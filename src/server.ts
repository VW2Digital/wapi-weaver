import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

// --- Background Queue Processor ---
import { processOnce } from "./routes/api/public/cron/process-queue";
import { checkLicense } from "./lib/license-verifier";
import db from "./lib/db";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

async function migrateRoles() {
  try {
    console.log("[Roles Migration] Starting role schema and data migration...");
    try {
      await db.query("ALTER TABLE user_roles MODIFY COLUMN role ENUM('adminmaster', 'owner', 'org_admin', 'member', 'user', 'admin') NOT NULL DEFAULT 'user'");
      console.log("[Roles Migration] Column enum altered successfully.");
    } catch (alterErr: any) {
      console.warn("[Roles Migration] Warning altering user_roles table:", alterErr.message);
    }

    const roleMode = process.env.LICENSE_ROLE || "saas";
    const adminEmail = process.env.ADMIN_EMAIL;

    if (roleMode === "panel") {
      if (adminEmail) {
        const userRows = await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [adminEmail.trim().toLowerCase()]) as any[];
        if (userRows.length > 0) {
          const userId = userRows[0].id;
          await db.query("UPDATE user_roles SET role = 'adminmaster' WHERE user_id = ?", [userId]);
          console.log(`[Roles Migration] Updated master user ${adminEmail} to adminmaster.`);
          
          const cleaned = await db.query("UPDATE user_roles SET role = 'user' WHERE user_id != ? AND role IN ('adminmaster', 'admin')", [userId]);
          if (cleaned.affectedRows > 0) {
            console.log(`[Roles Migration] Cleaned up ${cleaned.affectedRows} unauthorized administrators in Panel mode.`);
          }
        }
      }
    } else {
      if (adminEmail) {
        const userRows = await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [adminEmail.trim().toLowerCase()]) as any[];
        if (userRows.length > 0) {
          const userId = userRows[0].id;
          await db.query("UPDATE user_roles SET role = 'owner' WHERE user_id = ?", [userId]);
          console.log(`[Roles Migration] Converted SaaS initial user ${adminEmail} to owner.`);
          
          const cleaned = await db.query("UPDATE user_roles SET role = 'user' WHERE user_id != ? AND role IN ('adminmaster', 'admin')", [userId]);
          if (cleaned.affectedRows > 0) {
            console.log(`[Roles Migration] Converted ${cleaned.affectedRows} other administrators to user in SaaS mode.`);
          }
        }
      } else {
        const users = await db.query("SELECT id, email FROM users ORDER BY created_at ASC") as any[];
        if (users.length > 0) {
          const firstUserId = users[0].id;
          await db.query("UPDATE user_roles SET role = 'owner' WHERE user_id = ?", [firstUserId]);
          console.log(`[Roles Migration] Set first user ${users[0].email} as owner.`);
          
          const cleaned = await db.query("UPDATE user_roles SET role = 'user' WHERE user_id != ? AND role IN ('adminmaster', 'admin', 'owner')", [firstUserId]);
          if (cleaned.affectedRows > 0) {
            console.log(`[Roles Migration] Converted ${cleaned.affectedRows} other administrators to user.`);
          }
        }
      }
    }
  } catch (err: any) {
    console.error("[Roles Migration] Error running migrations:", err.message);
  }
}

async function ensureMasterUser() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    return;
  }
  try {
    const existing = await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [adminEmail]);
    if (existing && existing.length > 0) {
      console.log(`[Master Auth] Admin user ${adminEmail} already exists.`);
      return;
    }

    const roleMode = process.env.LICENSE_ROLE || "saas";
    const initialRole = roleMode === "panel" ? "adminmaster" : "owner";

    console.log(`[Master Auth] Provisioning Admin user: ${adminEmail} with role ${initialRole}`);
    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(adminPassword, 10);

    await db.transaction(async (conn) => {
      // 1. Insert into users
      await conn.execute("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
        userId,
        adminEmail,
        passwordHash,
      ]);

      // 2. Insert into user_roles
      const roleId = randomUUID();
      await conn.execute("INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)", [
        roleId,
        userId,
        initialRole,
      ]);

      // 3. Insert into profiles
      await conn.execute("INSERT INTO profiles (id, email, display_name) VALUES (?, ?, ?)", [
        userId,
        adminEmail,
        roleMode === "panel" ? "Master Admin" : "Owner Admin",
      ]);
    });
    console.log("[Master Auth] Admin user provisioned successfully.");
  } catch (err) {
    console.error("[Master Auth] Failed to provision Admin user:", err);
  }
}

async function runBootSequence() {
  await migrateRoles();
  await ensureMasterUser();
}

runBootSequence().catch(console.error);

let queueIntervalStarted = false;
function startQueueProcessor() {
  if (queueIntervalStarted) return;
  queueIntervalStarted = true;
  console.log("[Queue] Starting background queue processor (every 60s)...");

  // Call once immediately on startup, then every 60s
  setTimeout(() => {
    processOnce().catch((e) => console.error("[Queue Init Error]", e));
  }, 5000);

  setInterval(async () => {
    try {
      await processOnce();
    } catch (e) {
      console.error("[Queue] Error processing queue:", e);
    }
  }, 60000);
}

startQueueProcessor();

// --- Background License Validator ---
let licenseCheckStarted = false;
function startLicenseChecker() {
  if (licenseCheckStarted) return;
  licenseCheckStarted = true;
  console.log("[License] Starting background license checker (every 6 hours)...");

  // Run initial check after 10s
  setTimeout(() => {
    checkLicense().catch((e) => console.error("[License Init Error]", e));
  }, 10000);

  // Every 6 hours
  setInterval(async () => {
    try {
      await checkLicense();
    } catch (e) {
      console.error("[License Background Error]", e);
    }
  }, 21600000);
}

startLicenseChecker();
// ----------------------------------

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      
      if (url.pathname === "/api/license/debug") {
        const serverUrls = process.env.LICENSE_SERVER_URL
          ? [process.env.LICENSE_SERVER_URL]
          : [
              "https://admin.blivcrm.com",
              "https://painel.blivcrm.com",
              "http://85.155.186.146",
              "http://134.195.88.7"
            ];
        const appId = process.env.LICENSE_APP_ID || "meu-saas";
        const results = [];

        for (const serverUrl of serverUrls) {
          let canReach = false;
          let panelResponse: any = null;
          let errMessage: string | null = null;
          
          try {
            const healthUrl = `${serverUrl.replace(/\/+$/, "")}/api/licenses/health`;
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(healthUrl, { method: "GET", signal: controller.signal });
            clearTimeout(id);
            canReach = res.ok;
            const contentType = res.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
              panelResponse = await res.json();
            } else {
              panelResponse = await res.text();
            }
          } catch (err: any) {
            errMessage = err.message || String(err);
          }

          results.push({
            license_server_url: serverUrl,
            can_reach_panel: canReach,
            panel_health_response: panelResponse,
            error: errMessage
          });
        }
        
        return new Response(
          JSON.stringify({
            role: "saas",
            app_id: appId,
            results
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      // Intercept critical APIs if license is invalid
      if (url.pathname.startsWith("/api/whatsapp/")) {
        const reqHost = request.headers.get("host") || undefined;
        const isLicenseValid = await checkLicense(reqHost);
        if (!isLicenseValid) {
          return new Response(
            JSON.stringify({ error: "Licença inválida ou expirada. Regularize seu plano." }),
            {
              status: 402,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
