import mysql from "mysql2/promise";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env if present
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
  console.log("    EXECUTING DATABASE CRUD SMOKE TEST           ");
  console.log("=================================================");

  const dbPassword = process.env.DB_PASSWORD;
  if (!dbPassword) {
    console.error("[Smoke Test] ❌ CRITICAL: DB_PASSWORD environment variable is missing!");
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
    console.log("[Smoke Test] Connected to MySQL database.");
  } catch (err) {
    console.error("[Smoke Test] ❌ FAIL: Could not connect to MySQL database:", err.message);
    process.exit(1);
  }

  const testContactId = crypto.randomUUID();
  const testPhone = "+5511999990000";
  const testNameInitial = "Smoke Test Temporary Contact";
  const testNameUpdated = "Smoke Test Updated Contact";

  try {
    // A. Verify admin user exists
    const adminEmail = (process.env.ADMIN_EMAIL || "adm@vw2digital.com.br").trim().toLowerCase();
    const [adminRows] = await connection.query(
      "SELECT id FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1",
      [adminEmail],
    );

    if (adminRows.length === 0) {
      console.error(`[Smoke Test] ❌ FAIL: Admin user '${adminEmail}' does not exist.`);
      process.exit(1);
    }
    const adminUserId = adminRows[0].id;
    console.log(`[Smoke Test] ✅ A. Verified admin user exists (ID: ${adminUserId}).`);

    // B. Create contact (INSERT)
    await connection.query(
      `INSERT INTO contacts (id, user_id, tenant_id, phone_e164, contact_number, name, email, company, position, status, source, channel)
       VALUES (?, ?, ?, ?, ?, ?, 'smoke@test.com', 'Test Co', 'Tester', 'lead', 'smoke_test', 'whatsapp')`,
      [testContactId, adminUserId, adminUserId, testPhone, testPhone, testNameInitial],
    );
    console.log(`[Smoke Test] ✅ B. Contact created (ID: ${testContactId}).`);

    // C. Read contact (SELECT)
    const [createdRows] = await connection.query(
      "SELECT id, name, phone_e164 FROM contacts WHERE id = ?",
      [testContactId],
    );
    if (createdRows.length === 0 || createdRows[0].name !== testNameInitial) {
      console.error("[Smoke Test] ❌ FAIL: Contact read failed or data mismatch.");
      process.exit(1);
    }
    console.log("[Smoke Test] ✅ C. Contact read and verified.");

    // D. Update contact (UPDATE)
    await connection.query("UPDATE contacts SET name = ? WHERE id = ?", [
      testNameUpdated,
      testContactId,
    ]);
    const [updatedRows] = await connection.query(
      "SELECT name FROM contacts WHERE id = ?",
      [testContactId],
    );
    if (updatedRows.length === 0 || updatedRows[0].name !== testNameUpdated) {
      console.error("[Smoke Test] ❌ FAIL: Contact update failed.");
      process.exit(1);
    }
    console.log("[Smoke Test] ✅ D. Contact updated and verified.");

    // E. Delete contact (DELETE)
    await connection.query("DELETE FROM contacts WHERE id = ?", [testContactId]);
    console.log("[Smoke Test] ✅ E. Contact deleted.");

    // F. Confirm contact deleted (SELECT empty)
    const [deletedRows] = await connection.query(
      "SELECT id FROM contacts WHERE id = ?",
      [testContactId],
    );
    if (deletedRows.length > 0) {
      console.error("[Smoke Test] ❌ FAIL: Contact still exists after deletion.");
      process.exit(1);
    }
    console.log("[Smoke Test] ✅ F. Confirmed contact successfully removed.");

    console.log("=================================================");
    console.log("  DATABASE CRUD SMOKE TEST PASSED                ");
    console.log("=================================================");
    process.exit(0);
  } catch (err) {
    console.error("[Smoke Test] ❌ FAIL: CRUD Smoke Test failed:", err.message);

    // Cleanup attempt on failure
    try {
      await connection.query("DELETE FROM contacts WHERE id = ?", [testContactId]);
    } catch (_) {}

    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

main();
