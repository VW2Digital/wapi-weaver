import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SALVY_BASE = "https://api.salvy.com.br";

async function getKey(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("salvy_api_key")
    .eq("id", userId)
    .maybeSingle();
  return data?.salvy_api_key ?? null;
}

async function salvyFetch(token: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`${SALVY_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, body };
}

export const getSalvyStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await getKey(context.supabase, context.userId);
    return { configured: !!key };
  });

export const saveSalvyApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ api_key: z.string().trim().min(10).max(512).nullable() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({ salvy_api_key: data.api_key })
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const pingSalvy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await getKey(context.supabase, context.userId);
    if (!key) return { ok: false, error: "Chave de API da Salvy não configurada" };
    const r = await salvyFetch(key, "/api/v2/virtual-phone-accounts/area-codes?available=true");
    if (!r.ok) return { ok: false, error: (r.body as any)?.message ?? `Falha (HTTP ${r.status})` };
    return { ok: true };
  });

export const listSalvyAreaCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await getKey(context.supabase, context.userId);
    if (!key) return { ok: false as const, error: "Chave de API da Salvy não configurada", areaCodes: [] };
    const r = await salvyFetch(key, "/api/v2/virtual-phone-accounts/area-codes?available=true");
    if (!r.ok) return { ok: false as const, error: (r.body as any)?.message ?? "Falha ao listar DDDs", areaCodes: [] };
    const areaCodes = ((r.body as any)?.areaCodes ?? []) as Array<{ areaCode: number }>;
    return { ok: true as const, areaCodes };
  });

function mapSalvy(n: any) {
  return {
    salvy_id: n.id,
    phone_number: n.phoneNumber,
    name: n.name ?? null,
    status: n.status ?? "pending",
    cost_center: n.costCenter ?? null,
    cancel_reason: n.cancelReason ?? null,
    created_at_remote: n.createdAt ?? null,
    canceled_at: n.canceledAt ?? null,
    raw: n,
  };
}

export const listSalvyNumbers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: cached } = await context.supabase
      .from("salvy_numbers")
      .select("*")
      .order("created_at", { ascending: false });
    return { numbers: cached ?? [] };
  });

export const syncSalvyNumbers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await getKey(context.supabase, context.userId);
    if (!key) return { ok: false as const, error: "Chave de API da Salvy não configurada" };
    const r = await salvyFetch(key, "/api/v2/virtual-phone-accounts");
    if (!r.ok) return { ok: false as const, error: (r.body as any)?.message ?? "Falha ao sincronizar" };
    const items = ((r.body as any)?.virtualPhoneAccounts ?? (r.body as any)?.items ?? (r.body as any)?.data ?? []) as any[];
    let upserted = 0;
    for (const it of items) {
      const mapped = mapSalvy(it);
      const { error } = await context.supabase
        .from("salvy_numbers")
        .upsert(
          { ...mapped, user_id: context.userId, area_code: it.areaCode ?? null },
          { onConflict: "user_id,salvy_id" },
        );
      if (!error) upserted++;
    }
    return { ok: true as const, upserted, total: items.length };
  });

export const createSalvyNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      areaCode: z.number().int().min(11).max(99),
      name: z.string().trim().max(100).optional(),
      costCenter: z.string().trim().max(100).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const key = await getKey(context.supabase, context.userId);
    if (!key) return { ok: false as const, error: "Chave de API da Salvy não configurada" };

    const payload: any = { areaCode: data.areaCode };
    if (data.name) payload.name = data.name;
    if (data.costCenter) payload.costCenter = data.costCenter;

    const r = await salvyFetch(key, "/api/v2/virtual-phone-accounts", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      return { ok: false as const, error: (r.body as any)?.message ?? `Falha ao criar número (HTTP ${r.status})`, details: r.body };
    }
    const n = r.body as any;
    const mapped = mapSalvy(n);
    await context.supabase.from("salvy_numbers").upsert(
      { ...mapped, user_id: context.userId, area_code: data.areaCode },
      { onConflict: "user_id,salvy_id" },
    );
    return { ok: true as const, number: n };
  });

export const cancelSalvyNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      salvy_id: z.string().trim().min(1).max(64),
      reason: z.string().trim().max(255).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const key = await getKey(context.supabase, context.userId);
    if (!key) return { ok: false as const, error: "Chave de API da Salvy não configurada" };

    // ensure ownership
    const { data: owned } = await context.supabase
      .from("salvy_numbers")
      .select("id")
      .eq("salvy_id", data.salvy_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!owned) return { ok: false as const, error: "Número não encontrado" };

    const r = await salvyFetch(key, `/api/v2/virtual-phone-accounts/${encodeURIComponent(data.salvy_id)}/cancel`, {
      method: "POST",
      body: JSON.stringify(data.reason ? { reason: data.reason } : {}),
    });
    if (!r.ok) {
      return { ok: false as const, error: (r.body as any)?.message ?? `Falha ao cancelar (HTTP ${r.status})` };
    }
    await context.supabase
      .from("salvy_numbers")
      .update({ status: "canceled", canceled_at: new Date().toISOString(), cancel_reason: data.reason ?? null })
      .eq("salvy_id", data.salvy_id)
      .eq("user_id", context.userId);
    return { ok: true as const };
  });
