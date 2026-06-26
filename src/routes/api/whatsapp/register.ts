import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { dbAdmin } from "@/integrations/mysql/client.server";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

function getAuthUserId(request: Request): { userId: string; role: string } {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.slice(7).trim();
  const decoded = jwt.verify(token, JWT_SECRET) as any;
  if (!decoded?.sub) throw new Error("Unauthorized");
  return { userId: decoded.sub, role: decoded.role || "user" };
}

function redactMetaError(err: any): string {
  const e = err?.error ?? err;
  return e?.message || "Erro desconhecido retornado pela Meta API.";
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Aceita tanto camelCase quanto UPPERCASE para máxima flexibilidade com integrações externas
const registerSchema = z.object({
  phoneId: z.string().trim().optional(),
  PHONE_NUMBER_ID: z.string().trim().optional(),
  pin: z.string().trim().length(6, "O PIN deve conter exatamente 6 dígitos").optional(),
  PIN: z.string().trim().length(6, "O PIN deve conter exatamente 6 dígitos").optional(),
});

export const Route = createFileRoute("/api/whatsapp/register")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // 1. Autenticação via JWT
          const { userId } = getAuthUserId(request);

          // 2. Parser dos parâmetros recebidos
          const rawBody = await request.json().catch(() => ({}));
          const parsed = registerSchema.parse(rawBody);

          const phoneId = (parsed.phoneId || parsed.PHONE_NUMBER_ID || "").trim();
          const pin = (parsed.pin || parsed.PIN || "").trim();

          if (!phoneId) {
            return json(
              { success: false, message: "O campo PHONE_NUMBER_ID ou phoneId é obrigatório." },
              400,
            );
          }
          if (!pin) {
            return json({ success: false, message: "O campo PIN ou pin é obrigatório." }, 400);
          }

          // 3. Buscar credenciais da Meta do perfil do usuário (usando effectiveUserId)
          const { resolveEffectiveUserId } = await import("@/lib/chat-helpers");
          const effectiveUserId = await resolveEffectiveUserId(userId);

          const { data: p, error: profErr } = await dbAdmin
            .from("profiles")
            .select("whatsapp_access_token, meta_graph_version")
            .eq("id", effectiveUserId)
            .maybeSingle();

          if (profErr) throw new Error(profErr.message);
          if (!p?.whatsapp_access_token) {
            return json(
              {
                success: false,
                message: "Credenciais da Meta (Access Token) não configuradas no sistema.",
              },
              400,
            );
          }

          const apiVersion = p.meta_graph_version || "v20.0";

          // 4. Executar requisição POST de registro para a Meta
          const registerUrl = `https://graph.facebook.com/${apiVersion}/${phoneId}/register`;
          const r = await fetch(registerUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${p.whatsapp_access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              pin: pin,
            }),
          });

          const body = await r.json().catch(() => ({}));
          if (!r.ok) {
            const errorMsg = redactMetaError(body);
            return json({ success: false, message: `Erro da Meta: ${errorMsg}` }, 400);
          }

          // 5. Registro feito com sucesso! Agora salvamos o número como ativo
          // Buscar detalhes do número (display_phone_number) na Meta
          let displayPhone = "";
          try {
            const detailsUrl = `https://graph.facebook.com/${apiVersion}/${phoneId}?fields=display_phone_number`;
            const dr = await fetch(detailsUrl, {
              headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
            });
            const dBody = await dr.json();
            if (dr.ok && dBody?.display_phone_number) {
              displayPhone = dBody.display_phone_number.replace(/\D/g, "");
            }
          } catch (err) {
            // best effort para pegar o telefone legível, não bloqueia o fluxo principal
          }

          // Salvar as configurações no perfil
          const { error: updateErr } = await dbAdmin
            .from("profiles")
            .update({
              whatsapp_phone_number_id: phoneId,
              whatsapp_business_phone: displayPhone || null,
            })
            .eq("id", effectiveUserId);

          if (updateErr) {
            throw new Error(
              `Número registrado na Meta, mas falha ao salvar no banco de dados local: ${updateErr.message}`,
            );
          }

          return json(
            {
              success: true,
              message: "Número registrado e ativado com sucesso!",
              data: body,
            },
            200,
          );
        } catch (e: any) {
          return json(
            { success: false, message: e?.message || "Falha ao processar o registro do número." },
            e?.message === "Unauthorized" ? 401 : 400,
          );
        }
      },

      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
            "Access-Control-Max-Age": "86400",
          },
        }),
    },
  },
});
