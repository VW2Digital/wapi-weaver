import { dbAdmin } from "@/integrations/mysql/client.server";
import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { z } from "zod";

function logInfo(message: string, data?: any) {
  console.log(`[ai-agent] ${message}`, data ? JSON.stringify(data) : "");
}

function logError(message: string, data?: any) {
  console.error(`[ai-agent] ${message}`, data ? JSON.stringify(data) : "");
}

export const getAiAgentSettings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }: { context: any }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id")
      .maybeSingle();

    if (!p?.whatsapp_phone_number_id)
      return { ok: false, error: "Nenhuma instância WhatsApp configurada no perfil." };

    let { data: settings } = await context.db
      .from("ai_agent_settings")
      .select("*")
      .eq("instance_id", p.whatsapp_phone_number_id)
      .maybeSingle();

    if (!settings) {
      // Cria a configuração padrão se não existir
      const { data: newSettings, error } = await context.db
        .from("ai_agent_settings")
        .insert({
          id: crypto.randomUUID(),
          user_id: context.userId,
          instance_id: p.whatsapp_phone_number_id,
          is_active: false,
          model: "gemini-2.5-flash",
          system_prompt: "Você é um assistente virtual útil e educado.",
        })
        .select("*")
        .single();

      if (error) return { ok: false, error: error.message };
      settings = newSettings;
    }

    return { ok: true, settings };
  });

const saveAiSettingsInput = z.object({
  is_active: z.boolean(),
  api_key: z.string().optional().nullable(),
  model: z.string(),
  system_prompt: z.string().optional().nullable(),
});

export const saveAiAgentSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => saveAiSettingsInput.parse(d))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id")
      .maybeSingle();

    if (!p?.whatsapp_phone_number_id) return { ok: false, error: "Sem instância." };

    const { error } = await context.db
      .from("ai_agent_settings")
      .update({
        is_active: data.is_active,
        api_key: data.api_key || null,
        model: data.model,
        system_prompt: data.system_prompt || null,
      })
      .eq("instance_id", p.whatsapp_phone_number_id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const getKnowledgeBase = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }: { context: any }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id")
      .maybeSingle();

    if (!p?.whatsapp_phone_number_id) return [];

    const { data: settings } = await context.db
      .from("ai_agent_settings")
      .select("id")
      .eq("instance_id", p.whatsapp_phone_number_id)
      .maybeSingle();

    if (!settings) return [];

    const { data } = await context.db
      .from("knowledge_base")
      .select("*")
      .eq("ai_agent_settings_id", settings.id)
      .order("created_at", { ascending: false });

    return data || [];
  });

const saveKbInput = z.object({
  id: z.string().optional(),
  title: z.string(),
  content: z.string(),
});

export const saveKnowledgeBase = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => saveKbInput.parse(d))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_phone_number_id")
      .maybeSingle();

    if (!p?.whatsapp_phone_number_id) return { ok: false, error: "Sem instância." };

    const { data: settings } = await context.db
      .from("ai_agent_settings")
      .select("id")
      .eq("instance_id", p.whatsapp_phone_number_id)
      .maybeSingle();

    if (!settings) return { ok: false, error: "Settings não encontradas." };

    let result;
    if (data.id) {
      result = await context.db
        .from("knowledge_base")
        .update({ title: data.title, content: data.content })
        .eq("id", data.id)
        .select("*")
        .single();
    } else {
      result = await context.db
        .from("knowledge_base")
        .insert({
          id: crypto.randomUUID(),
          user_id: context.userId,
          ai_agent_settings_id: settings.id,
          title: data.title,
          content: data.content,
        })
        .select("*")
        .single();
    }

    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true };
  });

export const deleteKnowledgeBase = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const { error } = await context.db.from("knowledge_base").delete().eq("id", data.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

import { GoogleGenAI } from "@google/genai";

export async function processAiAgent(
  messageBody: string,
  phoneDigits: string,
  phoneNumberId: string,
  userId: string,
) {
  if (!phoneNumberId || !phoneDigits || !userId || !messageBody) return false;

  try {
    // 1. Get Settings
    const { data: settings } = await dbAdmin
      .from("ai_agent_settings")
      .select("*")
      .eq("user_id", userId)
      .eq("instance_id", phoneNumberId)
      .maybeSingle();

    if (!settings || !settings.is_active) {
      logInfo("Agente IA desativado para a instância", { phoneNumberId });
      return false;
    }

    const apiKey = settings.api_key || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logError("Chave de API não configurada para a IA");
      return false;
    }

    // 2. Get Knowledge Base
    const { data: kbDocs } = await dbAdmin
      .from("knowledge_base")
      .select("title, content")
      .eq("ai_agent_settings_id", settings.id);

    // 3. Assemble Prompt
    let fullPrompt = settings.system_prompt || "Você é um assistente virtual útil.";

    if (kbDocs && kbDocs.length > 0) {
      fullPrompt +=
        "\n\n--- BASE DE CONHECIMENTO ---\nUse as informações abaixo para responder se relevante:\n";
      kbDocs.forEach((doc: any) => {
        fullPrompt += `\n[${doc.title}]\n${doc.content}\n`;
      });
      fullPrompt += "----------------------------\n";
    }

    // 4. Get recent chat history
    const { data: recentMsgs } = await dbAdmin
      .from("direct_messages")
      .select("direction, body, created_at")
      .eq("user_id", userId)
      .eq("wa_id", phoneDigits)
      .order("created_at", { ascending: false })
      .limit(10);

    let historyText = "";
    if (recentMsgs && recentMsgs.length > 0) {
      const msgs = [...recentMsgs].reverse();
      historyText = msgs
        .map((m: any) => {
          const who = m.direction === "inbound" ? "Cliente" : "Agente";
          return `${who}: ${m.body}`;
        })
        .join("\n");
    } else {
      historyText = `Cliente: ${messageBody}`;
    }

    const finalPrompt = `${fullPrompt}\n\n--- HISTÓRICO RECENTE ---\n${historyText}\n\nAgente:`;

    logInfo("Chamando IA", { model: settings.model, phoneDigits });

    // 5. Call Gemini
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: settings.model || "gemini-2.5-flash",
      contents: finalPrompt,
    });

    const replyText = response.text;
    if (!replyText) {
      logError("IA retornou texto vazio");
      return false;
    }

    logInfo("IA Respondeu", { replyText });

    // 6. Send message via Graph API
    const { data: p } = await dbAdmin
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", userId)
      .maybeSingle();

    if (!p || !p.whatsapp_access_token) return false;

    const payload = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: phoneDigits,
      type: "text",
      text: { body: replyText },
    };

    const apiVersion = p.meta_graph_version || "v20.0";
    const r = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${p.whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (r.ok) {
      // Registrar no banco ou bot_conversation_state?
      // Por enquanto, o envio de webhook-events.functions cuida de salvar a msg depois, mas a gente já registrou enviada via API.
      return true;
    } else {
      const errBody = await r.text();
      logError("Erro ao enviar mensagem da IA pela Graph API", { errBody });
      return false;
    }
  } catch (err: any) {
    logError("Exceção na IA", { error: err.message });
    return false;
  }
}
