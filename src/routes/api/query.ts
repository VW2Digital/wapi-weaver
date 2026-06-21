import { createFileRoute } from "@tanstack/react-router";
import jwt from "jsonwebtoken";
import { executeQuery } from "@/lib/query-compiler";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";

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

          const query = await request.json();
          const results = await executeQuery(query, decoded.sub, decoded.role || "user");

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
