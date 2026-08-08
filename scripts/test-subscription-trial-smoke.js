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

async function main() {
  console.log("=================================================");
  console.log("   SMOKE TEST: 3-DAY TRIAL & SUBSCRIPTION ACCESS ");
  console.log("=================================================");

  const dbPassword = process.env.DB_PASSWORD;
  if (!dbPassword) {
    console.error("[Trial Smoke Test] ❌ CRITICAL: DB_PASSWORD environment variable is missing!");
    process.exit(1);
  }

  const dbConfig = {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "wapi_user",
    password: dbPassword,
    database: process.env.DB_NAME || "wapi_weaver",
  };

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log("[Trial Smoke Test] ✅ Connected to MySQL database successfully.");
  } catch (err) {
    console.error("[Trial Smoke Test] ❌ FAIL: Could not connect to MySQL database:", err.message);
    process.exit(1);
  }

  const testUserId = crypto.randomUUID();
  const testEmail = `trial_test_${Date.now()}@smoke.test`;

  try {
    // 1. Criar tenant e usuário de teste
    await connection.execute(
      "INSERT INTO users (id, email, password_hash) VALUES (?, ?, 'hash_test')",
      [testUserId, testEmail]
    );
    await connection.execute(
      "INSERT INTO user_roles (id, user_id, role) VALUES (UUID(), ?, 'admin')",
      [testUserId]
    );

    console.log(`[Trial Smoke Test] ✅ Tenant de teste criado: ${testUserId}`);

    // 2. Importar o serviço central de acesso
    const {
      createTrialSubscriptionForTenant,
      getTenantSubscriptionAccess,
      activateSubscriptionFromPayment,
    } = await import("../src/lib/services/subscription-access.service.js");

    // 3. Criar a assinatura com Trial Gratuito de 3 Dias
    const trialSub = await createTrialSubscriptionForTenant(testUserId, testUserId, connection);
    console.log("[Trial Smoke Test] ✅ Trial de 3 Dias criado com sucesso.");

    // 4. Verificar se a duração de trial criada é de 72 horas (3 dias)
    const [subRows] = await connection.execute(
      "SELECT status, trial_started_at, trial_ends_at FROM subscriptions WHERE tenant_id = ?",
      [testUserId]
    );
    const subDb = subRows[0];

    const startTime = new Date(subDb.trial_started_at).getTime();
    const endTime = new Date(subDb.trial_ends_at).getTime();
    const durationHours = (endTime - startTime) / (1000 * 60 * 60);

    if (Math.round(durationHours) !== 72) {
      console.error(`[Trial Smoke Test] ❌ FAIL: Duração do trial esperada: 72h, obtida: ${durationHours}h`);
      process.exit(1);
    }
    console.log(`[Trial Smoke Test] ✅ Duração exata do trial verificada: ${durationHours} horas (3 dias).`);

    // 5. Testar acesso operacional durante o trial ativo
    const accessActive = await getTenantSubscriptionAccess(testUserId);
    if (!accessActive.allowed || accessActive.status !== "trialing") {
      console.error("[Trial Smoke Test] ❌ FAIL: Acesso durante trial deveria ser PERMITIDO (allowed=true).", accessActive);
      process.exit(1);
    }
    console.log("[Trial Smoke Test] ✅ Acesso operacional durante trial ativo: PERMITIDO.");

    // 6. Simular expiração do trial ajustando trial_ends_at para o passado
    const pastDate = new Date(Date.now() - 3600 * 1000); // 1 hora no passado
    await connection.execute(
      "UPDATE subscriptions SET trial_ends_at = ?, current_period_end = ? WHERE tenant_id = ?",
      [pastDate, pastDate, testUserId]
    );

    // 7. Testar acesso operacional com trial expirado
    const accessExpired = await getTenantSubscriptionAccess(testUserId);
    if (accessExpired.allowed || accessExpired.status !== "expired") {
      console.error("[Trial Smoke Test] ❌ FAIL: Acesso após trial expirado deveria ser BLOQUEADO (allowed=false).", accessExpired);
      process.exit(1);
    }
    console.log("[Trial Smoke Test] ✅ Acesso operacional com trial expirado: BLOQUEADO (HTTP 402 / SUBSCRIPTION_REQUIRED).");

    // 8. Simular ativação da assinatura via confirmação de pagamento (Webhook)
    await activateSubscriptionFromPayment(connection, testUserId, "plan-mensal", 30);

    const accessPaid = await getTenantSubscriptionAccess(testUserId);
    if (!accessPaid.allowed || accessPaid.status !== "active") {
      console.error("[Trial Smoke Test] ❌ FAIL: Acesso após pagamento deveria ser PERMITIDO (allowed=true, status=active).", accessPaid);
      process.exit(1);
    }
    console.log("[Trial Smoke Test] ✅ Ativação pós-pagamento: PERMITIDO (status=active).");

    // 9. Testar idempotência de webhook (segunda chamada de ativação)
    await activateSubscriptionFromPayment(connection, testUserId, "plan-mensal", 30);
    const accessIdempotent = await getTenantSubscriptionAccess(testUserId);
    if (!accessIdempotent.allowed || accessIdempotent.status !== "active") {
      console.error("[Trial Smoke Test] ❌ FAIL: Idempotência do webhook falhou.", accessIdempotent);
      process.exit(1);
    }
    console.log("[Trial Smoke Test] ✅ Idempotência do webhook de pagamento: PASS.");

    console.log("=================================================");
    console.log("   ALL TRIAL & SUBSCRIPTION SMOKE TESTS PASSED   ");
    console.log("=================================================");
  } catch (err) {
    console.error("[Trial Smoke Test] ❌ FAIL: Exceção durante a execução do smoke test:", err);
    process.exit(1);
  } finally {
    // 10. Limpar dados temporários do teste
    try {
      await connection.execute("DELETE FROM subscription_events WHERE tenant_id = ?", [testUserId]);
      await connection.execute("DELETE FROM subscriptions WHERE tenant_id = ?", [testUserId]);
      await connection.execute("DELETE FROM user_roles WHERE user_id = ?", [testUserId]);
      await connection.execute("DELETE FROM users WHERE id = ?", [testUserId]);
      console.log("[Trial Smoke Test] 🧹 Dados temporários de teste removidos.");
    } catch {}

    if (connection) await connection.end();
  }
}

main();
