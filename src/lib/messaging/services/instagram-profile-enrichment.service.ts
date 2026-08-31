"use server";

import db from "@/lib/db";

export interface InstagramProfile {
  /** Human-readable name from the Instagram User Profile API. */
  name: string | null;
  /** Instagram handle (@username) when available. */
  username: string | null;
  /** Temporary URL for the customer's profile picture. */
  profilePic: string | null;
}

interface InstagramApiResponse {
  name?: string;
  username?: string;
  profile_pic?: string;
}

function safeJsonParse(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  try {
    return JSON.parse(typeof value === "string" ? value : JSON.stringify(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeVersion(version?: string): string {
  const v = version || process.env.META_GRAPH_VERSION || "v26.0";
  return v.startsWith("v") ? v : `v${v}`;
}

/**
 * Isolated Instagram profile enrichment service.
 *
 * Uses the official Instagram User Profile API:
 * https://graph.facebook.com/{version}/{igsid}?fields=name,username,profile_pic
 * with a Page Access Token in the Authorization header.
 *
 * Failures are non-critical and never throw to the caller; the return value is
 * `null` so the inbound message flow can continue with initials fallback.
 */
export class InstagramProfileEnrichmentService {
  constructor(private readonly graphVersion?: string) {}

  async fetchProfile(igsid: string, accessToken: string): Promise<InstagramProfile | null> {
    if (!igsid || !accessToken) return null;
    const version = normalizeVersion(this.graphVersion);
    const url = `https://graph.facebook.com/${version}/${encodeURIComponent(igsid)}?fields=name,username,profile_pic`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as InstagramApiResponse;
      return {
        name: data.name ?? data.username ?? null,
        username: data.username ?? null,
        profilePic: data.profile_pic ?? null,
      };
    } catch {
      return null;
    }
  }

  /**
   * Persist safe profile fields to the contact identity record for an Instagram
   * IGSID. This is a no-op when the identity does not exist so it cannot create
   * orphan records or cross tenant boundaries.
   */
  async persistToContactIdentity(
    tenantId: string,
    igsid: string,
    profile: InstagramProfile | null,
  ): Promise<void> {
    if (!profile || (!profile.profilePic && !profile.username)) return;

    const [rows] = await db.query(
      `SELECT id, metadata FROM contact_identities
       WHERE tenant_id = ? AND provider = 'instagram' AND external_id = ?
       LIMIT 1`,
      [tenantId, igsid],
    );

    const existing = (rows as Array<{ id: string; metadata: unknown }>)?.[0];
    if (!existing) return;

    const currentMetadata = safeJsonParse(existing.metadata) ?? {};
    const metadata = {
      ...currentMetadata,
      avatar_source: "instagram_user_profile_api",
      avatar_updated_at: new Date().toISOString(),
    };

    await db.query(
      `UPDATE contact_identities
       SET username = COALESCE(?, username),
           avatar_url = COALESCE(?, avatar_url),
           metadata = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [profile.username, profile.profilePic, JSON.stringify(metadata), existing.id],
    );
  }
}
