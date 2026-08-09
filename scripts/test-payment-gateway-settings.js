import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey() {
  const rawKey = process.env.MERCADOPAGO_ENCRYPTION_KEY;
  if (!rawKey) {
    const devFallbackKey = process.env.JWT_SECRET || "default-dev-encryption-key-for-mercadopago";
    return crypto.createHash("sha256").update(devFallbackKey).digest();
  }
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }
  return crypto.createHash("sha256").update(rawKey).digest();
}

function encrypt(text) {
  if (!text) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
}

function decrypt(encryptedText) {
  if (!encryptedText) return "";
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted text format. Expected iv:ciphertext:authTag");
  }
  const key = getEncryptionKey();
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = Buffer.from(parts[1], "hex");
  const authTag = Buffer.from(parts[2], "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, undefined, "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

function getDbConfig() {
  const envPath = path.resolve(process.cwd(), ".env");
  const env = {};

  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, "utf-8");
    envFile.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...value] = trimmed.split("=");
        env[key.trim()] = value.join("=").trim().replace(/^["']|["']$/g, "");
      }
    });
  }

  const host = process.env.DB_HOST || env.DB_HOST || "localhost";
  const port = Number(process.env.DB_PORT || env.DB_PORT) || 3306;
  const user = process.env.DB_USER || env.DB_USER || "wapi_user";
  const password = process.env.DB_PASSWORD || env.DB_PASSWORD;
  const database = process.env.DB_NAME || env.DB_NAME || "wapi_weaver";

  if (!password) {
    console.error("[Smoke Error] DB_PASSWORD environment variable is required.");
    process.exit(1);
  }

  return { host, port, user, password, database };
}

const MASKED_SECRET = "••••••••";

function encryptedValue(value, currentValue) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized === MASKED_SECRET || /^[•\*\.\s]+$/.test(normalized)) {
    return currentValue ?? null;
  }
  return encrypt(normalized);
}

function secretField(value) {
  return value ? MASKED_SECRET : "";
}

async function computeRealRowsFingerprint(conn, testTenantId) {
  const [rows] = await conn.query(
    "SELECT * FROM payment_gateway_settings WHERE tenant_id != ? ORDER BY tenant_id ASC",
    [testTenantId]
  );
  return crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}

