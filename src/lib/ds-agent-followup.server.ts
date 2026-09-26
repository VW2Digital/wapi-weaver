import crypto from "crypto";
import {
  listChannelConnectionsForTenant,
  resolveChannelAccessToken,
} from "@/lib/messaging/channel-connection.service";
import { dbAdmin } from "@/integrations/mysql/client.server";
import {
  classifyFollowupSendError,
  decideFollowup,
  followupChannelDecision,
  resolveFollowupBody,
  type FollowupChatMessage,
  type FollowupRecurrence,
  type FollowupRunRecord,
  type FollowupRunState,
} from "@/lib/ds-agent-followup-decision";

function logInfo(message: string, data?: any) {
  console.log(`[ds-agent-followup] ${message}`, data ? JSON.stringify(data) : "");
}

function logError(message: string, data?: any) {
  console.error(`[ds-agent-followup] ${message}`, data ? JSON.stringify(data) : "");
}

function followupRunId(followupId: string, sessionId: string, cycleKey: string): string {
  const hex = crypto.createHash("sha1").update(`${followupId}|${sessionId}|${cycleKey}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function parseJson(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, any>;
  try {
    return JSON.parse(String(value));
  } catch {
    return {};
  }
}

function isDuplicate(err: any): boolean {
  return err?.errno === 1062 || err?.code === "ER_DUP_ENTRY";
}

async function resolveWhatsAppAuth(tenantId: string) {
  const channels = await listChannelConnectionsForTenant(tenantId, "whatsapp");
  const matched = channels.find((c) => c.status === "active") || channels[0];
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

function statusFromLog(message: string): FollowupRunState | null {
  if (message === "followup_processing") return "processing";
  if (message === "followup_sent") return "sent";
  if (message === "followup_failed") return "failed";
  if (message === "followup_blocked") return "blocked";
  if (message === "followup_cancelled") return "cancelled";
  return null;
}

async function loadRuns(db: any, tenantId: string, agentId: string): Promise<FollowupRunRecord[]> {
  const rows = (await db.query(
    `SELECT message, details, created_at
     FROM ds_agent_logs
     WHERE tenant_id = ? AND agent_id = ?
       AND message IN (
         'followup_processing',
         'followup_sent',
         'followup_failed',
         'followup_blocked',
         'followup_cancelled'
       )
     ORDER BY created_at DESC
     LIMIT 200`,
    [tenantId, agentId],
  )) as Array<{ message: string; details: unknown; created_at: Date }>;

  const runs: FollowupRunRecord[] = [];
  for (const row of rows || []) {
    const status = statusFromLog(row.message);
    const details = parseJson(row.details);
    if (!status || !details.followup_id || !details.session_id || !details.cycle_key) continue;
    runs.push({
      followupId: String(details.followup_id),
      sessionId: String(details.session_id),
      cycleKey: String(details.cycle_key),
      status,
      createdAt: new Date(row.created_at).getTime(),
      attempt: Number(details.attempt) || 1,
    });
  }
  return runs;
}

async function claimRun(
  db: any,
  params: {
    id: string;
    tenantId: string;
    agentId: string;
    message: string;
    level: "info" | "warn" | "error";
    details: Record<string, unknown>;
    takeover: boolean;
  },
): Promise<"created" | "owned" | "busy"> {
  const payload = JSON.stringify(params.details);
  try {
    await db.query(
      `INSERT INTO ds_agent_logs (id, tenant_id, agent_id, level, message, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [params.id, params.tenantId, params.agentId, params.level, params.message, payload],
    );
    return "created";
  } catch (err) {
    if (!isDuplicate(err)) throw err;
  }

  if (!params.takeover) return "busy";

  const updated = (await db.query(
    `UPDATE ds_agent_logs
     SET message = ?, level = ?, details = ?, created_at = CURRENT_TIMESTAMP
     WHERE id = ? AND tenant_id = ?
       AND (
         message = 'followup_failed'
         OR (message = 'followup_processing' AND created_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE))
       )`,
    [params.message, params.level, payload, params.id, params.tenantId],
  )) as { affectedRows?: number };
  return Number(updated?.affectedRows || 0) > 0 ? "owned" : "busy";
}

async function finishRun(
  db: any,
  params: {
    id: string;
    tenantId: string;
    message: string;
    level: "info" | "warn" | "error";
    details: Record<string, unknown>;
  },
) {
  await db.query(
    `UPDATE ds_agent_logs
     SET message = ?, level = ?, details = ?
     WHERE id = ? AND tenant_id = ?`,
    [params.message, params.level, JSON.stringify(params.details), params.id, params.tenantId],
  );
}

