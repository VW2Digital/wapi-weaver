import { ProviderWorker } from "@/lib/omnichannel-next/application/workers/provider-worker";
import { ProviderWorkerRuntime, type WorkerRuntime } from "./worker-runtime";
import type { OmnichannelNextContainer } from "./omnichannel-next.container";

export function createWhatsappWorker(container: OmnichannelNextContainer): WorkerRuntime {
  const worker = new ProviderWorker(container.whatsappProvider, container.messageRepository);
  return new ProviderWorkerRuntime(worker);
}
