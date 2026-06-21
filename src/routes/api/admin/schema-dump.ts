import { createFileRoute } from "@tanstack/react-router";
import { dbAdmin } from "@/integrations/mysql/client.server";
import { promises as fs } from "fs";
import path from "path";
import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

// GET /api/admin/schema-dump
// Endpoint seguro que gera o dump (apenas schema, sem dados) do schema `public`
// e devolve como arquivo .sql para download. Requer um usuário autenticado COM
// papel `admin`. Equivale a `pg_dump --schema-only -n public`.
//
// Autenticação: header `Authorization: Bearer <access_token>` do usuário logado.
// (No painel, basta usar o link/botão "Baixar via endpoint" — o token é anexado
// automaticamente pelo client.)
export const Route = createFileRoute("/api/admin/schema-dump")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          // 1) Validar Bearer token
          const authz = request.headers.get("authorization") ?? "";
          const token = authz.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : "";
          if (!token) {
            return new Response("Unauthorized", { status: 401 });
          }

          // 2) Resolver usuário a partir do token (valida o JWT)
          let decoded: any;
          try {
            decoded = jwt.verify(token, JWT_SECRET);
          } catch (e) {
            return new Response("Unauthorized", { status: 401 });
          }
          if (!decoded || !decoded.sub) {
            return new Response("Unauthorized", { status: 401 });
          }
          const userId = decoded.sub;

          // 3) Verificar papel admin
          const { data: roles, error: rolesErr } = await dbAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", userId);
          if (rolesErr) {
            return new Response("Internal error", { status: 500 });
          }
          const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
          if (!isAdmin) {
            return new Response("Forbidden", { status: 403 });
          }

          // 4) Gerar dump via leitura do arquivo local schema_mysql.sql
          let sql = "";
          try {
            const schemaPath = path.join(process.cwd(), "schema_mysql.sql");
            sql = await fs.readFile(schemaPath, "utf-8");
          } catch (err) {
            console.error("[schema-dump] file read error", err);
            return new Response("Failed to generate dump", { status: 500 });
          }

          const body = String(sql ?? "");
          const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
          const filename = `schema-public-${ts}.sql`;

          // 5) Registrar auditoria (best-effort)
          try {
            await dbAdmin.from("audit_logs").insert({
              user_id: userId,
              action: "platform.schema_dump.endpoint",
              entity_type: "database",
              entity_id: "public",
              metadata: { bytes: body.length },
            } as any);
          } catch {
            // ignore
          }

          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "application/sql; charset=utf-8",
              "Content-Disposition": `attachment; filename="${filename}"`,
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch (e: any) {
          console.error("[schema-dump] unexpected", e);
          return new Response("Internal error", { status: 500 });
        }
      },

      // CORS preflight (caso seja chamado de outra origem com Authorization)
      OPTIONS: async () => {
        return new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
            "Access-Control-Max-Age": "86400",
          },
        });
      },
    },
  },
});
