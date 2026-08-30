import type { IOutboundAdapter } from "./types";

let nextAdapter: IOutboundAdapter | null = null;

export function getWhatsAppOutboundRuntime(): "current" | "next" {
  const value = process.env.WHATSAPP_OUTBOUND_RUNTIME?.toLowerCase();
  if (value === "next") return "next";
  if (value === "current" || value === undefined || value === "") return "current";
  throw new Error(`Unknown WHATSAPP_OUTBOUND_RUNTIME: ${value}`);
}

export function setWhatsAppNextAdapter(adapter: IOutboundAdapter): void {
  nextAdapter = adapter;
}

export function getWhatsAppNextAdapter(): IOutboundAdapter {
  if (!nextAdapter) {
    throw new Error("WhatsApp Next adapter has not been registered");
  }
  return nextAdapter;
}
