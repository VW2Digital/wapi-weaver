const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

/**
 * A Meta precisa alcançar o callback pela internet. Nunca use a URL local do
 * painel para atualizar a assinatura do App, pois isso interrompe todos os
 * callbacks de mensagens e status mesmo que o envio continue funcionando.
 */
export function resolvePublicWebhookBaseUrl(
  env: Partial<Pick<NodeJS.ProcessEnv, "PUBLIC_APP_URL" | "APP_URL">>,
) {
  for (const candidate of [env.PUBLIC_APP_URL, env.APP_URL]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol !== "https:" || LOCAL_HOSTNAMES.has(url.hostname.toLowerCase())) continue;
      return url.toString();
    } catch {
      // Ignora configurações inválidas e tenta a próxima fonte.
    }
  }
  return null;
}
