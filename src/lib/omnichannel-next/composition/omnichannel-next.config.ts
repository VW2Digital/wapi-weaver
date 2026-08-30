import type { SqlExecutor } from "@/lib/omnichannel-next/infrastructure/mysql";
import type { WhatsAppTransportPort } from "@/lib/omnichannel-next/providers/whatsapp";
import type { InstagramTransportPort } from "@/lib/omnichannel-next/providers/instagram";

export type BullMQQueueLike = {
  add: (
    name: string,
    data: unknown,
    opts?: { jobId?: string },
  ) => Promise<unknown>;
};

export interface OmnichannelNextConfig {
  mysql: {
    executor: SqlExecutor;
  };
  queues: {
    whatsapp: BullMQQueueLike;
    instagram: BullMQQueueLike;
  };
  transports: {
    whatsapp: WhatsAppTransportPort;
    instagram: InstagramTransportPort;
  };
}
