export type MetaMediaType = "image" | "audio" | "video" | "document" | "sticker";

export function inferMetaMediaType(file: File): MetaMediaType {
  const mimeType = file.type.toLowerCase();
  if (mimeType === "image/webp") return "sticker";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "document";
}

export async function uploadInstagramMediaViaApi(
  file: File,
  mediaType: MetaMediaType,
) {
  if (!file) {
    throw new Error("Arquivo não informado.");
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("app-token") : null;
  if (!token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const form = new FormData();
  form.append("file", file);
  form.append("mediaType", mediaType);

  const r = await fetch("/api/instagram/media-upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body?.ok) {
    throw new Error(body?.error || "Falha no upload da mídia para o Instagram.");
  }

  return body;
}

export async function uploadMetaMediaViaApi(
  phoneId: string,
  file: File,
  mediaType: MetaMediaType,
  options?: { isVoice?: boolean },
) {
  if (!phoneId) {
    throw new Error("ID do número de telefone não configurado.");
  }
  if (!file) {
    throw new Error("Arquivo não informado.");
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("app-token") : null;
  if (!token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const form = new FormData();
  form.append("phoneId", phoneId);
  form.append("file", file);
  form.append("mediaType", mediaType);
  if (options?.isVoice) {
    form.append("isVoice", "true");
  }

  const r = await fetch("/api/whatsapp/media-upload", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const body = await r.json().catch(() => ({}));
  if (!r.ok || !body?.ok) {
    throw new Error(body?.error || "Falha no upload da mídia para a Meta.");
  }

  return body;
}
