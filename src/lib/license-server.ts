import crypto from "crypto";
import db from "./db";

export function normalizeLicenseKey(key: string): string {
  return String(key || "")
    .trim()
    .toUpperCase();
}

export function licenseHash(key: string): string {
  const secret =
    process.env.LICENSE_HASH_SECRET || process.env.LICENSE_API_SECRET || "license-hash-secret";
  return crypto.createHmac("sha256", secret).update(normalizeLicenseKey(key)).digest("hex");
}

export function generateLicenseKey(): string {
  const prefix = (process.env.LICENSE_KEY_PREFIX || "VW2D").toUpperCase();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const segment = () =>
    Array.from({ length: 4 }, () => chars[crypto.randomInt(chars.length)]).join("");

  return `${prefix}-${segment()}-${segment()}-${segment()}-${segment()}`;
}

export function previewLicenseKey(key: string): string {
  const normalized = normalizeLicenseKey(key);
  return `${normalized.slice(0, 9)}-****-${normalized.slice(-4)}`;
}

export function mysqlDate(value: any): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace("T", " ");
}

export function nowMysql(): string {
  return mysqlDate(new Date())!;
}

export function parseJson(value: any, fallback = {}): any {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export interface LicenseRecord {
  id: number;
  license_key_hash: string;
  license_key_preview: string;
  client_name: string | null;
  client_email: string | null;
  product_name: string;
  app_id: string;
  plan: string;
  status: string;
  expires_at: string | null;
  max_activations: number;
  max_users: number | null;
  features_json: any;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function findLicenseByKey(key: string): Promise<LicenseRecord | null> {
  const rows = await db.query("SELECT * FROM licenses WHERE license_key_hash = ? LIMIT 1", [
    licenseHash(key),
  ]);
  return (rows as LicenseRecord[])[0] || null;
}

export async function findLicenseByDomain(domain: string): Promise<LicenseRecord | null> {
  const normalized = String(domain || "")
    .trim()
    .toLowerCase();
  const rows = await db.query(
    "SELECT * FROM licenses WHERE LOWER(license_key_preview) = ? LIMIT 1",
    [normalized],
  );
  return (rows as LicenseRecord[])[0] || null;
}

export function checkLicense(
  license: LicenseRecord | null,
  appId?: string,
): { ok: boolean; status: string; reason: string } {
  if (!license) {
    return {
      ok: false,
      status: "not_found",
      reason: "Licença não encontrada.",
    };
  }

  if (license.app_id && appId && license.app_id !== appId) {
    return {
      ok: false,
      status: "app_id_invalid",
      reason: "Licença não pertence a este aplicativo.",
    };
  }

  if (license.status !== "active") {
    return {
      ok: false,
      status: license.status,
      reason: `Licença com status ${license.status}.`,
    };
  }

  if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) {
    return {
      ok: false,
      status: "expired",
      reason: "Licença expirada.",
    };
  }

  return { ok: true, status: "active", reason: "Licença ativa e válida." };
}

export function publicLicenseResponse(license: LicenseRecord, extra: any = {}) {
  const features = parseJson(license.features_json, {});

  if (license.max_users && !features.max_users) {
    features.max_users = license.max_users;
  }

  return {
    valid: true,
    status: "active",
    message: extra.message || "Licença válida.",
    plan: license.plan,
    expires_at: license.expires_at ? new Date(license.expires_at).toISOString() : null,
    features,
    ...extra,
  };
}

export async function logPanelValidation(data: {
  license_id: number | null;
  domain: string | null;
  app_url: string | null;
  installation_id: string | null;
  ip_address: string | null;
  app_id: string | null;
  result: string;
  reason: string | null;
  payload: any;
}) {
  try {
    await db.query(
      `INSERT INTO license_validation_logs
       (license_id, domain, app_url, installation_id, ip_address, app_id, result, reason, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))`,
      [
        data.license_id || null,
        data.domain || null,
        data.app_url || null,
        data.installation_id || null,
        data.ip_address || null,
        data.app_id || null,
        data.result || "unknown",
        data.reason || null,
        JSON.stringify(data.payload || {}),
      ],
    );
  } catch (error: any) {
    console.error("[License] Falha ao gravar log:", error.message);
  }
}

export function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return null;
}
