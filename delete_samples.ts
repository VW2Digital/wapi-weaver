import db from "./src/lib/db";
async function run() {
  const r = await db.query("DELETE FROM templates WHERE meta_template_id LIKE 'sample_%'");
  console.log("Deleted samples", r);
  process.exit();
}
run();
