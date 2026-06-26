/**
 * Captura o Error original fora do fluxo normal para que o server.ts possa
 * recuperar a stack trace quando o h3 já engoliu o throw em um 500 genérico.
 *
 * Funcionamento:
 * - Registra listeners globais para `error` e `unhandledrejection`.
 * - Armazena o último erro capturado com timestamp (TTL de 5s).
 * - `consumeLastCapturedError()` retorna o erro e o limpa do cache.
 */

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

/**
 * Retorna o último erro capturado e limpa o cache.
 * Se o erro for mais velho que TTL_MS (5s), retorna undefined.
 */
export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}
