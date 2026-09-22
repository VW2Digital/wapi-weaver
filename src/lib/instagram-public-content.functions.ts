"use server";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { resolveInstagramPublicPreview } from "@/lib/instagram-public-preview";

const GRAPH_VERSION = "v26.0";
const HASHTAG_LIMIT = 30;
const HASHTAG_WINDOW_DAYS = 7;
const REQUIRED_SCOPES = ["instagram_basic", "pages_show_list"] as const;
export const INSTAGRAM_PUBLIC_REQUIRED_SCOPES = REQUIRED_SCOPES;
export const INSTAGRAM_HASHTAG_MEDIA_FIELDS =
  "id,caption,media_type,media_url,permalink,timestamp,children{media_type,media_url,thumbnail_url}";

type PublicConnectionRow = {
  id: string;
  tenant_id: string;
  instagram_account_id: string | null;
  meta_app_connection_id: string | null;
  page_id: string;
  ig_user_id: string;
  username: string | null;
  user_access_token_encrypted: string;
  granted_scopes: string | string[] | null;
  status: "connected" | "permission_pending" | "reauth_required" | "error" | "disconnected";
  app_review_status: "unknown" | "api_available" | "required" | "error";
  token_expires_at: string | null;
  last_validated_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type StorefrontRow = {
  id: string;
  tenant_id: string;
  slug: string;
  enabled: number;
  title: string;
  subtitle: string | null;
  layout: "grid" | "masonry";
  columns_count: number;
  show_captions: number;
  show_hashtags: number;
  max_items: number;
  theme: "auto" | "light" | "dark";
  deleted_at?: string | Date | null;
  deleted_by?: string | null;
};

type HashtagRow = {
  id: string;
  hashtag_id: string;
  hashtag: string;
  first_searched_at: string;
  last_searched_at: string;
  window_expires_at: string;
};

type MediaChild = {
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
};

type MediaRow = {
  id: string;
  provider_media_id: string;
  source?: "recent" | "top";
  media_type: string;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string;
  caption: string | null;
  username: string | null;
  provider_timestamp: string | null;
  children_json: string | MediaChild[] | null;
  selected?: number;
  rights_confirmed_at?: string | null;
  display_order?: number;
  hashtag?: string;
};

export type ReusableInstagramConnectionRow = {
  instagram_account_id: string;
  channel_connection_id: string;
  meta_app_connection_id: string | null;
  page_id: string;
  ig_user_id: string;
  username: string | null;
  facebook_user_access_token_encrypted: string | null;
};

type MetaAppConfig = {
  connectionId: string | null;
  appId: string;
  appSecret: string;
  graphVersion: string;
};

type GraphErrorShape = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

export class InstagramPublicContentError extends Error {
  status: number;
  metaCode: number | null;
  metaSubcode: number | null;
  traceId: string | null;

  constructor(message: string, status = 500, body?: GraphErrorShape) {
    super(message);
    this.name = "InstagramPublicContentError";
    this.status = status;
    this.metaCode = body?.error?.code ?? null;
    this.metaSubcode = body?.error?.error_subcode ?? null;
    this.traceId = body?.error?.fbtrace_id ?? null;
  }
}

export function normalizeInstagramHashtag(value: string) {
  return value.trim().replace(/^#+/, "").normalize("NFKC").toLocaleLowerCase("pt-BR");
}

export function canSearchUniqueHashtag(
  activeHashtags: readonly string[],
  requestedHashtag: string,
) {
  const normalized = normalizeInstagramHashtag(requestedHashtag);
  const unique = new Set(activeHashtags.map(normalizeInstagramHashtag));
  return unique.has(normalized) || unique.size < HASHTAG_LIMIT;
}

export function classifyPublicContentApproval(errorCode?: number | null) {
  return errorCode === 10 || errorCode === 200 ? ("required" as const) : ("error" as const);
}

export async function updateInstagramMediaSelectionForTenant(
  execute: (sql: string, params: unknown[]) => Promise<{ affectedRows?: number }>,
  options: {
    tenantId: string;
    mediaId: string;
    selected: boolean;
    rightsConfirmed: boolean;
  },
) {
  return execute(
    `UPDATE instagram_public_media
     SET selected = ?,
         rights_confirmed_at = IF(?, NOW(), NULL),
         updated_at = NOW()
     WHERE id = ? AND tenant_id = ?`,
    [
      options.selected ? 1 : 0,
      options.selected && options.rightsConfirmed ? 1 : 0,
      options.mediaId,
      options.tenantId,
    ],
  );
}

export async function findReusableInstagramConnectionForTenant(
  execute: (
    sql: string,
    params: unknown[],
  ) => Promise<ReusableInstagramConnectionRow[]>,
  tenantId: string,
) {
  const rows = await execute(
    `SELECT ia.id AS instagram_account_id,
            cc.id AS channel_connection_id,
            cc.meta_app_connection_id,
            ia.page_id,
            COALESCE(ia.instagram_business_account_id, ia.ig_user_id) AS ig_user_id,
            COALESCE(ia.instagram_username, ia.username, cc.display_name) AS username,
            ia.facebook_user_access_token_encrypted
     FROM instagram_accounts ia
     JOIN channel_connections cc
       ON cc.tenant_id = ia.tenant_id
      AND cc.provider = 'instagram'
      AND cc.status = 'active'
      AND (
        cc.external_account_id = ia.page_id
        OR cc.external_account_id = ia.instagram_business_account_id
        OR cc.external_account_id = ia.ig_user_id
      )
     WHERE ia.tenant_id = ?
       AND ia.is_active = 1
       AND ia.status = 'active'
     ORDER BY cc.updated_at DESC, ia.updated_at DESC
     LIMIT 1`,
    [tenantId],
  );
  return rows[0] || null;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value as T) ?? fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function safeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function retireStorefrontSlug(slug: string, id: string) {
  const base = safeSlug(slug.replace(/-deleted-[a-z0-9]+$/i, "")) || "vitrine";
  const suffix = id.replace(/-/g, "").slice(0, 12);
  return `${base}-deleted-${suffix}`.slice(0, 120);
}

export function isPublicStorefrontAvailable(row: {
  enabled?: number | boolean | null;
  deleted_at?: string | Date | null;
}) {
  return !row.deleted_at && Boolean(Number(row.enabled));
}

export const INSTAGRAM_STOREFRONT_UPDATE_SCHEMA = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(1).max(160),
  subtitle: z.string().trim().max(320).nullable(),
  layout: z.enum(["grid", "masonry"]),
  columnsCount: z.number().int().min(2).max(4),
  showCaptions: z.boolean(),
  showHashtags: z.boolean(),
  maxItems: z.number().int().min(1).max(30),
  theme: z.enum(["auto", "light", "dark"]),
});

