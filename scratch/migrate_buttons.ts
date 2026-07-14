import db from "../src/lib/db";
import crypto from "crypto";

async function runMigration(dryRun: boolean = true) {
  console.log(`Starting migration. Mode: ${dryRun ? "DRY-RUN" : "LIVE"}`);

  try {
    const steps = (await db.query(
      "SELECT id, message_type, buttons_config FROM bot_steps WHERE message_type IN ('buttons', 'list')"
    )) as any[];

    console.log(`Found ${steps.length} steps of type 'buttons' or 'list'.`);

    let updatedCount = 0;

    for (const step of steps) {
      if (!step.buttons_config) continue;

      let config: any;
      try {
        config = typeof step.buttons_config === "string" 
          ? JSON.parse(step.buttons_config) 
          : step.buttons_config;
      } catch (e) {
        console.warn(`Failed to parse buttons_config for step ${step.id}:`, e);
        continue;
      }

      let modified = false;

      // 1. If it's a buttons message type
      if (step.message_type === "buttons" && config?.action?.buttons) {
        config.action.buttons = config.action.buttons.map((btn: any) => {
          if (!btn.handleId) {
            btn.handleId = `btn_${crypto.randomBytes(4).toString("hex")}`;
            modified = true;
          }
          return btn;
        });
      }

      // 2. If it's a list message type
      if (step.message_type === "list" && config?.action?.sections) {
        config.action.sections = config.action.sections.map((sec: any) => {
          if (sec.rows) {
            sec.rows = sec.rows.map((row: any) => {
              if (!row.handleId) {
                row.handleId = `row_${crypto.randomBytes(4).toString("hex")}`;
                modified = true;
              }
              return row;
            });
          }
          return sec;
        });
      }

      if (modified) {
        updatedCount++;
        const newJson = JSON.stringify(config);
        if (dryRun) {
          console.log(`[DRY-RUN] Would update step ID: ${step.id}`);
          console.log(`Old: ${step.buttons_config}`);
          console.log(`New: ${newJson}`);
          console.log("-----------------------------------------");
        } else {
          await db.query("UPDATE bot_steps SET buttons_config = ? WHERE id = ?", [
            newJson,
            step.id,
          ]);
          console.log(`[LIVE] Updated step ID: ${step.id}`);
        }
      }
    }

    console.log(`Migration completed. Total modified: ${updatedCount}/${steps.length}`);
  } catch (err) {
    console.error("Migration failed:", err);
  }
  process.exit();
}

// Default to dry-run. Change to false for live update.
const isLive = process.argv.includes("--live");
runMigration(!isLive);
