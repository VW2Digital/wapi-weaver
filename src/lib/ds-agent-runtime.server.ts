import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import { dbAdmin } from "@/integrations/mysql/client.server";
import {
  listChannelConnectionsForTenant,
  resolveChannelAccessToken,
} from "@/lib/messaging/channel-connection.service";

function logInfo(message: string, data?: any) {
  console.log(`[ds-agent-runtime] ${message}`, data ? JSON.stringify(data) : "");
}

function logError(message: string, data?: any) {
  console.error(`[ds-agent-runtime] ${message}`, data ? JSON.stringify(data) : "");
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function isGeminiModel(model: string, provider: string): boolean {
  const m = String(model || "").toLowerCase();
  const p = String(provider || "").toLowerCase();
  return m.startsWith("gemini") || p.includes("gemini") || p.includes("google");
}

function splitReplyIntoBlocks(text: string, maxLen = 350): string[] {
  const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  if (normalized.length <= maxLen) return [normalized];

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const blocks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    if (current.trim()) blocks.push(current.trim());
    current = "";
  };

  const appendChunk = (chunk: string) => {
    if (!chunk) return;
    if (!current) {
      current = chunk;
      return;
    }
    if ((current + "\n\n" + chunk).length <= maxLen) {
      current = `${current}\n\n${chunk}`;
      return;
    }
    pushCurrent();
    if (chunk.length <= maxLen) {
      current = chunk;
      return;
    }
    for (let i = 0; i < chunk.length; i += maxLen) {
      const part = chunk.slice(i, i + maxLen).trim();
      if (part) blocks.push(part);
    }
  };

  for (const paragraph of paragraphs) {
    appendChunk(paragraph);
  }
  pushCurrent();
  return blocks.length ? blocks.slice(0, 6) : [normalized.slice(0, maxLen)];
}

async function isWithinAgentAvailability(
  db: any,
  tenantId: string,
  agentId: string,
): Promise<boolean> {
  try {
    const rows = (await db.query(
      `SELECT weekday, start_time, end_time, active
       FROM ds_agent_calendar_availability
       WHERE agent_id = ? AND tenant_id = ?`,
      [agentId, tenantId],
    )) as Array<{ weekday: number; start_time: string; end_time: string; active: number | boolean }>;

    if (!rows?.length) return true; // sem agenda = sempre disponível

    const now = new Date();
    // America/Sao_Paulo approx via locale offset - use explicit UTC-3 for BR default
    const sp = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const jsDay = sp.getDay();
    const mysqlWeekday = jsDay === 0 ? 7 : jsDay;
    const day = rows.find((r) => Number(r.weekday) === mysqlWeekday);
    if (!day || !isTruthyFlag(day.active)) return false;

    const [sh, sm] = String(day.start_time || "08:00:00").split(":").map(Number);
    const [eh, em] = String(day.end_time || "18:00:00").split(":").map(Number);
    const minutes = sp.getHours() * 60 + sp.getMinutes();
    const startMin = (sh || 0) * 60 + (sm || 0);
    const endMin = (eh || 23) * 60 + (em || 59);
    return minutes >= startMin && minutes <= endMin;
  } catch {
    return true;
  }
}

async function findAssignedResponsible(
  tenantId: string,
  phoneDigits: string,
): Promise<{ agentId: string | null; agentName: string | null } | null> {
  try {
    const { default: db } = await import("./db");
    const rows = (await db.query(
      `SELECT ca.agent_id,
              COALESCE(p.full_name, p.display_name, u.email) AS agent_name
       FROM conversation_assignments ca
       LEFT JOIN profiles p ON p.id = ca.agent_id
       LEFT JOIN users u ON u.id = ca.agent_id
       WHERE ca.tenant_id = ? AND ca.contact_phone = ? AND ca.is_active = 1
       ORDER BY ca.assigned_at DESC
       LIMIT 1`,
      [tenantId, phoneDigits],
    )) as Array<{ agent_id?: string | null; agent_name?: string | null }>;
    if (!rows?.[0]) return null;
    return {
      agentId: rows[0].agent_id || null,
      agentName: rows[0].agent_name || null,
    };
  } catch {
    return null;
  }
}

