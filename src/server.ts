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
