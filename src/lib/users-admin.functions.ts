import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { dbAdmin } from "@/integrations/mysql/client.server";
import db from "./db";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Acesso negado: apenas administradores.");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data: usersData, error: uErr } = await dbAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (uErr) throw uErr;
    const { data: roles, error: rErr } = await dbAdmin.from("user_roles").select("user_id, role");
    if (rErr) throw rErr;
    const rolesMap = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    });
    return {
      users: usersData.users.map((u: any) => ({
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        confirmed: !!u.email_confirmed_at,
        roles: rolesMap.get(u.id) ?? [],
      })),
    };
  });

const createSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  display_name: z.string().trim().min(1).max(80).optional(),
  role: z.enum(["admin", "user"]).default("user"),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: created, error } = await dbAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.display_name ? { display_name: data.display_name } : undefined,
    });
    if (error) throw error;
    const uid = created.user!.id;
    // O trigger assign_default_role já insere 'user'. Se admin solicitado, adiciona.
    if (data.role === "admin") {
      await dbAdmin.from("user_roles").insert({ user_id: uid, role: "admin" } as never);
    }
    // Garante que o usuário tenha um perfil (necessário para chats, categorias, etc.)
    await db.query(
      `INSERT IGNORE INTO profiles (id, email, display_name, full_name)
       VALUES (?, ?, ?, ?)`,
      [uid, data.email, data.display_name ?? null, data.display_name ?? null],
    );
    return { ok: true, id: uid };
  });

const roleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin", "user"]),
  grant: z.boolean(),
});

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => roleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.grant) {
      const { error } = await dbAdmin
        .from("user_roles")
        .insert({ user_id: data.user_id, role: data.role } as never);
      if (error && !String(error.message).includes("duplicate")) throw error;
    } else {
      // Proteção: não permitir remover o último admin
      if (data.role === "admin") {
        const { count } = await dbAdmin
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", "admin");
        if ((count ?? 0) <= 1) throw new Error("Não é possível remover o último administrador.");
      }
      const { error } = await dbAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", data.role);
      if (error) throw error;
    }
    return { ok: true };
  });

const deleteSchema = z.object({ user_id: z.string().uuid() });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.user_id === context.userId) throw new Error("Você não pode excluir a si mesmo.");
    const { error } = await dbAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw error;
    return { ok: true };
  });

const activitySchema = z.object({ user_id: z.string().uuid() });

export const getUserActivity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => activitySchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const uid = data.user_id;

    const { data: userInfo, error: uErr } = await dbAdmin.auth.admin.getUserById(uid);
    if (uErr) throw uErr;
    const user = userInfo.user;

    const [
      campaignsRes,
      msgsRes,
      contactsRes,
      listsRes,
      tagsRes,
      templatesRes,
      recentCampaignsRes,
    ] = await Promise.all([
      dbAdmin.from("campaigns").select("id, status", { count: "exact" }).eq("user_id", uid),
      dbAdmin.from("campaign_messages").select("status", { count: "exact" }).eq("user_id", uid),
      dbAdmin.from("contacts").select("id", { count: "exact", head: true }).eq("user_id", uid),
      dbAdmin.from("lists").select("id", { count: "exact", head: true }).eq("user_id", uid),
      dbAdmin.from("tags").select("id", { count: "exact", head: true }).eq("user_id", uid),
      dbAdmin.from("templates").select("id, status", { count: "exact" }).eq("user_id", uid),
      dbAdmin
        .from("campaigns")
        .select("id, name, status, created_at, started_at, finished_at, totals")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const campaignsByStatus: Record<string, number> = {};
    (campaignsRes.data ?? []).forEach((c: any) => {
      campaignsByStatus[c.status] = (campaignsByStatus[c.status] ?? 0) + 1;
    });

    const messagesByStatus: Record<string, number> = {};
    (msgsRes.data ?? []).forEach((m: any) => {
      messagesByStatus[m.status] = (messagesByStatus[m.status] ?? 0) + 1;
    });

    const templatesByStatus: Record<string, number> = {};
    (templatesRes.data ?? []).forEach((t: any) => {
      templatesByStatus[t.status] = (templatesByStatus[t.status] ?? 0) + 1;
    });

    return {
      profile: {
        id: user?.id ?? uid,
        email: user?.email ?? "",
        created_at: user?.created_at ?? null,
        last_sign_in_at: user?.last_sign_in_at ?? null,
        confirmed_at: user?.email_confirmed_at ?? null,
      },
      campaigns: {
        total: campaignsRes.count ?? 0,
        byStatus: campaignsByStatus,
        recent: (recentCampaignsRes.data ?? []) as Array<{
          id: string;
          name: string;
          status: string;
          created_at: string;
          started_at: string | null;
          finished_at: string | null;
          totals: {
            read?: number;
            sent?: number;
            total?: number;
            failed?: number;
            pending?: number;
            delivered?: number;
          };
        }>,
      },
      messages: {
        total: msgsRes.count ?? 0,
        byStatus: messagesByStatus,
      },
      contacts: contactsRes.count ?? 0,
      lists: listsRes.count ?? 0,
      tags: tagsRes.count ?? 0,
      templates: {
        total: templatesRes.count ?? 0,
        byStatus: templatesByStatus,
      },
    };
  });
