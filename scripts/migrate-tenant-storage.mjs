import crypto from "node:crypto";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const mode = process.argv[2];
const uploadsRoot = path.resolve("public", "uploads");
const manifestPath = path.resolve("storage-tenant-migration-manifest.json");
const uuidPrefix =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?:\/|$)/i;

if (!["--dry-run", "--apply", "--rollback"].includes(mode)) {
  throw new Error("Use --dry-run, --apply ou --rollback");
}

const connectionOptions = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "wapi_user",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "wapi_weaver",
};

function normalizePath(value) {
  return String(value)
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\/?uploads\//, "")
    .replace(/^\/+/, "");
}

function replaceDeep(value, from, to) {
  if (typeof value === "string") return value.replaceAll(from, to);
  if (Array.isArray(value)) return value.map((item) => replaceDeep(item, from, to));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, replaceDeep(item, from, to)]),
    );
  }
  return value;
}

async function listFiles(directory, relative = "") {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relative, entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await listFiles(absolutePath, relativePath)));
    else if (entry.isFile()) {
      const stat = await fs.stat(absolutePath);
      result.push({ path: relativePath, absolutePath, bytes: stat.size });
    }
  }
  return result;
}

async function checksum(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(await fs.readFile(filePath));
  return hash.digest("hex");
}

async function tenantForProfile(db, profileId) {
  const [rows] = await db.execute(
    `SELECT DISTINCT tenant_id FROM (
       SELECT ur.user_id AS tenant_id
       FROM user_roles ur
       WHERE ur.user_id = ? AND ur.role IN ('owner', 'adminmaster')
       UNION
       SELECT t.user_id AS tenant_id
       FROM team_members tm
       JOIN teams t ON t.id = tm.team_id
       WHERE tm.user_id = ?
     ) tenant_memberships`,
    [profileId, profileId],
  );
  return rows.map((row) => row.tenant_id);
}

async function findReferences(db, legacyPath) {
  const candidates = [legacyPath, `/uploads/${legacyPath}`, `uploads/${legacyPath}`];
  const references = [];

  const [contacts] = await db.execute(
    "SELECT id, user_id, custom_fields FROM contacts WHERE CAST(custom_fields AS CHAR) LIKE ?",
    [`%${legacyPath}%`],
  );
  for (const row of contacts) {
    references.push({
      table: "contacts",
      column: "custom_fields",
      id: row.id,
      tenantIds: [row.user_id],
      oldValue: row.custom_fields,
      kind: "json",
    });
  }

  const [profiles] = await db.execute(
    "SELECT id, avatar_url FROM profiles WHERE avatar_url LIKE ?",
    [`%${legacyPath}%`],
  );
  for (const row of profiles) {
    references.push({
      table: "profiles",
      column: "avatar_url",
      id: row.id,
      tenantIds: await tenantForProfile(db, row.id),
      oldValue: row.avatar_url,
      kind: "string",
    });
  }

  const [steps] = await db.execute(
    "SELECT id, user_id, media_url FROM bot_steps WHERE media_url LIKE ?",
    [`%${legacyPath}%`],
  );
  for (const row of steps) {
    references.push({
      table: "bot_steps",
      column: "media_url",
      id: row.id,
      tenantIds: [row.user_id],
      oldValue: row.media_url,
      kind: "string",
    });
  }

  const [knowledgeFiles] = await db.execute(
    "SELECT id, tenant_id, storage_path FROM ds_agent_knowledge_files WHERE storage_path LIKE ?",
    [`%${legacyPath}%`],
  );
  for (const row of knowledgeFiles) {
    references.push({
      table: "ds_agent_knowledge_files",
      column: "storage_path",
      id: row.id,
      tenantIds: [row.tenant_id],
      oldValue: row.storage_path,
      kind: "string",
    });
  }

  for (const reference of references) {
    reference.matchedPath = candidates.find((candidate) =>
      JSON.stringify(reference.oldValue).includes(candidate),
    );
  }
  return references;
}

