import crypto from "crypto";

export type DsUsageCategory =
  | "action_analysis"
  | "completion"
  | "embedding"
  | "query_rewriting"
  | "transcription";

/** Estimativa simples USD/1K tokens (aproximada). */
export function estimateCostUsd(model: string, tokens: number): number {
  const m = String(model || "").toLowerCase();
  let per1k = 0.00015; // gpt-4o-mini-ish
  if (m.includes("gpt-4o") && !m.includes("mini")) per1k = 0.005;
  else if (m.includes("gpt-4.1")) per1k = 0.003;
  else if (m.includes("gemini")) per1k = 0.0001;
  else if (m.includes("gpt-3.5")) per1k = 0.0005;
  return Number(((tokens / 1000) * per1k).toFixed(4));
}

export async function logDsAgentUsage(params: {
  agentId: string;
  tenantId: string;
  model: string;
  provider: string;
  category?: DsUsageCategory;
  tokens: number;
  costUsd?: number;
}): Promise<void> {
  const tokens = Math.max(0, Math.floor(Number(params.tokens) || 0));
  if (!params.agentId || !params.tenantId || tokens <= 0) return;

  try {
    const { default: db } = await import("./db");
    const cost =
      params.costUsd != null
        ? Number(params.costUsd)
        : estimateCostUsd(params.model, tokens);

    await db.query(
      `INSERT INTO ds_agent_usage_logs
         (id, agent_id, tenant_id, model, provider, category, tokens, cost_usd)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        params.agentId,
        params.tenantId,
        String(params.model || "gpt-4o-mini").slice(0, 100),
        String(params.provider || "OpenAI Padrão").slice(0, 100),
        params.category || "completion",
        tokens,
        cost,
      ],
    );
  } catch (err: any) {
    console.error("[ds-agent-usage] Falha ao gravar log:", err?.message || err);
  }
}
