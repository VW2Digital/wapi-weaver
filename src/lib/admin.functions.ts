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
      .select("meta_app_id, meta_config_id, meta_graph_version, updated_at, meta_app_secret, head_tags, body_tags, cron_secret")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      meta_app_id: data.meta_app_id ?? "",
      meta_config_id: data.meta_config_id ?? "",
      meta_graph_version: data.meta_graph_version ?? "v20.0",
      meta_app_secret_set: !!data.meta_app_secret,
      head_tags: (data as any).head_tags ?? "",
      body_tags: (data as any).body_tags ?? "",
      cron_secret: (data as any).cron_secret ?? "", // admin pode ver para configurar no pg_cron
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
  cron_secret: z.string().trim().max(128).regex(/^[A-Za-z0-9_-]*$/, "Use apenas letras, dígitos, _ ou -").optional(),
});

export const updatePlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => settingsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const update: Record<string, any> = { updated_at: new Date().toISOString(), updated_by: context.userId };
    if (data.meta_app_id !== undefined && data.meta_app_id !== "") update.meta_app_id = data.meta_app_id;
    if (data.meta_app_secret !== undefined && data.meta_app_secret !== "") update.meta_app_secret = data.meta_app_secret;
    if (data.meta_config_id !== undefined && data.meta_config_id !== "") update.meta_config_id = data.meta_config_id;
    if (data.meta_graph_version) update.meta_graph_version = data.meta_graph_version;
    if (data.head_tags !== undefined) update.head_tags = data.head_tags === "" ? null : data.head_tags;
    if (data.body_tags !== undefined) update.body_tags = data.body_tags === "" ? null : data.body_tags;
    if (data.cron_secret !== undefined) update.cron_secret = data.cron_secret === "" ? null : data.cron_secret;

    const { error } = await context.supabase
      .from("platform_settings")
      .update(update as never)
      .eq("id", 1);

    if (error) throw error;
    await recordAudit({
      userId: context.userId,
      action: "platform_settings.update",
      entityType: "platform_settings",
      entityId: "1",
      metadata: { changed: Object.keys(update).filter((k) => k !== "updated_at" && k !== "updated_by") },
    });
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

// Exporta o schema completo do banco (apenas admins). Usa supabaseAdmin (service_role)
// para chamar a função SECURITY DEFINER `public.export_schema_sql()`.
export const exportSchemaSql = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Confirma admin via RLS antes de usar o admin client
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) throw new Error("forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any).rpc("export_schema_sql");
    if (error) throw error;

    await recordAudit({
      userId: context.userId,
      action: "platform.export_schema",
      entityType: "database",
      entityId: "public",
      metadata: { bytes: (data ?? "").length },
    });

    return { sql: (data ?? "") as string, generated_at: new Date().toISOString() };
  });