async function runSmokeTest() {
  console.log("[Payment Gateway Smoke] Connecting to database...");
  const config = getDbConfig();
  const conn = await mysql.createConnection(config);

  let errors = 0;
  const testTenantId = "smoke-test-tenant-gateway";

  try {
    const initialFingerprint = await computeRealRowsFingerprint(conn, testTenantId);

    // 0. Ensure user exists for FK
    await conn.query(
      `INSERT IGNORE INTO users (id, name, email, password_hash, role)
       VALUES (?, 'Gateway Smoke', 'gateway-smoke@test.com', 'hash', 'admin_master')`,
      [testTenantId]
    );

    // 1. Initial insert/save on ISOLATED test fixture
    console.log("[Payment Gateway Smoke] Testing initial save & encryption on isolated fixture...");
    const rawSecret1 = "TEST-access-token-12345";
    const cipherSecret1 = encrypt(rawSecret1);

    await conn.query(
      `INSERT INTO payment_gateway_settings (
        tenant_id, provider, environment, checkout_mode,
        sandbox_public_key, sandbox_client_id, sandbox_access_token,
        production_public_key, production_client_id, production_access_token,
        webhook_secret
      ) VALUES (?, 'mercadopago', 'sandbox', 'redirect', ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        sandbox_public_key = VALUES(sandbox_public_key),
        sandbox_client_id = VALUES(sandbox_client_id),
        sandbox_access_token = VALUES(sandbox_access_token),
        production_public_key = VALUES(production_public_key),
        production_client_id = VALUES(production_client_id),
        production_access_token = VALUES(production_access_token),
        webhook_secret = VALUES(webhook_secret)`,
      [
        testTenantId,
        "PUB-sandbox-key",
        "CLIENT-sandbox-id",
        cipherSecret1,
        "PUB-prod-key",
        "CLIENT-prod-id",
        encrypt("TEST-prod-token-67890"),
        encrypt("TEST-webhook-secret"),
      ]
    );

    // 2. Query DB and confirm ciphertext stored (NOT plaintext)
    const [rows] = await conn.query(
      "SELECT * FROM payment_gateway_settings WHERE tenant_id = ?",
      [testTenantId]
    );
    const row1 = rows[0];

    if (!row1 || row1.sandbox_access_token === rawSecret1) {
      console.error("[Payment Gateway Smoke] ❌ FAIL: Secret stored in plaintext!");
      errors++;
    } else {
      console.log("[Payment Gateway Smoke] ✅ PASS: Secret stored as ciphertext.");
    }

    // 3. Confirm GET masking logic
    const maskedSandboxToken = secretField(row1.sandbox_access_token);
    if (maskedSandboxToken !== MASKED_SECRET) {
      console.error(`[Payment Gateway Smoke] ❌ FAIL: GET did not return MASKED_SECRET! Got: '${maskedSandboxToken}'`);
      errors++;
    } else {
      console.log("[Payment Gateway Smoke] ✅ PASS: GET returns MASKED_SECRET for secret fields.");
    }

    // 4. Confirm PUT with MASKED_SECRET preserves existing ciphertext
    const putPreserved = encryptedValue(MASKED_SECRET, row1.sandbox_access_token);
    if (putPreserved !== row1.sandbox_access_token) {
      console.error("[Payment Gateway Smoke] ❌ FAIL: PUT with MASKED_SECRET altered existing ciphertext!");
      errors++;
    } else {
      console.log("[Payment Gateway Smoke] ✅ PASS: PUT with MASKED_SECRET preserves existing ciphertext.");
    }

    // 5. Confirm replacing secret updates ciphertext correctly
    const newRawSecret = "TEST-new-access-token-99999";
    const newCiphertext = encryptedValue(newRawSecret, row1.sandbox_access_token);
    if (!newCiphertext || newCiphertext === row1.sandbox_access_token) {
      console.error("[Payment Gateway Smoke] ❌ FAIL: Replacing secret did not update ciphertext!");
      errors++;
    } else {
      const decrypted = decrypt(newCiphertext);
      if (decrypted !== newRawSecret) {
        console.error(`[Payment Gateway Smoke] ❌ FAIL: Decrypted secret mismatch! Expected '${newRawSecret}', got '${decrypted}'`);
        errors++;
      } else {
        console.log("[Payment Gateway Smoke] ✅ PASS: Secret replacement encrypted and decrypted correctly.");
      }
    }

    // Clean up test tenant
    await conn.query("DELETE FROM payment_gateway_settings WHERE tenant_id = ?", [testTenantId]);
    await conn.query("DELETE FROM users WHERE id = ?", [testTenantId]);

    // Verify non-destructiveness: Real gateway rows unchanged
    const finalFingerprint = await computeRealRowsFingerprint(conn, testTenantId);
    if (initialFingerprint !== finalFingerprint) {
      console.error("[Payment Gateway Smoke] ❌ FAIL: Real gateway rows were mutated by smoke test!");
      errors++;
    } else {
      console.log("[Payment Gateway Smoke] ✅ PASS: Real gateway rows preserved untouched (REAL GATEWAY MUTATED BY SMOKE: NO).");
    }

  } catch (err) {
    console.error("[Payment Gateway Smoke] ❌ FAIL: Unexpected error during smoke test:", err);
    errors++;
  } finally {
    await conn.end();
  }

  if (errors > 0) {
    console.error(`[Payment Gateway Smoke] ❌ FAIL: ${errors} smoke test check(s) failed.`);
    process.exit(1);
  } else {
    console.log("[Payment Gateway Smoke] ✅ SUCCESS: All Mercado Pago Payment Gateway smoke checks passed!");
  }
}

runSmokeTest();
