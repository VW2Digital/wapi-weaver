import db from "../src/lib/db";

async function main() {
  try {
    const funnels = await db.query("SELECT id, name, is_default FROM sales_funnels");
    console.log("Funnels:", funnels);

    const stages = await db.query("SELECT id, funnel_id, name FROM sales_stages");
    console.log("Stages count:", stages.length);
    if (stages.length > 0) {
      console.log("First stage:", stages[0]);
    }

    const contacts = await db.query("SELECT id, name, phone_e164, kanban_stage_id, chat_status, opted_out FROM contacts LIMIT 3");
    console.log("Contacts count:", contacts.length);
    console.log("Contacts:", contacts);

    const teams = await db.query("SELECT id, name FROM teams");
    console.log("Teams:", teams);

    const members = await db.query("SELECT * FROM team_members");
    console.log("Team members count:", members.length);
  } catch (err: any) {
    console.error("Error:", err.message);
  }
  process.exit(0);
}

main();
