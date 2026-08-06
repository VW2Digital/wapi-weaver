import fs from "node:fs/promises";
import crypto from "node:crypto";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { execFileSync } from "node:child_process";
import { toJSONAsync } from "seroval";

const stateFile = ".tenant-isolation-proof.json";
const marker = `codex-tenant-proof-${Date.now()}`;
const connectionOptions = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "wapi_user",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "wapi_weaver",
};
const jwtSecret =
  process.env.JWT_SECRET ||
  "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

function id() {
  return crypto.randomUUID();
}

function token(userId, role) {
  return jwt.sign({ sub: userId, role, email: `${userId}@proof.invalid` }, jwtSecret, {
    expiresIn: "30m",
  });
}

async function setup() {
  const db = await mysql.createConnection(connectionOptions);
  const passwordHash = await bcrypt.hash(crypto.randomBytes(18).toString("hex"), 10);
  const state = {
    marker,
    ownerA: { id: id(), email: `${marker}-owner-a@example.invalid`, role: "owner" },
    memberA: { id: id(), email: `${marker}-member-a@example.invalid`, role: "user" },
    ownerB: { id: id(), email: `${marker}-owner-b@example.invalid`, role: "owner" },
    memberB: { id: id(), email: `${marker}-member-b@example.invalid`, role: "user" },
    disposableB: { id: id(), email: `${marker}-disposable-b@example.invalid`, role: "user" },
    teamA: { id: id(), name: `${marker}-team-a` },
    teamB: { id: id(), name: `${marker}-team-b` },
  };
  try {
    await db.beginTransaction();
    for (const user of [
      state.ownerA,
      state.memberA,
      state.ownerB,
      state.memberB,
      state.disposableB,
    ]) {
      await db.execute("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
        user.id,
        user.email,
        passwordHash,
      ]);
      await db.execute(
        "INSERT INTO profiles (id, email, display_name, full_name) VALUES (?, ?, ?, ?)",
        [user.id, user.email, `${user.role}-${user.id.slice(0, 6)}`, `Proof ${user.email}`],
      );
      await db.execute("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)", [
        id(),
        user.id,
        user.role,
      ]);
    }
    await db.execute("INSERT INTO teams (id, user_id, name) VALUES (?, ?, ?)", [
      state.teamA.id,
      state.ownerA.id,
      state.teamA.name,
    ]);
    await db.execute("INSERT INTO teams (id, user_id, name) VALUES (?, ?, ?)", [
      state.teamB.id,
      state.ownerB.id,
      state.teamB.name,
    ]);
    await db.execute(
      "INSERT INTO team_members (id, team_id, user_id, role) VALUES (?, ?, ?, 'agent')",
      [id(), state.teamA.id, state.memberA.id],
    );
    for (const user of [state.memberB, state.disposableB]) {
      await db.execute(
        "INSERT INTO team_members (id, team_id, user_id, role) VALUES (?, ?, ?, 'agent')",
        [id(), state.teamB.id, user.id],
      );
    }
    const [masters] = await db.execute(
      "SELECT u.id, u.email FROM users u JOIN user_roles ur ON ur.user_id = u.id WHERE ur.role = 'adminmaster' LIMIT 1",
    );
    if (!masters[0]) throw new Error("Nenhum adminmaster existente para a prova");
    state.master = { ...masters[0], role: "adminmaster" };
    state.tokens = {
      ownerA: token(state.ownerA.id, "owner"),
      ownerB: token(state.ownerB.id, "owner"),
      master: token(state.master.id, "adminmaster"),
    };
    await db.commit();
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
    console.log(JSON.stringify(state, null, 2));
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
}

