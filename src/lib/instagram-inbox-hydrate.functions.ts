import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import db from "@/lib/db";
import {
  listChannelConnectionsForTenant,
  resolveChannelAccessToken,
} from "@/lib/messaging/channel-connection.service";
import { InstagramProfileEnrichmentService } from "@/lib/messaging/services/instagram-profile-enrichment.service";
import { isInstagramPlaceholderName } from "@/lib/messaging/services/contact-display.service";

export interface InstagramInboxHydrateItem {
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  lastMessageTime: string | null;
}

function parseJson(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveIgsid(row: {
  instagram_id?: string | null;
  external_id?: string | null;
  identity_external_id?: string | null;
  phone_e164?: string | null;
}): string | null {
  const fromIdentity = asString(row.identity_external_id);
  if (fromIdentity) return fromIdentity.replace(/^ig_/, "");
  const fromContact = asString(row.instagram_id) || asString(row.external_id);
  if (fromContact) return fromContact.replace(/^ig_/, "");
  const phone = asString(row.phone_e164);
  if (phone?.startsWith("ig_")) return phone.slice(3);
  return null;
}

const GRAPH_BATCH = 8;

export const hydrateInstagramInboxContacts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((input) =>
    z
      .object({
        contactIds: z.array(z.string().uuid()).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const tenantId = context.tenantId || context.userId;
    const ids = [...new Set(data.contactIds)];
    const result: Record<string, InstagramInboxHydrateItem> = {};
    if (ids.length === 0) return result;

    const placeholders = ids.map(() => "?").join(",");
    const rows = (await db.query(
      `SELECT
         c.id,
         c.name,
         c.phone_e164,
         c.instagram_id,
         c.external_id,
         c.custom_fields,
         c.last_interaction_at,
         ci.external_id AS identity_external_id,
         ci.username AS identity_username,
         ci.avatar_url AS identity_avatar_url,
         ci.metadata AS identity_metadata
       FROM contacts c
       LEFT JOIN contact_identities ci
         ON ci.contact_id = c.id AND ci.provider = 'instagram'
       WHERE c.channel = 'instagram'
         AND (c.tenant_id = ? OR c.user_id = ?)
         AND c.id IN (${placeholders})`,
      [tenantId, tenantId, ...ids],
    )) as Array<{
      id: string;
      name: string | null;
      phone_e164: string | null;
      instagram_id: string | null;
      external_id: string | null;
      custom_fields: unknown;
      last_interaction_at: string | Date | null;
      identity_external_id: string | null;
      identity_username: string | null;
      identity_avatar_url: string | null;
      identity_metadata: unknown;
    }>;

    const lastByContact = (await db.query(
      `SELECT contact_id, MAX(created_at) AS last_at
       FROM direct_messages
       WHERE (tenant_id = ? OR user_id = ?)
         AND contact_id IN (${placeholders})
       GROUP BY contact_id`,
      [tenantId, tenantId, ...ids],
    )) as Array<{ contact_id: string; last_at: string | Date | null }>;
    const lastMap = new Map(
      lastByContact.map((row) => [row.contact_id, row.last_at ? new Date(row.last_at).toISOString() : null]),
    );

    const phones = rows.map((row) => row.phone_e164).filter((phone): phone is string => Boolean(phone));
    if (phones.length > 0) {
      const phonePlaceholders = phones.map(() => "?").join(",");
      const lastByPhone = (await db.query(
        `SELECT contact_phone, MAX(created_at) AS last_at
         FROM direct_messages
         WHERE (tenant_id = ? OR user_id = ?)
           AND contact_phone IN (${phonePlaceholders})
         GROUP BY contact_phone`,
        [tenantId, tenantId, ...phones],
      )) as Array<{ contact_phone: string; last_at: string | Date | null }>;
      const phoneLast = new Map(
        lastByPhone.map((row) => [row.contact_phone, row.last_at ? new Date(row.last_at).toISOString() : null]),
      );
      for (const row of rows) {
        if (row.phone_e164 && phoneLast.get(row.phone_e164) && !lastMap.get(row.id)) {
          lastMap.set(row.id, phoneLast.get(row.phone_e164) ?? null);
        }
      }
    }

    const needsGraph: typeof rows = [];

    for (const row of rows) {
      const custom = parseJson(row.custom_fields);
      const identityMeta = parseJson(row.identity_metadata);
      const username =
        asString(row.identity_username) ||
        asString(custom.instagram_username) ||
        asString(identityMeta.instagram_username);
      const profileName =
        asString(custom.instagram_profile_name) ||
        asString(identityMeta.instagram_profile_name) ||
        asString(identityMeta.raw_name);
      const storedName = asString(row.name);
      const name =
        profileName && !isInstagramPlaceholderName(profileName)
          ? profileName
          : storedName && !isInstagramPlaceholderName(storedName)
            ? storedName
            : username
              ? `@${username}`
              : null;
      const avatarUrl =
        asString(row.identity_avatar_url) ||
        asString(custom.avatar_url) ||
        asString(identityMeta.avatar_url);
      const lastMessageTime =
        lastMap.get(row.id) ||
        (row.last_interaction_at ? new Date(row.last_interaction_at).toISOString() : null);

      result[row.id] = { name, username, avatarUrl, lastMessageTime };

      if (!name || !avatarUrl) needsGraph.push(row);
    }

    if (needsGraph.length === 0) return result;

    const channels = await listChannelConnectionsForTenant(tenantId, "instagram");
    const active = channels.find((channel) => channel.status === "active") ?? channels[0];
    if (!active) return result;

    let accessToken = "";
    try {
      accessToken = resolveChannelAccessToken(active);
    } catch {
      return result;
    }

    const graphRows = (await db.query(
      `SELECT graph_version FROM meta_app_connections WHERE id = ? LIMIT 1`,
      [active.metaAppConnectionId],
    )) as Array<{ graph_version?: string | null }>;
    const service = new InstagramProfileEnrichmentService(graphRows[0]?.graph_version || "v26.0");

    for (const row of needsGraph.slice(0, GRAPH_BATCH)) {
      const igsid = resolveIgsid(row);
      if (!igsid) continue;
      const profile = await service.fetchProfile(igsid, accessToken);
      if (!profile) continue;

      const displayName = asString(profile.name) || asString(profile.username);
      const username = asString(profile.username) || result[row.id]?.username || null;
      const avatarUrl = asString(profile.profilePic) || result[row.id]?.avatarUrl || null;
      const name =
        (displayName && !isInstagramPlaceholderName(displayName) ? displayName : null) ||
        (username ? `@${username}` : result[row.id]?.name || null);

      result[row.id] = {
        name,
        username,
        avatarUrl,
        lastMessageTime: result[row.id]?.lastMessageTime ?? null,
      };

      const customPatch = {
        instagram_profile_name: asString(profile.name),
        instagram_username: username,
        avatar_url: avatarUrl,
      };

      await db.query(
        `UPDATE contacts
         SET name = CASE
               WHEN name IS NULL OR name = '' OR name LIKE 'Instagram (%' OR name = 'Instagram' THEN COALESCE(?, name)
               ELSE name
             END,
             custom_fields = JSON_MERGE_PATCH(COALESCE(custom_fields, '{}'), ?),
             updated_at = NOW()
         WHERE id = ? AND (tenant_id = ? OR user_id = ?)`,
        [name, JSON.stringify(customPatch), row.id, tenantId, tenantId],
      );

      await db.query(
        `UPDATE contact_identities
         SET username = COALESCE(?, username),
             avatar_url = COALESCE(?, avatar_url),
             metadata = JSON_MERGE_PATCH(COALESCE(metadata, '{}'), ?),
             updated_at = NOW()
         WHERE contact_id = ? AND provider = 'instagram' AND tenant_id = ?`,
        [
          username,
          avatarUrl,
          JSON.stringify({
            instagram_profile_name: asString(profile.name),
            instagram_username: username,
            avatar_source: "instagram_user_profile_api",
          }),
          row.id,
          tenantId,
        ],
      );
    }

    return result;
  });