async function sleep(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function instagramPublicGraphRequest<T>(options: {
  path: string;
  accessToken: string;
  params?: Record<string, string | number | undefined>;
  method?: "GET" | "POST";
  graphVersion?: string;
  attempts?: number;
}): Promise<T> {
  const graphVersion = options.graphVersion || GRAPH_VERSION;
  const url = new URL(`https://graph.facebook.com/${graphVersion}/${options.path}`);
  for (const [key, value] of Object.entries(options.params || {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const attempts = options.attempts || 3;
  let lastError: InstagramPublicContentError | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        method: options.method || "GET",
        headers: { Authorization: `Bearer ${options.accessToken}` },
      });
      const body = (await response.json().catch(() => ({}))) as T & GraphErrorShape;
      if (response.ok && !body.error) return body;
      const error = new InstagramPublicContentError(
        body.error?.message || `Meta Graph API retornou HTTP ${response.status}.`,
        response.status,
        body,
      );
      lastError = error;
      if (attempt < attempts && (response.status === 429 || response.status >= 500)) {
        await sleep(250 * 2 ** (attempt - 1));
        continue;
      }
      throw error;
    } catch (error) {
      if (error instanceof InstagramPublicContentError) throw error;
      lastError = new InstagramPublicContentError(
        error instanceof Error ? error.message : "Falha de rede ao consultar a Meta.",
        503,
      );
      if (attempt < attempts) {
        await sleep(250 * 2 ** (attempt - 1));
        continue;
      }
    }
  }
  throw lastError || new InstagramPublicContentError("Falha ao consultar a Meta.");
}

async function resolveMetaAppConfig(connectionId?: string): Promise<MetaAppConfig> {
  const { default: db } = await import("./db");
  const { decryptMetaCredential } = await import("./encryption");

  if (connectionId === "platform") {
    const rows = (await db.query(
      `SELECT meta_app_id, meta_app_secret, meta_graph_version
       FROM platform_settings
       WHERE id = 1
       LIMIT 1`,
    )) as Array<{
      meta_app_id: string | null;
      meta_app_secret: string | null;
      meta_graph_version: string | null;
    }>;
    if (!rows[0]?.meta_app_id || !rows[0]?.meta_app_secret) {
      throw new Error("Meta App master não configurada.");
    }
    return {
      connectionId: null,
      appId: rows[0].meta_app_id,
      appSecret: rows[0].meta_app_secret,
      graphVersion: rows[0].meta_graph_version || GRAPH_VERSION,
    };
  }

  if (connectionId) {
    const rows = (await db.query(
      `SELECT mac.id, mac.app_id, mac.app_secret_encrypted, mac.graph_version
       FROM meta_app_connections mac
       JOIN user_roles ur
         ON ur.user_id = mac.tenant_id
        AND ur.role IN ('admin_master','adminmaster')
       WHERE mac.id = ? AND mac.status = 'active'
       LIMIT 1`,
      [connectionId],
    )) as Array<{
      id: string;
      app_id: string;
      app_secret_encrypted: string;
      graph_version: string | null;
    }>;
    if (rows[0]) {
      return {
        connectionId: rows[0].id,
        appId: rows[0].app_id,
        appSecret: decryptMetaCredential(rows[0].app_secret_encrypted),
        graphVersion: rows[0].graph_version || GRAPH_VERSION,
      };
    }
  }

  const masterRows = (await db.query(
    `SELECT mac.id, mac.app_id, mac.app_secret_encrypted, mac.graph_version
     FROM meta_app_connections mac
     JOIN user_roles ur
       ON ur.user_id = mac.tenant_id
      AND ur.role IN ('admin_master','adminmaster')
     WHERE mac.status = 'active'
     ORDER BY mac.updated_at DESC
     LIMIT 1`,
  )) as Array<{
    id: string;
    app_id: string;
    app_secret_encrypted: string;
    graph_version: string | null;
  }>;
  if (masterRows[0]) {
    return {
      connectionId: masterRows[0].id,
      appId: masterRows[0].app_id,
      appSecret: decryptMetaCredential(masterRows[0].app_secret_encrypted),
      graphVersion: masterRows[0].graph_version || GRAPH_VERSION,
    };
  }

  const platformRows = (await db.query(
    `SELECT meta_app_id, meta_app_secret, meta_graph_version
     FROM platform_settings
     WHERE id = 1
     LIMIT 1`,
  )) as Array<{
    meta_app_id: string | null;
    meta_app_secret: string | null;
    meta_graph_version: string | null;
  }>;
  if (!platformRows[0]?.meta_app_id || !platformRows[0]?.meta_app_secret) {
    throw new Error("Meta App master não configurada.");
  }
  return {
    connectionId: null,
    appId: platformRows[0].meta_app_id,
    appSecret: platformRows[0].meta_app_secret,
    graphVersion: platformRows[0].meta_graph_version || GRAPH_VERSION,
  };
}

