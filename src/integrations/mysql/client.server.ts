import { ServerMySQLClient } from "@/lib/db-client";

// Cliente MySQL server-side com acesso administrativo (sem filtros de user_id automáticos)
export const dbAdmin: ServerMySQLClient = new ServerMySQLClient("admin-system", "admin");
