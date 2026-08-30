import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { OutboundProviderPort } from "@/lib/omnichannel-next/application/ports/outbound-provider.port";
import type { MessageRepositoryPort } from "@/lib/omnichannel-next/application/ports/message-repository.port";
import type { OutboundJob } from "@/lib/omnichannel-next/application/outbox/outbound-job";
import type { ProviderWorkerResult } from "./provider-worker.types";

export class ProviderWorker {
  constructor(
    private readonly provider: OutboundProviderPort,
    private readonly messageRepository: MessageRepositoryPort,
  ) {}

  async process(job: OutboundJob): Promise<ProviderWorkerResult> {
    if (job.provider !== this.provider.provider) {
      throw new OmnichannelError(
        "PROVIDER_JOB_MISMATCH",
        `Worker for ${this.provider.provider} cannot process job for ${job.provider}`,
      );
    }

    const message = await this.messageRepository.getById(job.messageId);
    if (message?.status === "accepted") {
      return {
        jobId: job.id,
        providerMessageId: message.providerMessageId,
        status: "accepted",
      };
    }

    await this.messageRepository.markProcessing(job.messageId);

    try {
      const result = await this.provider.send({
        tenantId: job.tenantId,
        conversationId: job.conversationId,
        channelConnectionId: job.channelConnectionId,
        messageId: job.messageId,
        provider: job.provider,
        recipient: job.recipient,
        message: job.message,
      });

      if (!result.providerMessageId) {
        throw new OmnichannelError(
          "PROVIDER_SEND_ERROR",
          `Provider ${job.provider} did not return a message id`,
        );
      }

      await this.messageRepository.markAccepted(job.messageId, result.providerMessageId);

      return {
        jobId: job.id,
        providerMessageId: result.providerMessageId,
        status: "accepted",
      };
    } catch (error) {
      await this.messageRepository.markFailed(job.messageId);
      throw error;
    }
  }
}
