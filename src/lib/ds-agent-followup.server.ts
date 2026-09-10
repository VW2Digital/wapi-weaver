import crypto from "crypto";
import {
  listChannelConnectionsForTenant,
  resolveChannelAccessToken,
} from "@/lib/messaging/channel-connection.service";
import { dbAdmin } from "@/integrations/mysql/client.server";

function logInfo(message: string, data?: any) {
  console.log(`[ds-agent-followup] ${message}`, data ? JSON.stringify(data) : "");
}

function logError(message: string, data?: any) {
  console.error(`[ds-agent-followup] ${message}`, data ? JSON.stringify(data) : "");
}

function waitToMs(amount: number, unit: string): number {
  const n = Math.max(1, Number(amount) || 1);
  const u = String(unit || "minutos").toLowerCase();
  if (u.startsWith("hora")) return n * 60 * 60 * 1000;
  if (u.startsWith("dia")) return n * 24 * 60 * 60 * 1000;
  return n * 60 * 1000;
}

async function resolveWhatsAppAuth(tenantId: string) {
  const channels = await listChannelConnectionsForTenant(tenantId, "whatsapp");
  const matched =
    channels.find((c) => c.status === "active") || channels[0];
  if (!matched) return null;
  const accessToken = resolveChannelAccessToken(matched);
  if (!accessToken) return null;

  const { default: db } = await import("./db");
  const graphRows = matched.metaAppConnectionId
    ? ((await db.query(
        `SELECT graph_version FROM meta_app_connections WHERE id = ? LIMIT 1`,
        [matched.metaAppConnectionId],
      )) as Array<{ graph_version?: string | null }>)
    : [];

  return {
    accessToken,
    apiVersion: graphRows[0]?.graph_version || process.env.META_GRAPH_VERSION || "v26.0",
    sendResourceId: matched.externalAccountId,
  };
}

async function alreadySent(
  db: any,
  tenantId: string,
  agentId: string,
  followupId: string,
  sessionId: string,
  recurrence: string,
): Promise<boolean> {
  const rows = (await db.query(
    `SELECT id, created_at, details FROM ds_agent_logs
     WHERE tenant_id = ? AND agent_id = ? AND message = 'followup_sent'
     ORDER BY created_at DESC
     LIMIT 50`,
    [tenantId, agentId],
  )) as Array<{ id: string; created_at: Date; details: any }>;

  const matches = (rows || []).filter((r) => {
    let details = r.details;
    if (typeof details === "string") {
      try {
        details = JSON.parse(details);
      } catch {
        details = {};
      }
    }
    return details?.followup_id === followupId && details?.session_id === sessionId;
  });

  if (!matches.length) return false;

  const last = matches[0];
  const rec = String(recurrence || "unico").toLowerCase();
  if (rec === "unico") return true;

  const lastAt = new Date(last.created_at).getTime();
  if (rec === "diario") {
    return Date.now() - lastAt < 24 * 60 * 60 * 1000;
  }
  // recorrente: respeita o mesmo intervalo do wait (tratado pelo caller via last inbound)
  return Date.now() - lastAt < 60 * 60 * 1000;
}

async function markSent(
  db: any,
  tenantId: string,
  agentId: string,
  followupId: string,
  sessionId: string,
  contactId: string,
) {
  await db.query(
    `INSERT INTO ds_agent_logs (id, tenant_id, agent_id, level, message, details)
     VALUES (?, ?, ?, 'info', 'followup_sent', ?)`,
    [
      crypto.randomUUID(),
      tenantId,
      agentId,
      JSON.stringify({ followup_id: followupId, session_id: sessionId, contact_id: contactId }),
    ],
  );
}

/**
 * Processa follow-ups vencidos de sessões DS ativas.
 * Critério: última mensagem incoming do contato é mais antiga que wait_amount.
 */
