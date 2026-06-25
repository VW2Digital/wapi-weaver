import { dbAdmin } from "@/integrations/mysql/client.server";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

function logInfo(message: string, data?: any) {
  console.log(`[ai-agent] ${message}`, data ? JSON.stringify(data) : "");
}

function logError(message: string, data?: any) {
  console.error(`[ai-agent] ${message}`, data ? JSON.stringify(data) : "");
}

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
