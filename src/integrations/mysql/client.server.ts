import { ServerMySQLClient } from "@/lib/db-client";

// Cliente MySQL server-side com acesso administrativo (sem filtros de user_id automáticos)
export const dbAdmin = new ServerMySQLClient("admin-system", "admin") as any;
export { dbAdmin as supabaseAdmin };
