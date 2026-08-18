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

// Background workers flag container
const _g = globalThis as any;

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
        // Rotas públicas (webhooks de entrada, contatos, etc.) devem aceitar qualquer origin
        if (url.pathname.startsWith("/api/public/")) {
          return new Response(null, {
            status: 204,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, X-Idempotency-Key",
              "Access-Control-Max-Age": "86400",
            },
          });
        }
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
