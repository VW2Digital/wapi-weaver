import type {
  InstagramTransportRequest,
  InstagramTransportResult,
} from "@/lib/omnichannel-next/providers/instagram/instagram.types";

export interface InstagramTransportPort {
  send(request: InstagramTransportRequest): Promise<InstagramTransportResult>;
}
