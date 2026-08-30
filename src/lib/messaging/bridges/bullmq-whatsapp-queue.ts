import { Queue } from "bullmq";

export interface BullMQWhatsAppQueueOptions {
  host: string;
  port: number;
  password: string;
}

let queue: Queue | null = null;

export function getBullMQWhatsAppQueue(options?: BullMQWhatsAppQueueOptions): Queue {
  if (queue) return queue;

  const host = options?.host ?? process.env.REDIS_HOST ?? "localhost";
  const port = options?.port ?? Number(process.env.REDIS_PORT ?? 6379);
  const password = options?.password ?? process.env.REDIS_PASSWORD ?? "";

  queue = new Queue("messaging:outbound:whatsapp", {
    connection: { host, port, password },
    defaultJobOptions: {
      removeOnComplete: false,
      removeOnFail: false,
    },
  });

  return queue;
}
