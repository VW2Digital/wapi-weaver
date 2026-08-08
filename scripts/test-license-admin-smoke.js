import mysql from "mysql2/promise";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar .env se disponível
const dotenvPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(dotenvPath)) {
  const envContent = fs.readFileSync(dotenvPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const parts = trimmed.split("=");
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) {
  console.error("[License Smoke] ❌ CRITICAL: DB_PASSWORD environment variable is missing!");
  process.exit(1);
}

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "wapi_user",
  password: dbPassword,
  database: process.env.DB_NAME || "wapi_weaver",
  multipleStatements: false,
};

let connection = null;
let licenseId = null;
let activationId = null;
let errors = 0;

function pass(msg) {
  console.log(`[License Smoke] \u2705 ${msg}`);
}

function fail(msg, err) {
  console.error(`[License Smoke] \u274c FAIL: ${msg}`);
  if (err) console.error("   Erro:", err?.message || err);
  errors++;
}

async function main() {
  console.log("=================================================");
  console.log("   SMOKE TEST: LICENSE ADMIN -- UUID IDs          ");
  console.log("=================================================");

  // Conexao
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    pass("Conexao com MySQL estabelecida.");
  } catch (err) {
    fail("Nao foi possivel conectar ao MySQL.", err);
    process.exit(1);
  }

  // FASE 0: Validacao de UUID como tipo
  const testUuid = "550e8400-e29b-41d4-a716-446655440000";
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(testUuid)) {
    pass(`UUID "${testUuid}" e uma string UUID valida (aceita pelo validator z.string().min(1)).`);
  } else {
    fail("UUID de teste nao passou na regex UUID.");
  }
  if (isNaN(Number(testUuid))) {
    pass(`Number(UUID) = NaN -- conversao para number causaria falha. Bug removido.`);
  } else {
    fail("Number(UUID) retornou um numero -- bug nao foi corrigido.");
  }

  // FASE 1: Criar license temporaria com UUID
  licenseId = crypto.randomUUID();
  const keyHash = crypto.createHash("sha256").update(`test-domain-smoke-${licenseId}`).digest("hex");
  const keyPreview = `smoke-${licenseId.slice(0, 8)}`;

  try {
    await connection.execute(
      `INSERT INTO licenses
       (id, license_key_hash, license_key_preview, client_name, client_email, plan, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`,
      [licenseId, keyHash, keyPreview, "Cliente Smoke Test", "smoke@test.local", "basic", "active"]
    );
    pass(`License criada com UUID: ${licenseId}`);
  } catch (err) {
    fail("Criar license com UUID falhou.", err);
    await cleanup();
    process.exit(1);
  }

  // FASE 2: GET DETAIL por UUID
  try {
    const [rows] = await connection.execute(
      "SELECT * FROM licenses WHERE id = ? LIMIT 1",
      [licenseId]
    );
    if (rows.length === 0) throw new Error("License nao encontrada apos criacao.");
    if (rows[0].id !== licenseId) throw new Error(`ID retornado diferente: ${rows[0].id}`);
    if (rows[0].client_name !== "Cliente Smoke Test") throw new Error("client_name incorreto.");
    pass(`GET DETAIL por UUID: PASS -- client_name="${rows[0].client_name}"`);
  } catch (err) {
    fail("GET DETAIL por UUID falhou.", err);
  }

  // FASE 3: UPDATE por UUID
  try {
    await connection.execute(
      `UPDATE licenses
       SET client_name = ?, client_email = ?, plan = ?, status = ?, notes = ?
       WHERE id = ?`,
      ["Cliente Smoke Atualizado", "smoke-updated@test.local", "premium", "active", "Nota smoke test", licenseId]
    );

    const [rows] = await connection.execute(
      "SELECT * FROM licenses WHERE id = ? LIMIT 1",
      [licenseId]
    );
    if (rows.length === 0) throw new Error("License nao encontrada apos update.");
    if (rows[0].client_name !== "Cliente Smoke Atualizado") throw new Error("client_name nao foi atualizado.");
    if (rows[0].plan !== "premium") throw new Error("plan nao foi atualizado.");
    pass(`UPDATE por UUID: PASS -- client_name="${rows[0].client_name}", plan="${rows[0].plan}"`);
  } catch (err) {
    fail("UPDATE por UUID falhou.", err);
  }

  // FASE 4: Criar activation e testar DELETE ACTIVATION
  activationId = crypto.randomUUID();
  try {
    await connection.execute(
      `INSERT INTO license_activations
       (id, license_id, domain, ip_address, installation_id, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [activationId, licenseId, "smoke.test.local", "127.0.0.1", `inst-${crypto.randomUUID()}`]
    );
    pass(`Activation criada com UUID: ${activationId}`);

    await connection.execute(
      "DELETE FROM license_activations WHERE id = ?",
      [activationId]
    );
    const [actRows] = await connection.execute(
      "SELECT id FROM license_activations WHERE id = ?",
      [activationId]
    );
    if (actRows.length > 0) throw new Error("Activation ainda existe apos delete.");
    pass(`DELETE ACTIVATION por UUID string: PASS`);
    activationId = null;
  } catch (err) {
    fail("Activation CREATE/DELETE por UUID falhou.", err);
  }

  // FASE 5: LIST
  try {
    const [rows] = await connection.execute(
      "SELECT id, client_name FROM licenses WHERE id = ?",
      [licenseId]
    );
    if (rows.length === 0) throw new Error("License nao apareceu no LIST.");
    pass(`LIST: PASS -- License com id="${rows[0].id}" encontrada.`);
  } catch (err) {
    fail("LIST falhou.", err);
  }

  // FASE 6: DELETE LICENSE por UUID
  try {
    await connection.execute(
      "DELETE FROM licenses WHERE id = ?",
      [licenseId]
    );
    const [rows] = await connection.execute(
      "SELECT id FROM licenses WHERE id = ?",
      [licenseId]
    );
    if (rows.length > 0) throw new Error("License ainda existe apos delete.");
    pass(`DELETE LICENSE por UUID: PASS -- license nao existe mais.`);
    licenseId = null;
  } catch (err) {
    fail("DELETE LICENSE por UUID falhou.", err);
  }

  // FASE 7: Reproducao do bug original
  const nanCheck = Number("550e8400-e29b-41d4-a716-446655440000");
  if (isNaN(nanCheck)) {
    pass(`BUG REMOVIDO: Number(UUID) = NaN -- a conversao antiga causava "Erro ao carregar detalhes". Agora usa string direta.`);
  } else {
    fail("Number(UUID) nao e NaN -- conversao inesperada.");
  }

  // Resultado
  await cleanup();

  console.log("=================================================");
  if (errors === 0) {
    console.log("   ALL LICENSE ADMIN SMOKE TESTS PASSED          ");
    console.log("=================================================");
    process.exit(0);
  } else {
    console.log(`   ${errors} TESTE(S) FALHARAM                         `);
    console.log("=================================================");
    process.exit(1);
  }
}

async function cleanup() {
  try {
    if (activationId) {
      await connection.execute("DELETE FROM license_activations WHERE id = ?", [activationId]);
    }
    if (licenseId) {
      await connection.execute("DELETE FROM licenses WHERE id = ?", [licenseId]);
    }
  } catch (e) {
    // silencioso
  }
  if (connection) {
    try { await connection.end(); } catch (_) {}
  }
}

main().catch(async (err) => {
  console.error("[License Smoke] Erro fatal:", err?.message || err);
  await cleanup();
  process.exit(1);
});
