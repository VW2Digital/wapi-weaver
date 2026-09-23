import db from "@/lib/db";
import { decryptMetaCredential } from "@/lib/encryption";

export type OfficialTemplateAccount = {
  wabaId: string;
  accessToken: string;
  appId: string;
  graphVersion: string;
  source: "channel_connection" | "profiles";
  phoneNumberId: string | null;
};

function normalizeGraphVersion(value: unknown): string {
  const raw = String(value || process.env.META_GRAPH_VERSION || "v26.0").trim();
  const withV = raw.startsWith("v") ? raw : `v${raw}`;
  if (/^v2[4-6]\.\d+$/.test(withV)) return withV;
  return "v26.0";
}

function parseMeta(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? (raw as Record<string, any>) : {};
}

function isEvolution(meta: Record<string, any>): boolean {
  const blob = JSON.stringify(meta).toLowerCase();
  return (
    blob.includes("evolution") ||
    meta.provider === "evolution" ||
    meta.api_type === "evolution" ||
    meta.stack === "evolution"
  );
}

export async function resolveOfficialWhatsAppTemplateAccount(
  tenantId: string,
): Promise<OfficialTemplateAccount | null> {
  const channels = (await db.query(
    `SELECT cc.external_account_id, cc.metadata, cc.access_token_encrypted, cc.status,
            mac.app_id, mac.graph_version
       FROM channel_connections cc
       INNER JOIN meta_app_connections mac
         ON mac.id = cc.meta_app_connection_id AND mac.tenant_id = cc.tenant_id
      WHERE cc.tenant_id = ?
        AND cc.provider = 'whatsapp'
        AND mac.status = 'active'
      ORDER BY cc.updated_at DESC
      LIMIT 8`,
    [tenantId],
  )) as Array<{
    external_account_id: string;
    metadata: unknown;
    access_token_encrypted: string | null;
    status: string;
    app_id: string;
    graph_version: string | null;
  }>;

  for (const row of channels) {
    const metadata = parseMeta(row.metadata);
    if (isEvolution(metadata)) continue;
    const wabaId = String(metadata.waba_id || metadata.whatsapp_waba_id || "").trim();
    if (!wabaId || !/^\d{10,20}$/.test(wabaId)) continue;
    if (!row.access_token_encrypted) continue;
    let accessToken = "";
    try {
      accessToken = decryptMetaCredential(row.access_token_encrypted);
    } catch {
      continue;
    }
    if (!accessToken) continue;
    return {
      wabaId,
      accessToken,
      appId: String(row.app_id || "").trim(),
      graphVersion: normalizeGraphVersion(row.graph_version),
      source: "channel_connection",
      phoneNumberId: row.external_account_id || null,
    };
  }

  const profiles = (await db.query(
    `SELECT whatsapp_waba_id, whatsapp_access_token, whatsapp_app_id, whatsapp_phone_number_id, meta_graph_version
       FROM profiles
      WHERE id = ?
      LIMIT 1`,
    [tenantId],
  )) as Array<{
    whatsapp_waba_id: string | null;
    whatsapp_access_token: string | null;
    whatsapp_app_id: string | null;
    whatsapp_phone_number_id: string | null;
    meta_graph_version: string | null;
  }>;
  const profile = profiles[0];
  const wabaId = String(profile?.whatsapp_waba_id || "").trim();
  const accessToken = String(profile?.whatsapp_access_token || "").trim();
  if (!wabaId || !accessToken) return null;
  if (!/^\d{10,20}$/.test(wabaId)) return null;
  return {
    wabaId,
    accessToken,
    appId: String(profile?.whatsapp_app_id || "").trim(),
    graphVersion: normalizeGraphVersion(profile?.meta_graph_version),
    source: "profiles",
    phoneNumberId: profile?.whatsapp_phone_number_id || null,
  };
}