async function exchangeForLongLivedToken(options: {
  code: string;
  redirectUri: string;
  app: MetaAppConfig;
}) {
  const shortForm = new URLSearchParams({
    client_id: options.app.appId,
    client_secret: options.app.appSecret,
    redirect_uri: options.redirectUri,
    code: options.code,
  });
  const shortResponse = await fetch(
    `https://graph.facebook.com/${options.app.graphVersion}/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: shortForm,
    },
  );
  const shortBody = (await shortResponse.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
  } & GraphErrorShape;
  if (!shortResponse.ok || !shortBody.access_token) {
    throw new InstagramPublicContentError(
      shortBody.error?.message || "Falha ao trocar o código OAuth.",
      shortResponse.status,
      shortBody,
    );
  }

  const longForm = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: options.app.appId,
    client_secret: options.app.appSecret,
    fb_exchange_token: shortBody.access_token,
  });
  const longResponse = await fetch(
    `https://graph.facebook.com/${options.app.graphVersion}/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: longForm,
    },
  );
  const longBody = (await longResponse.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
  } & GraphErrorShape;

  const accessToken =
    longResponse.ok && longBody.access_token ? longBody.access_token : shortBody.access_token;
  const expiresIn =
    longResponse.ok && longBody.expires_in ? longBody.expires_in : shortBody.expires_in || 3600;
  return {
    accessToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

async function getTenantConnection(tenantId: string) {
  const { default: db } = await import("./db");
  const rows = (await db.query(
    `SELECT *
     FROM instagram_public_connections
     WHERE tenant_id = ?
     LIMIT 1`,
    [tenantId],
  )) as PublicConnectionRow[];
  return rows[0] || null;
}

async function getReusableDirectConnection(tenantId: string) {
  const { default: db } = await import("./db");
  return findReusableInstagramConnectionForTenant(
    (sql, params) =>
      db.query(sql, params) as Promise<ReusableInstagramConnectionRow[]>,
    tenantId,
  );
}

async function requireUsableConnection(tenantId: string) {
  const connection = await getTenantConnection(tenantId);
  if (!connection || connection.status === "disconnected") {
    throw new Error("Conecte uma conta profissional do Instagram.");
  }
  if (
    connection.token_expires_at &&
    new Date(connection.token_expires_at).getTime() <= Date.now()
  ) {
    const { default: db } = await import("./db");
    await db.query(
      `UPDATE instagram_public_connections
       SET status = 'reauth_required', last_error = 'Token expirado.', updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [connection.id, tenantId],
    );
    throw new Error("A autenticação expirou. Conecte novamente a conta Instagram.");
  }
  const { decryptMetaCredential } = await import("./encryption");
  if (connection.instagram_account_id) {
    const { default: db } = await import("./db");
    const accountRows = (await db.query(
      `SELECT facebook_user_access_token_encrypted
       FROM instagram_accounts
       WHERE id = ? AND tenant_id = ?
       LIMIT 1`,
      [connection.instagram_account_id, tenantId],
    )) as Array<{ facebook_user_access_token_encrypted: string | null }>;
    if (accountRows[0]?.facebook_user_access_token_encrypted) {
      return {
        connection,
        accessToken: decryptMetaCredential(
          accountRows[0].facebook_user_access_token_encrypted,
        ),
      };
    }
  }
  return {
    connection,
    accessToken: decryptMetaCredential(connection.user_access_token_encrypted),
  };
}

async function getActiveStorefrontSettings(tenantId: string) {
  const { default: db } = await import("./db");
  const rows = (await db.query(
    `SELECT *
     FROM instagram_storefront_settings
     WHERE tenant_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [tenantId],
  )) as StorefrontRow[];
  return rows[0] || null;
}

async function ensureStorefrontSettings(tenantId: string) {
  const existing = await getActiveStorefrontSettings(tenantId);
  if (existing) return existing;

  const { default: db } = await import("./db");
  const profileRows = (await db.query(
    `SELECT company_name, display_name
     FROM profiles
     WHERE id = ?
     LIMIT 1`,
    [tenantId],
  )) as Array<{ company_name: string | null; display_name: string | null }>;
  const base = safeSlug(
    profileRows[0]?.company_name || profileRows[0]?.display_name || `loja-${tenantId.slice(0, 8)}`,
  );
  let slug = `${base || "loja"}-${tenantId.slice(0, 8)}`;
  const slugTaken = (await db.query(
    `SELECT id FROM instagram_storefront_settings WHERE slug = ? LIMIT 1`,
    [slug],
  )) as Array<{ id: string }>;
  if (slugTaken[0]) slug = `${slug}-${crypto.randomUUID().slice(0, 8)}`;
  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO instagram_storefront_settings
       (id, tenant_id, slug, enabled, title, layout, columns_count,
        show_captions, show_hashtags, max_items, theme, created_at, updated_at)
     VALUES (?, ?, ?, 0, 'Instagram', 'grid', 3, 1, 1, 12, 'auto', NOW(), NOW())`,
    [id, tenantId, slug],
  );
  const created = (await db.query(
    `SELECT *
     FROM instagram_storefront_settings
     WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL
     LIMIT 1`,
    [id, tenantId],
  )) as StorefrontRow[];
  return created[0];
}

export const connectInstagramPublicContent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data) =>
    z
      .object({
        code: z.string().trim().min(1),
        redirectUri: z.string().url(),
        metaAppConnectionId: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { default: db } = await import("./db");
    const { encryptMetaCredential } = await import("./encryption");
    const app = await resolveMetaAppConfig(data.metaAppConnectionId);
    const token = await exchangeForLongLivedToken({
      code: data.code,
      redirectUri: data.redirectUri,
      app,
    });

    const permissions = await instagramPublicGraphRequest<{
      data?: Array<{ permission?: string; status?: string }>;
    }>({
      path: "me/permissions",
      accessToken: token.accessToken,
      graphVersion: app.graphVersion,
    });
    const granted = (permissions.data || [])
      .filter((permission) => permission.status === "granted" && permission.permission)
      .map((permission) => String(permission.permission));
    const missing = REQUIRED_SCOPES.filter((scope) => !granted.includes(scope));
    if (missing.length) {
      throw new Error(`Permissões obrigatórias não concedidas: ${missing.join(", ")}.`);
    }

    const accounts = await instagramPublicGraphRequest<{
      data?: Array<{
        id?: string;
        name?: string;
        instagram_business_account?: { id?: string; username?: string };
      }>;
    }>({
      path: "me/accounts",
      accessToken: token.accessToken,
      graphVersion: app.graphVersion,
      params: {
        fields: "id,name,instagram_business_account{id,username}",
        limit: 100,
      },
    });
    const page = (accounts.data || []).find(
      (candidate) => candidate.id && candidate.instagram_business_account?.id,
    );
    if (!page?.id || !page.instagram_business_account?.id) {
      throw new Error(
        "Nenhuma Página com conta profissional do Instagram foi encontrada para este usuário.",
      );
    }
    const igUserId = String(page.instagram_business_account.id);
    const pageId = String(page.id);
    const username = page.instagram_business_account.username || page.name || null;

    const conflict = (await db.query(
      `SELECT tenant_id
       FROM instagram_public_connections
       WHERE ig_user_id = ? AND tenant_id != ?
       LIMIT 1`,
      [igUserId, context.tenantId],
    )) as Array<{ tenant_id: string }>;
    if (conflict[0]) {
      throw new Error("Esta conta Instagram já está vinculada a outra loja.");
    }

    const instagramAccount = (await db.query(
      `SELECT id
       FROM instagram_accounts
       WHERE tenant_id = ?
         AND (instagram_business_account_id = ? OR ig_user_id = ? OR page_id = ?)
       LIMIT 1`,
      [context.tenantId, igUserId, igUserId, pageId],
    )) as Array<{ id: string }>;

    let appReviewStatus: "api_available" | "required" | "error" = "api_available";
    let status: "connected" | "permission_pending" | "error" = "connected";
    let lastError: string | null = null;
    try {
      await instagramPublicGraphRequest({
        path: `${encodeURIComponent(igUserId)}/recently_searched_hashtags`,
        accessToken: token.accessToken,
        graphVersion: app.graphVersion,
        params: { fields: "id,name", limit: 1 },
        attempts: 1,
      });
    } catch (error) {
      const metaError = error as InstagramPublicContentError;
      appReviewStatus = classifyPublicContentApproval(metaError.metaCode);
      status = appReviewStatus === "required" ? "permission_pending" : "error";
      lastError =
        appReviewStatus === "required"
          ? "Instagram Public Content Access ainda não foi aprovado pela Meta para este aplicativo."
          : metaError.message;
    }

    const existing = await getTenantConnection(context.tenantId);
    const id = existing?.id || crypto.randomUUID();
    await db.query(
      `INSERT INTO instagram_public_connections (
         id, tenant_id, instagram_account_id, meta_app_connection_id,
         page_id, ig_user_id, username, user_access_token_encrypted,
         granted_scopes, status, app_review_status, token_expires_at,
         last_validated_at, last_error, disconnected_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NULL, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         instagram_account_id = VALUES(instagram_account_id),
         meta_app_connection_id = VALUES(meta_app_connection_id),
         page_id = VALUES(page_id),
         ig_user_id = VALUES(ig_user_id),
         username = VALUES(username),
         user_access_token_encrypted = VALUES(user_access_token_encrypted),
         granted_scopes = VALUES(granted_scopes),
         status = VALUES(status),
         app_review_status = VALUES(app_review_status),
         token_expires_at = VALUES(token_expires_at),
         last_validated_at = NOW(),
         last_error = VALUES(last_error),
         disconnected_at = NULL,
         updated_at = NOW()`,
      [
        id,
        context.tenantId,
        instagramAccount[0]?.id || null,
        app.connectionId,
        pageId,
        igUserId,
        username,
        encryptMetaCredential(token.accessToken),
        JSON.stringify(granted),
        status,
        appReviewStatus,
        token.expiresAt,
        lastError,
      ],
    );
    const storefront = await ensureStorefrontSettings(context.tenantId);
    return {
      ok: status === "connected",
      status,
      appReviewStatus,
      username,
      grantedScopes: granted,
      missingScopes: missing,
      tokenExpiresAt: token.expiresAt.toISOString(),
      storefrontSlug: storefront?.slug,
      message: lastError,
    };
  });

export const reuseInstagramDirectConnection = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { default: db } = await import("./db");
    const { decryptMetaCredential, encryptMetaCredential } = await import("./encryption");
    const reusable = await getReusableDirectConnection(context.tenantId);
    if (!reusable) {
      throw new Error("Nenhuma conexão ativa do Instagram foi encontrada para esta empresa.");
    }
    if (!reusable.facebook_user_access_token_encrypted) {
      throw new Error(
        "Esta conexão foi criada antes do compartilhamento seguro de autorização. Reconecte o Instagram uma única vez em Configurações.",
      );
    }

    const accessToken = decryptMetaCredential(
      reusable.facebook_user_access_token_encrypted,
    );
    const app = await resolveMetaAppConfig(reusable.meta_app_connection_id || undefined);
    const permissions = await instagramPublicGraphRequest<{
      data?: Array<{ permission?: string; status?: string }>;
    }>({
      path: "me/permissions",
      accessToken,
      graphVersion: app.graphVersion,
      attempts: 1,
    });
    const granted = (permissions.data || [])
      .filter((permission) => permission.status === "granted" && permission.permission)
      .map((permission) => String(permission.permission));
    const missing = REQUIRED_SCOPES.filter((scope) => !granted.includes(scope));
    if (missing.length) {
      throw new Error(
        `A conexão existente não possui as permissões necessárias: ${missing.join(", ")}. Reconecte o Instagram uma única vez em Configurações.`,
      );
    }

    const conflict = (await db.query(
      `SELECT tenant_id
       FROM instagram_public_connections
       WHERE ig_user_id = ? AND tenant_id != ?
       LIMIT 1`,
      [reusable.ig_user_id, context.tenantId],
    )) as Array<{ tenant_id: string }>;
    if (conflict[0]) {
      throw new Error("Esta conta Instagram já está vinculada a outra loja.");
    }

    let appReviewStatus: "api_available" | "required" | "error" = "api_available";
    let status: "connected" | "permission_pending" | "error" = "connected";
    let lastError: string | null = null;
    try {
      await instagramPublicGraphRequest({
        path: `${encodeURIComponent(reusable.ig_user_id)}/recently_searched_hashtags`,
        accessToken,
        graphVersion: app.graphVersion,
        params: { fields: "id,name", limit: 1 },
        attempts: 1,
      });
    } catch (error) {
      const metaError = error as InstagramPublicContentError;
      appReviewStatus = classifyPublicContentApproval(metaError.metaCode);
      status = appReviewStatus === "required" ? "permission_pending" : "error";
      lastError =
        appReviewStatus === "required"
          ? "Instagram Public Content Access ainda não foi aprovado pela Meta para este aplicativo."
          : metaError.message;
    }

    const existing = await getTenantConnection(context.tenantId);
    const id = existing?.id || crypto.randomUUID();
    await db.query(
      `INSERT INTO instagram_public_connections (
         id, tenant_id, instagram_account_id, meta_app_connection_id,
         page_id, ig_user_id, username, user_access_token_encrypted,
         granted_scopes, status, app_review_status, token_expires_at,
         last_validated_at, last_error, disconnected_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NOW(), ?, NULL, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         instagram_account_id = VALUES(instagram_account_id),
         meta_app_connection_id = VALUES(meta_app_connection_id),
         page_id = VALUES(page_id),
         ig_user_id = VALUES(ig_user_id),
         username = VALUES(username),
         user_access_token_encrypted = VALUES(user_access_token_encrypted),
         granted_scopes = VALUES(granted_scopes),
         status = VALUES(status),
         app_review_status = VALUES(app_review_status),
         token_expires_at = NULL,
         last_validated_at = NOW(),
         last_error = VALUES(last_error),
         disconnected_at = NULL,
         updated_at = NOW()`,
      [
        id,
        context.tenantId,
        reusable.instagram_account_id,
        app.connectionId,
        reusable.page_id,
        reusable.ig_user_id,
        reusable.username,
        encryptMetaCredential(accessToken),
        JSON.stringify(granted),
        status,
        appReviewStatus,
        lastError,
      ],
    );
    const storefront = await ensureStorefrontSettings(context.tenantId);
    return {
      ok: status === "connected",
      status,
      appReviewStatus,
      username: reusable.username,
      grantedScopes: granted,
      missingScopes: missing,
      storefrontSlug: storefront?.slug,
      message: lastError,
      reusedConnection: true,
    };
  });

export const disconnectInstagramPublicContent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { default: db } = await import("./db");
    await db.query(
      `DELETE FROM instagram_public_connections
       WHERE tenant_id = ?`,
      [context.tenantId],
    );
    await db.query(
      `UPDATE instagram_storefront_settings
       SET enabled = 0, updated_at = NOW()
       WHERE tenant_id = ? AND deleted_at IS NULL`,
      [context.tenantId],
    );
    return { ok: true };
  });

export const getInstagramPublicDashboard = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { default: db } = await import("./db");
    const connection = await getTenantConnection(context.tenantId);
    const reusableConnection = connection
      ? null
      : await getReusableDirectConnection(context.tenantId);
    const storefront = await getActiveStorefrontSettings(context.tenantId);
    const hashtagRows = (await db.query(
      `SELECT id, hashtag_id, hashtag, first_searched_at, last_searched_at, window_expires_at
       FROM instagram_public_hashtags
       WHERE tenant_id = ?
       ORDER BY last_searched_at DESC
       LIMIT 100`,
      [context.tenantId],
    )) as HashtagRow[];
    const activeUsageRows = (await db.query(
      `SELECT COUNT(*) AS total
       FROM instagram_public_hashtags
       WHERE tenant_id = ? AND window_expires_at > NOW()`,
      [context.tenantId],
    )) as Array<{ total: number }>;
    const mediaRows = (await db.query(
      `SELECT ipm.id, ipm.provider_media_id, ipm.source, ipm.media_type,
              ipm.media_url, ipm.thumbnail_url, ipm.permalink, ipm.caption,
              ipm.username, ipm.provider_timestamp, ipm.children_json,
              ipm.selected, ipm.rights_confirmed_at, ipm.display_order,
              iph.hashtag
       FROM instagram_public_media ipm
       JOIN instagram_public_hashtags iph
         ON iph.id = ipm.hashtag_record_id AND iph.tenant_id = ipm.tenant_id
       WHERE ipm.tenant_id = ? AND ipm.expires_at > NOW()
       ORDER BY ipm.selected DESC, ipm.display_order ASC, ipm.fetched_at DESC
       LIMIT 200`,
      [context.tenantId],
    )) as MediaRow[];
    return {
      connection: connection
        ? {
            id: connection.id,
            pageId: connection.page_id,
            igUserId: connection.ig_user_id,
            username: connection.username,
            grantedScopes: parseJson<string[]>(connection.granted_scopes, []),
            status: connection.status,
            appReviewStatus: connection.app_review_status,
            tokenExpiresAt: connection.token_expires_at,
            lastValidatedAt: connection.last_validated_at,
            lastError: connection.last_error,
          }
        : null,
      reusableConnection: reusableConnection
        ? {
            username: reusableConnection.username,
            hasReusableAuthorization: Boolean(
              reusableConnection.facebook_user_access_token_encrypted,
            ),
          }
        : null,
      hashtagUsage: {
        used: Number(activeUsageRows[0]?.total || 0),
        limit: HASHTAG_LIMIT,
        windowDays: HASHTAG_WINDOW_DAYS,
      },
      hashtags: hashtagRows,
      media: mediaRows.map((row) => ({
        ...row,
        selected: Boolean(row.selected),
        children_json: parseJson<MediaChild[]>(row.children_json, []),
      })),
      storefront: storefront
        ? {
            id: storefront.id,
            slug: storefront.slug,
            enabled: Boolean(storefront.enabled),
            title: storefront.title,
            subtitle: storefront.subtitle,
            layout: storefront.layout,
            columnsCount: storefront.columns_count,
            showCaptions: Boolean(storefront.show_captions),
            showHashtags: Boolean(storefront.show_hashtags),
            maxItems: storefront.max_items,
            theme: storefront.theme,
          }
        : null,
    };
  });

export const searchInstagramPublicHashtag = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data) =>
    z
      .object({
        hashtag: z
          .string()
          .trim()
          .min(1)
          .max(100)
          .regex(/^[#\p{L}\p{N}_]+$/u, "Use somente letras, números e underscore."),
        source: z.enum(["recent", "top"]).default("recent"),
        after: z.string().max(500).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { default: db } = await import("./db");
    const { connection, accessToken } = await requireUsableConnection(context.tenantId);
    if (connection.app_review_status !== "api_available") {
      throw new Error(
        "Instagram Public Content Access ainda não está aprovado pela Meta para este aplicativo.",
      );
    }
    const hashtag = normalizeInstagramHashtag(data.hashtag);
    const activeRows = (await db.query(
      `SELECT id, hashtag
       FROM instagram_public_hashtags
       WHERE tenant_id = ? AND window_expires_at > NOW()
       ORDER BY first_searched_at ASC`,
      [context.tenantId],
    )) as Array<{ id: string; hashtag: string }>;
    if (
      !canSearchUniqueHashtag(
        activeRows.map((row) => row.hashtag),
        hashtag,
      )
    ) {
      throw new Error(
        "Limite de 30 hashtags únicas em sete dias atingido para esta conta Instagram.",
      );
    }

    const app = await resolveMetaAppConfig(connection.meta_app_connection_id || undefined);
    const cacheKey = `instagram-public:${context.tenantId}:${connection.id}:${hashtag}:${data.source}:${data.after || "first"}`;
    const { getOrSetCache } = await import("./cache");
    const result = await getOrSetCache(
      cacheKey,
      async () => {
        const hashtagSearch = await instagramPublicGraphRequest<{
          data?: Array<{ id?: string }>;
        }>({
          path: "ig_hashtag_search",
          accessToken,
          graphVersion: app.graphVersion,
          params: { user_id: connection.ig_user_id, q: hashtag },
        });
        const hashtagId = hashtagSearch.data?.[0]?.id;
        if (!hashtagId) {
          return { hashtagId: null, data: [], paging: null };
        }
        const media = await instagramPublicGraphRequest<{
          data?: Array<{
            id?: string;
            caption?: string;
            media_type?: string;
            media_url?: string;
            thumbnail_url?: string;
            permalink?: string;
            timestamp?: string;
            username?: string;
            children?: { data?: MediaChild[] };
          }>;
          paging?: { cursors?: { after?: string }; next?: string };
        }>({
          path: `${encodeURIComponent(hashtagId)}/${data.source}_media`,
          accessToken,
          graphVersion: app.graphVersion,
          params: {
            user_id: connection.ig_user_id,
            fields: INSTAGRAM_HASHTAG_MEDIA_FIELDS,
            limit: 25,
            after: data.after,
          },
        });
        return {
          hashtagId,
          data: media.data || [],
          paging: {
            after: media.paging?.cursors?.after || null,
            hasNext: Boolean(media.paging?.next),
          },
        };
      },
      300,
    );

    if (!result.hashtagId) {
      return { hashtag, source: data.source, items: [], paging: null, notFound: true as const };
    }

    const existing = (await db.query(
      `SELECT id, window_expires_at
       FROM instagram_public_hashtags
       WHERE tenant_id = ? AND hashtag = ?
       LIMIT 1`,
      [context.tenantId, hashtag],
    )) as Array<{ id: string; window_expires_at: string }>;
    const hashtagRecordId = existing[0]?.id || crypto.randomUUID();
    const isActive = existing[0] && new Date(existing[0].window_expires_at).getTime() > Date.now();
    await db.query(
      `INSERT INTO instagram_public_hashtags (
         id, tenant_id, connection_id, hashtag_id, hashtag,
         first_searched_at, last_searched_at, window_expires_at, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, NOW(), NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         connection_id = VALUES(connection_id),
         hashtag_id = VALUES(hashtag_id),
         first_searched_at = IF(window_expires_at <= NOW(), NOW(), first_searched_at),
         last_searched_at = NOW(),
         window_expires_at = IF(window_expires_at <= NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY), window_expires_at),
         updated_at = NOW()`,
      [hashtagRecordId, context.tenantId, connection.id, result.hashtagId, hashtag],
    );

    await db.query(
      `DELETE FROM instagram_public_media
       WHERE tenant_id = ? AND expires_at <= NOW()`,
      [context.tenantId],
    );
    for (const media of result.data) {
      if (!media.id || !media.media_type || !media.permalink) continue;
      await db.query(
        `INSERT INTO instagram_public_media (
           id, tenant_id, hashtag_record_id, provider_media_id, source,
           media_type, media_url, thumbnail_url, permalink, caption, username,
           provider_timestamp, children_json, selected, display_order,
           fetched_at, expires_at, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, NOW(),
                   DATE_ADD(NOW(), INTERVAL 30 DAY), NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           media_type = VALUES(media_type),
           media_url = VALUES(media_url),
           thumbnail_url = VALUES(thumbnail_url),
           permalink = VALUES(permalink),
           caption = VALUES(caption),
           username = VALUES(username),
           provider_timestamp = VALUES(provider_timestamp),
           children_json = VALUES(children_json),
           fetched_at = NOW(),
           expires_at = DATE_ADD(NOW(), INTERVAL 30 DAY),
           updated_at = NOW()`,
        [
          crypto.randomUUID(),
          context.tenantId,
          hashtagRecordId,
          media.id,
          data.source,
          media.media_type,
          media.media_url || null,
          resolveInstagramPublicPreview({
            media_type: media.media_type,
            media_url: media.media_url,
            thumbnail_url: media.thumbnail_url,
            children_json: media.children?.data || [],
          }).previewUrl,
          media.permalink,
          media.caption || null,
          media.username || null,
          media.timestamp ? new Date(media.timestamp) : null,
          JSON.stringify(media.children?.data || []),
        ],
      );
    }

    const pageIds = result.data.map((media) => media.id).filter((id): id is string => Boolean(id));
    if (pageIds.length === 0) {
      return {
        hashtag,
        source: data.source,
        isRepeatedWithinWindow: Boolean(isActive),
        items: [],
        paging: result.paging,
        notFound: false as const,
      };
    }
    const placeholders = pageIds.map(() => "?").join(", ");
    const persisted = (await db.query(
      `SELECT id, provider_media_id, source, media_type, media_url, thumbnail_url,
              permalink, caption, username, provider_timestamp, children_json,
              selected, rights_confirmed_at, display_order
       FROM instagram_public_media
       WHERE tenant_id = ? AND hashtag_record_id = ? AND source = ?
         AND provider_media_id IN (${placeholders})`,
      [context.tenantId, hashtagRecordId, data.source, ...pageIds],
    )) as MediaRow[];
    const byProvider = new Map(persisted.map((row) => [row.provider_media_id, row]));
    return {
      hashtag,
      source: data.source,
      isRepeatedWithinWindow: Boolean(isActive),
      items: pageIds
        .map((id) => byProvider.get(id))
        .filter((row): row is MediaRow => Boolean(row))
        .map((row) => ({
          ...row,
          selected: Boolean(row.selected),
          children_json: parseJson<MediaChild[]>(row.children_json, []),
        })),
      paging: result.paging,
        notFound: false as const,
    };
  });

export const setInstagramPublicMediaSelection = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data) =>
    z
      .object({
        mediaId: z.string().uuid(),
        selected: z.boolean(),
        rightsConfirmed: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    if (data.selected && !data.rightsConfirmed) {
      throw new Error("Confirme que sua loja possui autorização para reutilizar esta publicação.");
    }
    const { default: db } = await import("./db");
    const result = await updateInstagramMediaSelectionForTenant(db.query, {
      tenantId: context.tenantId,
      mediaId: data.mediaId,
      selected: data.selected,
      rightsConfirmed: data.rightsConfirmed,
    });
    if (!result.affectedRows) throw new Error("Publicação não encontrada para esta loja.");
    return { ok: true };
  });

export const updateInstagramStorefront = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data) => INSTAGRAM_STOREFRONT_UPDATE_SCHEMA.parse(data))
  .handler(async ({ data, context }) => {
    const { default: db } = await import("./db");
    const storefront = await ensureStorefrontSettings(context.tenantId);
    if (!storefront?.id) throw new Error("Configuração da vitrine não encontrada.");
    if (data.enabled) {
      const selectedRows = (await db.query(
        `SELECT COUNT(*) AS total
         FROM instagram_public_media
         WHERE tenant_id = ? AND selected = 1
           AND rights_confirmed_at IS NOT NULL AND expires_at > NOW()`,
        [context.tenantId],
      )) as Array<{ total: number }>;
      if (!Number(selectedRows[0]?.total || 0)) {
        throw new Error("Selecione ao menos uma publicação com direitos confirmados.");
      }
    }
    const result = await db.query(
      `UPDATE instagram_storefront_settings
       SET enabled = ?, title = ?, subtitle = ?, layout = ?,
           columns_count = ?, show_captions = ?, show_hashtags = ?,
           max_items = ?, theme = ?, updated_at = NOW()
       WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [
        data.enabled ? 1 : 0,
        data.title,
        data.subtitle || null,
        data.layout,
        data.columnsCount,
        data.showCaptions ? 1 : 0,
        data.showHashtags ? 1 : 0,
        data.maxItems,
        data.theme,
        storefront.id,
        context.tenantId,
      ],
    );
    const affected = Number((result as { affectedRows?: number })?.affectedRows || 0);
    if (!affected) throw new Error("A vitrine não pertence a esta loja ou já foi excluída.");
    return { ok: true as const, slug: storefront.slug };
  });

export const deleteInstagramStorefront = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { default: db } = await import("./db");
    const storefront = await getActiveStorefrontSettings(context.tenantId);
    if (!storefront?.id) {
      throw new Error("Não há vitrine ativa para excluir.");
    }
    const retiredSlug = retireStorefrontSlug(storefront.slug, storefront.id);
    const result = await db.query(
      `UPDATE instagram_storefront_settings
       SET enabled = 0,
           deleted_at = NOW(),
           deleted_by = ?,
           slug = ?,
           updated_at = NOW()
       WHERE id = ? AND tenant_id = ? AND deleted_at IS NULL`,
      [context.userId || context.tenantId, retiredSlug, storefront.id, context.tenantId],
    );
    const affected = Number((result as { affectedRows?: number })?.affectedRows || 0);
    if (!affected) {
      throw new Error("A vitrine não pertence a esta loja ou já foi excluída.");
    }
    const { recordAudit } = await import("./audit.functions");
    await recordAudit({
      userId: context.tenantId,
      action: "instagram_storefront.delete",
      entityType: "instagram_storefront_settings",
      entityId: storefront.id,
      metadata: {
        previousSlug: storefront.slug,
        retiredSlug,
        policy: "logical_delete_keep_media_and_instagram_connection",
      },
    });
    return { ok: true as const, previousSlug: storefront.slug };
  });

