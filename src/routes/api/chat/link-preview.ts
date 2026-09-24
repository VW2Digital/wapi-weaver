import { createFileRoute } from "@tanstack/react-router";
import { verifyStorageUser } from "@/lib/tenant-storage";
import { fetchLinkPreview } from "@/lib/link-preview.server";
import { normalizeExtractedUrl } from "@/lib/chat-linkify";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/chat/link-preview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await verifyStorageUser(request);
          const raw = new URL(request.url).searchParams.get("url") || "";
          const url = normalizeExtractedUrl(raw);
          if (!url) return json({ error: "URL inválida." }, 400);
          const preview = await fetchLinkPreview(url);
          return json({ ok: true, preview });
        } catch (err: any) {
          const status = err?.message === "Unauthorized" || /unauthorized/i.test(String(err?.message)) ? 401 : 400;
          return json({ ok: false, error: err?.message || "Não foi possível gerar a prévia." }, status);
        }
      },
    },
  },
});
