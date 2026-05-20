import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("templates")
      .select("*")
      .order("name");
    if (error) throw error;
    return data ?? [];
  });

export const syncTemplatesFromMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: p } = await context.supabase
      .from("profiles")
      .select("whatsapp_waba_id, whatsapp_access_token")
      .eq("id", context.userId)
      .maybeSingle();
    if (!p?.whatsapp_waba_id || !p?.whatsapp_access_token) {
      throw new Error("Configure WABA ID e Access Token em Configurações");
    }
    const all: any[] = [];
    let url: string | null = `https://graph.facebook.com/v20.0/${p.whatsapp_waba_id}/message_templates?fields=name,language,status,category,components,id&limit=200`;
    while (url) {
      const r: Response = await fetch(url, { headers: { Authorization: `Bearer ${p.whatsapp_access_token}` } });
      const body: any = await r.json();
      if (!r.ok) throw new Error(body?.error?.message ?? "Falha ao consultar templates");
      all.push(...(body.data ?? []));
      url = body.paging?.next ?? null;
    }
    if (all.length > 0) {
      const rows = all.map((t) => ({
        user_id: context.userId,
        meta_template_id: t.id,
        name: t.name,
        language: t.language,
        category: t.category,
        status: t.status,
        components: t.components ?? [],
        synced_at: new Date().toISOString(),
      }));
      const { error } = await context.supabase
        .from("templates")
        .upsert(rows, { onConflict: "user_id,name,language" });
      if (error) throw error;
    }
    return { synced: all.length };
  });
