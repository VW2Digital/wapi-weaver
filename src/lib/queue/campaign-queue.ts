import { Queue, Worker } from "bullmq";
import Redis from "ioredis";

// Dedicated Redis connection for BullMQ to avoid sharing the cache client.
const queueRedis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  enableOfflineQueue: true,
});

export const campaignQueue = new Queue("campaign-dispatcher", { connection: queueRedis as any });

// Define the worker, but don't start it immediately.
export const campaignWorker = new Worker(
  "campaign-dispatcher",
  async (job) => {
    const { processOnce } = await import("../../routes/api/public/cron/process-queue");

    // Process a batch of pending messages
    const result = await processOnce();

    // If there were messages processed, schedule another job immediately to keep draining the queue
    if (result && result.processed > 0) {
      await campaignQueue.add("drain-batch", {}, { delay: 1000 });
    }
  },
  { connection: queueRedis as any, autorun: true, concurrency: 1 },
);

campaignWorker.on("failed", (job, err) => {
  console.error(`[Campaign Worker] Job ${job?.id} failed with error ${err.message}`);
});
