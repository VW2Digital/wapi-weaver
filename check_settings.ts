import { ServerSupabaseMySQLClient } from "./src/lib/supabase-mysql";

async function run() {
  const client = new ServerSupabaseMySQLClient("user-id", "admin");
  const res = await client
    .from("platform_settings")
    .select(
      "meta_app_id, meta_config_id, meta_graph_version, updated_at, meta_app_secret, head_tags, body_tags, cron_secret",
    )
    .eq("id", 1)
    .maybeSingle();
  console.log("Query Compiler result:", res);
  process.exit();
}
run();
