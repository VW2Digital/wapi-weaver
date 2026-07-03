import { dbAdmin } from "@/integrations/mysql/client.server";

export async function checkLicense(tenantId?: string, ignoreGrace = false): Promise<boolean> {
  if (!tenantId || tenantId.length !== 36) {
    // If no specific tenant UUID is provided, default to true to allow background workers and server boot
    return true;
  }

  try {
    const rows = (await dbAdmin.query(
      "SELECT status, expires_at FROM licenses WHERE tenant_id = ? LIMIT 1",
      [tenantId],
    )) as any[];

    if (!rows || rows.length === 0) {
      return false;
    }

    const sub = rows[0];
    const isExpired = sub.expires_at && new Date(sub.expires_at) < new Date();
    return sub.status === "active" && !isExpired;
  } catch (err) {
    console.error("[License Verifier] Error checking license in DB:", err);
    return false;
  }
}

export async function activateLicense(
  key: string,
  reqHost?: string,
): Promise<{ success: boolean; error?: string }> {
  // Key activation is no longer used in the simplified local SaaS model
  return { success: true };
}

export async function licenseHasFeature(featureName: string): Promise<boolean> {
  return true;
}

export async function getLicenseLimit(featureName: string): Promise<number | null> {
  return null;
}
