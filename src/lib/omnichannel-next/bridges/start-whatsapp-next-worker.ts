import { startWhatsAppNextWorker } from "@/lib/messaging/bridges/bullmq-whatsapp-worker";
import { buildOmnichannelNextProductionContainer } from "@/lib/omnichannel-next/composition/omnichannel-next.production.container";
import { RealMySqlExecutor } from "@/lib/messaging/bridges/real-mysql-executor";
import { FetchHttpClient } from "@/lib/omnichannel-next/infrastructure/http/fetch-http-client";
import { getBullMQWhatsAppQueue } from "@/lib/messaging/bridges/bullmq-whatsapp-queue";
import type { OutboundJob } from "@/lib/omnichannel-next/application/outbox/outbound-job";

function buildContainer() {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT ?? 3306);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  if (!host || !user || !password || !database) {
    throw new Error("WhatsApp Next worker: database not configured");
  }

  const sql = new RealMySqlExecutor({ host, port, user, password, database });
  const http = new FetchHttpClient();
  const queue = getBullMQWhatsAppQueue();
  const graphApiVersion = process.env.META_GRAPH_VERSION?.replace(/^v/i, "") ?? "25.0";

  return buildOmnichannelNextProductionContainer(sql, http, queue, graphApiVersion);
}

export interface WhatsAppNextWorkerStartup {
  stop: () => Promise<void>;
}

export function startOmnichannelNextWhatsAppWorker(): WhatsAppNextWorkerStartup {
  const container = buildContainer();

  const handle = startWhatsAppNextWorker(async (data: unknown) => {
    const job = data as OutboundJob;
    const result = await container.whatsappWorker.process(job);
    return result;
  });

  return {
    stop: async () => {
      await handle.stop();
    },
  };
}
