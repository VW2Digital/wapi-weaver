import type { ProviderSendResult } from "@/lib/omnichannel-next/application/ports/outbound-provider.port";

export interface ProviderWorkerResult extends ProviderSendResult {
  jobId: string;
}
