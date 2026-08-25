import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { hasMasterRole } from "./roles";

export const listMyWebhookEvents = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((data: { limit?: number } | undefined) => ({
    limit: Math.min(Math.max(data?.limit ?? 100, 1), 500),
  }))
  .handler(async ({ context, data }) => {
    const { default: db } = await import("./db");

    const [roleRows] = (await db.query(
      "SELECT role FROM user_roles WHERE user_id = ?",
      [context.userId],
    )) as any[];
    const isMaster = hasMasterRole((roleRows || []).map((r: any) => r.role));

    const tenantRows = (await db.query(
      `SELECT DISTINCT t.tenant_id FROM team_members tm
       JOIN teams t ON t.id = tm.team_id
       WHERE tm.user_id = ?
       LIMIT 2`,
      [context.userId],
    )) as any[];
    const effectiveUserId = tenantRows[0]?.tenant_id ?? context.userId;

    const eventSources: any[] = [];

    // A instalação antiga da VPS possui tenant_id/payload_json, enquanto a
    // instalação atual usa user_id/raw. Montar a consulta pelas colunas reais
    // preserva o histórico depois de atualizações de schema.
    const columns = (await db.query("SHOW COLUMNS FROM webhook_events")) as any[];
    const names = new Set((columns || []).map((column: any) => column.Field));
    const ownerConditions: string[] = [];
    const ownerParams: string[] = [];
    if (!isMaster) {
      if (names.has("user_id")) {
        ownerConditions.push("user_id = ?");
        ownerParams.push(effectiveUserId);
      }
      if (names.has("tenant_id")) {
        ownerConditions.push("tenant_id = ?");
        ownerParams.push(effectiveUserId);
      }
    }

    const rawExpression =
      names.has("raw") && names.has("payload_json")
        ? "COALESCE(raw, payload_json)"
        : names.has("raw")
          ? "raw"
          : names.has("payload_json")
            ? "payload_json"
            : "JSON_OBJECT()";
    const receivedExpression =
      names.has("received_at") && names.has("created_at")
        ? "COALESCE(received_at, created_at, NOW())"
        : names.has("received_at")
          ? "COALESCE(received_at, NOW())"
          : "COALESCE(created_at, NOW())";
    const sourceExpression = names.has("source") ? "source" : "'whatsapp'";
    const processedExpression = names.has("processed") ? "processed" : "1";
    const errorExpression = names.has("error_message") ? "error_message" : "NULL";
    const eventTypeExpression = names.has("event_type") ? "event_type" : "NULL";
    const whereClause = ownerConditions.length > 0 ? `WHERE (${ownerConditions.join(" OR ")})` : "";

    const whatsappEvents = (await db.query(
      `SELECT id, ${sourceExpression} AS source, ${processedExpression} AS processed,
              ${receivedExpression} AS received_at, ${rawExpression} AS raw,
              ${errorExpression} AS error_message, ${eventTypeExpression} AS event_type
       FROM webhook_events
       ${whereClause}
       ORDER BY ${receivedExpression} DESC LIMIT ?`,
      ownerParams.length > 0 ? [...ownerParams, data.limit] : [data.limit],
    )) as any[];
    eventSources.push(...(whatsappEvents || []));

    // Instagram e Messenger são registrados separadamente pelos respectivos
    // endpoints, mas pertencem ao mesmo painel de eventos da Meta.
    for (const source of [
      { table: "instagram_webhook_events", label: "instagram" },
      { table: "facebook_webhook_events", label: "messenger" },
    ]) {
      try {
        const cols = (await db.query(`SHOW COLUMNS FROM ${source.table}`)) as any[];
        const colNames = new Set((cols || []).map((c: any) => c.Field));
        const rawCol = colNames.has("payload") ? "payload" : colNames.has("raw") ? "raw" : "JSON_OBJECT()";
        const ownerCol = colNames.has("tenant_id") ? "tenant_id" : "user_id";
        const processedCol = colNames.has("processed") ? "processed" : "1";
        const errorCol = colNames.has("error_message") ? "error_message" : "NULL";
        const eventTypeCol = colNames.has("event_type") ? "event_type" : "NULL";
        const recCol = colNames.has("received_at") && colNames.has("created_at")
          ? "COALESCE(received_at, created_at, NOW())"
          : colNames.has("received_at")
            ? "COALESCE(received_at, NOW())"
            : "COALESCE(created_at, NOW())";
        
        const where = isMaster ? "" : `WHERE ${ownerCol} = ?`;
        const params = isMaster ? [source.label, data.limit] : [source.label, effectiveUserId, data.limit];
        const rows = (await db.query(
          `SELECT id, ? AS source, ${processedCol} AS processed,
                  ${recCol} AS received_at, ${rawCol} AS raw,
                  ${errorCol} AS error_message, ${eventTypeCol} AS event_type
           FROM ${source.table}
           ${where}
           ORDER BY received_at DESC LIMIT ?`,
          params,
        )) as any[];
        eventSources.push(...(rows || []));
      } catch (error) {
        // Compatibilidade com instalações antigas que ainda não possuem a tabela.
        console.warn(`[WebhookEvents] Não foi possível consultar ${source.table}`, error);
      }
    }

    const events = eventSources
      .map((event: any) => ({
        ...event,
        received_at: event.received_at || new Date().toISOString(),
        raw:
          typeof event.raw === "string"
            ? (() => {
                try {
                  return JSON.parse(event.raw);
                } catch {
                  return { value: event.raw };
                }
              })()
            : event.raw || {},
      }))
      .sort(
        (a: any, b: any) =>
          new Date(b.received_at || 0).getTime() - new Date(a.received_at || 0).getTime(),
      )
      .slice(0, data.limit);

    return { events };
  });
