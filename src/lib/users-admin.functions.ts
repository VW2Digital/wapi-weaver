import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { dbAdmin } from "@/integrations/mysql/client.server";
import db from "./db";

async function assertAdmin(ctx: { db: any; userId: string }) {
  const { data, error } = await ctx.db
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .in("role", ["owner", "adminmaster"])
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error("Acesso negado: apenas o administrador (owner ou adminmaster) tem permissão.");
  }
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const rolesData = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [context.userId])) as any[];
    const rolesCurrent = rolesData.map((r: any) => r.role);
    const isMaster = rolesCurrent.includes("adminmaster");
    const isOwner = rolesCurrent.includes("owner");

    if (!isMaster && !isOwner) {
      throw new Error("Acesso negado: apenas administradores podem listar usuários.");
    }

    let usersQuery = "SELECT id, email, created_at, updated_at, tenant_id FROM users";
    let params: any[] = [];
    if (!isMaster) {
      usersQuery += " WHERE tenant_id = ?";
      params.push(context.userId);
    }

    const rawUsers = (await db.query(usersQuery, params)) as any[];
    const uids = rawUsers.map((u: any) => u.id);

    let rolesMap = new Map<string, string[]>();
    if (uids.length > 0) {
      const placeholders = uids.map(() => "?").join(",");
      const rolesRes = (await db.query(`SELECT user_id, role FROM user_roles WHERE user_id IN (${placeholders})`, uids)) as any[];
      rolesRes.forEach((r: any) => {
        const arr = rolesMap.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesMap.set(r.user_id, arr);
      });
    }

    let profilesMap = new Map<string, { display_name: string | null; full_name: string | null }>();
    if (uids.length > 0) {
      const placeholders = uids.map(() => "?").join(",");
      const profiles = (await db.query(
        `SELECT id, display_name, full_name FROM profiles WHERE id IN (${placeholders})`,
        uids,
      )) as any[];
      for (const p of profiles ?? []) {
        profilesMap.set(p.id, { display_name: p.display_name, full_name: p.full_name });
      }
    }

    return {
      users: rawUsers.map((u: any) => ({
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.updated_at ?? u.created_at ?? null,
        confirmed: true,
        roles: rolesMap.get(u.id) ?? [],
        display_name: profilesMap.get(u.id)?.display_name ?? null,
        full_name: profilesMap.get(u.id)?.full_name ?? null,
        tenant_id: u.tenant_id,
      })),
    };
  });

const createSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  display_name: z.string().trim().min(1).max(80).optional(),
  role: z.enum(["adminmaster", "owner", "org_admin", "member", "user", "admin"]).default("user"),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const rolesData = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [context.userId])) as any[];
    const rolesCurrent = rolesData.map((r: any) => r.role);
    const isMaster = rolesCurrent.includes("adminmaster");
    const isOwner = rolesCurrent.includes("owner");

    if (!isMaster && !isOwner) {
      throw new Error("Acesso negado.");
    }

    // Se for um Owner criando usuário, validar o max_users
    let tenantId: string | null = null;
    if (!isMaster || (isMaster && data.role === "user")) {
       tenantId = context.userId;
       const licenseRows = (await db.query(
         `SELECT l.id, p.max_users, (SELECT COUNT(*) FROM users WHERE tenant_id = l.tenant_id) as current_users
          FROM licenses l LEFT JOIN subscription_plans p ON l.plan_id = p.id WHERE l.tenant_id = ? LIMIT 1`,
         [tenantId]
       )) as any[];
       
       if (licenseRows && licenseRows.length > 0) {
         const lic = licenseRows[0];
         if (lic.max_users && lic.current_users >= lic.max_users) {
           throw new Error(`Limite de usuários atingido para sua licença (${lic.max_users} usuários).`);
         }
       }
    }

    const { data: created, error } = await dbAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.display_name ? { display_name: data.display_name } : undefined,
    });
    if (error) throw error;
    const uid = created.user!.id;

    if (tenantId) {
      await db.query("UPDATE users SET tenant_id = ? WHERE id = ?", [tenantId, uid]);
      // Também adicioná-lo na equipe padrão (criada durante o onboarding)
      const teamRows = (await db.query("SELECT id FROM teams WHERE user_id = ? LIMIT 1", [tenantId])) as any[];
      if (teamRows.length > 0) {
        await db.query("INSERT IGNORE INTO team_members (id, team_id, user_id, role) VALUES (UUID(), ?, ?, 'agent')", [teamRows[0].id, uid]);
      }
    }

    const targetRole = data.role === "admin" ? "owner" : data.role;
    await dbAdmin.from("user_roles").insert({ user_id: uid, role: targetRole } as never);
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
  role: z.enum(["adminmaster", "owner", "org_admin", "member", "user", "admin"]),
  grant: z.boolean(),
});

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => roleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const rolesData = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [context.userId])) as any[];
    const rolesCurrent = rolesData.map((r: any) => r.role);
    const isMaster = rolesCurrent.includes("adminmaster");
    const isOwner = rolesCurrent.includes("owner");

    if (!isMaster && !isOwner) {
      throw new Error("Acesso negado.");
    }

    if (!isMaster) {
      const uRows = await db.query("SELECT tenant_id FROM users WHERE id = ?", [data.user_id]) as any[];
      if (!uRows.length || uRows[0].tenant_id !== context.userId) {
        throw new Error("Usuário não pertence à sua organização.");
      }
    }
    if (data.grant) {
      const { error } = await dbAdmin
        .from("user_roles")
        .insert({ user_id: data.user_id, role: data.role } as never);
      if (error && !String(error.message).includes("duplicate")) throw error;
    } else {
      // Proteção: não permitir remover o último admin/owner/adminmaster
      if (data.role === "admin" || data.role === "owner" || data.role === "adminmaster") {
        const { count } = await dbAdmin
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("role", data.role);
        if ((count ?? 0) <= 1) throw new Error(`Não é possível remover o último ${data.role}.`);
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
  .validator((d) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const rolesData = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [context.userId])) as any[];
    const rolesCurrent = rolesData.map((r: any) => r.role);
    const isMaster = rolesCurrent.includes("adminmaster");
    const isOwner = rolesCurrent.includes("owner");

    if (!isMaster && !isOwner) {
      throw new Error("Acesso negado.");
    }

    if (!isMaster) {
      const uRows = await db.query("SELECT tenant_id FROM users WHERE id = ?", [data.user_id]) as any[];
      if (!uRows.length || uRows[0].tenant_id !== context.userId) {
        throw new Error("Usuário não pertence à sua organização.");
      }
    }
    if (data.user_id === context.userId) throw new Error("Você não pode excluir a si mesmo.");
    const { error } = await dbAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw error;
    return { ok: true };
  });

const updateProfileSchema = z.object({
  user_id: z.string().uuid(),
  display_name: z.string().trim().max(100).nullable().optional(),
  full_name: z.string().trim().max(150).nullable().optional(),
});

export const updateUserProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => updateProfileSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    await db.query("UPDATE profiles SET display_name = ?, full_name = ? WHERE id = ?", [
      data.display_name ?? null,
      data.full_name ?? null,
      data.user_id,
    ]);
    return { ok: true };
  });

const activitySchema = z.object({ user_id: z.string().uuid() });

const resetPasswordSchema = z.object({
  user_id: z.string().uuid(),
  password: z.string().min(8).max(72),
});

export const updateUserPassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => resetPasswordSchema.parse(d))
  .handler(async ({ data, context }) => {
    const rolesData = (await db.query("SELECT role FROM user_roles WHERE user_id = ?", [context.userId])) as any[];
    const rolesCurrent = rolesData.map((r: any) => r.role);
    const isMaster = rolesCurrent.includes("adminmaster");
    const isOwner = rolesCurrent.includes("owner");

    if (!isMaster && !isOwner) {
      throw new Error("Acesso negado.");
    }

    if (!isMaster) {
      const uRows = (await db.query("SELECT tenant_id FROM users WHERE id = ?", [data.user_id])) as any[];
      if (!uRows.length || uRows[0].tenant_id !== context.userId) {
        throw new Error("Usuário não pertence à sua organização.");
      }
    }

    const { error } = await dbAdmin.auth.admin.updateUserById(data.user_id, {
      password: data.password,
    });
    
    if (error) throw error;
    
    return { ok: true };
  });

export const getUserActivity = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d) => activitySchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const uid = data.user_id;

    const { data: userInfo, error: uErr } = await dbAdmin.auth.admin.getUserById(uid);
    if (uErr) throw uErr;
    const user = userInfo.user as { 
      id: string; 
      email: string; 
      created_at: string; 
      last_sign_in_at?: string; 
      email_confirmed_at?: string; 
    };

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
