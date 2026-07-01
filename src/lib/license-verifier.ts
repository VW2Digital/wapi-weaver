import crypto from "crypto";
import os from "os";
import { dbAdmin } from "@/integrations/mysql/client.server";
import { licenseClient } from "./license-client";

// Local cache for license status to avoid querying DB/API on every request
let memoryCachedLicenseStatus: {
  valid: boolean;
  expiresAt: number;
} | null = null;

const ENCRYPTION_ALGORITHM = "aes-256-cbc";
// Derive a 32-byte key from JWT_SECRET or fallback
function getEncryptionKey() {
  const secret = process.env.JWT_SECRET || "fallback-secret-for-encryption";
  return crypto.createHash("sha256").update(String(secret)).digest();
}

function encryptKey(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decryptKey(text: string): string | null {
  try {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift()!, "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, getEncryptionKey(), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    console.error("[License Verifier] Failed to decrypt license key");
    return null;
  }
}

async function getLicenseSettings() {
  const { data, error } = await dbAdmin
    .from("license_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("[License Verifier] Error fetching license settings:", error);
    return null;
  }
  return data;
}

async function ensureInstallationId(currentId?: string): Promise<string> {
  if (currentId) return currentId;
  const newId = crypto.randomUUID();
  await dbAdmin.from("license_settings").upsert({ id: 1, installation_id: newId });
  return newId;
}

export async function activateLicense(key: string, reqHost?: string): Promise<{ success: boolean; error?: string }> {
  try {
    let settings = await getLicenseSettings();
    if (!settings) {
      await dbAdmin.from("license_settings").insert({ id: 1 });
      settings = await getLicenseSettings();
    }
    
    const installationId = await ensureInstallationId(settings?.installation_id);
    const domain = reqHost || process.env.APP_URL || "localhost";
    const appUrl = process.env.APP_URL || `https://${domain}`;

    console.log(`[License Verifier] Attempting activation for key...`);

    const response = await licenseClient.activate(key, domain, installationId, appUrl);

    if (response.valid) {
      const cacheHours = parseInt(process.env.LICENSE_CACHE_HOURS || "24", 10);
      const cacheValidUntil = new Date(Date.now() + cacheHours * 60 * 60 * 1000);

      await dbAdmin.from("license_settings").upsert({
        id: 1,
        license_key_encrypted: encryptKey(key),
        license_status: "active",
        plan: response.plan || "default",
        features_json: response.features || {},
        domain: domain,
        installation_id: installationId,
        activated_at: new Date(),
        last_validated_at: new Date(),
        expires_at: response.expires_at ? new Date(response.expires_at) : null,
        cache_valid_until: cacheValidUntil,
        grace_until: null,
        last_error: null,
      });

      memoryCachedLicenseStatus = { valid: true, expiresAt: Date.now() + 15 * 60 * 1000 };
      return { success: true };
    } else {
      await dbAdmin.from("license_settings").upsert({
        id: 1,
        license_status: "invalid",
        last_error: response.message || response.error,
      });
      memoryCachedLicenseStatus = { valid: false, expiresAt: Date.now() + 60000 };
      return { success: false, error: response.message || response.error };
    }
  } catch (err: any) {
    console.error("[License Verifier] Activation exception:", err.message || err);
    return { success: false, error: err.message || "Erro de conexão" };
  }
}

export async function checkLicense(reqHost?: string, ignoreGrace = false): Promise<boolean> {
  if (!ignoreGrace && memoryCachedLicenseStatus && memoryCachedLicenseStatus.expiresAt > Date.now()) {
    return memoryCachedLicenseStatus.valid;
  }

  try {
    let settings = await getLicenseSettings();
    if (!settings) {
      return false;
    }

    const {
      license_key_encrypted,
      license_status,
      cache_valid_until,
      grace_until,
      installation_id
    } = settings;

    const key = license_key_encrypted ? decryptKey(license_key_encrypted) : null;
    if (!key) {
      return false; // No key = no access
    }

    const now = new Date();

    // If local cache is still valid
    if (cache_valid_until && new Date(cache_valid_until) > now) {
      if (license_status === "active") {
        memoryCachedLicenseStatus = { valid: true, expiresAt: Date.now() + 15 * 60 * 1000 };
        return true;
      }
      return false;
    }

    // Cache expired, need to validate
    const domain = reqHost || process.env.APP_URL || "localhost";
    const appUrl = process.env.APP_URL || `https://${domain}`;
    const instId = await ensureInstallationId(installation_id);

    console.log(`[License Verifier] Validating license via API...`);
    const response = await licenseClient.validate(key, domain, instId, appUrl);

    if (response.status === "network_error") {
      // API offline, check grace period
      if (grace_until && new Date(grace_until) > now) {
        console.warn(`[License Verifier] API offline, using grace period until ${grace_until}`);
        memoryCachedLicenseStatus = { valid: !ignoreGrace, expiresAt: Date.now() + 5 * 60 * 1000 };
        return !ignoreGrace;
      } else if (!grace_until) {
        // Start grace period
        const graceHours = parseInt(process.env.LICENSE_GRACE_HOURS || "72", 10);
        const newGrace = new Date(Date.now() + graceHours * 60 * 60 * 1000);
        await dbAdmin.from("license_settings").upsert({ id: 1, grace_until: newGrace });
        memoryCachedLicenseStatus = { valid: !ignoreGrace, expiresAt: Date.now() + 5 * 60 * 1000 };
        return !ignoreGrace;
      } else {
        // Grace period expired
        memoryCachedLicenseStatus = { valid: false, expiresAt: Date.now() + 5 * 60 * 1000 };
        return false;
      }
    }

    // We got a response from API
    if (response.valid) {
      const cacheHours = parseInt(process.env.LICENSE_CACHE_HOURS || "24", 10);
      const cacheValidUntil = new Date(Date.now() + cacheHours * 60 * 60 * 1000);

      await dbAdmin.from("license_settings").upsert({
        id: 1,
        license_status: "active",
        plan: response.plan || settings.plan,
        features_json: response.features || settings.features_json,
        last_validated_at: now,
        expires_at: response.expires_at ? new Date(response.expires_at) : settings.expires_at,
        cache_valid_until: cacheValidUntil,
        grace_until: null,
        last_error: null,
      });

      memoryCachedLicenseStatus = { valid: true, expiresAt: Date.now() + 15 * 60 * 1000 };
      return true;
    } else {
      // Invalid, blocked, expired etc
      await dbAdmin.from("license_settings").upsert({
        id: 1,
        license_status: response.status || "invalid",
        last_error: response.message || response.error,
        cache_valid_until: null, // invalidates cache immediately
      });
      memoryCachedLicenseStatus = { valid: false, expiresAt: Date.now() + 60000 };
      return false;
    }
  } catch (err) {
    console.error("[License Verifier] Check license exception:", err);
    return memoryCachedLicenseStatus?.valid ?? false;
  }
}

export async function licenseHasFeature(featureName: string): Promise<boolean> {
  const settings = await getLicenseSettings();
  if (!settings || !settings.features_json) return false;
  
  const features = settings.features_json as any;
  return !!features[featureName];
}

export async function getLicenseLimit(featureName: string): Promise<number | null> {
  const settings = await getLicenseSettings();
  if (!settings || !settings.features_json) return null;
  
  const features = settings.features_json as any;
  if (typeof features[featureName] === "number") {
    return features[featureName];
  }
  return null;
}
