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

    const style = document.createElement('style');
    style.textContent = '#bliv-webchat-btn-' + publicId + ' { transition: transform 0.25s ease, box-shadow 0.25s ease; }' +
      '#bliv-webchat-btn-' + publicId + ':hover { transform: scale(1.08); }' +
      '#bliv-webchat-btn-' + publicId + ':active { transform: scale(0.96); }' +
      '#bliv-webchat-btn-' + publicId + ' .bliv-webchat-icon { position: absolute; top: 50%; left: 50%; transition: opacity 0.25s ease, transform 0.25s ease; transform-origin: center; pointer-events: none; }' +
      '#bliv-webchat-btn-' + publicId + ' .bliv-webchat-icon-open { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }' +
      '#bliv-webchat-btn-' + publicId + ' .bliv-webchat-icon-close { opacity: 0; transform: translate(-50%, -50%) scale(0.6) rotate(-90deg); }' +
      '#bliv-webchat-btn-' + publicId + '[data-open="true"] .bliv-webchat-icon-open { opacity: 0; transform: translate(-50%, -50%) scale(0.6) rotate(90deg); }' +
      '#bliv-webchat-btn-' + publicId + '[data-open="true"] .bliv-webchat-icon-close { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }';
    document.head.appendChild(style);

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
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';
    button.style.overflow = 'hidden';
    button.setAttribute('aria-label', 'Abrir chat');
    button.setAttribute('data-open', 'false');

    const chatIcon = document.createElement('span');
    chatIcon.className = 'bliv-webchat-icon bliv-webchat-icon-open';
    chatIcon.textContent = '💬';
    const closeIcon = document.createElement('span');
    closeIcon.className = 'bliv-webchat-icon bliv-webchat-icon-close';
    closeIcon.textContent = '\u2715';
    button.appendChild(chatIcon);
    button.appendChild(closeIcon);

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

    function updateButton(open) {
      button.setAttribute('data-open', String(open));
      button.setAttribute('aria-label', open ? 'Fechar chat' : 'Abrir chat');
    }

    button.addEventListener('click', () => {
      const open = iframe.style.display === 'none';
      iframe.style.display = open ? 'block' : 'none';
      updateButton(open);
    });

    window.addEventListener('message', (e) => {
      if (e.data === 'bliv-webchat-close') {
        iframe.style.display = 'none';
        updateButton(false);
      }
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
