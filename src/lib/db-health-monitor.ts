/**
 * db-health-monitor.ts
 *
 * Monitor de saúde do pool MySQL.
 *
 * Roda em background (via globalThis guard — sobrevive a HMR) e:
 *  1. A cada 30 s, loga o estado atual do pool (conexões ativas/livres).
 *  2. Se o pool estiver saturado (>= 80% das conexões em uso), emite um aviso.
 *  3. Não tenta matar conexões diretamente (o pool gerencia sozinho via
 *     `idleTimeout`), mas emite métricas úteis para diagnóstico.
 */

"use server";

const _g = globalThis as any;

export function startDbHealthMonitor(pool: import("mysql2/promise").Pool): void {
  if (_g.__dbHealthMonitorStarted) return;
  _g.__dbHealthMonitorStarted = true;

  console.log("[DB Monitor] Pool health monitor iniciado (intervalo: 30s).");

  setInterval(() => {
    try {
      // mysql2 expõe stats internas via propriedade não documentada `pool`
      const internalPool = (pool as any).pool;
      if (!internalPool) return;

      const allConnections: unknown[] = internalPool._allConnections ?? [];
      const freeConnections: unknown[] = internalPool._freeConnections ?? [];
      const connectionQueue: unknown[] = internalPool._connectionQueue ?? [];
      const limit: number = internalPool.config?.connectionLimit ?? 10;

      const active = allConnections.length - freeConnections.length;
      const waiting = connectionQueue.length;
      const saturation = Math.round((active / limit) * 100);

      if (saturation >= 80 || waiting > 0) {
        console.warn(
          `[DB Monitor] ATENÇÃO — Pool saturado: ${active}/${limit} conexões ativas (${saturation}%), ${waiting} requests na fila.`,
        );
      } else {
        console.log(
          `[DB Monitor] Pool OK: ${active}/${limit} conexões ativas (${saturation}%), ${waiting} na fila.`,
        );
      }
    } catch {
      // Silencioso — não quebrar o servidor por causa de métricas
    }
  }, 30_000);
}
