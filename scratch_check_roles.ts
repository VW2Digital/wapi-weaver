import db from "./src/lib/db";

async function main() {
  try {
    const users = await db.query("SELECT * FROM users");
    console.log("USERS:", users);
    const roles = await db.query("SELECT * FROM user_roles");
    console.log("ROLES:", roles);
    const settings = await db.query("SELECT id, sidebar_order FROM platform_settings");
    console.log("SETTINGS:", settings);
  } catch (e) {
    console.error("ERROR checking database:", e);
  }
  process.exit(0);
}
main();
