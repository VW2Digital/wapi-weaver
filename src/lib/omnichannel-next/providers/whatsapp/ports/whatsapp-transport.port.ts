import type {
  WhatsAppTransportRequest,
  WhatsAppTransportResult,
} from "@/lib/omnichannel-next/providers/whatsapp/whatsapp.types";

export interface WhatsAppTransportPort {
  send(request: WhatsAppTransportRequest): Promise<WhatsAppTransportResult>;
}