async function sendWhatsAppText(params: {
  auth: { accessToken: string; apiVersion: string; sendResourceId: string };
  phoneDigits: string;
  text: string;
  tenantId: string;
  agentId: string;
  model: string;
}): Promise<boolean> {
  const { auth, phoneDigits, text, tenantId, agentId, model } = params;
  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: phoneDigits,
    type: "text",
    text: { body: text },
  };

  const r = await fetch(
    `https://graph.facebook.com/${auth.apiVersion}/${auth.sendResourceId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!r.ok) {
    const errBody = await r.text();
    logError("Falha ao enviar mensagem do DS Agente", { errBody: errBody.slice(0, 500) });
    return false;
  }

  const responseBody = (await r.json().catch(() => null)) as any;
  await dbAdmin.from("direct_messages").insert({
    id: crypto.randomUUID(),
    tenant_id: tenantId,
    user_id: tenantId,
    contact_phone: phoneDigits,
    direction: "outgoing",
    type: "text",
    body: text,
    wa_message_id: responseBody?.messages?.[0]?.id ?? null,
    provider_message_id: responseBody?.messages?.[0]?.id ?? null,
    provider_account_id: auth.sendResourceId,
    channel: "whatsapp",
    status: "sent",
    metadata: { ds_agent: true, ds_agent_id: agentId, model },
  });
  return true;
}

async function resolveWhatsAppSendAuth(
  tenantId: string,
  phoneNumberId: string,
): Promise<{ accessToken: string; apiVersion: string; sendResourceId: string } | null> {
  try {
    const channels = await listChannelConnectionsForTenant(tenantId, "whatsapp");
    const matched =
      channels.find((channel) => channel.externalAccountId === phoneNumberId && channel.status === "active") ||
      channels.find((channel) => channel.status === "active") ||
      channels.find((channel) => channel.externalAccountId === phoneNumberId) ||
      channels[0];
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
      sendResourceId: matched.externalAccountId || phoneNumberId,
    };
  } catch (error) {
    logError("Falha ao resolver auth WhatsApp do DS Agente", {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function resolveContactId(tenantId: string, phoneDigits: string): Promise<string | null> {
  const { default: db } = await import("./db");
  const rows = (await db.query(
    `SELECT id FROM contacts
     WHERE (tenant_id = ? OR user_id = ?)
       AND (phone_e164 = ? OR whatsapp_number = ? OR REPLACE(REPLACE(phone_e164, '+', ''), ' ', '') = ?)
     LIMIT 1`,
    [tenantId, tenantId, phoneDigits, phoneDigits, phoneDigits],
  )) as Array<{ id: string }>;
  return rows?.[0]?.id || null;
}

export async function findActiveDsAgentSession(
  tenantId: string,
  phoneDigits: string,
): Promise<{ sessionId: string; agentId: string } | null> {
  try {
    const contactId = await resolveContactId(tenantId, phoneDigits);
    if (!contactId) return null;

    const { default: db } = await import("./db");
    const rows = (await db.query(
      `SELECT id, agent_id FROM ds_agent_sessions
       WHERE tenant_id = ? AND contact_id = ? AND status = 'active'
       ORDER BY updated_at DESC
       LIMIT 1`,
      [tenantId, contactId],
    )) as Array<{ id: string; agent_id: string }>;

    if (!rows?.[0]?.agent_id) return null;
    return { sessionId: rows[0].id, agentId: rows[0].agent_id };
  } catch (err: any) {
    logError("Falha ao buscar sessão DS ativa", { error: err?.message });
    return null;
  }
}

/**
 * Resolve o DS Agente a usar no passo link_ai_agent.
 * Ordem: action.ds_agent_id → nome em "Vincular Agente IA: {nome}" → primeiro agente do tenant.
 */
export async function resolveDsAgentIdForLinkStep(params: {
  tenantId: string;
  configuredAgentId?: string | null;
  messageContent?: string | null;
}): Promise<string | null> {
  const { tenantId } = params;
  const configured = String(params.configuredAgentId || "").trim();
  const { default: db } = await import("./db");

  if (configured) {
    const rows = (await db.query(
      `SELECT id FROM ds_agents WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [configured, tenantId],
    )) as Array<{ id: string }>;
    if (rows?.[0]?.id) return rows[0].id;
  }

  const content = String(params.messageContent || "").trim();
  const nameMatch = content.match(/Vincular Agente IA:\s*(.+)$/i);
  const agentName = nameMatch?.[1]?.trim();
  if (agentName) {
    const byName = (await db.query(
      `SELECT id FROM ds_agents WHERE tenant_id = ? AND name = ? ORDER BY updated_at DESC LIMIT 1`,
      [tenantId, agentName],
    )) as Array<{ id: string }>;
    if (byName?.[0]?.id) return byName[0].id;

    const byLike = (await db.query(
      `SELECT id FROM ds_agents WHERE tenant_id = ? AND name LIKE ? ORDER BY updated_at DESC LIMIT 1`,
      [tenantId, `%${agentName}%`],
    )) as Array<{ id: string }>;
    if (byLike?.[0]?.id) return byLike[0].id;
  }

  const fallback = (await db.query(
    `SELECT id FROM ds_agents WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 1`,
    [tenantId],
  )) as Array<{ id: string }>;
  return fallback?.[0]?.id || null;
}

