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
