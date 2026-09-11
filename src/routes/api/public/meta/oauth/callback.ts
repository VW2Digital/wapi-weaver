import { createFileRoute } from "@tanstack/react-router";

/**
 * Callback público de OAuth da Meta (Facebook Login / Embedded Signup redirect).
 *
 * URI canônica de produção:
 *   https://app.blivcrm.com/api/public/meta/oauth/callback
 *
 * Esta rota NÃO troca o `code` por token sozinha (faltaria App Secret + state
 * assinado do tenant). Ela:
 * 1. Aceita o redirect da Meta (sucesso ou erro)
 * 2. Redireciona o usuário de volta para /settings com parâmetros seguros
 * 3. Em popup, tenta fechar a janela após avisar o opener
 *
 * Cadastre a URI exata em:
 * Facebook Login → Configurações → URIs de redirecionamento OAuth válidos
 */
function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSettingsRedirect(requestUrl: URL) {
  const state = requestUrl.searchParams.get("state") || "";
  const dest = new URL("/settings", requestUrl.origin);
  dest.searchParams.set("s", state.startsWith("instagram") ? "instagram" : "meta");
  dest.searchParams.set("oauth", "1");

  const error = requestUrl.searchParams.get("error");
  const errorReason = requestUrl.searchParams.get("error_reason");
  const errorDescription = requestUrl.searchParams.get("error_description");
  const code = requestUrl.searchParams.get("code");

  if (error) {
    dest.searchParams.set("oauth_error", error);
    if (errorReason) dest.searchParams.set("oauth_error_reason", errorReason.slice(0, 200));
    if (errorDescription) {
      dest.searchParams.set("oauth_error_description", errorDescription.slice(0, 500));
    }
  } else if (code) {
    // Não repassa o code na query string (credencial de curta duração).
    dest.searchParams.set("oauth_status", "code_received");
    if (state) dest.searchParams.set("oauth_state", state.slice(0, 200));
  } else {
    dest.searchParams.set("oauth_status", "empty");
  }

  return dest;
}

function landingHtml(
  redirectTo: string,
  kind: "success" | "error" | "empty",
  oauth?: { code?: string | null; state?: string | null },
) {
  const title =
    kind === "error"
      ? "Autorização recusada ou falhou"
      : kind === "success"
        ? "Autorização recebida"
        : "Callback OAuth da Meta";
  const message =
    kind === "error"
      ? "A Meta retornou um erro. Você será redirecionado às configurações."
      : kind === "success"
        ? "Recebemos o retorno do Facebook. Redirecionando…"
        : "Endpoint de callback ativo. Redirecionando às configurações.";

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} · Bliv</title>
  <style>
    body { font-family: system-ui, sans-serif; background:#0b0b0c; color:#f5f5f5;
      display:flex; min-height:100vh; align-items:center; justify-content:center; margin:0; }
    .card { max-width:28rem; padding:1.5rem; border:1px solid #2a2a2e; border-radius:12px; background:#141416; }
    h1 { font-size:1.1rem; margin:0 0 .5rem; }
    p { margin:0; color:#a1a1aa; font-size:.9rem; line-height:1.4; }
    a { color:#60a5fa; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <p style="margin-top:.75rem"><a href="${escapeHtml(redirectTo)}">Ir para Configurações</a></p>
  </div>
  <script>
    (function () {
      var target = ${JSON.stringify(redirectTo)};
      var code = ${JSON.stringify(oauth?.code || "")};
      var state = ${JSON.stringify(oauth?.state || "")};
      try {
        if (code && state.indexOf("instagram") === 0) {
          sessionStorage.setItem("bliv_meta_oauth_code", code);
          sessionStorage.setItem("bliv_meta_oauth_state", state);
          sessionStorage.setItem(
            "bliv_meta_oauth_redirect_uri",
            window.location.origin + "/api/public/meta/oauth/callback"
          );
        }
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: "BLIV_META_OAUTH", href: target, state: state }, window.location.origin);
        }
      } catch (e) {}
      setTimeout(function () {
        try { window.close(); } catch (e) {}
        window.location.replace(target);
      }, 400);
    })();
  </script>
</body>
</html>`;
}

export const Route = createFileRoute("/api/public/meta/oauth/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const hasError = Boolean(url.searchParams.get("error"));
        const hasCode = Boolean(url.searchParams.get("code"));

        console.info("[meta-oauth-callback] GET", {
          hasError,
          hasCode,
          hasState: Boolean(url.searchParams.get("state")),
          error: url.searchParams.get("error") || undefined,
          error_description: url.searchParams.get("error_description")?.slice(0, 200) || undefined,
        });

        const redirectTo = buildSettingsRedirect(url).toString();
        const kind = hasError ? "error" : hasCode ? "success" : "empty";
        const accept = request.headers.get("accept") || "";

        if (accept.includes("application/json")) {
          return Response.json({
            ok: !hasError,
            endpoint: "/api/public/meta/oauth/callback",
            oauth_status: hasError ? "error" : hasCode ? "code_received" : "empty",
            error: url.searchParams.get("error") || null,
            error_description: url.searchParams.get("error_description") || null,
            redirect_to: redirectTo,
          });
        }

        return new Response(
          landingHtml(redirectTo, kind, {
            code: url.searchParams.get("code"),
            state: url.searchParams.get("state"),
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store",
            },
          },
        );
      },
    },
  },
});
