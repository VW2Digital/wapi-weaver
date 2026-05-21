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
    await supabaseAdmin.from("audit_logs").insert({
      user_id: params.userId,
      actor_email: params.actorEmail ?? null,
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
  limit: z.number().int().min(1).max(500).default(100),
  action: z.string().optional(),
});

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => listSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("audit_logs")
      .select("id, user_id, actor_email, action, entity_type, entity_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.action) q = q.eq("action", data.action);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });
