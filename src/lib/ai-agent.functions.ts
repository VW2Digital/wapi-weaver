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
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const profiles = (await db.query(
      "SELECT whatsapp_phone_number_id FROM profiles WHERE id = ?",
      [effectiveUserId],
    )) as any[];
    const p = profiles?.[0];

    if (!p?.whatsapp_phone_number_id)
      return { ok: false, error: "Nenhuma instância WhatsApp configurada no perfil." };

    const settingsList = (await db.query(
      "SELECT * FROM ai_agent_settings WHERE instance_id = ?",
      [p.whatsapp_phone_number_id],
    )) as any[];
    let settings = settingsList?.[0] ?? null;

    if (!settings) {
      const id = crypto.randomUUID();
      await db.query(
        `INSERT INTO ai_agent_settings (id, user_id, instance_id, is_active, model, system_prompt)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, effectiveUserId, p.whatsapp_phone_number_id, false, "gemini-2.5-flash", "Você é um assistente virtual útil e educado."],
      );
      const newRows = (await db.query("SELECT * FROM ai_agent_settings WHERE id = ?", [id])) as any[];
      settings = newRows?.[0] ?? null;
      if (!settings) return { ok: false, error: "Falha ao criar configurações padrão." };
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
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const profiles = (await db.query(
      "SELECT whatsapp_phone_number_id FROM profiles WHERE id = ?",
      [effectiveUserId],
    )) as any[];
    const p = profiles?.[0];

    if (!p?.whatsapp_phone_number_id) return { ok: false, error: "Sem instância." };

    await db.query(
      "UPDATE ai_agent_settings SET is_active = ?, api_key = ?, model = ?, system_prompt = ? WHERE instance_id = ?",
      [data.is_active ? 1 : 0, data.api_key || null, data.model, data.system_prompt || null, p.whatsapp_phone_number_id],
    );

    return { ok: true };
  });

export const getKnowledgeBase = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }: { context: any }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const profiles = (await db.query(
      "SELECT whatsapp_phone_number_id FROM profiles WHERE id = ?",
      [effectiveUserId],
    )) as any[];
    const p = profiles?.[0];

    if (!p?.whatsapp_phone_number_id) return [];

    const settingsList = (await db.query(
      "SELECT id FROM ai_agent_settings WHERE instance_id = ?",
      [p.whatsapp_phone_number_id],
    )) as any[];
    const settings = settingsList?.[0];
    if (!settings) return [];

    const data = (await db.query(
      "SELECT * FROM knowledge_base WHERE ai_agent_settings_id = ? ORDER BY created_at DESC",
      [settings.id],
    )) as any[];
    return data ?? [];
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
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    const profiles = (await db.query(
      "SELECT whatsapp_phone_number_id FROM profiles WHERE id = ?",
      [effectiveUserId],
    )) as any[];
    const p = profiles?.[0];

    if (!p?.whatsapp_phone_number_id) return { ok: false, error: "Sem instância." };

    const settingsList = (await db.query(
      "SELECT id FROM ai_agent_settings WHERE instance_id = ?",
      [p.whatsapp_phone_number_id],
    )) as any[];
    const settings = settingsList?.[0];
    if (!settings) return { ok: false, error: "Settings não encontradas." };

    if (data.id) {
      await db.query("UPDATE knowledge_base SET title = ?, content = ? WHERE id = ?", [
        data.title,
        data.content,
        data.id,
      ]);
    } else {
      await db.query(
        "INSERT INTO knowledge_base (id, user_id, ai_agent_settings_id, title, content) VALUES (?, ?, ?, ?, ?)",
        [crypto.randomUUID(), effectiveUserId, settings.id, data.title, data.content],
      );
    }

    return { ok: true };
  });

export const deleteKnowledgeBase = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }: { data: any; context: any }) => {
    const { default: db } = await import("./db");
    await db.query("DELETE FROM knowledge_base WHERE id = ?", [data.id]);
    return { ok: true };
  });
