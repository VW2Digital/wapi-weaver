import { MetaWhatsAppTransport } from "@/lib/omnichannel-next/infrastructure/meta/whatsapp";
import { MetaInstagramTransport } from "@/lib/omnichannel-next/infrastructure/meta/instagram";
import { FakeHttpClient, FakeCredentialResolver } from "../infrastructure/meta/test-fakes";
import type { SafeOutboundContractDescriptor, ContractProvenance } from "./contract-descriptor";

const WA_PHONE = "1107720082434785";
const WA_RECIPIENT = "5511999999999";
const IG_SENDER = "IG_SENDER_123";
const IG_RECIPIENT = "IGSID_456";
const TEXT = "hello";
const VERSION = "25.0";

export function currentWhatsAppContract(): SafeOutboundContractDescriptor {
  return {
    provider: "whatsapp",
    apiVariant: "WhatsApp Cloud API",
    method: "POST",
    host: "graph.facebook.com",
    graphVersionSource: "clamp v24-v26, default v26.0 (recentMetaVersion)",
    senderNodeType: "phone_number_id",
    senderNodePlaceholder: "<PHONE_NUMBER_ID>",
    recipientType: "e.164 phone number",
    authorizationScheme: "Bearer [REDACTED]",
    contentType: "application/json",
    messageType: "text",
    normalizedBody: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "<RECIPIENT_PHONE>",
      type: "text",
      text: { body: "<BODY>", preview_url: false },
    },
    responseMessageIdPath: "messages[0].id",
    successSemantics: "sent",
    provenance: "STATIC_SOURCE_AUDIT",
  };
}

export function currentInstagramContract(): SafeOutboundContractDescriptor {
  return {
    provider: "instagram",
    apiVariant: "graph.facebook.com with MESSAGE_TYPE=RESPONSE",
    method: "POST",
    host: "graph.facebook.com",
    graphVersionSource: "process.env.META_GRAPH_VERSION or v26.0",
    senderNodeType: "ig_user_id",
    senderNodePlaceholder: "<IG_USER_ID>",
    recipientType: "ig_scoped_id (IGSID)",
    authorizationScheme: "Bearer [REDACTED]",
    contentType: "application/json",
    messageType: "text",
    normalizedBody: {
      recipient: { id: "<RECIPIENT_ID>" },
      message_type: "RESPONSE",
      message: { text: "<BODY>" },
    },
    responseMessageIdPath: "message_id",
    successSemantics: "sent",
    provenance: "STATIC_SOURCE_AUDIT",
  };
}

export async function nextWhatsAppContract(): Promise<SafeOutboundContractDescriptor> {
  const http = new FakeHttpClient();
  const credentials = new FakeCredentialResolver();
  credentials.addToken("wa-cred-ref", "WA_TOKEN_SENTINEL");
  http.setFixture(
    `https://graph.facebook.com/v${VERSION}/${WA_PHONE}/messages`,
    200,
    { messages: [{ id: "wamid.NEXT" }] },
  );

  const transport = new MetaWhatsAppTransport(
    { graphApiVersion: VERSION },
    http,
    credentials,
  );

  await transport.send({
    recipient: WA_RECIPIENT,
    sender: WA_PHONE,
    credentialReference: "wa-cred-ref",
    message: { type: "text", text: TEXT },
  });

  const req = http.requests[0];
  return normalizeWhatsAppRequest(req, "EXECUTED_MOCK");
}

export async function nextInstagramContract(): Promise<SafeOutboundContractDescriptor> {
  const http = new FakeHttpClient();
  const credentials = new FakeCredentialResolver();
  credentials.addToken("ig-cred-ref", "IG_TOKEN_SENTINEL");
  http.setFixture(
    `https://graph.instagram.com/v${VERSION}/${IG_SENDER}/messages`,
    200,
    { message_id: "ig-mid-NEXT" },
  );

  const transport = new MetaInstagramTransport(
    { graphApiVersion: VERSION },
    http,
    credentials,
  );

  await transport.send({
    recipient: IG_RECIPIENT,
    sender: IG_SENDER,
    credentialReference: "ig-cred-ref",
    message: { type: "text", text: TEXT },
  });

  const req = http.requests[0];
  return normalizeInstagramRequest(req, "EXECUTED_MOCK");
}

function redactHeaders(headers: Record<string, string> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "authorization") {
      out[key] = value.startsWith("Bearer ") ? "Bearer [REDACTED]" : "[REDACTED]";
    } else {
      out[key] = value;
    }
  }
  return out;
}

function normalizeWhatsAppRequest(
  req: { method: string; url: string; headers?: Record<string, string>; body?: unknown },
  provenance: ContractProvenance,
): SafeOutboundContractDescriptor {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const text = body.text as { body: string } | undefined;

  return {
    provider: "whatsapp",
    apiVariant: "WhatsApp Cloud API",
    method: req.method,
    host: "graph.facebook.com",
    graphVersionSource: "explicit transport config graphApiVersion",
    senderNodeType: "phone_number_id",
    senderNodePlaceholder: "<PHONE_NUMBER_ID>",
    recipientType: "e.164 phone number",
    authorizationScheme: redactHeaders(req.headers).Authorization ?? "Bearer [REDACTED]",
    contentType: redactHeaders(req.headers)["Content-Type"] ?? "application/json",
    messageType: String(body.type ?? "text"),
    normalizedBody: {
      ...body,
      to: "<RECIPIENT_PHONE>",
      text: text ? { body: "<BODY>", preview_url: (text as any).preview_url ?? false } : undefined,
    },
    responseMessageIdPath: "messages[0].id",
    successSemantics: "accepted",
    provenance,
  };
}

function normalizeInstagramRequest(
  req: { method: string; url: string; headers?: Record<string, string>; body?: unknown },
  provenance: ContractProvenance,
): SafeOutboundContractDescriptor {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const message = body.message as { text: string } | undefined;

  return {
    provider: "instagram",
    apiVariant: "Instagram Messaging API with Instagram Login",
    method: req.method,
    host: "graph.instagram.com",
    graphVersionSource: "explicit transport config graphApiVersion",
    senderNodeType: "ig_user_id",
    senderNodePlaceholder: "<IG_USER_ID>",
    recipientType: "ig_scoped_id (IGSID)",
    authorizationScheme: redactHeaders(req.headers).Authorization ?? "Bearer [REDACTED]",
    contentType: redactHeaders(req.headers)["Content-Type"] ?? "application/json",
    messageType: "text",
    normalizedBody: {
      ...body,
      recipient: { id: "<RECIPIENT_ID>" },
      message: message ? { text: "<BODY>" } : undefined,
    },
    responseMessageIdPath: "message_id",
    successSemantics: "accepted",
    provenance,
  };
}
