import { createFileRoute } from "@tanstack/react-router";
import { getWidgetByPublicId } from "@/lib/webchat/widget.repository";

function renderIframe(widget: {
  title: string;
  welcomeMessage: string | null;
  placeholder: string;
  accentColor: string;
}) {
  const welcome = (widget.welcomeMessage || "Olá! Como podemos ajudar?").replace(/"/g, "&quot;");
  const placeholder = (widget.placeholder || "Digite uma mensagem...").replace(/"/g, "&quot;");
  const title = (widget.title || "Chat").replace(/</g, "&lt;");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .chat { display: flex; flex-direction: column; height: 100%; background: #f9fafb; }
    .header { padding: 12px 16px; background: ${widget.accentColor}; color: #fff; font-weight: 600; }
    .messages { flex: 1; overflow-y: auto; padding: 16px; }
    .bubble { max-width: 80%; padding: 10px 14px; border-radius: 16px; margin-bottom: 10px; font-size: 14px; line-height: 1.4; }
    .bot { background: #fff; color: #111; border: 1px solid #e5e7eb; align-self: flex-start; border-bottom-left-radius: 4px; }
    .form { display: flex; gap: 8px; padding: 12px; background: #fff; border-top: 1px solid #e5e7eb; }
    input { flex: 1; border: 1px solid #d1d5db; border-radius: 8px; padding: 10px 12px; font-size: 14px; }
    button { padding: 10px 16px; border: none; border-radius: 8px; background: ${widget.accentColor}; color: #fff; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <div class="chat">
    <div class="header">${title}</div>
    <div class="messages" id="messages">
      <div class="bubble bot">${welcome}</div>
    </div>
    <form class="form" onsubmit="return false;">
      <input id="input" type="text" placeholder="${placeholder}" autocomplete="off">
      <button type="submit">Enviar</button>
    </form>
  </div>
  <script>
    const input = document.getElementById('input');
    const messages = document.getElementById('messages');
    document.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      const el = document.createElement('div');
      el.className = 'bubble';
      el.style.cssText = 'background: ${widget.accentColor}; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px;';
      el.textContent = text;
      messages.appendChild(el);
      input.value = '';
      messages.scrollTop = messages.scrollHeight;
    });
  </script>
</body>
</html>`;
}

export const Route = createFileRoute("/api/public/webchat/$publicId/iframe")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const publicId = params.publicId;
        const origin = request.headers.get("origin") ?? "";
        if (!publicId) {
          return new Response("publicId missing", { status: 400 });
        }

        const widget = await getWidgetByPublicId(publicId);
        if (!widget || !widget.enabled) {
          return new Response("Widget not found", { status: 404 });
        }

        const headers: Record<string, string> = {
          "Content-Type": "text/html",
          "Access-Control-Allow-Origin": origin || "*",
          "X-Frame-Options": "ALLOW-FROM " + (origin || "*"),
          "Content-Security-Policy": "frame-ancestors 'self' " + (origin || "*") + ";",
        };

        return new Response(renderIframe(widget), { headers });
      },
    },
  },
});
