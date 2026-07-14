// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import db from "@/lib/db";
import { decrypt } from "@/lib/encryption";
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

function isMasked(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.includes("...");
}

export const Route = createFileRoute("/api/admin/payment-gateways/mercadopago/test")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await checkAdmin(request);
        if (!auth.ok) {
          return new Response(JSON.stringify({ error: auth.error }), {
            status: auth.status,
            headers: { "Content-Type": "application/json" },
          });
        }

        try {
          const body = await request.json();
          const { environment, sandbox_access_token, production_access_token } = body;

          let targetToken = environment === "production" ? production_access_token : sandbox_access_token;

          if (!targetToken) {
            return new Response(JSON.stringify({ success: false, message: "Token de acesso não fornecido ou incompleto." }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }

          // If the token is masked, retrieve and decrypt the saved token
          if (isMasked(targetToken)) {
            const rows = (await db.query(
              "SELECT sandbox_access_token, production_access_token FROM payment_gateway_settings WHERE tenant_id = 'global' LIMIT 1",
            )) as any[];

            if (rows.length === 0) {
              return new Response(JSON.stringify({ success: false, message: "Nenhum token salvo encontrado para restaurar." }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
              });
            }

            const saved = rows[0];
            const encrypted = environment === "production" ? saved.production_access_token : saved.sandbox_access_token;
            if (!encrypted) {
              return new Response(JSON.stringify({ success: false, message: "Nenhum token criptografado correspondente no banco." }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
              });
            }
            targetToken = decrypt(encrypted);
          }

          console.log(`[MercadoPago Test] Testing connection in environment: ${environment}`);
          const isValid = await testConnection(targetToken);

          if (isValid) {
            return new Response(JSON.stringify({ success: true, message: "Conexão bem-sucedida! As credenciais são válidas." }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          } else {
            return new Response(JSON.stringify({ success: false, message: "Credencial inválida ou ambiente incompatível." }), {
              status: 200, // keep 200 but returning success: false as requested
              headers: { "Content-Type": "application/json" },
            });
          }
        } catch (err: any) {
          console.error("[MercadoPago Test API Error]", err);
          return new Response(JSON.stringify({ success: false, message: `Erro de rede ou configuração incompleta: ${err.message}` }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
