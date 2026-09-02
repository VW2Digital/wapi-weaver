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

const DEFAULT_ACCENT = "#0ea5e9";

/**
 * The accent color is interpolated into CSS rules, HTML style attributes and a
 * JS string literal. HTML-escaping alone is not safe in the CSS/JS contexts
 * (browsers decode entities before the JS parser runs), so we allow only a
 * strict hex color token and fall back to the default otherwise.
 */
export function sanitizeColor(value: string | null | undefined): string {
  if (typeof value !== "string") return DEFAULT_ACCENT;
  const trimmed = value.trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed : DEFAULT_ACCENT;
}

function normalizeOrigin(origin: string | null): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/**
 * Mirrors the session-service origin policy: an empty allow-list means the
 * widget has not been restricted yet, so framing is not narrowed here either.
 */
export function isOriginAllowed(allowedOrigins: string[] | null | undefined, origin: string | null): boolean {
  if (!origin) return false;
  if (!allowedOrigins || allowedOrigins.length === 0) return true;
  return allowedOrigins.some((candidate) => normalizeOrigin(candidate) === origin);
}

export function buildFrameAncestors(allowedOrigins: string[] | null | undefined): string {
  const normalized = (allowedOrigins ?? [])
    .map((candidate) => normalizeOrigin(candidate))
    .filter((candidate): candidate is string => Boolean(candidate));

  if (normalized.length === 0) {
    // No configured origins: keep the widget embeddable anywhere, matching the
    // documented default. Configure allowed origins to lock this down.
    return "frame-ancestors *;";
  }
  return `frame-ancestors 'self' ${normalized.join(" ")};`;
}

/** Only same-origin/absolute http(s) URLs may be used as an <img> source. */
export function sanitizeUrl(value: string | null | undefined): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed, "https://placeholder.invalid");
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return trimmed;
  } catch {
    return "";
  }
}

