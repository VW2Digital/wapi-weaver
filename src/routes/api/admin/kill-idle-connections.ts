import { createFileRoute } from "@tanstack/react-router";
import mysql from "mysql2/promise";
import { enforceAdminMaster } from "@/lib/admin-master-auth";

/**
 * GET /api/admin/kill-idle-connections
 *
 * Endpoint de emergência: conecta ao MySQL com uma conexão descartável,
 * lista o PROCESSLIST, mata conexões Sleep de wapi_user com >30s de
 * tempo ocioso e retorna o relatório completo.
 *
 * Acesso restrito a Admin Master.
 */
export const Route = createFileRoute("/api/admin/kill-idle-connections")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authError = await enforceAdminMaster(request);
        if (authError) return authError;

        let conn: mysql.Connection | null = null;
        try {
          conn = await mysql.createConnection({
            host: process.env.DB_HOST || "localhost",
            port: parseInt(process.env.DB_PORT || "3306", 10),
            user: process.env.DB_USER || "wapi_user",
            password: process.env.DB_PASSWORD || "",
            database: process.env.DB_NAME || "wapi_weaver",
          });

          // 1. Variáveis de configuração
          const [vars] = (await conn.query(
            "SHOW VARIABLES WHERE Variable_name IN ('max_connections', 'wait_timeout', 'interactive_timeout')",
          )) as any;

          // 2. Status de conexões ativas
          const [statusRows] = (await conn.query(
            "SHOW STATUS WHERE Variable_name IN ('Threads_connected', 'Threads_running', 'Max_used_connections', 'Connection_errors_max_connections')",
          )) as any;

          // 3. PROCESSLIST completo
          const [processList] = (await conn.query("SHOW FULL PROCESSLIST")) as any;

          // 4. Matar conexões Sleep do wapi_user com tempo ocioso > 30s
          const killed: number[] = [];
          for (const proc of processList) {
            if (
              proc.Command === "Sleep" &&
              proc.User === "wapi_user" &&
              proc.Time > 30 &&
              proc.Id !== (conn as any).config?.connectionId
            ) {
              try {
                await conn.query(`KILL CONNECTION ${proc.Id}`);
                killed.push(proc.Id);
              } catch {
                // Conexão pode ter encerrado sozinha entre o SHOW e o KILL
              }
            }
          }

          // 5. PROCESSLIST após o kill
          const [processListAfter] = (await conn.query("SHOW FULL PROCESSLIST")) as any;

          return new Response(
            JSON.stringify({
              variables: vars,
              status: statusRows,
              processListBefore: processList,
              killed,
              processListAfter,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          );
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        } finally {
          try { await conn?.end(); } catch {}
        }
      },
    },
  },
});
