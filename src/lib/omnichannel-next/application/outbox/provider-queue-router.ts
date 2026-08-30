import { UnsupportedProviderError } from "@/lib/omnichannel-next/domain/errors";
import type { Provider } from "@/lib/omnichannel-next/domain/provider";
import type { OutboundJob } from "./outbound-job";
import type { OutboundJobPort } from "./outbound-job.port";
import type { ProviderQueuePort } from "./provider-queue.port";

export class ProviderQueueRouter implements OutboundJobPort {
  private queues: Map<Provider, ProviderQueuePort> = new Map();

  register(queue: ProviderQueuePort): void {
    this.queues.set(queue.provider, queue);
  }

  async enqueue(job: OutboundJob): Promise<void> {
    const queue = this.queues.get(job.provider);
    if (!queue) throw new UnsupportedProviderError(job.provider);
    await queue.enqueue(job);
  }

  items(provider: Provider): OutboundJob[] {
    return this.queues.get(provider)?.items() ?? [];
  }
}