export const getPublicInstagramStorefront = createServerFn({ method: "GET" })
  .validator((data) =>
    z
      .object({
        slug: z
          .string()
          .trim()
          .min(3)
          .max(120)
          .regex(/^[a-z0-9-]+$/),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { default: db } = await import("./db");
    const settingsRows = (await db.query(
      `SELECT iss.tenant_id, iss.slug, iss.title, iss.subtitle, iss.layout,
              iss.columns_count, iss.show_captions, iss.show_hashtags,
              iss.max_items, iss.theme, p.company_name, p.display_name
       FROM instagram_storefront_settings iss
       LEFT JOIN profiles p ON p.id = iss.tenant_id
       WHERE iss.slug = ? AND iss.enabled = 1 AND iss.deleted_at IS NULL
       LIMIT 1`,
      [data.slug],
    )) as Array<
      StorefrontRow & {
        company_name: string | null;
        display_name: string | null;
      }
    >;
    const settings = settingsRows[0];
    if (!settings) return null;
    const tenantId = String(settings.tenant_id);
    const mediaRows = (await db.query(
      `SELECT ipm.id, ipm.provider_media_id, ipm.media_type, ipm.media_url,
              ipm.thumbnail_url, ipm.permalink, ipm.caption, ipm.username,
              ipm.provider_timestamp, ipm.children_json, iph.hashtag
       FROM instagram_public_media ipm
       JOIN instagram_public_hashtags iph
         ON iph.id = ipm.hashtag_record_id AND iph.tenant_id = ipm.tenant_id
       WHERE ipm.tenant_id = ?
         AND ipm.selected = 1
         AND ipm.rights_confirmed_at IS NOT NULL
         AND ipm.expires_at > NOW()
       ORDER BY ipm.display_order ASC, ipm.fetched_at DESC
       LIMIT ?`,
      [tenantId, Number(settings.max_items || 12)],
    )) as MediaRow[];
    return {
      store: {
        name: settings.company_name || settings.display_name || "Loja",
        title: settings.title,
        subtitle: settings.subtitle,
        layout: settings.layout,
        columnsCount: settings.columns_count,
        showCaptions: Boolean(settings.show_captions),
        showHashtags: Boolean(settings.show_hashtags),
        theme: settings.theme,
      },
      media: mediaRows.map((row) => ({
        ...row,
        children_json: parseJson<MediaChild[]>(row.children_json, []),
      })),
    };
  });