/**
 * Processa follow-ups vencidos.
 * O prazo conta da última mensagem de saída que ainda aguarda o lead.
 * Uma resposta do lead cancela o ciclo. O estado fica em ds_agent_logs,
 * então um reinício do servidor não perde nem duplica o disparo.
 */
export async function processDsAgentFollowupsOnce(): Promise<{
  scanned: number;
  sent: number;
  errors: number;
  cancelled: number;
  blocked: number;
}> {
  const { default: db } = await import("./db");
  let scanned = 0;
  let sent = 0;
  let errors = 0;
  let cancelled = 0;
  let blocked = 0;

  try {
    const followups = (await db.query(
      `SELECT f.*, a.is_active, a.status AS agent_status
       FROM ds_agent_followups f
       INNER JOIN ds_agents a ON a.id = f.agent_id AND a.tenant_id = f.tenant_id
       WHERE (a.is_active = 1 OR a.is_active = TRUE OR a.status = 'active')
         AND (f.active = 1 OR f.active = TRUE)`,
    )) as any[];

    if (!followups?.length) return { scanned, sent, errors, cancelled, blocked };

    for (const fu of followups) {
      const tenantId = String(fu.tenant_id);
      const agentId = String(fu.agent_id);
      const followupId = String(fu.id);
      const runs = await loadRuns(db, tenantId, agentId);

      const sessions = (await db.query(
        `SELECT s.id AS session_id, s.contact_id, s.status AS session_status,
                COALESCE(c.whatsapp_number, c.phone_e164) AS phone,
                c.name AS contact_name
         FROM ds_agent_sessions s
         INNER JOIN contacts c ON c.id = s.contact_id
         WHERE s.tenant_id = ? AND s.agent_id = ?
         LIMIT 100`,
        [tenantId, agentId],
      )) as Array<{
        session_id: string;
        contact_id: string;
        session_status: string;
        phone?: string;
        contact_name?: string;
      }>;

      for (const session of sessions || []) {
        scanned++;
        const phoneDigits = String(session.phone || "").replace(/\D/g, "");
        if (!phoneDigits || !session.contact_id) continue;

        try {
          const messageRows = (await db.query(
            `SELECT id, direction, type, body, channel, metadata, created_at
             FROM direct_messages
             WHERE tenant_id = ?
               AND REPLACE(REPLACE(IFNULL(contact_phone, ''), '+', ''), ' ', '') = ?
             ORDER BY created_at DESC
             LIMIT 40`,
            [tenantId, phoneDigits],
          )) as Array<{
            id: string;
            direction: string;
            type?: string | null;
            channel?: string | null;
            metadata?: unknown;
            created_at: Date;
          }>;

          const messages: FollowupChatMessage[] = (messageRows || []).map((row) => {
            const metadata = parseJson(row.metadata);
            return {
              id: String(row.id),
              direction: row.direction === "incoming" ? "incoming" : "outgoing",
              createdAt: new Date(row.created_at).getTime(),
              type: row.type,
              followupId: metadata.followup_id ? String(metadata.followup_id) : null,
              channel: row.channel || "whatsapp",
            };
          });

          const decision = decideFollowup({
            now: Date.now(),
            followupId,
            sessionId: session.session_id,
            active: fu.active == null ? true : Boolean(Number(fu.active)),
            recurrence: String(fu.recurrence || "unico").toLowerCase() as FollowupRecurrence,
            waitAmount: Number(fu.wait_amount) || 1,
            waitUnit: String(fu.wait_unit || "minutos"),
            sessionStatus: String(session.session_status || "active"),
            messages,
            runs,
          });

          if (decision.action === "skip") continue;

          const runId = followupRunId(followupId, session.session_id, decision.cycleKey);
          const baseDetails = {
            followup_id: followupId,
            session_id: session.session_id,
            contact_id: session.contact_id,
            cycle_key: decision.cycleKey,
            anchor_at: new Date(decision.anchorAt).toISOString(),
            channel: messages.find((message) => message.id === decision.cycleKey)?.channel || messages[0]?.channel || "whatsapp",
          };

          if (decision.action === "cancel") {
            const claim = await claimRun(db, {
              id: runId,
              tenantId,
              agentId,
              message: "followup_cancelled",
              level: "info",
              takeover: false,
              details: {
                ...baseDetails,
                status: "cancelled",
                reason: decision.reason === "customer_replied"
                  ? "Cliente respondeu antes do disparo"
                  : "Conversa encerrada ou transferida",
                attempt: 1,
              },
            });
            if (claim === "created") cancelled++;
            continue;
          }

          const claim = await claimRun(db, {
            id: runId,
            tenantId,
            agentId,
            message: "followup_processing",
            level: "info",
            takeover: decision.attempt > 1,
            details: {
              ...baseDetails,
              status: "processing",
              scheduled_for: new Date(decision.scheduledFor).toISOString(),
              attempt: decision.attempt,
            },
          });
          if (claim === "busy") continue;

          const lastChannel = messages[0]?.channel;
          const channelDecision = followupChannelDecision(lastChannel);
          if (!channelDecision.ok) {
            await finishRun(db, {
              id: runId,
              tenantId,
              message: "followup_blocked",
              level: "warn",
              details: {
                ...baseDetails,
                status: "blocked",
                reason: channelDecision.reason,
                attempt: decision.attempt,
                executed_at: new Date().toISOString(),
              },
            });
            blocked++;
            continue;
          }

          let generated: string | null = null;
          if (String(fu.type).toLowerCase() === "generativo") {
            const { runDsAgentCompletion } = await import("./ds-agent-runtime.server");
            const gen = await runDsAgentCompletion({
              agentId,
              tenantId,
              phoneDigits,
              purpose: "followup",
              enableTools: false,
              userMessage:
                "Gere somente a mensagem curta de reengajamento, sem explicação e sem inventar dados.\n" +
                `Instruções do follow-up:\n${String(fu.message || "").trim()}`,
            });
            generated = gen.ok ? gen.reply : null;
            if (!generated) {
              await finishRun(db, {
                id: runId,
                tenantId,
                message: "followup_failed",
                level: "error",
                details: {
                  ...baseDetails,
                  status: "failed",
                  phase: "generation",
                  reason: gen.error || "A geração da mensagem falhou",
                  attempt: decision.attempt,
                  executed_at: new Date().toISOString(),
                },
              });
              errors++;
              continue;
            }
          }

          const body = resolveFollowupBody({
            type: String(fu.type).toLowerCase() === "generativo" ? "generativo" : "manual",
            template: String(fu.message || ""),
            leadName: String(session.contact_name || ""),
            generated,
          });
          if (!body.text) {
            await finishRun(db, {
              id: runId,
              tenantId,
              message: "followup_failed",
              level: "error",
              details: {
                ...baseDetails,
                status: "failed",
                phase: "generation",
                reason: "Mensagem vazia",
                attempt: decision.attempt,
                executed_at: new Date().toISOString(),
              },
            });
            errors++;
            continue;
          }

          const auth = await resolveWhatsAppAuth(tenantId);
          if (!auth?.accessToken || !auth.sendResourceId) {
            await finishRun(db, {
              id: runId,
              tenantId,
              message: "followup_blocked",
              level: "warn",
              details: {
                ...baseDetails,
                status: "blocked",
                channel: "whatsapp",
                reason: "WhatsApp sem credencial ativa para este envio",
                attempt: decision.attempt,
                executed_at: new Date().toISOString(),
                source: body.source,
              },
            });
            blocked++;
            continue;
          }

          const response = await fetch(
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
                text: { body: body.text },
              }),
            },
          );

          if (!response.ok) {
            const errBody = await response.text();
            const classified = classifyFollowupSendError(response.status, errBody);
            await finishRun(db, {
              id: runId,
              tenantId,
              message: classified.state === "blocked" ? "followup_blocked" : "followup_failed",
              level: classified.state === "blocked" ? "warn" : "error",
              details: {
                ...baseDetails,
                status: classified.state,
                channel: "whatsapp",
                reason: classified.reason,
                attempt: decision.attempt,
                executed_at: new Date().toISOString(),
                source: body.source,
              },
            });
            if (classified.state === "blocked") blocked++;
            else errors++;
            continue;
          }

          const responseBody = (await response.json().catch(() => null)) as any;
          const providerMessageId = responseBody?.messages?.[0]?.id ?? null;
          await dbAdmin.from("direct_messages").insert({
            id: crypto.randomUUID(),
            tenant_id: tenantId,
            user_id: tenantId,
            contact_phone: phoneDigits,
            direction: "outgoing",
            type: "text",
            body: body.text,
            wa_message_id: providerMessageId,
            provider_message_id: providerMessageId,
            provider_account_id: auth.sendResourceId,
            channel: "whatsapp",
            status: "sent",
            metadata: {
              ds_agent: true,
              ds_agent_id: agentId,
              followup_id: followupId,
              followup_run_id: runId,
            },
          });

          await finishRun(db, {
            id: runId,
            tenantId,
            message: "followup_sent",
            level: "info",
            details: {
              ...baseDetails,
              status: "sent",
              channel: "whatsapp",
              reason: "Mensagem enviada",
              attempt: decision.attempt,
              executed_at: new Date().toISOString(),
              provider_message_id: providerMessageId,
              source: body.source,
              phase: body.source === "generated" ? "sent_after_generation" : "sent",
            },
          });
          sent++;
          logInfo("Follow-up enviado", { agentId, followupId, sessionId: session.session_id });
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

  return { scanned, sent, errors, cancelled, blocked };
}
