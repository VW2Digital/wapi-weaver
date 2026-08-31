import { createFileRoute } from "@tanstack/react-router";
import { getWidgetByPublicId } from "@/lib/webchat/widget.repository";

function makeWidgetScript(publicId: string, configUrl: string, iframeUrl: string) {
  return `(async () => {
    const publicId = ${JSON.stringify(publicId)};
    const configUrl = ${JSON.stringify(configUrl)};
    const iframeUrl = ${JSON.stringify(iframeUrl)};

    if (document.getElementById('bliv-webchat-' + publicId)) return;

    let config = {};
    try {
      const res = await fetch(configUrl);
      if (res.ok) config = await res.json();
    } catch (e) {
      // fail closed; still render default shell
    }

    const button = document.createElement('button');
    button.id = 'bliv-webchat-btn-' + publicId;
    button.style.position = 'fixed';
    button.style.bottom = '16px';
    button.style.right = config.position === 'bottom-left' ? 'auto' : '16px';
    button.style.left = config.position === 'bottom-left' ? '16px' : 'auto';
    button.style.zIndex = '999999';
    button.style.width = '56px';
    button.style.height = '56px';
    button.style.border = 'none';
    button.style.borderRadius = '50%';
    button.style.background = config.accentColor || '#0ea5e9';
    button.style.color = '#fff';
    button.style.fontSize = '28px';
    button.style.cursor = 'pointer';
    button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    button.textContent = '💬';

    const iframe = document.createElement('iframe');
    iframe.id = 'bliv-webchat-iframe-' + publicId;
    iframe.src = iframeUrl;
    iframe.style.position = 'fixed';
    iframe.style.bottom = '88px';
    iframe.style.right = config.position === 'bottom-left' ? 'auto' : '16px';
    iframe.style.left = config.position === 'bottom-left' ? '16px' : 'auto';
    iframe.style.width = '360px';
    iframe.style.height = '500px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '12px';
    iframe.style.boxShadow = '0 8px 30px rgba(0,0,0,0.18)';
    iframe.style.zIndex = '999998';
    iframe.style.display = 'none';
    iframe.style.background = '#fff';

    button.addEventListener('click', () => {
      iframe.style.display = iframe.style.display === 'none' ? 'block' : 'none';
    });

    document.body.appendChild(button);
    document.body.appendChild(iframe);
  })();`;
}

export const Route = createFileRoute("/api/public/webchat/$publicId/widget/js")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const publicId = params.publicId;
        const origin = request.headers.get("origin") ?? "";
        if (!publicId) {
          return new Response("// publicId missing", { status: 400, headers: { "Content-Type": "application/javascript" } });
        }

        const widget = await getWidgetByPublicId(publicId);
        if (!widget || !widget.enabled) {
          return new Response("// widget disabled", { status: 404, headers: { "Content-Type": "application/javascript" } });
        }

        const base = new URL(request.url).origin;
        const configUrl = base + "/api/public/webchat/" + publicId + "/config";
        const iframeUrl = base + "/api/public/webchat/" + publicId + "/iframe";

        const body = makeWidgetScript(publicId, configUrl, iframeUrl);
        const headers: Record<string, string> = {
          "Content-Type": "application/javascript",
          "Access-Control-Allow-Origin": origin || "*",
          "Cache-Control": "public, max-age=60",
        };
        return new Response(body, { headers });
      },
    },
  },
});
