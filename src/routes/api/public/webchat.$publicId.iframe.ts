import { createFileRoute } from "@tanstack/react-router";
import { getWidgetByPublicId } from "@/lib/webchat/widget.repository";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderIframe(
  widget: {
    title: string;
    welcomeMessage: string | null;
    placeholder: string;
    accentColor: string;
  },
  publicId: string,
) {
  const welcome = escapeHtml(widget.welcomeMessage || "Olá! Como podemos ajudar?");
  const placeholder = escapeHtml(widget.placeholder || "Digite uma mensagem...");
  const title = escapeHtml(widget.title || "Chat");
  const accent = escapeHtml(widget.accentColor);

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
    .header { padding: 12px 16px; background: ${accent}; color: #fff; font-weight: 600; }
    .messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; }
    .bubble { max-width: 80%; padding: 10px 14px; border-radius: 16px; margin-bottom: 10px; font-size: 14px; line-height: 1.4; word-break: break-word; }
    .bot, .incoming { background: #fff; color: #111; border: 1px solid #e5e7eb; align-self: flex-start; border-bottom-left-radius: 4px; }
    .outgoing { background: ${accent}; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
    .form { display: flex; gap: 8px; padding: 12px; background: #fff; border-top: 1px solid #e5e7eb; }
    input { flex: 1; border: 1px solid #d1d5db; border-radius: 8px; padding: 10px 12px; font-size: 14px; }
    button { padding: 10px 16px; border: none; border-radius: 8px; background: ${accent}; color: #fff; font-weight: 600; cursor: pointer; }
    button:disabled { opacity: 0.6; cursor: not-allowed; }
    .status { text-align: center; font-size: 12px; color: #6b7280; padding: 4px; }
  </style>
</head>
<body>
  <div class="chat">
    <div class="header">${title}</div>
    <div class="status" id="status">Carregando...</div>
    <div class="messages" id="messages"></div>
    <form class="form" onsubmit="return false;">
      <input id="input" type="text" placeholder="${placeholder}" autocomplete="off" disabled>
      <button type="submit" id="sendBtn" disabled>Enviar</button>
    </form>
  </div>
  <script>
    const __publicId = '${publicId}';
    const storageKey = 'webchat_session_' + __publicId;
    const visitorKey = 'webchat_visitor_' + __publicId;
    const API = (path) => '/api/public/webchat/' + __publicId + path;
    const messagesEl = document.getElementById('messages');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('sendBtn');
    const statusEl = document.getElementById('status');
    const rendered = new Set();
    let session = null;
    let optimistic = new Map();

    function genId() {
      return crypto.randomUUID();
    }

    function render(msg) {
      if (rendered.has(msg.id)) return;
      const div = document.createElement('div');
      div.className = 'bubble ' + (msg.direction === 'outgoing' ? 'outgoing' : 'incoming');
      div.dataset.id = msg.id;
      div.textContent = msg.body;
      if (msg.clientMessageId) div.dataset.client = msg.clientMessageId;
      messagesEl.appendChild(div);
      rendered.add(msg.id);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function setStatus(text) {
      statusEl.textContent = text;
    }

    function enable(enabled) {
      input.disabled = !enabled;
      sendBtn.disabled = !enabled;
    }

    async function fetchJSON(url, opts) {
      const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Request failed');
      return res.json();
    }

    async function initSession() {
      let stored = null;
      try { stored = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch {}

      if (stored?.token) {
        try {
          const data = await fetchJSON(API('/session'), { method: 'GET', headers: { Authorization: 'Bearer ' + stored.token } });
          session = { token: stored.token, ...data };
          setStatus('Conectado');
          return;
        } catch (e) {
          console.log('Session expired or invalid, creating new one');
        }
      }

      let visitorId = localStorage.getItem(visitorKey);
      if (!visitorId) {
        visitorId = genId();
        localStorage.setItem(visitorKey, visitorId);
      }
      const data = await fetchJSON(API('/session'), {
        method: 'POST',
        body: JSON.stringify({ visitorId }),
      });
      session = { token: data.sessionToken, ...data };
      localStorage.setItem(storageKey, JSON.stringify({ token: data.sessionToken, sessionId: data.sessionId }));
      setStatus('Conectado');
    }

    async function loadHistory() {
      if (!session?.token) return;
      const data = await fetchJSON(API('/history?limit=50'), { headers: { Authorization: 'Bearer ' + session.token } });
      data.messages.forEach(render);
    }

    async function sendMessage(text) {
      if (!session?.token) return;
      const clientMessageId = genId();
      const temp = { id: clientMessageId, clientMessageId, direction: 'outgoing', body: text };
      optimistic.set(clientMessageId, temp);
      render({ ...temp, id: 'temp:' + clientMessageId });
      input.value = '';
      try {
        const result = await fetchJSON(API('/messages'), {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + session.token },
          body: JSON.stringify({ clientMessageId, type: 'text', text }),
        });
        const existing = document.querySelector('[data-client="' + clientMessageId + '"]');
        if (existing) {
          existing.dataset.id = result.messageId;
          existing.id = result.messageId;
          rendered.delete('temp:' + clientMessageId);
          rendered.add(result.messageId);
        }
        await loadHistory();
      } catch (e) {
        setStatus('Erro ao enviar: ' + e.message);
      } finally {
        optimistic.delete(clientMessageId);
      }
    }

    document.querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      sendMessage(text);
    });

    async function start() {
      try {
        await initSession();
        enable(true);
        const welcome = document.createElement('div');
        welcome.className = 'bubble bot';
        welcome.textContent = '${welcome}';
        messagesEl.appendChild(welcome);
        await loadHistory();
        setInterval(loadHistory, 3000);
      } catch (e) {
        setStatus('Erro: ' + e.message);
        console.error(e);
      }
    }

    start();
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

        return new Response(renderIframe(widget, publicId), { headers });
      },
    },
  },
});
