import { dbAdmin } from "@/integrations/mysql/client.server";

export async function checkLicense(tenantId?: string, ignoreGrace = false): Promise<boolean> {
  return true;
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
