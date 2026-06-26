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

    const [
      contactsNow,
      contactsPrev,
      templatesNow,
      templatesPrev,
      campaignsNow,
      campaignsPrev,
      deliveredCurrent,
      deliveredPrev,
    ] = await Promise.all([
      countBefore(effectiveUserId, "contacts", now.toISOString()),
      countBefore(effectiveUserId, "contacts", sevenAgo.toISOString()),
      countBefore(effectiveUserId, "templates", now.toISOString(), "synced_at"),
      countBefore(effectiveUserId, "templates", sevenAgo.toISOString(), "synced_at"),
      countBefore(effectiveUserId, "campaigns", now.toISOString()),
      countBefore(effectiveUserId, "campaigns", sevenAgo.toISOString()),
      countDeliveredBetween(effectiveUserId, sevenAgo.toISOString(), now.toISOString()),
      countDeliveredBetween(effectiveUserId, fourteenAgo.toISOString(), sevenAgo.toISOString()),
    ]);

    return {
      contacts: { current: contactsNow, previous: contactsPrev },
      templates: { current: templatesNow, previous: templatesPrev },
      campaigns: { current: campaignsNow, previous: campaignsPrev },
      delivered: { current: deliveredCurrent, previous: deliveredPrev },
    };
  });
