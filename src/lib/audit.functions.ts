import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Helper interno — chame de dentro de outros server fns para registrar uma ação.
 * Usa o cliente admin para garantir gravação mesmo sem políticas de INSERT.
 */
export async function recordAudit(params: {
  userId: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let actorEmail = params.actorEmail ?? null;
    if (!actorEmail && params.userId) {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", params.userId)
        .maybeSingle();
      if (data?.email) {
        actorEmail = data.email;
      }
    }
    await supabaseAdmin.from("audit_logs").insert({
      user_id: params.userId,
      actor_email: actorEmail,
      action: params.action,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? {},
    } as never);
  } catch (e) {
    // Audit nunca deve quebrar a request principal
    console.error("[audit] falha ao registrar:", e);
  }
}

const listSchema = z.object({
  limit: z.number().int().min(1).max(500).default(20),
  page: z.number().int().min(1).default(1),
  action: z.string().optional(),
});

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const from = (data.page - 1) * data.limit;
    const to = from + data.limit - 1;

    let q = context.supabase
      .from("audit_logs")
      .select("id, user_id, actor_email, action, entity_type, entity_id, metadata, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data.action) q = q.eq("action", data.action);
    const { data: rows, error, count } = await q;
    if (error) throw error;

    let mappedRows = rows ?? [];
    if (rows && rows.length > 0) {
      const missingUserIds = Array.from(
        new Set(
          rows
            .filter((r) => !r.actor_email && r.user_id)
            .map((r) => r.user_id as string)
        )
      );
      if (missingUserIds.length > 0) {
        const { data: profiles } = await context.supabase
          .from("profiles")
          .select("id, email")
          .in("id", missingUserIds);
        
        if (profiles && profiles.length > 0) {
          const emailMap = new Map(profiles.map((p) => [p.id, p.email]));
          mappedRows = rows.map((r) => {
            if (!r.actor_email && r.user_id && emailMap.has(r.user_id)) {
              return {
                ...r,
                actor_email: emailMap.get(r.user_id) ?? null,
              };
            }
            return r;
          });
        }
      }
    }

    return {
      rows: mappedRows,
      total: count ?? 0,
    };
  });
