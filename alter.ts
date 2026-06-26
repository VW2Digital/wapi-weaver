import { query } from "./src/lib/db";

async function main() {
  try {
    await query("ALTER TABLE bot_steps ADD COLUMN position_x FLOAT NOT NULL DEFAULT 0");
    console.log("Added position_x");
  } catch (e: any) {
    if (e.code === "ER_DUP_FIELDNAME") console.log("position_x already exists");
    else console.error(e);
  }

  try {
    await query("ALTER TABLE bot_steps ADD COLUMN position_y FLOAT NOT NULL DEFAULT 0");
    console.log("Added position_y");
  } catch (e: any) {
    if (e.code === "ER_DUP_FIELDNAME") console.log("position_y already exists");
    else console.error(e);
  }

  process.exit(0);
}

main();
