import { randomUUID } from "crypto";
import crypto from "crypto";
import mysql from "mysql2/promise";

const DB = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || "3309"),
  user: process.env.DB_USER || "wapi_user",
  password: process.env.DB_PASSWORD || "S0xbxPfKazBVT8JFy1UEOjIsrjox",
  database: process.env.DB_NAME || "wapi_weaver",
};

const TEST_PROFILE_ID = "00000000-0000-0000-0000-000000000001";
const TEST_EMAIL = "webhook-test@localhost.invalid";
const TEST_PHONE_NUMBER_ID = "PHONE_ID";
const APP_SECRET = process.env.META_TEST_APP_SECRET || "local-test-secret";
const VERIFY_TOKEN = process.env.META_TEST_VERIFY_TOKEN || "local-test-verify-token";
const META_CONFIG_ID = process.env.META_TEST_CONFIG_ID || "local-test-config-id";

function getMetaKey() {
  const raw = process.env.META_CREDENTIALS_ENCRYPTION_KEY;
  if (!raw || raw.trim().length === 0) {
    throw new Error("FAIL_CLOSED: META_CREDENTIALS_ENCRYPTION_KEY is not configured.");
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  return crypto.createHash("sha256").update(raw).digest();
}

function encrypt(text) {
  const key = getMetaKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
}

const conn = await mysql.createConnection(DB);

const publicId = "00000000-0000-0000-0000-000000000001";

const encryptedSecret = encrypt(APP_SECRET);
const encryptedVerifyToken = encrypt(VERIFY_TOKEN);

try {
  await conn.execute(
    `INSERT INTO users (id, email, password_hash, created_at, updated_at)
     VALUES (?, ?, 'notused', NOW(), NOW())
     ON DUPLICATE KEY UPDATE updated_at = NOW()`,
    [TEST_PROFILE_ID, TEST_EMAIL],
  );

  await conn.execute(
    `INSERT INTO user_roles (id, user_id, role, created_at)
     VALUES (?, ?, 'admin_master', NOW())
     ON DUPLICATE KEY UPDATE role = VALUES(role)`,
    [randomUUID(), TEST_PROFILE_ID],
  );

  await conn.execute(
    `INSERT INTO meta_app_connections (
      id, public_id, tenant_id, created_by_user_id, app_name, app_id,
      app_secret_encrypted, meta_config_id, webhook_verify_token_encrypted,
      graph_version, status, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, 'Webhook Test App', 'local-test-app-id', ?, ?, ?, 'v26.0', 'active', NOW(), NOW()
    )
    ON DUPLICATE KEY UPDATE
      app_secret_encrypted = VALUES(app_secret_encrypted),
      webhook_verify_token_encrypted = VALUES(webhook_verify_token_encrypted),
      meta_config_id = VALUES(meta_config_id),
      updated_at = NOW()`,
    [randomUUID(), publicId, TEST_PROFILE_ID, TEST_PROFILE_ID, encryptedSecret, META_CONFIG_ID, encryptedVerifyToken],
  );

  console.log("[setup-webhook-test] OK");
  console.log(`  profile_id: ${TEST_PROFILE_ID}`);
  console.log(`  public_id: ${publicId}`);
  console.log(`  phone_number_id: ${TEST_PHONE_NUMBER_ID}`);
  console.log(`  app_secret_test: ${APP_SECRET}`);
  console.log(`  verify_token_test: ${VERIFY_TOKEN}`);
} catch (err) {
  console.error("[setup-webhook-test] Error:", err.message);
  process.exit(1);
} finally {
  await conn.end();
}
