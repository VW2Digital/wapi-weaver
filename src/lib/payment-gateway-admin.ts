import crypto from "crypto";
import db from "@/lib/db";
import { decrypt, encrypt } from "@/lib/encryption";
import { verifyApiUser } from "@/lib/subscription-helpers";

export const MASKED_SECRET = "••••••••";

export async function requirePaymentGatewayAdmin(request: Request) {
  const user = await verifyApiUser(request);
  const roles = (await db.query(
    "SELECT role FROM user_roles WHERE user_id = ? AND role IN ('adminmaster', 'owner') LIMIT 1",
    [user.userId],
  )) as Array<{ role: string }>;

  if (roles.length === 0 && user.role !== "adminmaster" && user.role !== "owner") {
    throw new Error("Forbidden: apenas o Admin Master pode configurar meios de pagamento");
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
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_payment_gateway_provider (provider)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
}

export async function getGlobalMercadoPagoRow() {
  await ensurePaymentGatewaySettingsTable();
  const rows = (await db.query(
    "SELECT * FROM payment_gateway_settings WHERE tenant_id = 'global' AND provider = 'mercadopago' LIMIT 1",
  )) as any[];
  return rows[0] ?? null;
}

export function encryptedValue(value: unknown, currentValue?: string | null) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized || normalized === MASKED_SECRET || /^\*{4,}$/.test(normalized)) {
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
