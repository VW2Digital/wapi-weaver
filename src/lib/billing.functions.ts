import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { toFriendlyError } from "@/lib/meta-errors";
import { aggregateMetaBillingAnalytics } from "@/lib/meta-waba-analytics";

function monthBoundsUnix(month: string): { start: number; end: number } {
  const [y, m] = month.split("-").map(Number);
  const start = Math.floor(Date.UTC(y, m - 1, 1) / 1000);
  const end = Math.floor(Date.UTC(y, m, 1) / 1000);
  return { start, end };
}

async function graphGet(url: string, accessToken: string) {
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok && !body?.error, status: r.status, body };
}

async function fetchWabaAnalytics(params: {
  wabaId: string;
  accessToken: string;
  graphVersion: string;
  start: number;
  end: number;
}): Promise<{ ok: true; body: any } | { ok: false; error: unknown }> {
  const base = `https://graph.facebook.com/${params.graphVersion}/${params.wabaId}`;
  const combinedFields = [
    "name",
    "currency",
    `analytics.start(${params.start}).end(${params.end}).granularity(MONTH)`,
    `conversation_analytics.start(${params.start}).end(${params.end}).granularity(MONTHLY).dimensions(CONVERSATION_CATEGORY,CONVERSATION_TYPE)`,
    `pricing_analytics.start(${params.start}).end(${params.end}).granularity(MONTHLY).dimensions(PRICING_CATEGORY,PRICING_TYPE)`,
  ].join(",");
  const combined = await graphGet(
    `${base}?fields=${encodeURIComponent(combinedFields)}`,
    params.accessToken,
  );

  const callAnalytics = await graphGet(
    `${base}?fields=${encodeURIComponent(`call_analytics.start(${params.start}).end(${params.end}).granularity(MONTHLY)`)}`,
    params.accessToken,
  );
  const callField =
    callAnalytics.ok && callAnalytics.body?.call_analytics
      ? { call_analytics: callAnalytics.body.call_analytics }
      : {};

  if (combined.ok) {
    return { ok: true, body: { ...combined.body, ...callField } };
  }

  const parts = await Promise.all([
    graphGet(`${base}?fields=name,currency`, params.accessToken),
    graphGet(
      `${base}?fields=${encodeURIComponent(`analytics.start(${params.start}).end(${params.end}).granularity(DAY)`)}`,
      params.accessToken,
    ),
    graphGet(
      `${base}?fields=${encodeURIComponent(`conversation_analytics.start(${params.start}).end(${params.end}).granularity(MONTHLY).dimensions(CONVERSATION_CATEGORY,CONVERSATION_TYPE)`)}`,
      params.accessToken,
    ),
    graphGet(
      `${base}?fields=${encodeURIComponent(`pricing_analytics.start(${params.start}).end(${params.end}).granularity(MONTHLY).dimensions(PRICING_CATEGORY,PRICING_TYPE)`)}`,
      params.accessToken,
    ),
  ]);
  const merged: Record<string, unknown> = { ...callField };
  if (parts[0].ok) {
    if (parts[0].body?.name) merged.name = parts[0].body.name;
    if (parts[0].body?.currency) merged.currency = parts[0].body.currency;
  }
  if (parts[1].ok && parts[1].body?.analytics) merged.analytics = parts[1].body.analytics;
  if (parts[2].ok && parts[2].body?.conversation_analytics) {
    merged.conversation_analytics = parts[2].body.conversation_analytics;
  }
  if (parts[3].ok && parts[3].body?.pricing_analytics) {
    merged.pricing_analytics = parts[3].body.pricing_analytics;
  }
  if (
    merged.conversation_analytics ||
    merged.pricing_analytics ||
    merged.analytics ||
    merged.call_analytics
  ) {
    return { ok: true, body: merged };
  }
  return { ok: false, error: combined.body };
}

export const getBillingReport = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { resolveOfficialWhatsAppTemplateAccount } = await import("./whatsapp-template-credentials");
    const tenantId = await resolveEffectiveUserId(context.userId);

    const now = new Date();
    const month =
      data.month ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const { start, end } = monthBoundsUnix(month);

    const account = await resolveOfficialWhatsAppTemplateAccount(tenantId);
    if (!account) {
      return {
        month,
        source: "meta" as const,
        ok: false,
        error:
          "Não há WABA WhatsApp conectada neste tenant. Conecte o número oficial da empresa para ver o consumo cobrado pela Meta.",
        wabaId: null,
        wabaName: null,
        currency: null,
        totals: aggregateMetaBillingAnalytics({}),
      };
    }

    const fetched = await fetchWabaAnalytics({
      wabaId: account.wabaId,
      accessToken: account.accessToken,
      graphVersion: account.graphVersion,
      start,
      end,
    });

    if (!fetched.ok) {
      const friendly = toFriendlyError(fetched.error, "A Meta recusou a consulta de analytics desta WABA.");
      return {
        month,
        source: "meta" as const,
        ok: false,
        error: `${friendly.title}: ${friendly.message}${friendly.hint ? ` ${friendly.hint}` : ""}`,
        wabaId: account.wabaId,
        wabaName: null,
        currency: null,
        totals: aggregateMetaBillingAnalytics({}),
        metaError: fetched.error,
      };
    }

    return {
      month,
      source: "meta" as const,
      ok: true,
      error: null,
      wabaId: account.wabaId,
      wabaName: typeof fetched.body?.name === "string" ? fetched.body.name : null,
      currency: typeof fetched.body?.currency === "string" ? fetched.body.currency : "USD",
      totals: aggregateMetaBillingAnalytics(fetched.body),
    };
  });

export const listPublicCommercialPlans = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    const { default: db } = await import("./db");
    const plans = (await db.query(
      `SELECT bp.*, sp.name as subscription_plan_name, sp.description as subscription_plan_desc,
              sp.max_agents, sp.max_funnels, sp.max_users
       FROM billing_plans bp
       LEFT JOIN subscription_plans sp ON bp.subscription_plan_id = sp.id
       WHERE bp.is_active = 1 OR bp.is_active = true
       ORDER BY bp.price ASC`,
    )) as any[];
    const operationalPlans = (await db.query(
      `SELECT * FROM subscription_plans WHERE is_active = 1 OR is_active = true ORDER BY name ASC`,
    )) as any[];
    return { plans, operationalPlans };
  });
