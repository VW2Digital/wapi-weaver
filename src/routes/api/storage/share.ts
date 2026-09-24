import { createFileRoute } from "@tanstack/react-router";
import { assertTenantStoragePath, verifyStorageUser } from "@/lib/tenant-storage";
import { createGalleryShareUrl } from "@/lib/gallery-share.server";

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/storage/share")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await verifyStorageUser(request);
          const body = await request.json().catch(() => ({}));
          const requested = String(body?.path || "");
          const safePath = await assertTenantStoragePath(requested, user);
          const forwardedHost = request.headers.get("x-forwarded-host");
          const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
          const origin =
            (process.env.APP_URL || "").trim().replace(/\/$/, "") ||
            (forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin);
          const url = createGalleryShareUrl({
            tenantId: user.tenantId,
            mediaPath: safePath,
            origin,
          });
          return json({ ok: true, url, expiresInDays: 7 });
        } catch (err: any) {
          const status =
            err?.statusCode ||
            (/unauthorized/i.test(String(err?.message)) ? 401 : 400);
          return json({ error: err?.message || "Não foi possível gerar o link." }, status);
        }
      },
    },
  },
});
