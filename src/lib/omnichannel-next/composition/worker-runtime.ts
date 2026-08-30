import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";
import type { OutboundJob } from "@/lib/omnichannel-next/application/outbox/outbound-job";
import type { ProviderWorkerResult } from "@/lib/omnichannel-next/application/workers/provider-worker.types";
import type { ProviderWorker } from "@/lib/omnichannel-next/application/workers/provider-worker";

export interface WorkerRuntime {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
  process(job: OutboundJob): Promise<ProviderWorkerResult>;
}

export class ProviderWorkerRuntime implements WorkerRuntime {
  private running = false;

  constructor(private readonly worker: ProviderWorker) {}

  async start(): Promise<void> {
    if (this.running) {
      throw new OmnichannelError("WORKER_ALREADY_RUNNING", "Worker is already running");
    }
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  async process(job: OutboundJob): Promise<ProviderWorkerResult> {
    if (!this.running) {
      throw new OmnichannelError("WORKER_NOT_RUNNING", "Worker must be started before processing jobs");
    }
    return this.worker.process(job);
  }
}
