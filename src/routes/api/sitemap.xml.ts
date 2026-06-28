import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/seo";

const STATIC_ROUTES = [
  { path: "/", changefreq: "weekly", priority: 1.0 },
  { path: "/login", changefreq: "monthly", priority: 0.3 },
  { path: "/privacy", changefreq: "monthly", priority: 0.4 },
  { path: "/terms", changefreq: "monthly", priority: 0.4 },
  { path: "/data-deletion", changefreq: "monthly", priority: 0.3 },
] as const;

function buildSitemapXml(baseUrl: string): string {
  const urls = STATIC_ROUTES.map(
    (r) => `  <url>
    <loc>${baseUrl}${r.path === "/" ? "" : r.path}</loc>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority.toFixed(1)}</priority>
  </url>`,
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

export const Route = createFileRoute("/api/sitemap/xml")({
  server: {
    handlers: {
      GET: async () => {
        const baseUrl = SITE_URL;
        const xml = buildSitemapXml(baseUrl);
        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});
