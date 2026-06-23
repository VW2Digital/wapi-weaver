const MAX_MEDIA_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function uploadMetaMediaViaApi(phoneId: string, file: File) {
  if (!phoneId) {
    throw new Error("ID do número de telefone não configurado.");
  }
  if (!file) {
    throw new Error("Arquivo não informado.");
  }
  if (file.size > MAX_MEDIA_UPLOAD_BYTES) {
    throw new Error("Arquivo muito grande. Máximo permitido: 20MB.");
  }

  const token = typeof window !== "undefined" ? localStorage.getItem("app-token") : null;
  if (!token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const form = new FormData();
  form.append("phoneId", phoneId);
  form.append("file", file);

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