async function cleanup() {
  const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
  const db = await mysql.createConnection(connectionOptions);
  const ids = [
    state.ownerA.id,
    state.memberA.id,
    state.ownerB.id,
    state.memberB.id,
    state.disposableB.id,
  ];
  try {
    await db.beginTransaction();
    await db.query("DELETE FROM team_members WHERE team_id IN (?, ?) OR user_id IN (?)", [
      state.teamA.id,
      state.teamB.id,
      ids,
    ]);
    await db.query("DELETE FROM teams WHERE id IN (?, ?)", [state.teamA.id, state.teamB.id]);
    await db.query("DELETE FROM user_roles WHERE user_id IN (?)", [ids]);
    await db.query("DELETE FROM profiles WHERE id IN (?)", [ids]);
    await db.query("DELETE FROM users WHERE id IN (?)", [ids]);
    await db.commit();
    console.log(`CLEANUP_OK ${state.marker}`);
    await fs.unlink(stateFile);
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    await db.end();
  }
}

const serverFnIds = {
  listUsers:
    "eyJmaWxlIjoiL3NyYy9saWIvdXNlcnMtYWRtaW4uZnVuY3Rpb25zLnRzP3Rzcy1zZXJ2ZXJmbi1zcGxpdCIsImV4cG9ydCI6Imxpc3RVc2Vyc19jcmVhdGVTZXJ2ZXJGbl9oYW5kbGVyIn0",
  setUserRole:
    "eyJmaWxlIjoiL3NyYy9saWIvdXNlcnMtYWRtaW4uZnVuY3Rpb25zLnRzP3Rzcy1zZXJ2ZXJmbi1zcGxpdCIsImV4cG9ydCI6InNldFVzZXJSb2xlX2NyZWF0ZVNlcnZlckZuX2hhbmRsZXIifQ",
  deleteUser:
    "eyJmaWxlIjoiL3NyYy9saWIvdXNlcnMtYWRtaW4uZnVuY3Rpb25zLnRzP3Rzcy1zZXJ2ZXJmbi1zcGxpdCIsImV4cG9ydCI6ImRlbGV0ZVVzZXJfY3JlYXRlU2VydmVyRm5faGFuZGxlciJ9",
  updateUserProfile:
    "eyJmaWxlIjoiL3NyYy9saWIvdXNlcnMtYWRtaW4uZnVuY3Rpb25zLnRzP3Rzcy1zZXJ2ZXJmbi1zcGxpdCIsImV4cG9ydCI6InVwZGF0ZVVzZXJQcm9maWxlX2NyZWF0ZVNlcnZlckZuX2hhbmRsZXIifQ",
  getUserActivity:
    "eyJmaWxlIjoiL3NyYy9saWIvdXNlcnMtYWRtaW4uZnVuY3Rpb25zLnRzP3Rzcy1zZXJ2ZXJmbi1zcGxpdCIsImV4cG9ydCI6ImdldFVzZXJBY3Rpdml0eV9jcmVhdGVTZXJ2ZXJGbl9oYW5kbGVyIn0",
  addTeamMember:
    "eyJmaWxlIjoiL3NyYy9saWIvYXNzaWdubWVudC5mdW5jdGlvbnMudHM_dHNzLXNlcnZlcmZuLXNwbGl0IiwiZXhwb3J0IjoiYWRkVGVhbU1lbWJlcl9jcmVhdGVTZXJ2ZXJGbl9oYW5kbGVyIn0",
};

for (const [name, file] of [
  ["listBotSteps", "botflow.functions.ts"],
  ["deleteBotFlow", "botflow.functions.ts"],
  ["saveBotStepsBatch", "botflow.functions.ts"],
  ["saveBotStep", "botflow.functions.ts"],
  ["deleteBotStep", "botflow.functions.ts"],
  ["markOpportunityLost", "crm.functions.ts"],
]) {
  serverFnIds[name] = Buffer.from(
    JSON.stringify({
      file: `/src/lib/${file}?tss-serverfn-split`,
      export: `${name}_createServerFn_handler`,
    }),
  ).toString("base64url");
}

async function refreshServerFnIds() {
  for (const file of [
    "users-admin.functions.ts",
    "assignment.functions.ts",
    "botflow.functions.ts",
    "crm.functions.ts",
  ]) {
    const source = await (await fetch(`http://127.0.0.1:8080/src/lib/${file}`)).text();
    for (const name of Object.keys(serverFnIds)) {
      const start = source.indexOf(`export const ${name} =`);
      if (start < 0) continue;
      const match = source.slice(start, start + 1000).match(/createClientRpc\("([^"]+)"/);
      if (match) serverFnIds[name] = match[1];
    }
  }
}

