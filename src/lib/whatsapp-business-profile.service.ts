import { dbAdmin } from "@/integrations/mysql/client.server";
import { randomUUID } from "crypto";
import {
  normalizeBusinessProfile,
  normalizeOptionalString,
  normalizeWebsites,
  type WhatsAppBusinessProfile,
} from "@/lib/whatsapp-business-profile.shared";

function normalizeApiVersion(value: unknown): string {
  const raw = normalizeOptionalString(value) ?? "v25.0";
  return raw.startsWith("v") ? raw : `v${raw}`;
}

function redactMetaError(err: any) {
  // Meta geralmente retorna { error: { message, type, code, error_subcode, fbtrace_id } }
  const e = err?.error ?? err;
  return {
    message: e?.message,
    type: e?.type,
    code: e?.code,
    error_subcode: e?.error_subcode,
    fbtrace_id: e?.fbtrace_id,
  };
}

export async function logBusinessProfileAction(params: {
  userId: string | null;
  phoneNumberId: string | null;
  action: "fetch_profile" | "update_profile" | "upload_profile_picture" | "update_profile_picture";
  oldData?: any;
  newData?: any;
  metaResponse?: any;
  success: boolean;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  try {
    await dbAdmin.from("whatsapp_business_profile_logs").insert({
      id: randomUUID(),
      user_id: params.userId,
      phone_number_id: params.phoneNumberId,
      action: params.action,
      old_data_json: params.oldData ?? null,
      new_data_json: params.newData ?? null,
      meta_response_json: params.metaResponse ?? null,
      success: params.success ? 1 : 0,
      error_code: params.errorCode ?? null,
      error_message: params.errorMessage ?? null,
    } as any);
  } catch {
    // best-effort: não pode derrubar o fluxo principal
  }
}

export async function getWhatsAppBusinessProfileFromMeta(params: {
  phoneNumberId: string;
  accessToken: string;
  apiVersion?: string;
}) {
  const apiVersion = normalizeApiVersion(params.apiVersion);
  const url = new URL(
    `https://graph.facebook.com/${apiVersion}/${params.phoneNumberId}/whatsapp_business_profile`,
  );
  url.searchParams.set(
    "fields",
    "about,address,description,email,profile_picture_url,websites,vertical",
  );

  const r = await fetch(url.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const safe = redactMetaError(body);
    throw new Error(safe?.message || "Falha ao buscar perfil empresarial na Meta.");
  }
  const first = Array.isArray(body?.data) ? body.data[0] : null;
  return normalizeBusinessProfile(first ?? {});
}

export function buildBusinessProfileUpdatePayload(
  input: Partial<WhatsAppBusinessProfile> & {
    profile_picture_handle?: string | null;
  },
) {
  const payload: any = { messaging_product: "whatsapp" };

  const about = normalizeOptionalString(input.about);
  const address = normalizeOptionalString(input.address);
  const description = normalizeOptionalString(input.description);
  const email = normalizeOptionalString(input.email);
  const vertical = normalizeOptionalString(input.vertical);
  const websites = normalizeWebsites(input.websites);

  // Não enviar campo vazio por padrão (evita sobrescrever com vazio sem confirmação)
  if (about) payload.about = about;
  if (address) payload.address = address;
  if (description) payload.description = description;
  if (email) payload.email = email;
  if (vertical !== null) payload.vertical = vertical;
  if (websites.length > 0) payload.websites = websites;

  const handle = normalizeOptionalString(input.profile_picture_handle);
  if (handle) payload.profile_picture_handle = handle;

  return payload;
}

export async function updateWhatsAppBusinessProfileOnMeta(params: {
  phoneNumberId: string;
  accessToken: string;
  apiVersion?: string;
  payload: any;
}) {
  const apiVersion = normalizeApiVersion(params.apiVersion);
  const url = `https://graph.facebook.com/${apiVersion}/${params.phoneNumberId}/whatsapp_business_profile`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params.payload),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    const safe = redactMetaError(body);
    throw new Error(safe?.message || "Falha ao atualizar perfil empresarial na Meta.");
  }
  return body;
}

export async function uploadProfilePictureToMeta(params: {
  appId: string;
  accessToken: string;
  apiVersion?: string;
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}) {
  const apiVersion = normalizeApiVersion(params.apiVersion);

  // Step 1: Start upload session (Resumable Upload API)
  const startUrl = new URL(`https://graph.facebook.com/${apiVersion}/${params.appId}/uploads`);
  startUrl.searchParams.set("file_name", params.filename);
  startUrl.searchParams.set("file_length", String(params.bytes.byteLength));
  startUrl.searchParams.set("file_type", params.mimeType);
  startUrl.searchParams.set("access_token", params.accessToken);

  const r1 = await fetch(startUrl.toString(), { method: "POST" });
  const b1 = await r1.json().catch(() => ({}));
  if (!r1.ok) {
    const safe = redactMetaError(b1);
    throw new Error(safe?.message || "Falha ao iniciar upload da imagem na Meta.");
  }

  const sessionIdRaw = normalizeOptionalString(b1?.id);
  if (!sessionIdRaw || !sessionIdRaw.startsWith("upload:")) {
    throw new Error("Resposta inesperada da Meta ao iniciar upload (id ausente).");
  }

  const uploadUrl = `https://graph.facebook.com/${apiVersion}/${sessionIdRaw}`;
  const r2 = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      // conforme docs: Authorization: OAuth <USER_ACCESS_TOKEN>
      Authorization: `OAuth ${params.accessToken}`,
      file_offset: "0",
      "Content-Type": "application/octet-stream",
    },
    body: Buffer.from(params.bytes),
  });
  const b2 = await r2.json().catch(() => ({}));
  if (!r2.ok) {
    const safe = redactMetaError(b2);
    throw new Error(safe?.message || "Falha ao enviar binário da imagem na Meta.");
  }

  // handle costuma vir em `h`
  const handle = normalizeOptionalString(b2?.h);
  if (!handle) {
    throw new Error("Resposta inesperada da Meta ao finalizar upload (handle ausente).");
  }
  return { handle, raw: b2 };
}
