import crypto from "crypto";
import db from "@/lib/db";
import { decrypt, encrypt } from "@/lib/encryption";
import { verifyApiUser } from "@/lib/subscription-helpers";
import { hasCompanyAdminRole, hasMasterRole, isCompanyAdmin, isMaster } from "@/lib/roles";

export const MASKED_SECRET = "••••••••";

export async function requirePaymentGatewayAdmin(request: Request) {
  const user = await verifyApiUser(request);
  const roles = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [
    user.userId,
  ])) as Array<{ role: string }>;

  const userRoles = roles.map(({ role }) => role);
  if (
    !hasMasterRole(userRoles) &&
    !isMaster(user.role) &&
    !hasCompanyAdminRole(userRoles) &&
    !isCompanyAdmin(user.role)
  ) {
    throw new Error("Forbidden: apenas administradores podem configurar meios de pagamento");
  }

  return user;
}

export async function ensurePaymentGatewaySettingsTable() {
  await db.query(`CREATE TABLE IF NOT EXISTS payment_gateway_settings (
    id CHAR(36) NOT NULL PRIMARY KEY,
    tenant_id VARCHAR(191) NOT NULL UNIQUE,
    provider VARCHAR(40) NOT NULL DEFAULT 'mercadopago',
    environment ENUM('sandbox', 'production') NOT NULL DEFAULT 'sandbox',
    checkout_mode ENUM('redirect', 'transparent') NOT NULL DEFAULT 'redirect',
    sandbox_public_key TEXT NULL,
    sandbox_client_id TEXT NULL,
    sandbox_access_token TEXT NULL,
    sandbox_client_secret TEXT NULL,
    production_public_key TEXT NULL,
    production_client_id TEXT NULL,
    production_access_token TEXT NULL,
    production_client_secret TEXT NULL,
    webhook_secret TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_payment_gateway_provider (provider)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

  // Migration helper: Ensure all expected columns exist if table was created in an older schema version
  try {
    const existingColumns = (await db.query(
      "SHOW COLUMNS FROM payment_gateway_settings"
    )) as Array<{ Field: string }>;

    const colSet = new Set(existingColumns.map((c) => String(c.Field).toLowerCase()));

    const alterQueries: string[] = [];
    if (!colSet.has("id")) {
      alterQueries.push("ADD COLUMN id CHAR(36) NULL");
    }
    if (!colSet.has("tenant_id")) {
      alterQueries.push("ADD COLUMN tenant_id VARCHAR(191) NOT NULL DEFAULT 'global'");
    }
    if (!colSet.has("provider")) {
      alterQueries.push("ADD COLUMN provider VARCHAR(40) NOT NULL DEFAULT 'mercadopago'");
    }
    if (!colSet.has("environment")) {
      alterQueries.push("ADD COLUMN environment ENUM('sandbox', 'production') NOT NULL DEFAULT 'sandbox'");
    }
    if (!colSet.has("checkout_mode")) {
      alterQueries.push("ADD COLUMN checkout_mode ENUM('redirect', 'transparent') NOT NULL DEFAULT 'redirect'");
    }
    if (!colSet.has("sandbox_public_key")) {
      alterQueries.push("ADD COLUMN sandbox_public_key TEXT NULL");
    }
    if (!colSet.has("sandbox_client_id")) {
      alterQueries.push("ADD COLUMN sandbox_client_id TEXT NULL");
    }
    if (!colSet.has("sandbox_access_token")) {
      alterQueries.push("ADD COLUMN sandbox_access_token TEXT NULL");
    }
    if (!colSet.has("sandbox_client_secret")) {
      alterQueries.push("ADD COLUMN sandbox_client_secret TEXT NULL");
    }
    if (!colSet.has("production_public_key")) {
      alterQueries.push("ADD COLUMN production_public_key TEXT NULL");
    }
    if (!colSet.has("production_client_id")) {
      alterQueries.push("ADD COLUMN production_client_id TEXT NULL");
    }
    if (!colSet.has("production_access_token")) {
      alterQueries.push("ADD COLUMN production_access_token TEXT NULL");
    }
    if (!colSet.has("production_client_secret")) {
      alterQueries.push("ADD COLUMN production_client_secret TEXT NULL");
    }
    if (!colSet.has("webhook_secret")) {
      alterQueries.push("ADD COLUMN webhook_secret TEXT NULL");
    }

    for (const alterStmt of alterQueries) {
      try {
        await db.query(`ALTER TABLE payment_gateway_settings ${alterStmt}`);
      } catch (alterErr) {
        // Ignora erros caso a coluna já exista
      }
    }
  } catch (err) {
    console.warn("[PaymentGateway] Column check/alter warning:", err);
  }
}

export async function getGlobalMercadoPagoRow(tenantId?: string) {
  await ensurePaymentGatewaySettingsTable();
  if (tenantId) {
    const rows = (await db.query(
      "SELECT * FROM payment_gateway_settings WHERE tenant_id = ? LIMIT 1",
      [tenantId]
    )) as any[];
    if (rows.length > 0) return rows[0];
  }
  const fallbackRows = (await db.query(
    "SELECT * FROM payment_gateway_settings LIMIT 1"
  )) as any[];
  return fallbackRows[0] ?? null;
}

export function encryptedValue(value: unknown, currentValue?: string | null) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (
    !normalized ||
    normalized === MASKED_SECRET ||
    /^[•\*\.\s]+$/.test(normalized)
  ) {
    return currentValue ?? null;
  }
  return encrypt(normalized);
}

export function decryptSecret(value?: string | null) {
  return value ? decrypt(value) : "";
}

export function gatewayId() {
  return crypto.randomUUID();
}
