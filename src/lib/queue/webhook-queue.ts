import { Queue, Worker } from "bullmq";
import { redis } from "../cache";
import {
  getPendingEvents,
  markEventCompleted,
  markEventFailed,
  markEventProcessing,
  hydrateCanonicalEvent,
} from "@/lib/messaging/event-store.server";
import { processCanonicalEvent } from "@/lib/messaging/processor.server";

export const webhookQueue = new Queue("webhook-events", { connection: redis as any });

export const webhookWorker = new Worker(
  "webhook-events",
  async (job) => {
    const { eventId } = job.data as { eventId: string };
    if (!eventId) {
      throw new Error("Missing eventId in webhook job");
    }

    await markEventProcessing(eventId);

    try {
      const [row] = await getPendingEvents(1);
      if (!row || row.id !== eventId) {
        // The event is no longer pending (already processed or not found)
        return;
      }

      const event = hydrateCanonicalEvent(row);
      await processCanonicalEvent(event);
      await markEventCompleted(eventId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[Webhook Worker] Failed to process event ${eventId}: ${message}`);
      await markEventFailed(eventId, message);
      throw error;
    }
  },
  { connection: redis as any, autorun: true, concurrency: 5 },
);

webhookWorker.on("failed", (job, err) => {
  console.error(`[Webhook Worker] Job ${job?.id} failed with error ${err.message}`);
});

/**
 * Enfileira um evento canônico para processamento assíncrono.
 */
export async function enqueueMessagingEvent(eventId: string): Promise<void> {
  await webhookQueue.add(
    `messaging-event:${eventId}`,
    { eventId },
    { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
  );
}
