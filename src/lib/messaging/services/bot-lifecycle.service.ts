"use server";

import db from "@/lib/db";

export interface BotActivationInput {
  legacySettings: Array<{ is_active: number | boolean | null; instance_id?: string | null }>;
  builderFlows: Array<{ is_active: number | boolean | null }>;
  conversationState: {
    bot_active: number | boolean | null;
    is_paused: number | boolean | null;
    paused_until?: string | Date | null;
  } | null;
}

export interface BotActivationDecision {
  active: boolean;
  reason: string;
}

const toBool = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return value === "1" || value === "true";
  return false;
};

const isPaused = (state: NonNullable<BotActivationInput["conversationState"]>): boolean => {
  if (!toBool(state.is_paused)) return false;
  const raw = state.paused_until;
  if (!raw) return true;
  const str = typeof raw === "string" ? raw : new Date(raw).toISOString();
  const pausedUntil = new Date(str.includes("Z") || str.includes("+") ? str : str.replace(" ", "T") + "Z");
  return Date.now() < pausedUntil.getTime();
};

export function evaluateBotActivation(input: BotActivationInput): BotActivationDecision {
  const { legacySettings, builderFlows, conversationState } = input;

  const hasActiveLegacy = legacySettings.some((s) => toBool(s.is_active));
  const hasActiveFlow = builderFlows.some((f) => toBool(f.is_active));

  if (!hasActiveLegacy && !hasActiveFlow) {
    return { active: false, reason: "NO_ACTIVE_FLOW" };
  }

  if (conversationState) {
    if (!toBool(conversationState.bot_active)) {
      return { active: false, reason: "CONVERSATION_BOT_INACTIVE" };
    }
    if (isPaused(conversationState)) {
      return { active: false, reason: "CONVERSATION_PAUSED" };
    }
  }

  return { active: true, reason: "BOT_ACTIVE" };
}

export interface BotActivationContext {
  legacySettings: BotActivationInput["legacySettings"];
  builderFlows: BotActivationInput["builderFlows"];
  conversationState: BotActivationInput["conversationState"];
}

export async function getBotActivationContext(
  userId: string,
  channel: string,
  contactPhone: string,
): Promise<BotActivationContext> {
  const [legacyRows] = (await db.query(
    "SELECT is_active, instance_id FROM bot_settings WHERE (user_id = ? OR tenant_id = ?) AND channel = ?",
    [userId, userId, channel],
  )) as Array<{ is_active: number; instance_id: string | null }>[];

  const [builderRows] = (await db.query(
    "SELECT id, is_active, channel FROM bot_flows WHERE (user_id = ? OR tenant_id = ?) AND channel = ?",
    [userId, userId, channel],
  )) as Array<{ id: string; is_active: number; channel: string }>[];

  const [stateRows] = (await db.query(
    `SELECT bot_active, is_paused, paused_until
     FROM bot_conversation_state
     WHERE (user_id = ? OR tenant_id = ?)
       AND contact_number = ?
       AND channel = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId, userId, contactPhone, channel],
  )) as Array<{ bot_active: number; is_paused: number; paused_until: string | null }>[];

  return {
    legacySettings: legacyRows ?? [],
    builderFlows: builderRows ?? [],
    conversationState: stateRows?.[0] ?? null,
  };
}
