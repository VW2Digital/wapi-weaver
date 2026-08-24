"use server";
import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { getTenantFilter } from "./chat-helpers";
import db from "./db";

function toMySqlDatetime(d: Date | string): string {
  if (typeof d === "string") {
    return d.slice(0, 19).replace("T", " ");
  }
  return d.toISOString().slice(0, 19).replace("T", " ");
}

async function countBefore(
  filter: { isMaster: boolean; effectiveTenantId: string },
  table: string,
  cutoff: Date | string,
  column = "created_at",
): Promise<number> {
  const cutoffSql = toMySqlDatetime(cutoff);
  const whereTenant = filter.isMaster ? "1=1" : "(user_id = ? OR tenant_id = ?)";
  const params = filter.isMaster ? [cutoffSql] : [filter.effectiveTenantId, filter.effectiveTenantId, cutoffSql];
  const rows: any[] = (await db.query(
    `SELECT COUNT(*) AS cnt FROM \`${table}\` WHERE ${whereTenant} AND (${column} <= ? OR ${column} IS NULL)`,
    params,
  )) as any[];
  return Number(rows?.[0]?.cnt || 0);
}

async function countChatStatus(
  filter: { isMaster: boolean; effectiveTenantId: string },
  status: "aguardando" | "aberto" | "fechado",
): Promise<number> {
  const whereContacts = filter.isMaster ? "1=1" : "(user_id = ? OR tenant_id = ?)";
  const whereSessions = filter.isMaster ? "1=1" : "(cs.user_id = ? OR cs.tenant_id = ?)";
  const paramsContacts = filter.isMaster ? [] : [filter.effectiveTenantId, filter.effectiveTenantId];
  const paramsSessions = filter.isMaster ? [] : [filter.effectiveTenantId, filter.effectiveTenantId];

  if (status === "aguardando") {
    const rows: any[] = (await db.query(
      `SELECT (
         (SELECT COUNT(*) FROM contacts WHERE ${whereContacts} AND chat_status IN ('aguardando', 'pendente'))
         +
         (SELECT COUNT(*) FROM chat_sessions cs WHERE ${whereSessions} AND cs.status IN ('aguardando', 'pendente') AND cs.closed_at IS NULL AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = cs.contact_id AND c.chat_status IN ('aguardando', 'pendente')))
       ) AS cnt`,
      [...paramsContacts, ...paramsSessions],
    )) as any[];
    return Number(rows?.[0]?.cnt || 0);
  }
  if (status === "aberto") {
    const rows: any[] = (await db.query(
      `SELECT (
         (SELECT COUNT(*) FROM contacts WHERE ${whereContacts} AND (chat_status = 'aberto' OR chat_status IS NULL OR chat_status = ''))
         +
         (SELECT COUNT(*) FROM chat_sessions cs WHERE ${whereSessions} AND cs.status = 'aberto' AND cs.closed_at IS NULL AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = cs.contact_id AND (c.chat_status = 'aberto' OR c.chat_status IS NULL OR c.chat_status = '')))
       ) AS cnt`,
      [...paramsContacts, ...paramsSessions],
    )) as any[];
    return Number(rows?.[0]?.cnt || 0);
  }
  // fechado
  const rows: any[] = (await db.query(
    `SELECT (
       (SELECT COUNT(*) FROM contacts WHERE ${whereContacts} AND chat_status = 'fechado')
       +
       (SELECT COUNT(*) FROM chat_sessions cs WHERE ${whereSessions} AND cs.status = 'fechado' AND NOT EXISTS (SELECT 1 FROM contacts c WHERE c.id = cs.contact_id AND c.chat_status = 'fechado'))
     ) AS cnt`,
    [...paramsContacts, ...paramsSessions],
  )) as any[];
  return Number(rows?.[0]?.cnt || 0);
}

async function countContactsCreatedBetween(
  filter: { isMaster: boolean; effectiveTenantId: string },
  startIso: string,
  endIso: string,
): Promise<number> {
  const startSql = toMySqlDatetime(startIso);
  const endSql = toMySqlDatetime(endIso);
  const whereTenant = filter.isMaster ? "1=1" : "(user_id = ? OR tenant_id = ?)";
  const params = filter.isMaster
    ? [startSql, endSql]
    : [filter.effectiveTenantId, filter.effectiveTenantId, startSql, endSql];
  const rows: any[] = (await db.query(
    `SELECT COUNT(*) AS cnt FROM contacts WHERE ${whereTenant} AND created_at >= ? AND created_at <= ?`,
    params,
  )) as any[];
  return Number(rows?.[0]?.cnt || 0);
}

