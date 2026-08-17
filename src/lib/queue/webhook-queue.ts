import { Queue, Worker } from "bullmq";
import { redis } from "../cache";
import { dbAdmin } from "@/integrations/mysql/client.server";

export const webhookQueue = new Queue("webhook-events", { connection: redis as any });

export const webhookWorker = new Worker(
  "webhook-events",
  async (job) => {
    // Import dynamically to avoid circular dependencies
    const { processMetaWebhookEvent } = await import("../../routes/api/public/whatsapp-webhook");

    const { entry, matchedUserId, evRowId } = job.data;
    
    await processMetaWebhookEvent(entry, matchedUserId);

    if (evRowId) {
      await dbAdmin.from("webhook_events").update({ processed: true }).eq("id", evRowId);
    }
  },
  { connection: redis as any, autorun: true, concurrency: 5 },
);

webhookWorker.on("failed", (job, err) => {
  console.error(`[Webhook Worker] Job ${job?.id} failed with error ${err.message}`);
});
