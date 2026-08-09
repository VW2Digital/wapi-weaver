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
  if (!hasMasterRole(userRoles) && !isMaster(user.role)) {
    throw new Error("Forbidden: apenas o administrador master (adminmaster) da plataforma tem permissão");
  }

  return user;
}

export async function getGlobalMercadoPagoRow(tenantId?: string) {
  if (tenantId) {
    const rows = (await db.query(
      "SELECT * FROM payment_gateway_settings WHERE tenant_id = ? LIMIT 1",
      [tenantId]
    )) as any[];
    if (rows.length > 0) return rows[0];
  }
  return null;
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
  if (!value) return "";
  try {
    return decrypt(value);
  } catch (err) {
    console.error("[PaymentGateway] Secret decryption failed:", (err as Error).message);
    return "";
  }
}

export function gatewayId() {
  return crypto.randomUUID();
}
