import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/mysql/auth-middleware";

async function countBefore(supabase: any, table: string, cutoffIso: string, column = "created_at") {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .lte(column, cutoffIso);
  if (error) throw error;
  return count ?? 0;
}

async function countDeliveredBetween(supabase: any, startIso: string, endIso: string) {
  const { count, error } = await supabase
    .from("campaign_messages")
    .select("*", { count: "exact", head: true })
    .gte("delivered_at", startIso)
    .lt("delivered_at", endIso);
  if (error) throw error;
  return count ?? 0;
}

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
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
      countBefore(supabase, "contacts", now.toISOString()),
      countBefore(supabase, "contacts", sevenAgo.toISOString()),
      countBefore(supabase, "templates", now.toISOString(), "synced_at"),
      countBefore(supabase, "templates", sevenAgo.toISOString(), "synced_at"),
      countBefore(supabase, "campaigns", now.toISOString()),
      countBefore(supabase, "campaigns", sevenAgo.toISOString()),
      countDeliveredBetween(supabase, sevenAgo.toISOString(), now.toISOString()),
      countDeliveredBetween(supabase, fourteenAgo.toISOString(), sevenAgo.toISOString()),
    ]);

    return {
      contacts: { current: contactsNow, previous: contactsPrev },
      templates: { current: templatesNow, previous: templatesPrev },
      campaigns: { current: campaignsNow, previous: campaignsPrev },
      delivered: { current: deliveredCurrent, previous: deliveredPrev },
    };
  });
