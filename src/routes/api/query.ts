import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { executeQuery } from "@/lib/query-compiler";
import { JWT_SECRET } from "@/lib/jwt-secret";
import db from "@/lib/db";

export const Route = createFileRoute("/api/query")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const authHeader = request.headers.get("authorization");
          if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const token = authHeader.replace("Bearer ", "");
          let decoded: any;
          try {
            decoded = jwt.verify(token, JWT_SECRET);
          } catch (e) {
            return new Response(JSON.stringify({ error: "Unauthorized: Invalid token" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }

          const { resolveEffectiveUserId } = await import("@/lib/chat-helpers");
          const effectiveUserId = await resolveEffectiveUserId(decoded.sub);

          // O papel do JWT pode ficar obsoleto após uma promoção feita pelo
          // instalador. A autorização deve sempre refletir o banco atual.
          const roles = (await db.query(
            "SELECT role FROM user_roles WHERE user_id = ? ORDER BY FIELD(role, 'admin_master', 'admin', 'user') ASC LIMIT 1",
            [decoded.sub],
          )) as Array<{ role: string }>;
          const currentRole = roles[0]?.role || "user";

          const query = await request.json();
          const results = await executeQuery(query, effectiveUserId, currentRole);

          return new Response(JSON.stringify({ data: results, error: null }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: any) {
          console.error("[Query API] Error:", err);
          return new Response(JSON.stringify({ data: null, error: { message: err.message } }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
