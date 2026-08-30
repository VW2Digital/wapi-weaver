import { setWhatsAppNextAdapter } from "@/lib/messaging/outbound/runtime-config";
import { WhatsAppNextOutboundAdapter } from "./whatsapp-next-adapter";

export function registerWhatsAppNextAdapter(): void {
  setWhatsAppNextAdapter(new WhatsAppNextOutboundAdapter());
}
