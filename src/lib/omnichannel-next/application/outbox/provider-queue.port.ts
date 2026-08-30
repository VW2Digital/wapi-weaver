import type { Provider } from "@/lib/omnichannel-next/domain/provider";
import type { OutboundJob } from "./outbound-job";

export interface ProviderQueuePort {
  readonly provider: Provider;
  enqueue(job: OutboundJob): Promise<void>;
  items(): OutboundJob[];
}
