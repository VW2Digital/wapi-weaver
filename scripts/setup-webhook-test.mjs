import { randomUUID } from "crypto";
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
const APP_SECRET = process.env.META_APP_SECRET || "local-test-secret";

const conn = await mysql.createConnection(DB);

try {
  // 1. Upsert platform_settings
  await conn.execute(
    `INSERT INTO platform_settings (id, meta_app_secret, meta_graph_version, created_at, updated_at)
     VALUES (1, ?, 'v26.0', NOW(), NOW())
     ON DUPLICATE KEY UPDATE meta_app_secret = VALUES(meta_app_secret), updated_at = NOW()`,
    [APP_SECRET],
  );

  // 2. Ensure user exists
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

  // 3. Upsert profile
  await conn.execute(
    `INSERT INTO profiles (
      id, email, full_name, whatsapp_phone_number_id,
      whatsapp_app_secret, created_at, updated_at
    )
    VALUES (?, ?, 'Webhook Test', ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
      whatsapp_phone_number_id = VALUES(whatsapp_phone_number_id),
      whatsapp_app_secret = VALUES(whatsapp_app_secret),
      updated_at = NOW()`,
    [TEST_PROFILE_ID, TEST_EMAIL, TEST_PHONE_NUMBER_ID, APP_SECRET],
  );

  console.log("[setup-webhook-test] OK");
  console.log(`  profile_id: ${TEST_PROFILE_ID}`);
  console.log(`  phone_number_id: ${TEST_PHONE_NUMBER_ID}`);
  console.log(`  meta_app_secret: ${APP_SECRET}`);
} catch (err) {
  console.error("[setup-webhook-test] Error:", err.message);
  process.exit(1);
} finally {
  await conn.end();
}
