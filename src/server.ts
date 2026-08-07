import "./lib/error-capture";
import "./lib/queue/webhook-queue";
import "./lib/queue/campaign-queue";
import { startDbHealthMonitor } from "./lib/db-health-monitor";

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

  const err = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  console.error(err);
  try {
    const fs = await import("fs");
    fs.writeFileSync(
      "./ssr_error.log",
      "CATASTROPHIC SSR:\n" + (err instanceof Error ? err.stack : String(err)) + "\n",
    );
  } catch {}
  return brandedErrorResponse();
}

// --- Background Queue Processor ---
import { processOnce } from "./routes/api/public/cron/process-queue";
import { checkLicense } from "./lib/license-verifier";
import db from "./lib/db";
import { randomUUID, createHash } from "crypto";
import bcrypt from "bcryptjs";

// Inicia o monitor de saúde do pool imediatamente
startDbHealthMonitor(db.pool);

async function migrateRoles() {
  try {
    console.log("[Roles Migration] Starting role schema and data migration...");

    // Guarda de idempotência: verifica se a coluna role já foi migrada para ENUM('admin_master', 'admin', 'user')
    const [cols] = (await db.query(
      `SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_roles' AND COLUMN_NAME = 'role' LIMIT 1`,
    )) as any[];
    const isAlreadyEnum = String(cols?.[0]?.COLUMN_TYPE ?? "").includes(
      "enum('admin_master','admin','user')",
    );

    if (isAlreadyEnum) {
      console.log(
        "[Roles Migration] Schema user_roles já está no formato ENUM final. Pulando DDLs pesados.",
      );
    } else {
      // 1. Temporarily allow VARCHAR(50) so MySQL doesn't throw Data Truncated error
      try {
        await db.query(
          "ALTER TABLE user_roles MODIFY COLUMN role VARCHAR(50) NOT NULL DEFAULT 'user'",
        );
      } catch (e: any) {
        console.warn("[Roles Migration] Warning converting role to VARCHAR:", e.message);
      }

      // 2. Migrate legacy roles correctly
      try {
        await db.query("UPDATE user_roles SET role = 'admin_master' WHERE role IN ('adminmaster')");
        await db.query("UPDATE user_roles SET role = 'admin' WHERE role IN ('owner')");
        await db.query("UPDATE user_roles SET role = 'user' WHERE role IN ('org_admin', 'member')");
      } catch (e: any) {
        console.warn("[Roles Migration] Warning updating legacy roles:", e.message);
      }

      // 3. Remove orphaned user_roles
      try {
        const orphans = (await db.query(
          "DELETE FROM user_roles WHERE user_id NOT IN (SELECT id FROM users)",
        )) as any;
        if (orphans && orphans.affectedRows > 0) {
          console.log(`[Roles Migration] Removed ${orphans.affectedRows} orphaned user_roles.`);
        }
      } catch (e: any) {
        console.warn("[Roles Migration] Warning deleting orphaned user_roles:", e.message);
      }

      // 4. Deduplicate user_roles (ensure 1 role per user before UNIQUE index)
      try {
        await db.query(`
          DELETE ur1 FROM user_roles ur1
          JOIN user_roles ur2 ON ur1.user_id = ur2.user_id
          WHERE ur1.id > ur2.id
        `);
        console.log("[Roles Migration] Deduplicated user_roles table.");
      } catch (e: any) {
        console.warn("[Roles Migration] Warning deduplicating user_roles:", e.message);
      }

      // 5. Drop old index if exists & Add UNIQUE(user_id)
      try {
        await db.query("ALTER TABLE user_roles DROP INDEX uq_user_roles");
      } catch (e: any) {
        console.log(
          "[Roles Migration] Legacy index uq_user_roles already dropped or absent:",
          e.message,
        );
      }

      try {
        await db.query("ALTER TABLE user_roles ADD UNIQUE INDEX idx_unique_user_id (user_id)");
        console.log("[Roles Migration] Added UNIQUE(user_id) index to user_roles table.");
      } catch (e: any) {
        console.warn(
          "[Roles Migration] Index idx_unique_user_id already exists or error adding it:",
          e.message,
        );
      }

      // 6. Restrict column to strict 3-value ENUM
      try {
        await db.query(
          "ALTER TABLE user_roles MODIFY COLUMN role ENUM('admin_master', 'admin', 'user') NOT NULL DEFAULT 'user'",
        );
        console.log(
          "[Roles Migration] Column enum altered successfully to ('admin_master', 'admin', 'user').",
        );
      } catch (e: any) {
        console.error("[Roles Migration] Error setting ENUM on user_roles:", e.message);
      }
    }

    try {
      await db.query("ALTER TABLE licenses ADD COLUMN tenant_id VARCHAR(36) NULL UNIQUE");
      console.log("[Roles Migration] Added tenant_id column to licenses table.");
    } catch (colErr: any) {
      console.log("[Roles Migration] Column tenant_id already exists or error adding it.");
    }

    const roleMode = process.env.LICENSE_ROLE || "saas";
    const adminEmail = process.env.ADMIN_EMAIL;

    if (roleMode === "panel") {
      if (adminEmail) {
        const userRows = (await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [
          adminEmail.trim().toLowerCase(),
        ])) as any[];
        if (userRows.length > 0) {
          const userId = userRows[0].id;
          await db.query("DELETE FROM user_roles WHERE user_id = ?", [userId]);
          await db.query(
            "INSERT IGNORE INTO user_roles (id, user_id, role) VALUES (UUID(), ?, 'admin_master')",
            [userId],
          );
          await db.query("UPDATE profiles SET display_name = 'Administrador Master' WHERE id = ?", [
            userId,
          ]);
          console.log(`[Roles Migration] Updated master user ${adminEmail} to admin_master.`);

          const cleaned = await db.query(
            "UPDATE user_roles SET role = 'user' WHERE user_id != ? AND role = 'admin_master' AND user_id NOT IN (SELECT id FROM users WHERE email IN ('vw2digital@gmail.com'))",
            [userId],
          );
          if (cleaned.affectedRows > 0) {
            console.log(
              `[Roles Migration] Cleaned up ${cleaned.affectedRows} unauthorized administrators in Panel mode.`,
            );
          }
        }
      }
    } else {
      if (adminEmail) {
        const userRows = (await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [
          adminEmail.trim().toLowerCase(),
        ])) as any[];
        if (userRows.length > 0) {
          const userId = userRows[0].id;
          await db.query("DELETE FROM user_roles WHERE user_id = ?", [userId]);
          await db.query(
            "INSERT IGNORE INTO user_roles (id, user_id, role) VALUES (UUID(), ?, 'admin')",
            [userId],
          );
          console.log(`[Roles Migration] Converted SaaS initial user ${adminEmail} to admin.`);

          const cleaned = await db.query(
            "UPDATE user_roles SET role = 'user' WHERE user_id != ? AND role = 'admin_master' AND user_id NOT IN (SELECT id FROM users WHERE email IN ('vw2digital@gmail.com'))",
            [userId],
          );
          if (cleaned.affectedRows > 0) {
            console.log(
              `[Roles Migration] Converted ${cleaned.affectedRows} other administrators to user in SaaS mode.`,
            );
          }
        }
      } else {
        const users = (await db.query(
          "SELECT id, email FROM users ORDER BY created_at ASC",
        )) as any[];
        if (users.length > 0) {
          const firstUserId = users[0].id;
          await db.query("DELETE FROM user_roles WHERE user_id = ?", [firstUserId]);
          await db.query(
            "INSERT IGNORE INTO user_roles (id, user_id, role) VALUES (UUID(), ?, 'admin')",
            [firstUserId],
          );
          console.log(`[Roles Migration] Set first user ${users[0].email} as admin.`);

          const cleaned = await db.query(
            "UPDATE user_roles SET role = 'user' WHERE user_id != ? AND role IN ('admin_master', 'admin') AND user_id NOT IN (SELECT id FROM users WHERE email IN ('vw2digital@gmail.com'))",
            [firstUserId],
          );
          if (cleaned.affectedRows > 0) {
            console.log(
              `[Roles Migration] Converted ${cleaned.affectedRows} other administrators to user.`,
            );
          }
        }
      }
    }

    // Link existing licenses to their owners by email if tenant_id is not set
    const allUsers = (await db.query("SELECT id, email FROM users")) as any[];
    for (const u of allUsers) {
      const emailNormalized = String(u.email).trim().toLowerCase();

      const emailLicenses = (await db.query(
        "SELECT id, tenant_id FROM licenses WHERE LOWER(TRIM(client_email)) = ?",
        [emailNormalized],
      )) as any[];

      if (emailLicenses.length > 0) {
        const linkedLicense = emailLicenses.find((l) => l.tenant_id === u.id);
        const unlinkedLicense = emailLicenses.find((l) => !l.tenant_id);

        if (unlinkedLicense) {
          if (linkedLicense) {
            console.log(
              `[License Migration] Found duplicate licenses for ${emailNormalized}. Keeping main license ${unlinkedLicense.id} and deleting trial license ${linkedLicense.id}`,
            );
            await db.query("DELETE FROM licenses WHERE id = ?", [linkedLicense.id]);
          }

          await db.query("UPDATE licenses SET tenant_id = ? WHERE id = ?", [
            u.id,
            unlinkedLicense.id,
          ]);
          console.log(
            `[License Migration] Linked license ${unlinkedLicense.id} to user ${emailNormalized} (${u.id})`,
          );
        }
      }
    }

    // Auto-create a license subscription record for any admin/admin_master user that doesn't have one
    const owners = (await db.query(
      "SELECT u.id, u.email, p.display_name FROM users u JOIN user_roles r ON u.id = r.user_id LEFT JOIN profiles p ON p.id = u.id WHERE r.role IN ('admin', 'admin_master')",
    )) as any[];
    for (const owner of owners) {
      const existingSub = (await db.query("SELECT id FROM licenses WHERE tenant_id = ? LIMIT 1", [
        owner.id,
      ])) as any[];
      if (existingSub.length === 0) {
        const licenseKey = owner.email;
        const keyHash = createHash("sha256").update(licenseKey).digest("hex");
        await db.query(
          `INSERT INTO licenses (license_key_hash, license_key_preview, client_name, client_email, plan, status, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            keyHash,
            owner.email,
            owner.display_name || owner.email,
            owner.email,
            "basic",
            "active",
            owner.id,
          ],
        );
        console.log(`[Roles Migration] Auto-provisioned subscription for admin: ${owner.email}`);
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
    const initialRole = roleMode === "panel" ? "admin_master" : "admin";

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

async function waitForDatabase(retries = 10, delayMs = 3000): Promise<void> {
  for (let i = 1; i <= retries; i++) {
    try {
      await db.query("SELECT 1");
      console.log("[DB Init] Database connection verified successfully.");
      return;
    } catch (err: any) {
      console.warn(
        `[DB Init] Database connection attempt ${i}/${retries} failed: ${err.message}. Retrying in ${delayMs / 1000}s...`,
      );
      if (i === retries) {
        throw new Error(`Database unreachable after ${retries} attempts.`);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function runBootSequence() {
  try {
    await waitForDatabase();
  } catch (dbErr: any) {
    console.error(
      "[Boot Sequence] Critical: Could not connect to database on startup.",
      dbErr.message,
    );
    try {
      const fs = await import("fs");
      fs.writeFileSync(
        "./db_update_status.txt",
        "CRITICAL ERROR: " + dbErr.message + "\n" + dbErr.stack,
      );
    } catch {}
    return;
  }

  await migrateRoles();
  await ensureMasterUser();

  try {
    const fs = await import("fs");
    const targetEmails = ["vw2digital@gmail.com"];
    let logMsg = "";

    for (const targetEmail of targetEmails) {
      const userRows = (await db.query("SELECT id FROM users WHERE email = ? LIMIT 1", [
        targetEmail.trim().toLowerCase(),
      ])) as any[];

      if (userRows.length > 0) {
        const userId = userRows[0].id;
        // Delete existing roles for this user
        await db.query("DELETE FROM user_roles WHERE user_id = ?", [userId]);
        // Insert admin_master role
        await db.query(
          "INSERT INTO user_roles (id, user_id, role) VALUES (UUID(), ?, 'admin_master')",
          [userId],
        );

        // Verify/Create license for the admin_master
        const existingSub = (await db.query("SELECT id FROM licenses WHERE tenant_id = ? LIMIT 1", [
          userId,
        ])) as any[];
        if (existingSub.length === 0) {
          const keyHash = createHash("sha256").update(targetEmail).digest("hex");
          await db.query(
            `INSERT INTO licenses (license_key_hash, license_key_preview, client_name, client_email, plan, status, tenant_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [keyHash, targetEmail, "Master Admin", targetEmail, "basic", "active", userId],
          );
        }
        logMsg += `SUCCESS: User ${targetEmail} (ID: ${userId}) updated to admin_master.\n`;
      } else {
        // User doesn't exist, let's provision them with a default password so they can log in
        const userId = randomUUID();
        const defaultPassword = "adminmaster123";
        const passwordHash = await bcrypt.hash(defaultPassword, 10);

        await db.transaction(async (conn) => {
          // 1. Insert into users
          await conn.execute("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)", [
            userId,
            targetEmail,
            passwordHash,
          ]);

          // 2. Insert into user_roles
          await conn.execute(
            "INSERT INTO user_roles (id, user_id, role) VALUES (UUID(), ?, 'admin_master')",
            [userId],
          );

          // 3. Insert into profiles
          await conn.execute("INSERT INTO profiles (id, email, display_name) VALUES (?, ?, ?)", [
            userId,
            targetEmail,
            "Admin Master",
          ]);

          // 4. Create license
          const keyHash = createHash("sha256").update(targetEmail).digest("hex");
          await conn.execute(
            `INSERT INTO licenses (license_key_hash, license_key_preview, client_name, client_email, plan, status, tenant_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [keyHash, targetEmail, "Admin Master", targetEmail, "basic", "active", userId],
          );
        });

        logMsg += `SUCCESS: Created new user ${targetEmail} with role adminmaster. Default password is '${defaultPassword}'.\n`;
      }
    }

    fs.writeFileSync("./db_update_status.txt", logMsg + "\nTimestamp: " + new Date().toISOString());
    console.log("[Roles Patch]", logMsg);
  } catch (patchErr: any) {
    console.error("[Roles Patch] Error executing patch:", patchErr);
    try {
      const fs = await import("fs");
      fs.writeFileSync(
        "./db_update_status.txt",
        "ERROR: " + patchErr.message + "\n" + patchErr.stack,
      );
    } catch {}
  }
}

// ─── Guards via globalThis ────────────────────────────────────────────────────
// Variáveis de módulo (let x = false) são resetadas a cada HMR do Vite, fazendo
// o boot sequence e os workers rodarem múltiplas vezes em dev.
// Usar globalThis garante que esses flags persistem entre reloads do módulo.
const _g = globalThis as any;

if (!_g.__bootSequenceStarted) {
  _g.__bootSequenceStarted = true;
  // Aguarda 2 s para o pool estabilizar antes de rodar as migrações de boot
  setTimeout(() => {
    runBootSequence().catch(console.error);
  }, 2000);
}

function startQueueProcessor() {
  if (_g.__queueIntervalStarted) return;
  _g.__queueIntervalStarted = true;
  console.log("[Queue] Starting background queue processor (every 60s)...");

  // Aguarda 10 s para o boot sequence terminar antes do primeiro processamento
  setTimeout(() => {
    processOnce().catch((e) => console.error("[Queue Init Error]", e));
  }, 10000);

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
function startLicenseChecker() {
  if (_g.__licenseCheckStarted) return;
  _g.__licenseCheckStarted = true;
  console.log("[License] Starting background license checker (every 6 hours)...");

  // Run initial check after 20s (após boot sequence)
  setTimeout(() => {
    checkLicense().catch((e) => console.error("[License Init Error]", e));
  }, 20000);

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

// --- Rate Limiting (in-memory, per-IP sliding window) ---
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_AUTH = 60; // max 60 auth requests per minute per IP
const RATE_LIMIT_WEBHOOK = 200; // max 200 webhook requests per minute per IP

function getRateLimitKey(ip: string, bucket: string): string {
  return `${bucket}:${ip}`;
}

function isRateLimited(ip: string, bucket: string, maxRequests: number): boolean {
  const key = getRateLimitKey(ip, bucket);
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > maxRequests;
}

// Cleanup stale entries every 5 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 300_000);

// --- Background Billing Expiration Checker ---
function startBillingChecker() {
  if (_g.__billingCheckerStarted) return;
  _g.__billingCheckerStarted = true;
  console.log("[Billing] Starting background billing expiration checker (every 24 hours)...");

  // Run initial check after 30s (após boot sequence e fila)
  setTimeout(async () => {
    try {
      const { runBillingJob } = await import("./lib/billing-job");
      await runBillingJob();
    } catch (e) {
      console.error("[Billing Job Init Error]", e);
    }
  }, 30000);

  // Every 24 hours
  setInterval(async () => {
    try {
      const { runBillingJob } = await import("./lib/billing-job");
      await runBillingJob();
    } catch (e) {
      console.error("[Billing Job Error]", e);
    }
  }, 86400000);
}

startBillingChecker();

// --- CORS allowed origins ---
const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
);

function getCorsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "";

  // In development, allow all origins. In production, enforce the whitelist.
  const isAllowed =
    process.env.NODE_ENV !== "production" ||
    ALLOWED_ORIGINS.size === 0 ||
    ALLOWED_ORIGINS.has(origin);

  return {
    "Access-Control-Allow-Origin": isAllowed ? origin || "*" : "",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      // --- CORS Preflight ---
      if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
        return new Response(null, { status: 204, headers: getCorsHeaders(request) });
      }

      // --- Rate Limiting ---
      const clientIp =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("cf-connecting-ip") ||
        "unknown";

      if (url.pathname.startsWith("/api/auth/")) {
        if (isRateLimited(clientIp, "auth", RATE_LIMIT_AUTH)) {
          return new Response(JSON.stringify({ error: "Muitas tentativas. Aguarde um momento." }), {
            status: 429,
            headers: { "Content-Type": "application/json", "Retry-After": "60" },
          });
        }
      }

      if (
        url.pathname.startsWith("/api/public/whatsapp-webhook") ||
        url.pathname.startsWith("/api/public/facebook-webhook") ||
        url.pathname.startsWith("/api/public/instagram-webhook") ||
        url.pathname.startsWith("/api/public/webhooks/incoming/")
      ) {
        if (isRateLimited(clientIp, "webhook", RATE_LIMIT_WEBHOOK)) {
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429,
            headers: { "Content-Type": "application/json", "Retry-After": "60" },
          });
        }
      }

      if (url.pathname === "/api/license/debug") {
        return new Response(
          JSON.stringify({
            role: "admin_master",
            standalone: true,
            status: "active",
            message: "Plataforma BLIV CRM operando em modo standalone local.",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
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
            },
          );
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      try {
        const fs = await import("fs");
        fs.writeFileSync(
          "./ssr_error.log",
          "FETCH CATCH:\n" + (error instanceof Error ? error.stack : String(error)) + "\n",
        );
      } catch {}
      return brandedErrorResponse();
    }
  },
};