function curl(label, args) {
  console.log(`\n===== ${label} =====`);
  console.log(
    `curl.exe ${args.map((value) => (value.startsWith("Authorization: Bearer ") ? '"Authorization: Bearer <redacted>"' : JSON.stringify(value))).join(" ")}`,
  );
  const output = execFileSync("curl.exe", ["-sS", "-i", ...args], { encoding: "utf8" });
  console.log(output.trim());
  return output;
}

async function serverFn(label, name, tokenValue, data) {
  const args = [
    "-H",
    `Authorization: Bearer ${tokenValue}`,
    "-H",
    "Origin: http://127.0.0.1:8080",
    "-H",
    "x-tsr-serverFn: true",
  ];
  const isGet = name === "listUsers" || name === "listBotSteps";
  if (isGet) {
    let url = `http://127.0.0.1:8080/_serverFn/${serverFnIds[name]}`;
    if (data !== undefined) {
      const payload = JSON.stringify(await toJSONAsync({ data }));
      url += `?payload=${encodeURIComponent(payload)}`;
    }
    args.push(url);
  } else {
    const payload = JSON.stringify(await toJSONAsync({ data }));
    args.push(
      "-X",
      "POST",
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      payload,
      `http://127.0.0.1:8080/_serverFn/${serverFnIds[name]}`,
    );
  }
  return curl(label, args);
}

async function runResources() {
  await refreshServerFnIds();
  const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
  const db = await mysql.createConnection(connectionOptions);
  const resources = {
    flowB: id(),
    settingsB: id(),
    stepB: id(),
    reasonB: id(),
  };
  const [existingSettingsA] = await db.execute("SELECT id FROM bot_settings WHERE user_id = ?", [
    state.ownerA.id,
  ]);
  try {
    await db.execute("INSERT INTO bot_flows (id, tenant_id, name) VALUES (?, ?, ?)", [
      resources.flowB,
      state.ownerB.id,
      `${state.marker}-flow-b`,
    ]);
    await db.execute("INSERT INTO bot_settings (id, user_id, name) VALUES (?, ?, ?)", [
      resources.settingsB,
      state.ownerB.id,
      `${state.marker}-settings-b`,
    ]);
    await db.execute(
      "INSERT INTO bot_steps (id, user_id, bot_settings_id, flow_id, step_order, trigger_type) VALUES (?, ?, ?, ?, 1, 'keyword')",
      [resources.stepB, state.ownerB.id, resources.settingsB, resources.flowB],
    );
    await db.execute("INSERT INTO opportunity_lost_reasons (id, user_id, name) VALUES (?, ?, ?)", [
      resources.reasonB,
      state.ownerB.id,
      `${state.marker}-reason-b`,
    ]);

    for (const [label, name, data] of [
      ["bot1. listBotSteps A tenta ler flow B", "listBotSteps", { flowId: resources.flowB }],
      ["bot2. deleteBotFlow A tenta excluir flow B", "deleteBotFlow", { id: resources.flowB }],
      [
        "bot3. saveBotStepsBatch A tenta salvar flow B",
        "saveBotStepsBatch",
        { flowId: resources.flowB, steps: [] },
      ],
      [
        "bot4. saveBotStep A referencia equipe B",
        "saveBotStep",
        { step_order: 1, trigger_type: "keyword", assign_team_id: state.teamB.id },
      ],
      ["bot5. deleteBotStep A tenta excluir step B", "deleteBotStep", { id: resources.stepB }],
      [
        "crm1. markOpportunityLost A usa motivo B",
        "markOpportunityLost",
        { id: id(), lost_reason_id: resources.reasonB },
      ],
    ]) {
      const output = await serverFn(label, name, state.tokens.ownerA, data);
      expectStatus(output, [403, 404], label);
    }
    const [rows] = await db.execute(
      "SELECT (SELECT COUNT(*) FROM bot_flows WHERE id=?) AS flow_exists, (SELECT COUNT(*) FROM bot_steps WHERE id=?) AS step_exists, (SELECT COUNT(*) FROM opportunity_lost_reasons WHERE id=?) AS reason_exists",
      [resources.flowB, resources.stepB, resources.reasonB],
    );
    console.log("\nDB_AFTER_BLOCKED_RESOURCE_OPS", rows);
    if (
      !rows[0] ||
      Number(rows[0].flow_exists) !== 1 ||
      Number(rows[0].step_exists) !== 1 ||
      Number(rows[0].reason_exists) !== 1
    )
      throw new Error("Uma operação cross-tenant alterou recursos do tenant B");
    console.log("\nRESOURCE_PROOF_RESULT=PASS");
  } finally {
    await db.execute("DELETE FROM bot_steps WHERE id = ?", [resources.stepB]);
    await db.execute("DELETE FROM bot_flows WHERE id = ?", [resources.flowB]);
    await db.execute("DELETE FROM bot_settings WHERE id = ?", [resources.settingsB]);
    await db.execute("DELETE FROM opportunity_lost_reasons WHERE id = ?", [resources.reasonB]);
    if (existingSettingsA.length === 0)
      await db.execute("DELETE FROM bot_settings WHERE user_id = ?", [state.ownerA.id]);
    await db.end();
  }
}

