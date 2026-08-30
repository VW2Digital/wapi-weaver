import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { OutboundJob } from "@/lib/omnichannel-next/application/outbox/outbound-job";
import type { ProviderQueuePort } from "@/lib/omnichannel-next/application/outbox/provider-queue.port";
import { INSTAGRAM_OUTBOUND_QUEUE } from "./queue-names";

type MinimalBullMQQueue = {
  add: (
    name: string,
    data: unknown,
    opts?: { jobId?: string },
  ) => Promise<unknown>;
};

export class BullMQInstagramQueue implements ProviderQueuePort {
  readonly provider = "instagram" as const;

  constructor(private readonly queue: MinimalBullMQQueue) {}

  async enqueue(job: OutboundJob): Promise<void> {
    if (job.provider !== this.provider) {
      throw new OmnichannelError(
        "PROVIDER_QUEUE_MISMATCH",
        `${INSTAGRAM_OUTBOUND_QUEUE} cannot receive a ${job.provider} job`,
      );
    }

    await this.queue.add(
      "outbound",
      { ...job },
      { jobId: job.id },
    );
  }

  items(): OutboundJob[] {
    return [];
  }
}
