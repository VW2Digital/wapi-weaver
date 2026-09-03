import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { dbAdmin } from "@/integrations/mysql/client.server";
import db from "./db";
import { hasCompanyAdminRole, hasMasterRole } from "./roles";
import {
  assertUserBelongsToTenant,
  getActorTenantAccess,
  listTenantUserIds,
} from "./tenant-authorization";

function isDuplicateEmailError(error: unknown) {
  const candidate = error as { code?: string; errno?: number; message?: string } | null;
  return (
    candidate?.code === "ER_DUP_ENTRY" ||
    candidate?.errno === 1062 ||
    /duplicate entry|already exists/i.test(candidate?.message ?? "")
  );
}

async function findUserByEmail(email: string) {
  const users = (await db.query(
    "SELECT id, email FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1",
    [email],
  )) as Array<{ id: string; email: string }>;
  return users[0] ?? null;
}

async function assertExistingUserCanBeRecovered(userId: string, email: string, tenantId: string) {
  const memberships = (await db.query(
    `SELECT DISTINCT t.tenant_id
     FROM team_members tm
     JOIN teams t ON t.id = tm.team_id
     WHERE tm.user_id = ?`,
    [userId],
  )) as Array<{ tenant_id: string }>;
  if (memberships.some(({ tenant_id: currentTenantId }) => currentTenantId !== tenantId)) {
    throw new Error("Este e-mail já pertence a outra empresa.");
  }

  const protectedAccount = (await db.query(
    `SELECT 1
     FROM user_roles ur
     LEFT JOIN licenses l ON l.tenant_id = ur.user_id OR LOWER(l.client_email) = LOWER(?)
     WHERE ur.user_id = ?
       AND (ur.role = 'admin_master' OR l.id IS NOT NULL)
     LIMIT 1`,
    [email, userId],
  )) as unknown[];
  if (memberships.length === 0 && protectedAccount.length > 0) {
    throw new Error("Este e-mail pertence a uma conta administradora e não pode ser vinculado.");
  }
}

async function ensureTenantMembership(tenantId: string, userId: string) {
  const teams = (await db.query(
    "SELECT id FROM teams WHERE tenant_id = ? ORDER BY created_at ASC LIMIT 1",
    [tenantId],
  )) as Array<{ id: string }>;
  let teamId = teams[0]?.id;

  if (!teamId) {
    teamId = crypto.randomUUID();
    await db.query("INSERT INTO teams (id, tenant_id, name, user_id) VALUES (?, ?, 'Geral', ?)", [
      teamId,
      tenantId,
      tenantId,
    ]);
  }

  await db.query(
    `INSERT INTO team_members (id, team_id, user_id, role)
     VALUES (?, ?, ?, 'agent')
     ON DUPLICATE KEY UPDATE role = role`,
    [crypto.randomUUID(), teamId, userId],
  );
}

async function assertAdmin(ctx: { userId: string; tenantId: string }) {
  const access = await getActorTenantAccess(ctx.userId, ctx.tenantId);
  if (!access.isMaster && !access.isCompanyAdmin) {
    throw Object.assign(
      new Error("Acesso negado: apenas administradores podem gerenciar usuários."),
      {
        statusCode: 403,
      },
    );
  }
  return access;
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const access = await assertAdmin(context);
    const { data: usersData, error: uErr } = await dbAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (uErr) throw uErr;
    const platformMembers = access.isMaster
      ? ((await db.query("SELECT user_id FROM user_roles")) as Array<{ user_id: string }>).map(
          ({ user_id }) => user_id,
        )
      : null;
    const allowedUserIds = platformMembers ?? (await listTenantUserIds(access.tenantId));
    const visibleUsers = usersData.users.filter((user: any) => allowedUserIds.includes(user.id));
    let rolesQuery = dbAdmin.from("user_roles").select("user_id, role").in("user_id", allowedUserIds);
    const { data: roles, error: rErr } = await rolesQuery;
    if (rErr) throw rErr;
    const rolesMap = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    });

    // Buscar display_name e full_name dos perfis MySQL
    const uids = visibleUsers.map((u: any) => u.id);
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
      users: visibleUsers.map((u: any) => {
        const userRoles = [...(rolesMap.get(u.id) ?? [])];
        const isOwner = u.id === context.tenantId;
        if (isOwner && !userRoles.includes("admin") && !userRoles.includes("admin_master")) {
          userRoles.push("admin");
        }
        return {
          id: u.id,
          email: u.email ?? "",
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          confirmed: !!u.email_confirmed_at,
          roles: userRoles,
          isOwner,
          display_name: profilesMap.get(u.id)?.display_name ?? null,
          full_name: profilesMap.get(u.id)?.full_name ?? null,
        };
      }),
    };
  });

const createSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(72),
  display_name: z.string().trim().min(1).max(80).optional(),
  role: z.enum(["admin_master", "admin", "user"]).default("user"),
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const access = await assertAdmin(context);
    const { data: created, error } = await dbAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.display_name ? { display_name: data.display_name } : undefined,
    });
    let uid: string | undefined = created.user?.id;
    let recovered = false;

    // Versões anteriores criavam o login, mas podiam falhar silenciosamente ao
    // associá-lo ao tenant. Reenviar o mesmo e-mail recupera apenas contas órfãs,
    // sem permitir tomar um usuário que já pertença a outra empresa.
    if (error) {
      if (!isDuplicateEmailError(error)) throw error;
      const existingUser = await findUserByEmail(data.email);
      if (!existingUser) throw error;
      await assertExistingUserCanBeRecovered(existingUser.id, existingUser.email, access.tenantId);
      uid = existingUser.id;
      recovered = true;
    }

    if (!uid) throw new Error("Não foi possível identificar o usuário criado.");

    try {
      await db.query(
        `INSERT INTO user_roles (id, user_id, role)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE role = VALUES(role)`,
        [crypto.randomUUID(), uid, data.role],
      );
      // Garante que o usuário tenha um perfil (necessário para chats, categorias, etc.)
      await db.query(
        `INSERT INTO profiles (id, email, display_name, full_name)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           email = VALUES(email),
           display_name = COALESCE(VALUES(display_name), display_name),
           full_name = COALESCE(VALUES(full_name), full_name)`,
        [uid, data.email, data.display_name ?? null, data.display_name ?? null],
      );

      // Todo membro criado pelo painel entra no workspace atual, inclusive quando
      // o administrador master também está administrando a própria empresa.
      await ensureTenantMembership(access.tenantId, uid);
    } catch (associationError) {
      // Evita repetir o estado legado de login criado sem vínculo com a empresa.
      if (!recovered) {
        const { error: cleanupError } = await dbAdmin.auth.admin.deleteUser(uid);
        if (cleanupError) console.error("Falha ao desfazer usuário sem vínculo:", cleanupError);
      }
      throw associationError;
    }

    return { ok: true, id: uid, recovered };
  });

const roleSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["admin_master", "admin", "user"]),
  grant: z.boolean(),
});

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => roleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const access = await assertAdmin(context);
    if (data.user_id === access.tenantId && !data.grant && data.role === "admin") {
      throw new Error("O criador da conta é o administrador titular da empresa e seu perfil de administrador é imutável.");
    }
    if (!access.isMaster) await assertUserBelongsToTenant(data.user_id, access.tenantId);
    if (data.grant) {
      const { error } = await dbAdmin
        .from("user_roles")
        .insert({ user_id: data.user_id, role: data.role } as never);
      if (error && !String(error.message).includes("duplicate")) throw error;
    } else {
      // Proteção: não permitir remover o último administrador de cada nível.
      if (hasMasterRole([data.role]) || hasCompanyAdminRole([data.role])) {
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

// Alguns usuários legados podem ter sido criados antes da padronização dos IDs em UUID.
// A exclusão continua protegida por assertAdmin e usa query parametrizada no banco.
const deleteSchema = z.object({
  user_id: z.string().trim().min(1, "Identificador do usuário é obrigatório.").max(64),
});

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => deleteSchema.parse(d))
  .handler(async ({ data, context }) => {
    const access = await assertAdmin(context);
    if (!access.isMaster) await assertUserBelongsToTenant(data.user_id, access.tenantId);
    if (data.user_id === access.tenantId) throw new Error("O administrador titular da conta não pode ser excluído.");
    if (data.user_id === context.userId) throw new Error("Você não pode excluir a si mesmo.");

    // Verificar se o usuário possui sua própria empresa/licença de cliente
    const ownLicenses = (await db.query(
      "SELECT id FROM licenses WHERE tenant_id = ? OR client_email = (SELECT email FROM users WHERE id = ?) LIMIT 1",
      [data.user_id, data.user_id],
    )) as any[];

    const hasOwnTenant = ownLicenses.length > 0;

    if (hasOwnTenant) {
      // Se possui empresa/licença própria, apenas desvincula das equipes e cargos da empresa atual
      await db.query(
        "DELETE tm FROM team_members tm JOIN teams t ON t.id = tm.team_id WHERE tm.user_id = ? AND t.tenant_id = ?",
        [data.user_id, access.tenantId],
      );
      // Remove cargos associados à empresa do solicitante
      if (!access.isMaster) {
        await db.query("DELETE FROM user_roles WHERE user_id = ? AND role != 'admin'", [data.user_id]);
      }
    } else {
      // Caso não tenha empresa própria, deleta a conta globalmente
      const { error } = await dbAdmin.auth.admin.deleteUser(data.user_id);
      if (error) throw error;
    }
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
    const access = await assertAdmin(context);
    if (!access.isMaster) await assertUserBelongsToTenant(data.user_id, access.tenantId);
    await db.query("UPDATE profiles SET display_name = ?, full_name = ? WHERE id = ?", [
      data.display_name ?? null,
      data.full_name ?? null,
      data.user_id,
    ]);
    return { ok: true };
  });

const activitySchema = z.object({ user_id: z.string().uuid() });

export const getUserActivity = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => activitySchema.parse(d))
  .handler(async ({ data, context }) => {
    const access = await assertAdmin(context);
    if (!access.isMaster) await assertUserBelongsToTenant(data.user_id, access.tenantId);
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
