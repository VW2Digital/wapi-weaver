import { Queue, Job, QueueEvents } from "bullmq";

export interface BullMQWhatsAppQueueOptions {
  host: string;
  port: number;
  password: string;
}

let queue: Queue | null = null;

function getConnectionOptions(): { host: string; port: number; username?: string; password?: string } {
  const host = process.env.REDIS_HOST ?? "localhost";
  const port = Number(process.env.REDIS_PORT ?? 6379);
  const password = process.env.REDIS_PASSWORD;
  const username = process.env.REDIS_USERNAME;

  return { host, port, username: username || undefined, password: password || undefined };
}

export function getBullMQWhatsAppQueue(options?: BullMQWhatsAppQueueOptions): Queue {
  if (queue) return queue;

  const host = options?.host ?? process.env.REDIS_HOST ?? "localhost";
  const port = options?.port ?? Number(process.env.REDIS_PORT ?? 6379);
  const password = options?.password ?? process.env.REDIS_PASSWORD ?? "";

  queue = new Queue("messaging-outbound-whatsapp", {
    connection: { host, port, password: password || undefined, username: options ? undefined : undefined },
    defaultJobOptions: {
      removeOnComplete: false,
      removeOnFail: false,
    },
  });

  return queue;
}

export async function waitForWhatsAppJob<T = unknown>(jobId: string, timeout = 30_000): Promise<T> {
  const q = getBullMQWhatsAppQueue();
  const job = await q.getJob(jobId);
  if (!job) {
    throw new Error(`WhatsApp outbound job ${jobId} not found in queue`);
  }

  const queueEvents = new QueueEvents("messaging-outbound-whatsapp", { connection: getConnectionOptions() });
  try {
    const result = await job.waitUntilFinished(queueEvents, timeout);
    return result as T;
  } finally {
    await queueEvents.close();
  }
}
