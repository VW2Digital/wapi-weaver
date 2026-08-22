import db from "../src/lib/db";

async function main() {
  const plans = await db.query("SELECT * FROM subscription_plans");
  console.log("subscription_plans:", plans);
}

main().catch(console.error).then(() => process.exit(0));
