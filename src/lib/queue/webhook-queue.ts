import { Queue, Worker } from "bullmq";
import { redis } from "../cache";
import { dbAdmin } from "@/integrations/mysql/client.server";

export const webhookQueue = new Queue("webhook-events", { connection: redis as any });

export const webhookWorker = new Worker(
  "webhook-events",
  async (job) => {
    // Import dynamically to avoid circular dependencies
    const { 
      processStatusUpdate, 
      processInboundMessages,
      processInboundDirectMessages,
      processHistorySync,
      processStateSync,
      processMessageEchoes,
      processTemplateStatusUpdate,
      processTemplateCategoryUpdate
    } = await import("../../routes/api/public/whatsapp-webhook");

    const { entry, matchedUserId, evRowId } = job.data;
    
    for (const ent of entry ?? []) {
      for (const change of ent.changes ?? []) {
        if (change.field === "messages") {
          await processStatusUpdate(change.value, matchedUserId);
          await processInboundMessages(change.value, matchedUserId);
          await processInboundDirectMessages(change.value, matchedUserId);
        } else if (change.field === "history") {
          await processHistorySync(change.value, matchedUserId);
        } else if (change.field === "smb_app_state_sync") {
          await processStateSync(change.value, matchedUserId);
        } else if (change.field === "smb_message_echoes") {
          await processMessageEchoes(change.value, matchedUserId);
        } else if (change.field === "message_template_status_update") {
          await processTemplateStatusUpdate(change.value, matchedUserId);
        } else if (change.field === "template_category_update") {
          await processTemplateCategoryUpdate(change.value, matchedUserId);
        }
      }
    }

    if (evRowId) {
      await dbAdmin.from("webhook_events").update({ processed: true }).eq("id", evRowId);
    }
  },
  { connection: redis as any, autorun: false, concurrency: 5 },
);

webhookWorker.on("failed", (job, err) => {
  console.error(`[Webhook Worker] Job ${job?.id} failed with error ${err.message}`);
});