function expectStatus(output, statuses, label) {
  const match = output.match(/^HTTP\/\S+\s+(\d+)/m);
  const status = Number(match?.[1]);
  if (!statuses.includes(status))
    throw new Error(`${label}: status ${status}, esperado ${statuses}`);
}

async function run() {
  await refreshServerFnIds();
  const state = JSON.parse(await fs.readFile(stateFile, "utf8"));
  const db = await mysql.createConnection(connectionOptions);
  try {
    const listA = await serverFn("a. owner A lista usuários", "listUsers", state.tokens.ownerA);
    expectStatus(listA, [200], "listUsers A");
    if (!listA.includes(state.ownerA.email) || !listA.includes(state.memberA.email))
      throw new Error("listUsers A não retornou os dois usuários do tenant A");
    if (listA.includes(state.ownerB.email) || listA.includes(state.memberB.email))
      throw new Error("listUsers A vazou usuário do tenant B");

    for (const [label, name, data] of [
      [
        "b1. owner A tenta alterar role de B",
        "setUserRole",
        { user_id: state.memberB.id, role: "member", grant: true },
      ],
      [
        "b2. owner A tenta alterar perfil de B",
        "updateUserProfile",
        {
          user_id: state.memberB.id,
          display_name: "CROSS_TENANT_SHOULD_NOT_APPLY",
          full_name: "Blocked",
        },
      ],
      [
        "b3. owner A tenta consultar atividade de B",
        "getUserActivity",
        { user_id: state.memberB.id },
      ],
      ["b4. owner A tenta excluir B", "deleteUser", { user_id: state.memberB.id }],
    ]) {
      const output = await serverFn(label, name, state.tokens.ownerA, data);
      expectStatus(output, [403, 404], label);
    }
    const [unchanged] = await db.execute(
      "SELECT u.id, p.display_name, SUM(ur.role = 'member') AS member_grants FROM users u JOIN profiles p ON p.id=u.id LEFT JOIN user_roles ur ON ur.user_id=u.id WHERE u.id=? GROUP BY u.id,p.display_name",
      [state.memberB.id],
    );
    console.log("\nDB_AFTER_BLOCKED_USER_OPS", unchanged);
    if (
      !unchanged[0] ||
      unchanged[0].display_name === "CROSS_TENANT_SHOULD_NOT_APPLY" ||
      Number(unchanged[0].member_grants) !== 0
    )
      throw new Error("Uma operação cross-tenant alterou o usuário B");

    const addCross = await serverFn(
      "c/f. owner A tenta adicionar membro B à equipe A",
      "addTeamMember",
      state.tokens.ownerA,
      {
        teamId: state.teamA.id,
        userId: state.memberB.id,
        role: "agent",
      },
    );
    expectStatus(addCross, [403, 404], "addTeamMember cross-tenant");
    const [crossMembership] = await db.execute(
      "SELECT COUNT(*) AS total FROM team_members WHERE team_id=? AND user_id=?",
      [state.teamA.id, state.memberB.id],
    );
    console.log("DB_CROSS_MEMBERSHIP", crossMembership);
    if (Number(crossMembership[0].total) !== 0)
      throw new Error("Membro B foi inserido na equipe A");

    const uploadB = curl("e1. owner B faz upload", [
      "-X",
      "POST",
      "-H",
      `Authorization: Bearer ${state.tokens.ownerB}`,
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      JSON.stringify({
        path: "proof/tenant-b.pdf",
        fileData: Buffer.from("TENANT_B_SECRET").toString("base64"),
      }),
      "http://127.0.0.1:8080/api/storage/upload",
    ]);
    expectStatus(uploadB, [200], "upload B");
    const storedPath = `${state.ownerB.id}/proof/tenant-b.pdf`;
    if (!uploadB.includes(storedPath)) throw new Error("Upload não vinculou path ao tenant B");

    const fileA = curl("e2. owner A tenta acessar arquivo B", [
      "-H",
      `Authorization: Bearer ${state.tokens.ownerA}`,
      `http://127.0.0.1:8080/api/storage/file?path=${encodeURIComponent(storedPath)}`,
    ]);
    expectStatus(fileA, [403, 404], "file cross-tenant");
    const removeA = curl("e3. owner A tenta apagar arquivo B", [
      "-X",
      "POST",
      "-H",
      `Authorization: Bearer ${state.tokens.ownerA}`,
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      JSON.stringify({ paths: [storedPath] }),
      "http://127.0.0.1:8080/api/storage/remove",
    ]);
    expectStatus(removeA, [403, 404], "remove cross-tenant");
    const fileB = curl("e4. owner B ainda acessa seu arquivo", [
      "-H",
      `Authorization: Bearer ${state.tokens.ownerB}`,
      `http://127.0.0.1:8080/api/storage/file?path=${encodeURIComponent(storedPath)}`,
    ]);
    expectStatus(fileB, [200], "file B");
    if (!fileB.includes("TENANT_B_SECRET")) throw new Error("Arquivo B foi apagado ou alterado");

    for (const [label, name, data] of [
      [
        "d1. master altera role no tenant B",
        "setUserRole",
        { user_id: state.memberB.id, role: "member", grant: true },
      ],
      [
        "d2. master altera perfil no tenant B",
        "updateUserProfile",
        { user_id: state.memberB.id, display_name: "MASTER_ALLOWED", full_name: "Master proof" },
      ],
      [
        "d3. master consulta atividade no tenant B",
        "getUserActivity",
        { user_id: state.memberB.id },
      ],
      [
        "d4. master exclui usuário descartável do tenant B",
        "deleteUser",
        { user_id: state.disposableB.id },
      ],
    ]) {
      const output = await serverFn(label, name, state.tokens.master, data);
      expectStatus(output, [200], label);
    }
    const masterFile = curl("d5. master acessa arquivo do tenant B", [
      "-H",
      `Authorization: Bearer ${state.tokens.master}`,
      `http://127.0.0.1:8080/api/storage/file?path=${encodeURIComponent(storedPath)}`,
    ]);
    expectStatus(masterFile, [200], "master file B");

    const removeB = curl("limpeza. owner B remove seu arquivo", [
      "-X",
      "POST",
      "-H",
      `Authorization: Bearer ${state.tokens.ownerB}`,
      "-H",
      "Content-Type: application/json",
      "--data-binary",
      JSON.stringify({ paths: [storedPath] }),
      "http://127.0.0.1:8080/api/storage/remove",
    ]);
    expectStatus(removeB, [200], "cleanup storage B");
    console.log("\nPROOF_RESULT=PASS");
  } finally {
    await db.end();
  }
}

if (process.argv[2] === "setup") await setup();
else if (process.argv[2] === "cleanup") await cleanup();
else if (process.argv[2] === "run") await run();
else if (process.argv[2] === "resources") await runResources();
else throw new Error("Use setup, run, resources ou cleanup");
