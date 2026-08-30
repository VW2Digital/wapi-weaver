import { Worker, type Job } from "bullmq";

const QUEUE_NAME = "messaging-outbound-whatsapp";

export interface WhatsAppNextWorkerHandle {
  stop: () => Promise<void>;
}

export function startWhatsAppNextWorker(
  processJob: (data: unknown) => Promise<unknown>,
): WhatsAppNextWorkerHandle {
  const host = process.env.REDIS_HOST ?? "localhost";
  const port = Number(process.env.REDIS_PORT ?? 6379);
  const password = process.env.REDIS_PASSWORD;
  const username = process.env.REDIS_USERNAME;

  const worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      if (!job?.data) {
        throw new Error("WhatsApp Next worker received empty job data");
      }
      return processJob(job.data);
    },
    {
      connection: { host, port, username: username || undefined, password: password || undefined },
      autorun: true,
    },
  );

  worker.on("completed", (job) => {
    console.log(`[WhatsApp Next Worker] completed ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[WhatsApp Next Worker] failed ${job?.id ?? "unknown"}`, error);
  });

  console.log("[WhatsApp Next Worker] started");

  return {
    stop: async () => {
      await worker.close();
      console.log("[WhatsApp Next Worker] stopped");
    },
  };
}