export async function pauseDsAgentSessionsForContact(
  tenantId: string,
  phoneDigits: string,
): Promise<void> {
  try {
    const contactId = await resolveContactId(tenantId, phoneDigits);
    if (!contactId) return;

    const { default: db } = await import("./db");
    await db.query(
      `UPDATE ds_agent_sessions
       SET status = 'paused', updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND contact_id = ? AND status = 'active'`,
      [tenantId, contactId],
    );
  } catch (err: any) {
    logError("Falha ao pausar sessões DS", { error: err?.message });
  }
}

export async function upsertActiveDsAgentSession(
  tenantId: string,
  agentId: string,
  phoneDigits: string,
): Promise<void> {
  try {
    const contactId = await resolveContactId(tenantId, phoneDigits);
    if (!contactId) {
      logInfo("Contato não encontrado para sessão DS; sessão sticky adiada", { tenantId, phoneDigits, agentId });
      return;
    }

    const { default: db } = await import("./db");
    const existing = (await db.query(
      `SELECT id FROM ds_agent_sessions
       WHERE tenant_id = ? AND contact_id = ? AND agent_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
      [tenantId, contactId, agentId],
    )) as Array<{ id: string }>;

    if (existing?.[0]?.id) {
      await db.query(
        `UPDATE ds_agent_sessions
         SET status = 'active', updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND tenant_id = ?`,
        [existing[0].id, tenantId],
      );
      await db.query(
        `UPDATE ds_agent_sessions
         SET status = 'paused', updated_at = CURRENT_TIMESTAMP
         WHERE tenant_id = ? AND contact_id = ? AND id != ? AND status = 'active'`,
        [tenantId, contactId, existing[0].id],
      );
      return;
    }

    await db.query(
      `UPDATE ds_agent_sessions
       SET status = 'paused', updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = ? AND contact_id = ? AND status = 'active'`,
      [tenantId, contactId],
    );

    await db.query(
      `INSERT INTO ds_agent_sessions (id, tenant_id, agent_id, contact_id, status)
       VALUES (?, ?, ?, ?, 'active')`,
      [crypto.randomUUID(), tenantId, agentId, contactId],
    );
  } catch (err: any) {
    logError("Falha ao upsert sessão DS", { error: err?.message, agentId });
  }
}

async function generateDsAgentReply(params: {
  provider: string;
  model: string;
  apiKey: string;
  systemPrompt: string;
  historyText: string;
  userMessage: string;
  tools?: Array<{
    type: "function";
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }>;
  onToolCall?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
}): Promise<{ text: string | null; tokens: number }> {
  const { provider, model, apiKey, systemPrompt, historyText, userMessage, tools, onToolCall } =
    params;

  if (isGeminiModel(model, provider)) {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `${systemPrompt}\n\n--- HISTÓRICO RECENTE ---\n${historyText}\n\nCliente: ${userMessage}\nAgente:`;
    const response = await ai.models.generateContent({
      model: model || "gemini-2.5-flash",
      contents: prompt,
    });
    const text = String(response.text || "").trim() || null;
    const approxTokens = Math.ceil((prompt.length + String(text || "").length) / 4);
    return { text, tokens: approxTokens };
  }

  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: historyText
        ? `Histórico recente:\n${historyText}\n\nMensagem atual do cliente:\n${userMessage}`
        : userMessage,
    },
  ];

  let totalTokens = 0;
  const maxRounds = tools?.length && onToolCall ? 4 : 1;

  for (let round = 0; round < maxRounds; round++) {
    const body: Record<string, unknown> = {
      model: model || "gpt-4o-mini",
      messages,
      temperature: 0.7,
    };
    if (tools?.length) {
      body.tools = tools;
      body.tool_choice = "auto";
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errBody = await response.text();
      logError("OpenAI retornou erro", { status: response.status, errBody: errBody.slice(0, 500) });
      return { text: null, tokens: totalTokens };
    }

    const json = (await response.json().catch(() => null)) as any;
    totalTokens += Number(json?.usage?.total_tokens || 0);

    const choice = json?.choices?.[0]?.message;
    const toolCalls = choice?.tool_calls;
    if (Array.isArray(toolCalls) && toolCalls.length > 0 && onToolCall) {
      messages.push(choice);
      for (const call of toolCalls) {
        const name = String(call?.function?.name || "");
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(String(call?.function?.arguments || "{}"));
        } catch {
          args = {};
        }
        let result: unknown;
        try {
          result = await onToolCall(name, args);
        } catch (err: any) {
          result = { ok: false, error: err?.message || String(err) };
        }
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result ?? {}),
        });
      }
      continue;
    }

    const text = String(choice?.content || "").trim() || null;
    if (!totalTokens && text) {
      totalTokens = Math.ceil((systemPrompt.length + userMessage.length + text.length) / 4);
    }
    return { text, tokens: totalTokens };
  }

  return { text: null, tokens: totalTokens };
}

function buildOpenAiToolsFromEnabled(
  enabledKeys: Set<string>,
): Array<{
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  const defs: Array<{
    key: string;
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }> = [
    {
      key: "google_calendar",
      name: "calendar_check_availability",
      description: "Verifica disponibilidade de agenda em uma data/horário.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          start_time: { type: "string", description: "HH:mm" },
          end_time: { type: "string", description: "HH:mm" },
        },
      },
    },
    {
      key: "google_calendar",
      name: "calendar_create_event",
      description:
        "Cria um compromisso na agenda interna do tenant. Use SEMPRE o ano atual em start_at/end_at (formato YYYY-MM-DD HH:mm:ss). Só confirme ao cliente após sucesso.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          start_at: { type: "string", description: "YYYY-MM-DD HH:mm:ss (ano atual)" },
          end_at: { type: "string", description: "YYYY-MM-DD HH:mm:ss (ano atual)" },
          description: { type: "string" },
          location: { type: "string" },
        },
        required: ["title", "start_at", "end_at"],
      },
    },
    {
      key: "google_calendar",
      name: "calendar_list_events",
      description: "Lista compromissos em um intervalo de datas.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string" },
          end_date: { type: "string" },
        },
      },
    },
    {
      key: "consulta_crm",
      name: "consulta_crm",
      description: "Busca dados do contato no CRM (nome, email, campos customizados).",
      parameters: {
        type: "object",
        properties: {
          phone: { type: "string" },
          contact_id: { type: "string" },
        },
      },
    },
    {
      key: "gerenciar_tags",
      name: "gerenciar_tags",
      description: "Adiciona ou remove uma tag do contato.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add", "remove"] },
          tag_name: { type: "string" },
          phone: { type: "string" },
          contact_id: { type: "string" },
        },
        required: ["tag_name"],
      },
    },
    {
      key: "webhook_customizado",
      name: "webhook_customizado",
      description: "Dispara o webhook customizado configurado no agente com um payload JSON.",
      parameters: {
        type: "object",
        properties: {
          body: { type: "object" },
        },
      },
    },
  ];

  return defs
    .filter((d) => enabledKeys.has(d.key))
    .map((d) => ({
      type: "function" as const,
      function: { name: d.name, description: d.description, parameters: d.parameters },
    }));
}

async function loadAgentKnowledgeBlock(
  db: any,
  agentId: string,
  tenantId: string,
): Promise<string> {
  let knowledgeRows: Array<{ title?: string; content?: string }> = [];
  try {
    knowledgeRows = (await db.query(
      `SELECT title, content FROM ds_agent_knowledge
       WHERE agent_id = ? AND tenant_id = ?
         AND status IN ('indexed', 'pending')
         AND content IS NOT NULL AND content != ''
       ORDER BY updated_at DESC
       LIMIT 20`,
      [agentId, tenantId],
    )) as Array<{ title?: string; content?: string }>;
  } catch {
    knowledgeRows = [];
  }

  if (!knowledgeRows?.length) return "";

  let block = "\n\n--- BASE DE CONHECIMENTO ---\nUse as informações abaixo quando forem relevantes:\n";
  for (const doc of knowledgeRows) {
    const content = String(doc.content || "").slice(0, 6000);
    block += `\n[${doc.title || "Documento"}]\n${content}\n`;
  }
  block += "----------------------------\n";
  return block;
}

async function buildDsAgentSystemPrompt(params: {
  db: any;
  agent: any;
  tenantId: string;
  agentId: string;
  phoneDigits?: string;
  replyWithAssigned: boolean;
  processImages: boolean;
}): Promise<string> {
  const { db, agent, tenantId, agentId, phoneDigits, replyWithAssigned, processImages } = params;
  const mode = String(agent.mode || "basico");
  const instructions =
    mode === "avancado"
      ? String(agent.instructions_advanced || agent.system_prompt || agent.prompt || "").trim()
      : String(agent.instructions_basic || agent.system_prompt || agent.prompt || "").trim();

  let systemPrompt = instructions || `Você é ${agent.name || "um assistente virtual"} útil e profissional.`;

  if (phoneDigits) {
    try {
      const contactRows = (await db.query(
        `SELECT name, phone_e164, email FROM contacts
         WHERE (tenant_id = ? OR user_id = ?)
           AND (phone_e164 = ? OR whatsapp_number = ?)
         LIMIT 1`,
        [tenantId, tenantId, phoneDigits, phoneDigits],
      )) as Array<{ name?: string; phone_e164?: string; email?: string }>;
      const contactName = String(contactRows?.[0]?.name || "").trim() || "cliente";
      const contactEmail = String(contactRows?.[0]?.email || "").trim();
      systemPrompt = systemPrompt
        .replace(/\{\{\s*nome_lead\s*\}\}/gi, contactName)
        .replace(/\{\{\s*nome\s*\}\}/gi, contactName)
        .replace(/\{\{\s*contact\.name\s*\}\}/gi, contactName)
        .replace(/\{\{\s*telefone\s*\}\}/gi, phoneDigits)
        .replace(/\{\{\s*contact\.phone\s*\}\}/gi, phoneDigits)
        .replace(/\{\{\s*email\s*\}\}/gi, contactEmail || "")
        .replace(
          /\{\{\s*data_atual\s*\}\}/gi,
          new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        );
    } catch {
      // Mantém o prompt original se a resolução do contato falhar.
    }

    if (replyWithAssigned) {
      const assigned = await findAssignedResponsible(tenantId, phoneDigits);
      if (assigned?.agentName) {
        systemPrompt += `\n\nO responsável humano atual desta conversa é: ${assigned.agentName}. Alinhe o tom como suporte a esse responsável.`;
      } else {
        systemPrompt +=
          "\n\nNão há responsável humano atribuído no momento. Atenda com autonomia e ofereça transferir a um humano se necessário.";
      }
    }
  }

  if (processImages) {
    systemPrompt +=
      "\n\nVocê pode interpretar descrições de imagens enviadas pelo cliente quando disponíveis no histórico.";
  } else {
    systemPrompt += "\n\nSe o cliente enviar imagens, peça para descrever em texto.";
  }

  systemPrompt +=
    "\n\nRegras adicionais:\n- Nunca escreva placeholders como {{nome_lead}} na resposta.\n- Responda sempre a mensagem mais recente do cliente de forma útil e objetiva.\n- Data/hora de referência (America/Sao_Paulo): use SEMPRE o ano atual ao agendar; nunca anos passados (ex.: 2023).\n- Só confirme que um compromisso foi agendado DEPOIS de chamar a ferramenta calendar_create_event com sucesso. Se a ferramenta falhar, diga que não conseguiu agendar.\n- Ao chamar calendar_create_event, use start_at/end_at no formato YYYY-MM-DD HH:mm:ss com o ano corrente.\n";

  systemPrompt += await loadAgentKnowledgeBlock(db, agentId, tenantId);
  return systemPrompt;
}

/**
 * Completion reutilizável (WhatsApp + chat de teste).
 * Grava usage em ds_agent_usage_logs. Não envia mensagem no canal.
 */
export async function runDsAgentCompletion(params: {
  agentId: string;
  tenantId: string;
  userMessage: string;
  phoneDigits?: string;
  historyText?: string;
  enableTools?: boolean;
}): Promise<{ ok: boolean; reply: string | null; error?: string; tokens?: number }> {
  const { agentId, tenantId, userMessage } = params;
  const phoneDigits = String(params.phoneDigits || "").replace(/\D/g, "");

  try {
    const { default: db } = await import("./db");
    const { logDsAgentUsage } = await import("./ds-agent-usage.server");
    const { executeDsAgentTool } = await import("./ds-agent-tools.server");

    const agents = (await db.query(
      `SELECT * FROM ds_agents WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [agentId, tenantId],
    )) as any[];
    const agent = agents?.[0];
    if (!agent) return { ok: false, reply: null, error: "Agente não encontrado" };

    const replyWithAssigned = isTruthyFlag(agent.reply_with_assigned_agent);
    const processImages = isTruthyFlag(agent.process_images);

    const systemPrompt = await buildDsAgentSystemPrompt({
      db,
      agent,
      tenantId,
      agentId,
      phoneDigits: phoneDigits || undefined,
      replyWithAssigned,
      processImages,
    });

    const provider = String(agent.provider || "OpenAI Padrão");
    const model = String(agent.model || "gpt-4o-mini");
    const apiKey =
      String(agent.api_key_encrypted || "").trim() ||
      (isGeminiModel(model, provider) ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY) ||
      "";

    if (!apiKey) {
      return { ok: false, reply: null, error: "API key não configurada para este agente" };
    }

    let historyText = String(params.historyText || "");
    if (!historyText && phoneDigits) {
      const { data: recentMsgs } = await dbAdmin
        .from("direct_messages")
        .select("direction, body, created_at, type")
        .eq("user_id", tenantId)
        .eq("contact_phone", phoneDigits)
        .order("created_at", { ascending: false })
        .limit(10);

      if (recentMsgs && recentMsgs.length > 0) {
        historyText = [...recentMsgs]
          .reverse()
          .map((m: any) => {
            const who = m.direction === "incoming" ? "Cliente" : "Agente";
            const body = m.type && m.type !== "text" && !m.body ? `[${m.type}]` : m.body || "";
            return `${who}: ${body}`;
          })
          .join("\n");
      }
    }

    let enabledKeys = new Set<string>();
    const toolConfigByKey: Record<string, any> = {};
    if (params.enableTools !== false) {
      try {
        const toolRows = (await db.query(
          `SELECT tool_key, enabled, config FROM ds_agent_tools
           WHERE agent_id = ? AND tenant_id = ? AND enabled = 1`,
          [agentId, tenantId],
        )) as Array<{ tool_key: string; enabled: any; config: any }>;
        for (const row of toolRows || []) {
          enabledKeys.add(String(row.tool_key));
          let cfg = row.config;
          if (typeof cfg === "string") {
            try {
              cfg = JSON.parse(cfg);
            } catch {
              cfg = {};
            }
          }
          toolConfigByKey[String(row.tool_key)] = cfg || {};
        }
      } catch {
        enabledKeys = new Set();
      }
    }

    const openAiTools = isGeminiModel(model, provider)
      ? []
      : buildOpenAiToolsFromEnabled(enabledKeys);

    const contactId = phoneDigits ? await resolveContactId(tenantId, phoneDigits) : null;

    const { text, tokens } = await generateDsAgentReply({
      provider,
      model,
      apiKey,
      systemPrompt,
      historyText,
      userMessage,
      tools: openAiTools,
      onToolCall: async (name, args) => {
        const payload = {
          ...args,
          phone: phoneDigits || args.phone,
          phone_digits: phoneDigits || args.phone_digits,
          contact_id: contactId || args.contact_id,
        };
        const parentKey = name.startsWith("calendar_") ? "google_calendar" : name;
        return executeDsAgentTool({
          agentId,
          tenantId,
          toolKey: name.startsWith("calendar_") ? name : parentKey,
          payload,
          toolConfig: toolConfigByKey[parentKey],
        });
      },
    });

    if (tokens > 0) {
      await logDsAgentUsage({
        agentId,
        tenantId,
        model,
        provider,
        category: "completion",
        tokens,
      });
    }

    if (!text) return { ok: false, reply: null, error: "Modelo retornou resposta vazia", tokens };
    return { ok: true, reply: text, tokens };
  } catch (err: any) {
    logError("runDsAgentCompletion falhou", { error: err?.message || String(err), agentId });
    return { ok: false, reply: null, error: err?.message || "Falha na completion" };
  }
}

