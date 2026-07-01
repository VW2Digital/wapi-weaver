import crypto from "crypto";
import os from "os";
import { dbAdmin } from "@/integrations/mysql/client.server";
import jwt from "jsonwebtoken";

// Local cache for license status to avoid querying DB/API on every request
let cachedLicenseStatus: {
  valid: boolean;
  expiresAt: number; // local cache expiration timestamp
} | null = null;

function getLicenseServerUrl(): string {
  return process.env.LICENSE_SERVER_URL || "http://localhost:3001/api/licenses";
}

async function fetchWithTimeout(url: string, options: any = {}, timeout = 4000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

function getFallbackLicenseKey(): string {
  return process.env.LICENSE_KEY || "VW2-PRO-XXXX-XXXX-XXXX";
}

async function getPlatformSettings() {
  const { data, error } = await dbAdmin
    .from("platform_settings")
    .select("license_key, license_token, installation_id, license_grace_period_start")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("[License Verifier] Error fetching platform settings:", error);
    return null;
  }
  return data;
}

async function ensureInstallationId(currentId?: string): Promise<string> {
  if (currentId) return currentId;

  const newId = crypto.randomUUID();
  console.log("[License Verifier] Generating new installation ID:", newId);
  const { error } = await dbAdmin
    .from("platform_settings")
    .upsert({ id: 1, installation_id: newId });

  if (error) {
    console.error("[License Verifier] Error saving installation ID:", error);
  }
  return newId;
}

export function getFingerprint(installationId: string): string {
  return crypto
    .createHash("sha256")
    .update(`${os.hostname()}_${os.platform()}_${installationId}`)
    .digest("hex");
}

