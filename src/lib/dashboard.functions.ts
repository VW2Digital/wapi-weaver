import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { resolveEffectiveUserId } from "./chat-helpers";
import db from "./db";

async function countBefore(
  userId: string,
  table: string,
  cutoffIso: string,
  column = "created_at",
): Promise<number> {
  const rows: any[] = (await db.query(
    `SELECT COUNT(*) AS cnt FROM \`${table}\` WHERE user_id = ? AND ${column} <= ?`,
    [userId, cutoffIso],
  )) as any[];
  return (rows?.[0]?.cnt as number) ?? 0;
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

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const now = new Date();
    const sevenAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

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
      sessionsRows,
      aiAgentRows,
      usersRows
    ] = await Promise.all([
      countBefore(effectiveUserId, "contacts", now.toISOString()),
      countBefore(effectiveUserId, "contacts", sevenAgo.toISOString()),
      countBefore(effectiveUserId, "templates", now.toISOString(), "synced_at"),
      countBefore(effectiveUserId, "templates", sevenAgo.toISOString(), "synced_at"),
      countBefore(effectiveUserId, "campaigns", now.toISOString()),
      countBefore(effectiveUserId, "campaigns", sevenAgo.toISOString()),
      countDeliveredBetween(effectiveUserId, sevenAgo.toISOString(), now.toISOString()),
      countDeliveredBetween(effectiveUserId, fourteenAgo.toISOString(), sevenAgo.toISOString()),
      countActiveSessionsByStatus(effectiveUserId, "aberto"),
      countActiveSessionsByStatus(effectiveUserId, "aguardando"),
      countClosedSessionsToday(effectiveUserId, startOfToday.toISOString()),
      countContactsCreatedSince(effectiveUserId, startOfToday.toISOString()),
      getAverageWaitTime(effectiveUserId, startOfToday.toISOString()),
      getAverageConversationTime(effectiveUserId, startOfToday.toISOString()),
      db.query("SELECT id FROM wapi_sessions WHERE user_id = ? AND status = 'CONNECTED' LIMIT 1", [effectiveUserId]),
      db.query("SELECT id FROM ai_agent_settings WHERE user_id = ? AND is_active = 1 LIMIT 1", [effectiveUserId]),
      db.query("SELECT COUNT(*) as cnt FROM users WHERE tenant_id = ?", [effectiveUserId])
    ]);

    const hasSessionConnected = (sessionsRows as any[]).length > 0;
    const hasAiAgentActive = (aiAgentRows as any[]).length > 0;
    const hasTeamMembers = ((usersRows as any[])[0]?.cnt || 0) > 0;

    return {
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
      },
      onboarding: {
        hasSessionConnected,
        hasAiAgentActive,
        hasTeamMembers,
      }
    };
  });

export const getMasterDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data: rolesData, error: rolesErr } = await context.db
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    
    const roles = (rolesData ?? []).map((r: any) => r.role);
    if (!roles.includes("adminmaster") && !roles.includes("owner")) {
      throw new Error("Acesso negado.");
    }

    // Calcular Receita (MRR) baseada em planos das licenças ativas
    const licensesRows: any[] = await db.query(
      `SELECT l.id, l.status, l.ai_tokens_used, p.price_monthly, p.max_users
       FROM licenses l
       LEFT JOIN subscription_plans p ON l.plan_id = p.id`
    ) as any[];

    let mrr = 0;
    let activeLicenses = 0;
    let totalTokens = 0;

    for (const lic of licensesRows) {
      totalTokens += (lic.ai_tokens_used || 0);
      if (lic.status === "active") {
        activeLicenses++;
        mrr += Number(lic.price_monthly || 0);
      }
    }

    const [usersRes]: any = await db.query("SELECT COUNT(*) as cnt FROM users");
    const totalUsers = usersRes[0].cnt;

    return {
      mrr,
      activeLicenses,
      totalLicenses: licensesRows.length,
      totalTokens,
      totalUsers,
    };
  });

