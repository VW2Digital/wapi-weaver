import { processOnce } from "./src/routes/api/public/cron/process-queue";

async function run() {
  console.log("Triggering processOnce manually...");
  try {
    const result = await processOnce();
    console.log("Result:", result);
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}

run();
