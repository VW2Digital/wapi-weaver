import { createFileRoute } from "@tanstack/react-router";
import { getWidgetByPublicId } from "@/lib/webchat/widget.repository";

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeJs(str: string): string {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/</g, "\\x3c")
    .replace(/>/g, "\\x3e")
    .replace(/`/g, "\\x60")
    .replace(/\$/g, "\\x24");
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
  const title = escapeHtml(widget.title || "Chat");
  const accent = escapeHtml(widget.accentColor || "#0ea5e9");
  const placeholder = escapeHtml(widget.placeholder || "Digite uma mensagem...");
  const welcome = escapeJs(widget.welcomeMessage || "Olá! Como podemos ajudar?");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; }
    .view { display: flex; flex-direction: column; height: 100%; }
    .hidden { display: none !important; }
    .header { padding: 14px 16px; color: #fff; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0; }
    .header-content { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .header-avatar { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
    .header-text { min-width: 0; }
    .header-title { font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .header-status { font-size: 12px; opacity: 0.9; display: flex; align-items: center; gap: 6px; }
    .header-status::before { content: ""; width: 7px; height: 7px; background: #22c55e; border-radius: 50%; display: inline-block; }
    .close-btn { background: transparent; border: none; color: #fff; font-size: 22px; line-height: 1; cursor: pointer; padding: 4px; opacity: 0.85; }
    .close-btn:hover { opacity: 1; }

    .prechat-body { flex: 1; overflow-y: auto; padding: 28px 24px 20px; display: flex; flex-direction: column; align-items: center; text-align: center; }
    .prechat-avatar { width: 72px; height: 72px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 36px; margin-bottom: 18px; }
    .prechat-title { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 10px; }
    .prechat-lead { font-size: 14px; color: #6b7280; line-height: 1.5; max-width: 280px; margin-bottom: 24px; }
    .prechat-form { width: 100%; max-width: 320px; display: flex; flex-direction: column; gap: 12px; }
    .field { position: relative; }
    .field input { width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 14px 12px 40px; font-size: 14px; background: #f9fafb; outline: none; }
    .field input:focus { border-color: ${accent}; background: #fff; }
    .field-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #9ca3af; font-size: 14px; }
    .start-btn { width: 100%; border: none; border-radius: 10px; padding: 14px; color: #fff; font-weight: 600; font-size: 15px; cursor: pointer; margin-top: 6px; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .start-btn:disabled { opacity: 0.7; cursor: not-allowed; }
    .prechat-footer { font-size: 12px; color: #9ca3af; margin-top: 18px; }
    .error { color: #ef4444; font-size: 13px; text-align: center; }

    .chat-view { display: flex; flex-direction: column; height: 100%; background: #f9fafb; }
    .messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; }
    .bubble { max-width: 80%; padding: 10px 14px; border-radius: 16px; margin-bottom: 10px; font-size: 14px; line-height: 1.4; word-break: break-word; position: relative; }
    .incoming { background: #fff; color: #111; border: 1px solid #e5e7eb; align-self: flex-start; border-bottom-left-radius: 4px; }
    .outgoing { color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
    .bubble-time { font-size: 11px; opacity: 0.65; display: block; margin-top: 6px; text-align: right; }
    .status { text-align: center; font-size: 12px; color: #6b7280; padding: 4px; }
    .chat-form { display: flex; gap: 8px; padding: 12px; background: #fff; border-top: 1px solid #e5e7eb; }
    .chat-form input { flex: 1; border: 1px solid #d1d5db; border-radius: 999px; padding: 10px 14px; font-size: 14px; outline: none; }
    .chat-form input:focus { border-color: ${accent}; }
    .chat-form button { padding: 10px 18px; border: none; border-radius: 999px; color: #fff; font-weight: 600; cursor: pointer; }
    .chat-form button:disabled { opacity: 0.6; cursor: not-allowed; }
  </style>
</head>
<body>
  <div id="app" class="view">
    <div id="prechat" class="view">
      <div class="header" style="background: ${accent}">
        <div class="header-content">
          <div class="header-avatar">&#128172;</div>
          <div class="header-text">
            <div class="header-title">${title}</div>
            <div class="header-status">Online agora</div>
          </div>
        </div>
        <button class="close-btn" onclick="closeWidget()" aria-label="Fechar">&times;</button>
      </div>
      <div class="prechat-body">
        <div class="prechat-avatar">&#128172;</div>
        <h2 class="prechat-title">VAMOS CONVERSAR?</h2>
        <p class="prechat-lead">Preencha seus dados e fale com nossa equipe no WhatsApp.</p>
        <form id="prechat-form" class="prechat-form" novalidate>
          <div class="field">
            <span class="field-icon">&#128100;</span>
            <input id="prechat-name" type="text" placeholder="Seu nome" required>
          </div>
          <div class="field">
            <span class="field-icon">&#9993;</span>
            <input id="prechat-email" type="email" placeholder="Seu e-mail" required>
          </div>
          <div class="field">
            <span class="field-icon">&#128222;</span>
            <input id="prechat-phone" type="tel" placeholder="WhatsApp (com DDD)" required>
          </div>
          <button type="submit" id="prechat-submit" class="start-btn" style="background: ${accent}">Iniciar conversa &rarr;</button>
          <p id="prechat-error" class="error hidden"></p>
        </form>
        <p class="prechat-footer">Resposta em ate 15 minutos, em horario comercial.</p>
      </div>
    </div>

    <div id="chat" class="view chat-view hidden">
      <div class="header" style="background: ${accent}">
        <div class="header-content">
          <div class="header-avatar">&#128172;</div>
          <div class="header-text">
            <div class="header-title">${title}</div>
            <div class="header-status">Online agora</div>
          </div>
        </div>
        <button class="close-btn" onclick="closeWidget()" aria-label="Fechar">&times;</button>
      </div>
      <div class="status" id="status">Carregando...</div>
      <div class="messages" id="messages"></div>
      <form class="chat-form" id="chat-form" onsubmit="return false;">
        <input id="input" type="text" placeholder="${placeholder}" autocomplete="off" disabled>
        <button type="submit" id="sendBtn" style="background: ${accent}" disabled>Enviar</button>
      </form>
    </div>
  </div>

  <script>
    const __publicId = '${publicId}';
    const __accent = '${accent}';
    const __welcome = '${welcome}';
    const storageKey = 'webchat_session_' + __publicId;
    const visitorKey = 'webchat_visitor_' + __publicId;
    const API = (path) => '/api/public/webchat/' + __publicId + path;
    const prechatEl = document.getElementById('prechat');
    const chatEl = document.getElementById('chat');
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

    function closeWidget() {
      if (window.parent !== window) {
        window.parent.postMessage('bliv-webchat-close', '*');
      }
    }

    function setStatus(text) {
      statusEl.textContent = text;
    }

    function enable(enabled) {
      input.disabled = !enabled;
      sendBtn.disabled = !enabled;
    }

    function formatTime(date) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    function maskEmail(value) {
      return value.toLowerCase().replace(/\\s/g, '').replace(/[^a-z0-9._%+@-]/g, '');
    }

    function maskPhone(value) {
      const digits = value.replace(/\\D/g, '').slice(0, 11);
      if (digits.length <= 2) return digits;
      if (digits.length <= 6) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2);
      if (digits.length <= 10) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + '-' + digits.slice(6);
      return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7);
    }

    function render(msg) {
      if (rendered.has(msg.id)) return;
      const div = document.createElement('div');
      div.className = 'bubble ' + (msg.direction === 'outgoing' ? 'outgoing' : 'incoming');
      div.style.background = msg.direction === 'outgoing' ? __accent : '';
      div.dataset.id = msg.id;
      div.textContent = msg.body;
      if (msg.clientMessageId) div.dataset.client = msg.clientMessageId;

      const time = document.createElement('span');
      time.className = 'bubble-time';
      time.textContent = msg.createdAt ? formatTime(new Date(msg.createdAt)) : formatTime(new Date());
      div.appendChild(time);

      messagesEl.appendChild(div);
      rendered.add(msg.id);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    async function fetchJSON(url, opts) {
      const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Request failed');
      return res.json();
    }

    function showChat() {
      prechatEl.classList.add('hidden');
      chatEl.classList.remove('hidden');
    }

    function showPrechat() {
      prechatEl.classList.remove('hidden');
      chatEl.classList.add('hidden');
    }

    async function tryRestoreSession() {
      let stored = null;
      try { stored = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch {}

      if (stored?.token) {
        try {
          const data = await fetchJSON(API('/session'), { method: 'GET', headers: { Authorization: 'Bearer ' + stored.token } });
          session = { token: stored.token, ...data };
          setStatus('Conectado');
          showChat();
          return true;
        } catch (e) {
          console.log('Session expired or invalid, asking for prechat data');
          localStorage.removeItem(storageKey);
        }
      }
      return false;
    }

    async function createSession(prechat) {
      let visitorId = localStorage.getItem(visitorKey);
      if (!visitorId) {
        visitorId = genId();
        localStorage.setItem(visitorKey, visitorId);
      }

      const data = await fetchJSON(API('/session'), {
        method: 'POST',
        body: JSON.stringify({ visitorId, prechat }),
      });
      session = { token: data.sessionToken, ...data };
      localStorage.setItem(storageKey, JSON.stringify({ token: data.sessionToken, sessionId: data.sessionId }));
      setStatus('Conectado');
      showChat();
      return true;
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

    document.getElementById('prechat-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('prechat-name').value.trim();
      const email = document.getElementById('prechat-email').value.trim();
      const rawPhone = document.getElementById('prechat-phone').value.replace(/\\D/g, '');
      const phone = rawPhone;
      const errorEl = document.getElementById('prechat-error');

      if (!name || !email || !phone) {
        errorEl.textContent = 'Preencha todos os campos.';
        errorEl.classList.remove('hidden');
        return;
      }
      if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
        errorEl.textContent = 'Informe um e-mail válido.';
        errorEl.classList.remove('hidden');
        return;
      }

      errorEl.classList.add('hidden');
      const btn = document.getElementById('prechat-submit');
      btn.disabled = true;
      btn.textContent = 'Abrindo chat...';

      try {
        await createSession({ name, email, phone });
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Iniciar conversa \u2192';
        errorEl.textContent = err.message || 'Erro ao iniciar conversa.';
        errorEl.classList.remove('hidden');
        return;
      }

      await startChat();
    });

    document.getElementById('chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      sendMessage(text);
    });

    async function startChat() {
      try {
        enable(true);
        const welcome = document.createElement('div');
        welcome.className = 'bubble incoming';
        welcome.textContent = __welcome;
        const time = document.createElement('span');
        time.className = 'bubble-time';
        time.textContent = formatTime(new Date());
        welcome.appendChild(time);
        messagesEl.appendChild(welcome);
        rendered.add('welcome');
        await loadHistory();
        setInterval(loadHistory, 3000);
      } catch (e) {
        setStatus('Erro: ' + e.message);
        console.error(e);
      }
    }

    document.getElementById('prechat-email').addEventListener('input', (e) => {
      e.target.value = maskEmail(e.target.value);
    });

    document.getElementById('prechat-phone').addEventListener('input', (e) => {
      e.target.value = maskPhone(e.target.value);
    });

    async function start() {
      const restored = await tryRestoreSession();
      if (restored) {
        await startChat();
      } else {
        showPrechat();
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
