// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import db from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";
import { testConnection } from "@/lib/mercadopago";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

async function checkAdmin(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
  const token = authHeader.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded || !decoded.sub) {
      return { ok: false, status: 401, error: "Unauthorized" };
    }
    if (decoded.role !== "adminmaster" && decoded.role !== "owner") {
      return { ok: false, status: 403, error: "Forbidden: Admin access required" };
    }
    return { ok: true, decoded };
  } catch (e) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }
}

function maskKey(key: string | null | undefined): string {
  if (!key) return "";
  if (key.length <= 10) return "********";
  return key.slice(0, 8) + "..." + key.slice(-4);
}

function isMasked(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.includes("...");
}

export const Route = createFileRoute("/api/admin/payment-gateways/mercadopago")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await checkAdmin(request);
        if (!auth.ok) {
          return new Response(JSON.stringify({ error: auth.error }), {
            status: auth.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const rows = (await db.query(
            "SELECT * FROM payment_gateway_settings WHERE tenant_id = 'global' LIMIT 1",
          )) as any[];

          const siteUrl = process.env.SITE_URL || "http://localhost:3000";
          const webhookUrl = `${siteUrl.replace(/\/+$/, "")}/api/webhooks/mercadopago`;

          if (rows.length === 0) {
            return new Response(
              JSON.stringify({
                environment: "sandbox",
                checkout_mode: "redirect",
                sandbox_public_key: "",
                sandbox_client_id: "",
                production_public_key: "",
                production_client_id: "",
                sandbox_access_token: "",
                sandbox_client_secret: "",
                production_access_token: "",
                production_client_secret: "",
                webhook_secret: "",
                webhook_url: webhookUrl,
              }),
              {
                status: 200,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const settings = rows[0];
          
          return new Response(
            JSON.stringify({
              environment: settings.environment,
              checkout_mode: settings.checkout_mode,
              sandbox_public_key: settings.sandbox_public_key || "",
              sandbox_client_id: settings.sandbox_client_id || "",
              production_public_key: settings.production_public_key || "",
              production_client_id: settings.production_client_id || "",
              sandbox_access_token: maskKey(settings.sandbox_access_token),
              sandbox_client_secret: maskKey(settings.sandbox_client_secret),
              production_access_token: maskKey(settings.production_access_token),
              production_client_secret: maskKey(settings.production_client_secret),
              webhook_secret: maskKey(settings.webhook_secret),
              webhook_url: webhookUrl,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      PUT: async ({ request }) => {
        const auth = await checkAdmin(request);
        if (!auth.ok) {
          return new Response(JSON.stringify({ error: auth.error }), {
            status: auth.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const body = await request.json();
          const {
            environment,
            checkout_mode,
            sandbox_public_key,
            sandbox_client_id,
            production_public_key,
            production_client_id,
            sandbox_access_token,
            sandbox_client_secret,
            production_access_token,
            production_client_secret,
            webhook_secret,
          } = body;

          // Fetch existing to handle masked secrets
          const existingRows = (await db.query(
            "SELECT * FROM payment_gateway_settings WHERE tenant_id = 'global' LIMIT 1",
          )) as any[];
          const existing = existingRows[0] || {};

          let sAccessToken = existing.sandbox_access_token || null;
          let sClientSecret = existing.sandbox_client_secret || null;
          let pAccessToken = existing.production_access_token || null;
          let pClientSecret = existing.production_client_secret || null;
          let wSecret = existing.webhook_secret || null;

          if (sandbox_access_token && !isMasked(sandbox_access_token)) {
            sAccessToken = encrypt(sandbox_access_token);
          }
          if (sandbox_client_secret && !isMasked(sandbox_client_secret)) {
            sClientSecret = encrypt(sandbox_client_secret);
          }
          if (production_access_token && !isMasked(production_access_token)) {
            pAccessToken = encrypt(production_access_token);
          }
          if (production_client_secret && !isMasked(production_client_secret)) {
            pClientSecret = encrypt(production_client_secret);
          }
          if (webhook_secret && !isMasked(webhook_secret)) {
            wSecret = encrypt(webhook_secret);
          }

          // Insert or update
          await db.query(
            `INSERT INTO payment_gateway_settings (
              tenant_id, environment, checkout_mode,
              sandbox_public_key, sandbox_client_id, sandbox_access_token, sandbox_client_secret,
              production_public_key, production_client_id, production_access_token, production_client_secret,
              webhook_secret
            ) VALUES ('global', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              environment = VALUES(environment),
              checkout_mode = VALUES(checkout_mode),
              sandbox_public_key = VALUES(sandbox_public_key),
              sandbox_client_id = VALUES(sandbox_client_id),
              sandbox_access_token = VALUES(sandbox_access_token),
              sandbox_client_secret = VALUES(sandbox_client_secret),
              production_public_key = VALUES(production_public_key),
              production_client_id = VALUES(production_client_id),
              production_access_token = VALUES(production_access_token),
              production_client_secret = VALUES(production_client_secret),
              webhook_secret = VALUES(webhook_secret)`,
            [
              environment || "sandbox",
              checkout_mode || "redirect",
              sandbox_public_key || null,
              sandbox_client_id || null,
              sAccessToken,
              sClientSecret,
              production_public_key || null,
              production_client_id || null,
              pAccessToken,
              pClientSecret,
              wSecret,
            ],
          );

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
