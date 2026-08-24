"use server";
import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { resolveEffectiveUserId } from "./chat-helpers";
import db from "./db";

function toMySqlDatetime(d: Date | string): string {
  if (typeof d === "string") {
    return d.slice(0, 19).replace("T", " ");
  }
  return d.toISOString().slice(0, 19).replace("T", " ");
}

async function countBefore(
  userId: string,
  table: string,
  cutoff: Date | string,
  column = "created_at",
): Promise<number> {
  const cutoffSql = toMySqlDatetime(cutoff);
  const rows: any[] = (await db.query(
    `SELECT COUNT(*) AS cnt FROM \`${table}\` WHERE user_id = ? AND (${column} <= ? OR ${column} IS NULL)`,
    [userId, cutoffSql],
  )) as any[];
  return Number(rows?.[0]?.cnt || 0);
}

async function countActiveSessionsByStatus(userId: string, status: string): Promise<number> {
  const aliases = status === "aguardando" ? ["aguardando", "pendente"] : [status];
  const placeholders = aliases.map(() => "?").join(", ");
  const rows: any[] = (await db.query(
    `SELECT COUNT(*) AS cnt
     FROM chat_sessions
     WHERE user_id = ? AND status IN (${placeholders}) AND closed_at IS NULL`,
    [userId, ...aliases],
  )) as any[];
  return (rows?.[0]?.cnt as number) ?? 0;
}

async function countClosedSessionsToday(userId: string, isoDate: string): Promise<number> {
  const rows: any[] = (await db.query(
    `SELECT COUNT(*) AS cnt FROM chat_sessions WHERE user_id = ? AND status = 'fechado' AND closed_at >= ?`,
    [userId, isoDate],
  )) as any[];
  return (rows?.[0]?.cnt as number) ?? 0;
}

async function countContactsCreatedSince(userId: string, isoDate: string): Promise<number> {
  const rows: any[] = (await db.query(
    `SELECT COUNT(*) AS cnt FROM \`contacts\` WHERE user_id = ? AND created_at >= ?`,
    [userId, isoDate],
  )) as any[];
  return (rows?.[0]?.cnt as number) ?? 0;
}

async function getAverageWaitTime(userId: string, startIso: string): Promise<number> {
  const rows: any[] = (await db.query(
    `SELECT AVG(TIMESTAMPDIFF(SECOND, started_at, answered_at)) AS avg_wait 
     FROM chat_sessions 
     WHERE user_id = ? AND started_at >= ? AND answered_at IS NOT NULL`,
    [userId, startIso],
  )) as any[];
  return Math.round(Number(rows?.[0]?.avg_wait || 0));
}

async function getAverageConversationTime(userId: string, startIso: string): Promise<number> {
  const rows: any[] = (await db.query(
    `SELECT AVG(TIMESTAMPDIFF(SECOND, answered_at, closed_at)) AS avg_conv 
     FROM chat_sessions 
     WHERE user_id = ? AND started_at >= ? AND closed_at IS NOT NULL AND answered_at IS NOT NULL`,
    [userId, startIso],
  )) as any[];
  return Math.round(Number(rows?.[0]?.avg_conv || 0));
}

function formatDuration(seconds: number): string {
  if (!seconds) return "00h 00m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m`;
}

async function countDeliveredBetween(
  userId: string,
  startIso: string,
  endIso: string,
): Promise<number> {
  const rows: any[] = (await db.query(
    `SELECT COUNT(*) AS cnt FROM campaign_messages WHERE user_id = ? AND delivered_at >= ? AND delivered_at < ?`,
    [userId, startIso, endIso],
  )) as any[];
  return (rows?.[0]?.cnt as number) ?? 0;
}

async function countUnreadContacts(userId: string): Promise<number> {
  const rows: any[] = (await db.query(
    `SELECT COUNT(*) AS cnt FROM contacts WHERE user_id = ? AND is_unread = true`,
    [userId],
  )) as any[];
  return (rows?.[0]?.cnt as number) ?? 0;
}

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((data?: { period?: "today" | "7d" | "30d" }) => data)
  .handler(async ({ context, data }) => {
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const period = data?.period || "7d";
    const now = new Date();

    let currentStart: Date;
    let previousStart: Date;
    let previousEnd: Date;

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    if (period === "today") {
      currentStart = startOfToday;
      previousStart = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);
      previousEnd = startOfToday;
    } else if (period === "30d") {
      currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      previousEnd = currentStart;
    } else {
      // Padrão: 7 dias
      currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      previousEnd = currentStart;
    }

    const [
      contactsNow,
      contactsPrev,
      templatesNow,
      templatesPrev,
      campaignsNow,
      campaignsPrev,
      deliveredCurrent,
      deliveredPrev,
      chatAberto,
      chatAguardando,
      chatFechado,
      novosContatosHoje,
      avgWaitSec,
      avgConversationSec,
      unreadChats,
    ] = await Promise.all([
      countBefore(effectiveUserId, "contacts", now.toISOString()),
      countBefore(effectiveUserId, "contacts", currentStart.toISOString()),
      countBefore(effectiveUserId, "templates", now.toISOString()),
      countBefore(effectiveUserId, "templates", currentStart.toISOString()),
      countBefore(effectiveUserId, "campaigns", now.toISOString()),
      countBefore(effectiveUserId, "campaigns", currentStart.toISOString()),
      countDeliveredBetween(effectiveUserId, currentStart.toISOString(), now.toISOString()),
      countDeliveredBetween(effectiveUserId, previousStart.toISOString(), previousEnd.toISOString()),
      countActiveSessionsByStatus(effectiveUserId, "aberto"),
      countActiveSessionsByStatus(effectiveUserId, "aguardando"),
      countClosedSessionsToday(effectiveUserId, startOfToday.toISOString()),
      countContactsCreatedSince(effectiveUserId, startOfToday.toISOString()),
      getAverageWaitTime(effectiveUserId, startOfToday.toISOString()),
      getAverageConversationTime(effectiveUserId, startOfToday.toISOString()),
      countUnreadContacts(effectiveUserId),
    ]);

    return {
      period,
      contacts: { current: contactsNow, previous: contactsPrev },
      templates: { current: templatesNow, previous: templatesPrev },
      campaigns: { current: campaignsNow, previous: campaignsPrev },
      delivered: { current: deliveredCurrent, previous: deliveredPrev },
      chatMetrics: {
        emConversa: chatAberto,
        aguardando: chatAguardando,
        finalizados: chatFechado,
        novosContatos: novosContatosHoje,
        tmConversa: formatDuration(avgConversationSec),
        tmEspera: formatDuration(avgWaitSec),
        unreadChatsCount: unreadChats,
      },
    };
  });
