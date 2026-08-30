import type { OutboundJob } from "./outbound-job";

export interface OutboundJobPort {
  enqueue(job: OutboundJob): Promise<void>;
}