export async function processDsAgentFollowupsOnce(): Promise<{
  scanned: number;
  sent: number;
  errors: number;
}> {
  const { default: db } = await import("./db");
  let scanned = 0;
  let sent = 0;
  let errors = 0;

  try {
    const followups = (await db.query(
      `SELECT f.*, a.is_active, a.model, a.provider, a.api_key_encrypted
       FROM ds_agent_followups f
       INNER JOIN ds_agents a ON a.id = f.agent_id AND a.tenant_id = f.tenant_id
       WHERE (a.is_active = 1 OR a.is_active = TRUE OR a.status = 'active')`,
    )) as any[];

    if (!followups?.length) return { scanned: 0, sent: 0, errors: 0 };

    for (const fu of followups) {
      const tenantId = String(fu.tenant_id);
      const agentId = String(fu.agent_id);
      const waitMs = waitToMs(fu.wait_amount, fu.wait_unit);

      const sessions = (await db.query(
        `SELECT s.id AS session_id, s.contact_id, s.updated_at,
                COALESCE(c.whatsapp_number, c.phone_e164) AS phone
         FROM ds_agent_sessions s
         INNER JOIN contacts c ON c.id = s.contact_id
         WHERE s.tenant_id = ? AND s.agent_id = ? AND s.status = 'active'
         LIMIT 100`,
        [tenantId, agentId],
      )) as Array<{
        session_id: string;
        contact_id: string;
        updated_at: Date;
        phone?: string;
      }>;

      for (const session of sessions || []) {
        scanned++;
        const phoneDigits = String(session.phone || "").replace(/\D/g, "");
        if (!phoneDigits || !session.contact_id) continue;

        try {
          const lastInbound = (await db.query(
            `SELECT created_at FROM direct_messages
             WHERE user_id = ? AND contact_phone = ? AND direction = 'incoming'
             ORDER BY created_at DESC
             LIMIT 1`,
            [tenantId, phoneDigits],
          )) as Array<{ created_at: Date }>;

          const anchor = lastInbound?.[0]?.created_at
            ? new Date(lastInbound[0].created_at).getTime()
            : new Date(session.updated_at).getTime();

          if (Date.now() - anchor < waitMs) continue;

          if (
            await alreadySent(
              db,
              tenantId,
              agentId,
              String(fu.id),
              session.session_id,
              String(fu.recurrence),
            )
          ) {
            continue;
          }

          let messageText = String(fu.message || "").trim();
          if (String(fu.type).toLowerCase() === "generativo") {
            const { runDsAgentCompletion } = await import("./ds-agent-runtime.server");
            const gen = await runDsAgentCompletion({
              agentId,
              tenantId,
              phoneDigits,
              userMessage: `Gere uma mensagem curta de follow-up WhatsApp baseada neste roteiro (não explique, só a mensagem):\n${messageText}`,
              enableTools: false,
            });
            if (gen.ok && gen.reply) messageText = gen.reply;
          }

          if (!messageText) continue;

          const auth = await resolveWhatsAppAuth(tenantId);
          if (!auth?.accessToken || !auth.sendResourceId) {
            errors++;
            continue;
          }

          const r = await fetch(
            `https://graph.facebook.com/${auth.apiVersion}/${auth.sendResourceId}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${auth.accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: phoneDigits,
                type: "text",
                text: { body: messageText },
              }),
            },
          );

          if (!r.ok) {
            const errBody = await r.text();
            logError("Falha ao enviar follow-up", { errBody: errBody.slice(0, 300), agentId });
            errors++;
            continue;
          }

          const responseBody = (await r.json().catch(() => null)) as any;
          await dbAdmin.from("direct_messages").insert({
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            user_id: tenantId,
            contact_phone: phoneDigits,
            direction: "outgoing",
            type: "text",
            body: messageText,
            wa_message_id: responseBody?.messages?.[0]?.id ?? null,
            provider_message_id: responseBody?.messages?.[0]?.id ?? null,
            provider_account_id: auth.sendResourceId,
            channel: "whatsapp",
            status: "sent",
            metadata: {
              ds_agent: true,
              ds_agent_id: agentId,
              followup_id: fu.id,
            },
          });

          await markSent(db, tenantId, agentId, String(fu.id), session.session_id, session.contact_id);
          sent++;
          logInfo("Follow-up enviado", { agentId, phoneDigits, followupId: fu.id });
        } catch (err: any) {
          errors++;
          logError("Erro no follow-up da sessão", {
            error: err?.message || String(err),
            sessionId: session.session_id,
          });
        }
      }
    }
  } catch (err: any) {
    logError("processDsAgentFollowupsOnce falhou", { error: err?.message || String(err) });
  }

  return { scanned, sent, errors };
}
