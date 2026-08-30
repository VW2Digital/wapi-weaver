export function getWhatsAppOutboundRuntime(): "current" | "next" {
  const value = process.env.WHATSAPP_OUTBOUND_RUNTIME?.toLowerCase();
  if (value === "next") return "next";
  if (value === "current" || value === undefined || value === "") return "current";
  throw new Error(`Unknown WHATSAPP_OUTBOUND_RUNTIME: ${value}`);
}