export async function processDsAgent(params: {
  agentId: string;
  messageBody: string;
  phoneDigits: string;
  phoneNumberId: string;
  tenantId: string;
}): Promise<boolean> {
  const { agentId, messageBody, phoneDigits, phoneNumberId, tenantId } = params;
  if (!agentId || !messageBody || !phoneDigits || !phoneNumberId || !tenantId) return false;

  try {
    const { default: db } = await import("./db");
    const agents = (await db.query(
      `SELECT * FROM ds_agents WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [agentId, tenantId],
    )) as any[];
    const agent = agents?.[0];
    if (!agent) {
      logInfo("DS Agente não encontrado", { agentId, tenantId });
      return false;
    }

    // Fonte de verdade: is_active. A coluna legada status DEFAULT 'inactive'
    // não deve bloquear agentes já marcados como ativos na UI.
    const explicitlyInactive =
      agent.is_active === 0 ||
      agent.is_active === false ||
      agent.is_active === "0";
    if (explicitlyInactive) {
      logInfo("DS Agente inativo (is_active=0)", { agentId });
      return false;
    }

    const replyWithAssigned = isTruthyFlag(agent.reply_with_assigned_agent);
    const splitBlocks = isTruthyFlag(agent.split_replies_in_blocks);
    const processImages = isTruthyFlag(agent.process_images);
    const disableOutsidePlatform = isTruthyFlag(agent.disabled_outside_platform);

    // "Desabilitar agente fora da plataforma" + coluna legada disable_outside_hours:
    // respeita a agenda em Ferramentas > Disponibilidade (America/Sao_Paulo).
    const respectAvailability =
      disableOutsidePlatform || isTruthyFlag(agent.disable_outside_hours);
    if (respectAvailability) {
      const withinHours = await isWithinAgentAvailability(db, tenantId, agentId);
      if (!withinHours) {
        logInfo("DS Agente fora da disponibilidade/plataforma", { agentId, phoneDigits });
        const authOutside = await resolveWhatsAppSendAuth(tenantId, phoneNumberId);
        if (authOutside?.accessToken) {
          await sendWhatsAppText({
            auth: authOutside,
            phoneDigits,
            text: "Nosso assistente está fora do horário de atendimento configurado. Por favor, retorne no próximo horário útil.",
            tenantId,
            agentId,
            model: String(agent.model || "gpt-4o-mini"),
          });
          return true;
        }
        return false;
      }
    }

    // Só trata como imagem quando o body já veio marcado assim pelo webhook/inbox.
    // Nunca usar texto livre ("foto", etc.) — isso quebraria mensagens normais.
    const looksLikeImageOnly =
      /^\[(imagem|image|img)\]$/i.test(String(messageBody || "").trim()) ||
      /^\[(imagem|image|img)\]\s*/i.test(String(messageBody || "").trim());
    if (looksLikeImageOnly && !processImages) {
      logInfo("DS Agente ignorou imagem (process_images=off)", { agentId });
      const authEarly = await resolveWhatsAppSendAuth(tenantId, phoneNumberId);
      if (!authEarly?.accessToken) return false;
      await sendWhatsAppText({
        auth: authEarly,
        phoneDigits,
        text: "No momento não consigo analisar imagens. Pode descrever em texto o que precisa?",
        tenantId,
        agentId,
        model: String(agent.model || "gpt-4o-mini"),
      });
      await upsertActiveDsAgentSession(tenantId, agentId, phoneDigits);
      return true;
    }

    logInfo("Gerando resposta DS Agente", {
      agentId,
      model: agent.model,
      provider: agent.provider,
      phoneDigits,
      flags: { replyWithAssigned, splitBlocks, processImages, disableOutsidePlatform },
    });

    const completion = await runDsAgentCompletion({
      agentId,
      tenantId,
      userMessage: messageBody,
      phoneDigits,
      enableTools: true,
    });

    if (!completion.ok || !completion.reply) {
      logError("DS Agente retornou texto vazio", { agentId, error: completion.error });
      return false;
    }

    const replyText = completion.reply;
    const model = String(agent.model || "gpt-4o-mini");

    const auth = await resolveWhatsAppSendAuth(tenantId, phoneNumberId);
    if (!auth?.accessToken) {
      logError("Sem credencial WhatsApp para enviar resposta do DS Agente", { tenantId, phoneNumberId });
      return false;
    }

    const shouldSplit =
      splitBlocks || isTruthyFlag(agent.chunk_responses);
    const blocks = shouldSplit ? splitReplyIntoBlocks(replyText) : [replyText];
    for (let i = 0; i < blocks.length; i++) {
      const ok = await sendWhatsAppText({
        auth,
        phoneDigits,
        text: blocks[i],
        tenantId,
        agentId,
        model,
      });
      if (!ok) return false;
      if (i < blocks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    await upsertActiveDsAgentSession(tenantId, agentId, phoneDigits);
    logInfo("Resposta DS Agente enviada", { agentId, phoneDigits, blocks: blocks.length });
    return true;
  } catch (err: any) {
    logError("Exceção no processDsAgent", { error: err?.message || String(err), agentId });
    return false;
  }
}