function renderIframe(
  widget: {
    title: string;
    welcomeMessage: string | null;
    placeholder: string;
    accentColor: string;
    avatarUrl: string | null;
  },
  publicId: string,
  parentOrigin: string | null,
) {
  const title = escapeHtml(widget.title || "Chat");
  const accent = sanitizeColor(widget.accentColor);
  const placeholder = escapeHtml(widget.placeholder || "Digite uma mensagem...");
  const welcome = escapeJs(widget.welcomeMessage || "Olá! Como podemos ajudar?");
  const avatar = escapeHtml(sanitizeUrl(widget.avatarUrl));
  const avatarEl = avatar ? `<img src="${avatar}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block;">` : "&#128172;";

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
    .header-avatar { width: 40px; height: 40px; border-radius: 50%; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; overflow: hidden; }
    .header-text { min-width: 0; }
    .header-title { font-weight: 600; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .header-status { font-size: 12px; opacity: 0.9; display: flex; align-items: center; gap: 6px; }
    .header-status::before { content: ""; width: 7px; height: 7px; background: #22c55e; border-radius: 50%; display: inline-block; }
    .close-btn { background: transparent; border: none; color: #fff; font-size: 22px; line-height: 1; cursor: pointer; padding: 4px; opacity: 0.85; }
    .close-btn:hover { opacity: 1; }

    .prechat-body { flex: 1; overflow-y: auto; padding: 28px 24px 20px; display: flex; flex-direction: column; align-items: center; text-align: center; }
    .prechat-avatar { width: 72px; height: 72px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; font-size: 36px; margin-bottom: 18px; overflow: hidden; }
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
          <div class="header-avatar">${avatarEl}</div>
          <div class="header-text">
            <div class="header-title">${title}</div>
            <div class="header-status">Online agora</div>
          </div>
        </div>
        <button class="close-btn" onclick="closeWidget()" aria-label="Fechar">&times;</button>
      </div>
      <div class="prechat-body">
        <div class="prechat-avatar">${avatarEl}</div>
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
          <div class="header-avatar">${avatarEl}</div>
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
    const __publicId = ${JSON.stringify(publicId)};
    const __accent = ${JSON.stringify(accent)};
    const __welcome = '${welcome}';
    const __parentOrigin = ${JSON.stringify(parentOrigin)};
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

    /* ---------------- delivered / read acknowledgements ---------------- */

    const STATUS_RANK = { queued: 0, sent: 1, delivered: 2, read: 3 };
    /* Highest status already confirmed by the server for each message. */
    const ackedStatus = new Map();
    /* Pending ACKs waiting to be flushed, messageId -> status. */
    const pendingAcks = new Map();
    /* Widget open state, driven by the host page. Starts false: an iframe that
       was never displayed must not mark anything as read. */
    let widgetOpen = false;
    let flushTimer = null;
    let flushBackoff = 0;
    const MAX_BACKOFF_MS = 30000;

    function rank(status) {
      return STATUS_RANK[status] !== undefined ? STATUS_RANK[status] : -1;
    }

    /* A message counts as visible only when the host actually shows the widget
       and the browser tab is in the foreground. */
    function widgetIsVisible() {
      return widgetOpen && document.visibilityState === 'visible';
    }

    function queueAck(messageId, status) {
      if (!messageId || String(messageId).indexOf('temp:') === 0) return;
      if (rank(ackedStatus.get(messageId)) >= rank(status)) return;
      if (rank(pendingAcks.get(messageId)) >= rank(status)) return;
      pendingAcks.set(messageId, status);
      scheduleFlush();
    }

    function scheduleFlush() {
      if (flushTimer || pendingAcks.size === 0) return;
      flushTimer = setTimeout(() => {
        flushTimer = null;
        flushAcks();
      }, flushBackoff || 250);
    }

    async function flushAcks() {
      if (!session?.token || pendingAcks.size === 0) return;

      const batch = Array.from(pendingAcks.entries()).map(([messageId, status]) => ({
        messageId: messageId,
        status: status,
      }));

      try {
        const result = await fetchJSON(API('/status'), {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + session.token },
          body: JSON.stringify({ updates: batch }),
        });
        flushBackoff = 0;
        /* Both updated and unchanged are settled server-side; rejected ids are
           not ours and must never be retried. */
        batch.forEach((item) => {
          if (rank(ackedStatus.get(item.messageId)) < rank(item.status)) {
            ackedStatus.set(item.messageId, item.status);
          }
          if (pendingAcks.get(item.messageId) === item.status) {
            pendingAcks.delete(item.messageId);
          }
        });
        (result.rejected || []).forEach((id) => {
          ackedStatus.set(id, 'read');
          pendingAcks.delete(id);
        });
      } catch (e) {
        /* Bounded retry so a flaky network never turns into a tight loop. */
        flushBackoff = Math.min(flushBackoff ? flushBackoff * 2 : 1000, MAX_BACKOFF_MS);
        scheduleFlush();
      }
    }

    /* Marks outgoing bubbles as read once they are actually on screen. */
    const readObserver = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
          if (!widgetIsVisible()) return;
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const id = entry.target.dataset.id;
            if (!id) return;
            queueAck(id, 'read');
            readObserver.unobserve(entry.target);
          });
        }, { threshold: 0.5 })
      : null;

    /* Re-check every outgoing bubble that has not been read yet. Used when the
       widget is opened or the tab becomes visible again. */
    function reevaluateReadState() {
      if (!widgetIsVisible()) return;
      const nodes = messagesEl.querySelectorAll('.bubble.outgoing[data-id]');
      nodes.forEach((node) => {
        const id = node.dataset.id;
        if (!id || rank(ackedStatus.get(id)) >= rank('read')) return;
        const box = node.getBoundingClientRect();
        const inViewport = box.height > 0 && box.bottom > 0 && box.top < window.innerHeight;
        if (inViewport) queueAck(id, 'read');
      });
    }

    function setWidgetOpen(open) {
      widgetOpen = !!open;
      if (widgetOpen) reevaluateReadState();
    }

    document.addEventListener('visibilitychange', reevaluateReadState);
    window.addEventListener('focus', reevaluateReadState);

    /* The host page tells us when the panel is shown or hidden. Only accept it
       from our direct parent; the payload is a non-sensitive UI hint. */
    window.addEventListener('message', (e) => {
      if (e.source !== window.parent) return;
      if (__parentOrigin && e.origin !== __parentOrigin) return;
      const data = e.data;
      if (!data || data.type !== 'bliv-webchat-visibility') return;
      setWidgetOpen(data.open === true);
    });

    function genId() {
      return crypto.randomUUID();
    }

    function closeWidget() {
      if (window.parent !== window) {
        window.parent.postMessage('bliv-webchat-close', __parentOrigin || '/');
      }
      setWidgetOpen(false);
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
      /* Dedupe strictly by server message id, never by text or timestamp. */
      if (rendered.has(msg.id)) {
        if (msg.direction === 'outgoing') trackOutgoing(msg);
        return;
      }
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

      if (msg.direction === 'outgoing') trackOutgoing(msg, div);
    }

    /* An outgoing message that reached this function has been received by the
       browser, so it is genuinely "delivered". "read" is decided separately by
       the visibility observer. */
    function trackOutgoing(msg, node) {
      const id = msg.id;
      if (!id || String(id).indexOf('temp:') === 0) return;

      /* Trust the server's stored status so a reload does not re-ACK forever. */
      if (msg.status && rank(ackedStatus.get(id)) < rank(msg.status)) {
        ackedStatus.set(id, msg.status);
      }

      queueAck(id, 'delivered');

      const target = node || messagesEl.querySelector('[data-id="' + id + '"]');
      if (target && readObserver && rank(ackedStatus.get(id)) < rank('read')) {
        readObserver.observe(target);
      }
      reevaluateReadState();
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

        const avatarUrl = widget.avatarUrl ? new URL(widget.avatarUrl, request.url).toString() : null;

        // The host page passes its own origin so the iframe can target
        // postMessage precisely instead of broadcasting with "*".
        const requestUrl = new URL(request.url);
        const parentOrigin = normalizeOrigin(requestUrl.searchParams.get("parentOrigin"));
        const allowedParentOrigin = isOriginAllowed(widget.allowedOrigins, parentOrigin)
          ? parentOrigin
          : null;

        // frame-ancestors is derived from the widget configuration, not from the
        // requesting Origin header, which an attacker fully controls.
        const headers: Record<string, string> = {
          "Content-Type": "text/html",
          "Access-Control-Allow-Origin": origin || "*",
          "Content-Security-Policy": buildFrameAncestors(widget.allowedOrigins),
        };

        return new Response(
          renderIframe({ ...widget, avatarUrl }, publicId, allowedParentOrigin),
          { headers },
        );
      },
    },
  },
});