async function getAverageWaitTime(
  filter: { isMaster: boolean; effectiveTenantId: string },
  startIso: string,
): Promise<number> {
  const startSql = toMySqlDatetime(startIso);
  const whereTenant = filter.isMaster ? "1=1" : "(user_id = ? OR tenant_id = ?)";
  const params = filter.isMaster ? [startSql] : [filter.effectiveTenantId, filter.effectiveTenantId, startSql];
  const rows: any[] = (await db.query(
    `SELECT AVG(TIMESTAMPDIFF(SECOND, started_at, answered_at)) AS avg_wait 
     FROM chat_sessions 
     WHERE ${whereTenant} AND started_at >= ? AND answered_at IS NOT NULL`,
    params,
  )) as any[];
  return Math.round(Number(rows?.[0]?.avg_wait || 0));
}

async function getAverageConversationTime(
  filter: { isMaster: boolean; effectiveTenantId: string },
  startIso: string,
): Promise<number> {
  const startSql = toMySqlDatetime(startIso);
  const whereTenant = filter.isMaster ? "1=1" : "(user_id = ? OR tenant_id = ?)";
  const params = filter.isMaster ? [startSql] : [filter.effectiveTenantId, filter.effectiveTenantId, startSql];
  const rows: any[] = (await db.query(
    `SELECT AVG(TIMESTAMPDIFF(SECOND, answered_at, closed_at)) AS avg_conv 
     FROM chat_sessions 
     WHERE ${whereTenant} AND started_at >= ? AND closed_at IS NOT NULL AND answered_at IS NOT NULL`,
    params,
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
  filter: { isMaster: boolean; effectiveTenantId: string },
  startIso: string,
  endIso: string,
): Promise<number> {
  const startSql = toMySqlDatetime(startIso);
  const endSql = toMySqlDatetime(endIso);
  const whereCamp = filter.isMaster ? "1=1" : "(user_id = ? OR tenant_id = ?)";
  const whereDm = filter.isMaster ? "1=1" : "(user_id = ? OR tenant_id = ?)";
  const paramsCamp = filter.isMaster
    ? [startSql, endSql, startSql, endSql, startSql, endSql]
    : [filter.effectiveTenantId, filter.effectiveTenantId, startSql, endSql, startSql, endSql, startSql, endSql];
  const paramsDm = filter.isMaster
    ? [startSql, endSql]
    : [filter.effectiveTenantId, filter.effectiveTenantId, startSql, endSql];

  const rows: any[] = (await db.query(
    `SELECT (
       (SELECT COUNT(*) FROM campaign_messages 
        WHERE ${whereCamp} 
          AND status IN ('sent', 'delivered', 'read') 
          AND (
            (delivered_at >= ? AND delivered_at <= ?) 
            OR (delivered_at IS NULL AND sent_at >= ? AND sent_at <= ?)
            OR (delivered_at IS NULL AND sent_at IS NULL AND created_at >= ? AND created_at <= ?)
          )
       )
       +
       (SELECT COUNT(*) FROM direct_messages 
        WHERE ${whereDm} 
          AND direction = 'outgoing' 
          AND status IN ('sent', 'delivered', 'read') 
          AND created_at >= ? AND created_at <= ?
       )
     ) AS cnt`,
    [...paramsCamp, ...paramsDm],
  )) as any[];
  return Number(rows?.[0]?.cnt || 0);
}

async function countUnreadContacts(filter: { isMaster: boolean; effectiveTenantId: string }): Promise<number> {
  const whereTenant = filter.isMaster ? "1=1" : "(user_id = ? OR tenant_id = ?)";
  const params = filter.isMaster ? [] : [filter.effectiveTenantId, filter.effectiveTenantId];
  const rows: any[] = (await db.query(
    `SELECT COUNT(*) AS cnt FROM contacts WHERE ${whereTenant} AND is_unread = true`,
    params,
  )) as any[];
  return Number(rows?.[0]?.cnt || 0);
}

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((data?: { period?: "today" | "7d" | "30d" }) => data)
  .handler(async ({ context, data }) => {
    const filter = await getTenantFilter(context.userId);
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
      novosContatos,
      avgWaitSec,
      avgConversationSec,
      unreadChats,
    ] = await Promise.all([
      countBefore(filter, "contacts", now.toISOString()),
      countBefore(filter, "contacts", currentStart.toISOString()),
      countBefore(filter, "templates", now.toISOString()),
      countBefore(filter, "templates", currentStart.toISOString()),
      countBefore(filter, "campaigns", now.toISOString()),
      countBefore(filter, "campaigns", currentStart.toISOString()),
      countDeliveredBetween(filter, currentStart.toISOString(), now.toISOString()),
      countDeliveredBetween(filter, previousStart.toISOString(), previousEnd.toISOString()),
      countChatStatus(filter, "aberto"),
      countChatStatus(filter, "aguardando"),
      countChatStatus(filter, "fechado"),
      countContactsCreatedBetween(filter, currentStart.toISOString(), now.toISOString()),
      getAverageWaitTime(filter, currentStart.toISOString()),
      getAverageConversationTime(filter, currentStart.toISOString()),
      countUnreadContacts(filter),
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
        novosContatos: novosContatos,
        tmConversa: formatDuration(avgConversationSec),
        tmEspera: formatDuration(avgWaitSec),
        unreadChatsCount: unreadChats,
      },
    };
  });