export async function activateLicense(key?: string, reqHost?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const settings = await getPlatformSettings();
    const activeKey = key || settings?.license_key || getFallbackLicenseKey();
    const installationId = await ensureInstallationId(settings?.installation_id);
    const fingerprint = getFingerprint(installationId);
    
    // Automatically get domain from request host or fallback to hostname/localhost
    const domain = reqHost || process.env.APP_URL || "localhost";
    const serverUrl = getLicenseServerUrl();

    console.log(`[License Verifier] Attempting activation for key prefix: ${activeKey.slice(0, 11)}... at ${serverUrl}/activate`);

    const response = await fetchWithTimeout(`${serverUrl}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        license_key: activeKey,
        domain,
        fingerprint_hash: fingerprint,
        installation_id: installationId,
      }),
    }, 5000);

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const errorMsg = errData.error || `HTTP error ${response.status}`;
      console.error("[License Verifier] Activation failed:", errorMsg);
      
      // Clear token on failure
      await dbAdmin.from("platform_settings").upsert({ id: 1, license_token: null });
      cachedLicenseStatus = { valid: false, expiresAt: Date.now() + 60000 }; // Cache failure for 1 minute
      return { success: false, error: errorMsg };
    }

    const data = await response.json();
    if (data.token) {
      // Save token and key in the database, reset grace period since activation was successful
      const updateData: Record<string, any> = { 
        id: 1, 
        license_token: data.token,
        license_grace_period_start: null 
      };
      if (key) {
        updateData.license_key = key;
      }
      await dbAdmin.from("platform_settings").upsert(updateData);
      
      // Update cache
      cachedLicenseStatus = { valid: true, expiresAt: Date.now() + 15 * 60 * 1000 }; // Cache for 15 minutes
      console.log("[License Verifier] Activation successful!");
      return { success: true };
    }

    return { success: false, error: "Token não retornado pelo servidor" };
  } catch (err: any) {
    console.error("[License Verifier] Activation exception:", err.message || err);
    return { success: false, error: err.message || "Erro de conexão" };
  }
}

export async function checkLicense(reqHost?: string, ignoreGrace = false): Promise<boolean> {
  // 1. Check local cache first (only if we are not ignoring grace)
  if (!ignoreGrace && cachedLicenseStatus && cachedLicenseStatus.expiresAt > Date.now()) {
    return cachedLicenseStatus.valid;
  }

  try {
    const settings = await getPlatformSettings();
    const activeKey = settings?.license_key || getFallbackLicenseKey();
    const installationId = await ensureInstallationId(settings?.installation_id);
    const fingerprint = getFingerprint(installationId);
    const domain = reqHost || process.env.APP_URL || "localhost";
    const serverUrl = getLicenseServerUrl();

    // Check if key is completely absent
    const isKeyAbsent = !settings?.license_key || settings.license_key === "VW2-PRO-XXXX-XXXX-XXXX";

    // 2. Validate JWT locally if present and key is not absent
    const localToken = settings?.license_token;
    if (localToken && !isKeyAbsent) {
      try {
        const decoded = jwt.decode(localToken) as any;
        if (decoded && typeof decoded === "object") {
          const expiresAt = decoded.token_expires_at || decoded.exp;
          const endsAt = decoded.license_ends_at;

          // If JWT payload looks valid, not expired, and ends_at is in the future
          if (
            expiresAt && expiresAt * 1000 > Date.now() &&
            (!endsAt || new Date(endsAt).getTime() > Date.now()) &&
            decoded.status === "active" &&
            (!decoded.domain || decoded.domain === domain)
          ) {
            // Reset grace period since license is valid
            if (settings?.license_grace_period_start) {
              await dbAdmin.from("platform_settings").upsert({ id: 1, license_grace_period_start: null });
            }
            cachedLicenseStatus = { valid: true, expiresAt: Date.now() + 15 * 60 * 1000 }; // 15 mins
            return true;
          }
        }
      } catch (jwtErr) {
        console.warn("[License Verifier] Local JWT decode error, falling back to server check:", jwtErr);
      }
    }

    // 3. Fallback to API check if key is not absent
    let isServerValid = false;
    let newToken = null;

    if (!isKeyAbsent) {
      console.log(`[License Verifier] Calling license server ${serverUrl}/check...`);
      try {
        const response = await fetchWithTimeout(`${serverUrl}/check`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            license_key: activeKey,
            domain,
            fingerprint_hash: fingerprint,
            installation_id: installationId,
          }),
        }, 4000);

        if (response.ok) {
          const data = await response.json();
          if (data.valid && data.token) {
            isServerValid = true;
            newToken = data.token;
          }
        } else {
          console.error("[License Verifier] Check request failed with status:", response.status);
          // Try to re-activate
          const actRes = await activateLicense(activeKey, domain);
          isServerValid = actRes.success;
        }
      } catch (serverErr) {
        console.error("[License Verifier] Server check failed:", serverErr);
      }
    }

    if (isServerValid) {
      const updateData: Record<string, any> = { id: 1, license_grace_period_start: null };
      if (newToken) {
        updateData.license_token = newToken;
      }
      await dbAdmin.from("platform_settings").upsert(updateData);
      cachedLicenseStatus = { valid: true, expiresAt: Date.now() + 15 * 60 * 1000 }; // Cache for 15 mins
      return true;
    } else {
      console.warn("[License Verifier] License is invalid, expired, or absent. Checking grace period.");
      
      const graceStart = settings?.license_grace_period_start;
      if (!graceStart) {
        // Record the start of the grace period
        const now = new Date();
        await dbAdmin.from("platform_settings").upsert({ id: 1, license_grace_period_start: now, license_token: null });
        cachedLicenseStatus = { valid: !ignoreGrace, expiresAt: Date.now() + 5 * 60 * 1000 };
        return !ignoreGrace; // Access allowed during grace period (since it just started)
      } else {
        const graceStartTime = new Date(graceStart).getTime();
        const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
        const hasGraceExpired = (Date.now() - graceStartTime) > threeDaysMs;
        
        if (hasGraceExpired) {
          // Block access
          await dbAdmin.from("platform_settings").upsert({ id: 1, license_token: null });
          cachedLicenseStatus = { valid: false, expiresAt: Date.now() + 5 * 60 * 1000 };
          return false;
        } else {
          cachedLicenseStatus = { valid: !ignoreGrace, expiresAt: Date.now() + 5 * 60 * 1000 };
          return !ignoreGrace; // Access allowed during grace period
        }
      }
    }
  } catch (err) {
    console.error("[License Verifier] Check license exception:", err);
    // If license server or DB fails, check the cached status or fallback safely
    const graceStart = cachedLicenseStatus?.valid === false ? null : undefined;
    return cachedLicenseStatus?.valid ?? false;
  }
}
