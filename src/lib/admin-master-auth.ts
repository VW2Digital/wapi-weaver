import db from "./db";
import { hasMasterRole } from "./roles";
import { verifyApiUser } from "./subscription-helpers";

const jsonError = (error: string, status: number) =>
  new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function enforceAdminMaster(request: Request): Promise<Response | null> {
  let userId: string;

  try {
    const user = await verifyApiUser(request);
    userId = user.userId;
  } catch {
    return jsonError("Unauthorized", 401);
  }

  const roles = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [
    userId,
  ])) as Array<{ role: string }>;

  if (!hasMasterRole(roles.map(({ role }) => role))) {
    return jsonError("Forbidden", 403);
  }

  return null;
}
