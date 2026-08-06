import { createFileRoute } from "@tanstack/react-router";
import db from "@/lib/db";
import { enforceAdminMaster } from "@/lib/admin-master-auth";

export const Route = createFileRoute("/api/auth/temp-promote")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const authError = await enforceAdminMaster(request);
        if (authError) return authError;

        const roleCounts = (await db.query("SELECT role, COUNT(*) as count FROM user_roles GROUP BY role")) as any[];
        return new Response(JSON.stringify({ ok: true, roleCounts }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
