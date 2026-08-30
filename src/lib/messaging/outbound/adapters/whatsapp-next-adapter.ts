import { randomUUID } from "node:crypto";
import type { IOutboundAdapter, OutboundMessageContext, OutboundSendResult } from "../types";
import { FetchHttpClient } from "@/lib/omnichannel-next/infrastructure/http/fetch-http-client";
import { buildOmnichannelNextProductionContainer } from "@/lib/omnichannel-next/composition/omnichannel-next.production.container";
import { RealMySqlExecutor } from "@/lib/messaging/bridges/real-mysql-executor";
import { getBullMQWhatsAppQueue } from "@/lib/messaging/bridges/bullmq-whatsapp-queue";
import { UnsupportedProviderError } from "../types";
import type { OutboundJob } from "@/lib/omnichannel-next/application/outbox/outbound-job";

function buildMessage(command: OutboundMessageContext) {
  const { payload, type } = command;
  if (type === "text" || payload.type === "text") {
    return { type: "text" as const, text: payload.text?.body ?? "" };
  }
  throw new UnsupportedProviderError("whatsapp-next-unsupported-message-type");
}

export class WhatsAppNextOutboundAdapter implements IOutboundAdapter {
  readonly provider = "whatsapp" as const;
  private container: ReturnType<typeof buildOmnichannelNextProductionContainer> | null = null;

  private getContainer() {
    if (this.container) return this.container;

    const host = process.env.DB_HOST;
    const port = Number(process.env.DB_PORT ?? 3306);
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const database = process.env.DB_NAME;

    if (!host || !user || !password || !database) {
      throw new Error("WhatsApp Next adapter: database not configured");
    }

    const sql = new RealMySqlExecutor({ host, port, user, password, database });
    const http = new FetchHttpClient();
    const bullQueue = getBullMQWhatsAppQueue();
    const graphApiVersion = process.env.META_GRAPH_VERSION?.replace(/^v/i, "") ?? "25.0";

    this.container = buildOmnichannelNextProductionContainer(sql, http, bullQueue, graphApiVersion);
    return this.container;
  }

  async send(context: OutboundMessageContext): Promise<OutboundSendResult> {
    if (context.provider !== "whatsapp") {
      throw new UnsupportedProviderError(context.provider);
    }

    const conversationId = context.conversationId;
    if (!conversationId) {
      throw new Error("WhatsApp Next adapter: conversationId is required");
    }

    const container = this.getContainer();
    const message = buildMessage(context);

    const result = await container.sendMessageService.execute({
      tenantId: context.tenantId,
      conversationId,
      message,
    });

    const job: OutboundJob = {
      id: randomUUID(),
      tenantId: context.tenantId,
      messageId: result.messageId,
      conversationId: result.conversationId,
      channelConnectionId: result.channelConnectionId,
      provider: result.provider,
      recipient: context.contactPhone,
      message,
      attempt: 0,
      createdAt: new Date().toISOString(),
    };

    const workerResult = await container.whatsappWorker.process(job);

    return {
      provider: "whatsapp",
      providerMessageId: workerResult.providerMessageId ?? null,
      providerAccountId: context.providerAccountId ?? null,
      status: workerResult.status as OutboundSendResult["status"],
      responsePayload: { status: workerResult.status, jobId: workerResult.jobId },
    };
  }
}