async function buildPlan(db) {
  const files = await listFiles(uploadsRoot);
  const legacyFiles = files.filter((file) => !uuidPrefix.test(file.path));
  const migrations = [];
  const orphans = [];
  const blocked = [];

  for (const file of legacyFiles) {
    const references = await findReferences(db, file.path);
    if (references.length === 0) {
      orphans.push({ path: file.path, bytes: file.bytes });
      continue;
    }

    const tenantIds = [
      ...new Set(references.flatMap((reference) => reference.tenantIds).filter(Boolean)),
    ];
    const unresolved = references.some((reference) => reference.tenantIds.length !== 1);
    if (unresolved || tenantIds.length !== 1) {
      blocked.push({
        path: file.path,
        reason: unresolved
          ? "tenant não inferível de forma única"
          : "referenciado por mais de um tenant",
        tenantIds,
        references,
      });
      continue;
    }

    const tenantId = tenantIds[0];
    const targetPath = `${tenantId}/${file.path}`;
    migrations.push({
      sourcePath: file.path,
      targetPath,
      bytes: file.bytes,
      sha256: await checksum(file.absolutePath),
      tenantId,
      references: references.map((reference) => ({
        ...reference,
        newValue: replaceDeep(reference.oldValue, reference.matchedPath, targetPath),
      })),
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    database: {
      host: connectionOptions.host,
      port: connectionOptions.port,
      database: connectionOptions.database,
    },
    uploadsRoot,
    totals: {
      files: files.length,
      bytes: files.reduce((sum, file) => sum + file.bytes, 0),
      legacyFiles: legacyFiles.length,
      legacyBytes: legacyFiles.reduce((sum, file) => sum + file.bytes, 0),
      migratableFiles: migrations.length,
      migratableBytes: migrations.reduce((sum, file) => sum + file.bytes, 0),
      orphanFiles: orphans.length,
      orphanBytes: orphans.reduce((sum, file) => sum + file.bytes, 0),
      blockedFiles: blocked.length,
    },
    migrations,
    orphans,
    blocked,
  };
}

async function updateReference(connection, reference, value) {
  const allowed = new Set([
    "contacts.custom_fields",
    "profiles.avatar_url",
    "bot_steps.media_url",
    "ds_agent_knowledge_files.storage_path",
  ]);
  if (!allowed.has(`${reference.table}.${reference.column}`))
    throw new Error("Referência não permitida");
  const serialized = reference.kind === "json" ? JSON.stringify(value) : value;
  await connection.execute(
    `UPDATE \`${reference.table}\` SET \`${reference.column}\` = ? WHERE id = ?`,
    [serialized, reference.id],
  );
}

async function applyPlan(db, plan) {
  if (plan.blocked.length > 0) throw new Error("Migração bloqueada: existem arquivos ambíguos");
  const copiedTargets = [];
  let manifestCreated = false;
  let committed = false;
  try {
    for (const migration of plan.migrations) {
      const source = path.resolve(uploadsRoot, migration.sourcePath);
      const target = path.resolve(uploadsRoot, migration.targetPath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(source, target, constants.COPYFILE_EXCL);
      copiedTargets.push(target);
      if ((await checksum(target)) !== migration.sha256)
        throw new Error(`Hash divergente: ${migration.targetPath}`);
    }

    await fs.writeFile(manifestPath, JSON.stringify({ ...plan, status: "prepared" }, null, 2), {
      flag: "wx",
    });
    manifestCreated = true;
    await db.beginTransaction();
    for (const migration of plan.migrations) {
      for (const reference of migration.references)
        await updateReference(db, reference, reference.newValue);
    }
    await db.commit();
    committed = true;
    await fs.writeFile(manifestPath, JSON.stringify({ ...plan, status: "applied" }, null, 2));
  } catch (error) {
    if (!committed) {
      try {
        await db.rollback();
      } catch {}
      for (const target of copiedTargets.reverse()) await fs.rm(target, { force: true });
      if (manifestCreated) await fs.rm(manifestPath, { force: true });
    }
    throw error;
  }
}

async function rollback(db) {
  const plan = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  await db.beginTransaction();
  try {
    for (const migration of plan.migrations) {
      for (const reference of migration.references)
        await updateReference(db, reference, reference.oldValue);
    }
    await db.commit();
    for (const migration of plan.migrations) {
      const target = path.resolve(uploadsRoot, migration.targetPath);
      if ((await checksum(target)) !== migration.sha256)
        throw new Error(`Target alterado: ${migration.targetPath}`);
      await fs.rm(target);
    }
    const archivedManifest = manifestPath.replace(
      /\.json$/,
      `.rolled-back-${new Date().toISOString().replaceAll(":", "-")}.json`,
    );
    await fs.writeFile(
      manifestPath,
      JSON.stringify(
        { ...plan, status: "rolled_back", rolledBackAt: new Date().toISOString() },
        null,
        2,
      ),
    );
    await fs.rename(manifestPath, archivedManifest);
    console.log(`ROLLBACK_MANIFEST=${archivedManifest}`);
  } catch (error) {
    try {
      await db.rollback();
    } catch {}
    throw error;
  }
}

const db = await mysql.createConnection(connectionOptions);
try {
  if (mode === "--rollback") {
    await rollback(db);
    console.log("ROLLBACK_RESULT=PASS");
  } else {
    const plan = await buildPlan(db);
    console.log(JSON.stringify(plan, null, 2));
    if (mode === "--apply") {
      await applyPlan(db, plan);
      console.log(`APPLY_RESULT=PASS manifest=${manifestPath}`);
    } else {
      console.log("DRY_RUN_RESULT=PASS nenhuma alteração executada");
    }
  }
} finally {
  await db.end();
}
