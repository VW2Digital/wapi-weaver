import type { Provider } from "./provider";

export type ChannelStatus = "active" | "pending" | "degraded" | "disconnected";

export interface Channel {
  id: string;
  tenantId: string;
  provider: Provider;
  externalAccountId: string | null;
  status: ChannelStatus;
}
