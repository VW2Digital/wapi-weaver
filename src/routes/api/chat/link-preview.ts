import { createFileRoute } from "@tanstack/react-router";
import { verifyStorageUser } from "@/lib/tenant-storage";
import { fetchLinkPreview } from "@/lib/link-preview.server";
import { normalizeExtractedUrl } from "@/lib/chat-linkify";
import { query } from "@/lib/db";
import { decryptMetaCredential } from "@/lib/encryption";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function resolveTenantAppToken(tenantId: string): Promise<{
  token: string;
  graphVersion: string;
} | null> {
  const rows = await query<
    Array<{ app_id: string; app_secret_encrypted: string; graph_version: string | null }>
  >(
    `SELECT app_id, app_secret_encrypted, graph_version
     FROM meta_app_connections
     WHERE tenant_id = ?
       AND app_id IS NOT NULL
       AND app_id <> ''
       AND app_secret_encrypted IS NOT NULL
       AND app_secret_encrypted <> ''
     ORDER BY FIELD(status, 'active', 'pending', 'degraded', 'reauth_required', 'disconnected')
     LIMIT 1`,
    [tenantId],
  );
  const row = rows?.[0];
  if (!row?.app_id || !row.app_secret_encrypted) return null;
  try {
    const secret = decryptMetaCredential(row.app_secret_encrypted);
    if (!secret) return null;
    return {
      token: `${row.app_id}|${secret}`,
      graphVersion: row.graph_version || "v26.0",
    };
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/chat/link-preview")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await verifyStorageUser(request);
          const raw = new URL(request.url).searchParams.get("url") || "";
          const url = normalizeExtractedUrl(raw);
          if (!url) return json({ error: "URL inválida." }, 400);
          const app = await resolveTenantAppToken(user.tenantId);
          const preview = await fetchLinkPreview(url, {
            instagramAccessToken: app?.token,
            graphVersion: app?.graphVersion,
          });
          return json({ ok: true, preview });
        } catch (err: any) {
          const status =
            err?.message === "Unauthorized" || /unauthorized/i.test(String(err?.message))
              ? 401
              : 400;
          return json({ ok: false, error: err?.message || "Não foi possível gerar a prévia." }, status);
        }
      },
    },
  },
});
