import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { recordAudit } from "./audit.functions";

export const getCurrentUserRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw error;
    const roles = (data ?? []).map((r) => r.role);
    return { roles, isAdmin: roles.includes("admin") };
  });

export const getPlatformSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // RLS bloqueia não-admins automaticamente
    const { data, error } = await context.supabase
      .from("platform_settings")
      .select("meta_app_id, meta_config_id, meta_graph_version, updated_at, meta_app_secret, head_tags, body_tags")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    // Mascarar o secret na resposta (mostra só se está preenchido)
    return {
      meta_app_id: data.meta_app_id ?? "",
      meta_config_id: data.meta_config_id ?? "",
      meta_graph_version: data.meta_graph_version ?? "v20.0",
      meta_app_secret_set: !!data.meta_app_secret,
      head_tags: (data as any).head_tags ?? "",
      body_tags: (data as any).body_tags ?? "",
      updated_at: data.updated_at,
    };
  });

const settingsSchema = z.object({
  meta_app_id: z.string().trim().max(64).regex(/^[0-9]*$/, "App ID deve conter apenas dígitos").optional(),
  meta_app_secret: z.string().trim().max(256).optional(),
  meta_config_id: z.string().trim().max(64).regex(/^[0-9]*$/, "Config ID deve conter apenas dígitos").optional(),
  meta_graph_version: z.string().trim().max(10).regex(/^v\d+\.\d+$/, "Formato deve ser vXX.X").optional(),
  head_tags: z.string().max(20000).optional(),
  body_tags: z.string().max(20000).optional(),
});

export const updatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Só envia campos preenchidos — vazios mantém o valor atual no banco
    const update: Record<string, any> = { updated_at: new Date().toISOString(), updated_by: context.userId };
    if (data.meta_app_id !== undefined && data.meta_app_id !== "") update.meta_app_id = data.meta_app_id;
    if (data.meta_app_secret !== undefined && data.meta_app_secret !== "") update.meta_app_secret = data.meta_app_secret;
    if (data.meta_config_id !== undefined && data.meta_config_id !== "") update.meta_config_id = data.meta_config_id;
    if (data.meta_graph_version) update.meta_graph_version = data.meta_graph_version;
    // head_tags / body_tags: permitir limpar (string vazia salva como null)
    if (data.head_tags !== undefined) update.head_tags = data.head_tags === "" ? null : data.head_tags;
    if (data.body_tags !== undefined) update.body_tags = data.body_tags === "" ? null : data.body_tags;

    const { error } = await context.supabase
      .from("platform_settings")
      .update(update as never)
      .eq("id", 1);

    if (error) throw error;
    return { ok: true };
  });

// Público (sem auth) — retorna apenas head_tags/body_tags para injetar em todas as páginas.
// Usa o cliente admin para contornar RLS, mas só expõe esses dois campos.
export const getTrackingTags = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("platform_settings")
      .select("head_tags, body_tags")
      .eq("id", 1)
      .maybeSingle();
    if (error) return { head_tags: "", body_tags: "" };
    return {
      head_tags: (data as any)?.head_tags ?? "",
      body_tags: (data as any)?.body_tags ?? "",
    };
  });
