import { beforeAll, afterAll, describe, expect, test } from "@jest/globals";
import { randomUUID } from "crypto";
import db from "@/lib/db";
import { createWebchatSession, getWebchatSessionByToken } from "@/lib/webchat/session.service";

const TENANT_ID = "webchat-test-tenant";
const CHANNEL_ID = "webchat-test-channel";
const WIDGET_ID = "webchat-test-widget";
const PUBLIC_ID = "webchat-test-public";
const ORIGIN = "http://localhost:3000";

describe("WebChat Session", () => {
  beforeAll(async () => {
    await db.query(`DELETE FROM webchat_sessions WHERE widget_id = ?`, [WIDGET_ID]);
    await db.query(`DELETE FROM webchat_widgets WHERE id = ?`, [WIDGET_ID]);
    await db.query(`DELETE FROM channel_connections WHERE id = ?`, [CHANNEL_ID]);
    await db.query(`DELETE FROM users WHERE id = ?`, [TENANT_ID]);

    await db.query(
      `INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`,
      [TENANT_ID, "webchat-test@example.com", "test"],
    );
    await db.query(
      `INSERT INTO channel_connections (id, tenant_id, provider, status, external_account_id, display_name)
       VALUES (?, ?, 'webchat', 'active', ?, 'WebChat Test')`,
      [CHANNEL_ID, TENANT_ID, "webchat-ext-" + PUBLIC_ID],
    );
    await db.query(
      `INSERT INTO webchat_widgets (id, tenant_id, channel_connection_id, public_id, enabled, title, allowed_origins)
       VALUES (?, ?, ?, ?, 1, 'Test Chat', ?)`,
      [WIDGET_ID, TENANT_ID, CHANNEL_ID, PUBLIC_ID, JSON.stringify([ORIGIN])],
    );
  });

  afterAll(async () => {
    await db.query(`DELETE FROM webchat_sessions WHERE widget_id = ?`, [WIDGET_ID]);
    await db.query(`DELETE FROM webchat_widgets WHERE id = ?`, [WIDGET_ID]);
    await db.query(`DELETE FROM channel_connections WHERE id = ?`, [CHANNEL_ID]);
    await db.query(`DELETE FROM users WHERE id = ?`, [TENANT_ID]);
  });

  test("creates a new session with a raw token not stored in DB", async () => {
    const { sessionToken, session } = await createWebchatSession(PUBLIC_ID, undefined, ORIGIN);

    expect(sessionToken).toBeTruthy();
    expect(sessionToken.length).toBeGreaterThanOrEqual(32);
    expect(session.visitorId).toBeTruthy();
    expect(session.tenantId).toBe(TENANT_ID);
    expect(session.channelConnectionId).toBe(CHANNEL_ID);

    const rows = (await db.query(
      `SELECT token_hash FROM webchat_sessions WHERE id = ?`,
      [session.id],
    )) as any[];

    expect(rows[0].token_hash).not.toBe(sessionToken);
    expect(rows[0].token_hash).toHaveLength(64); // SHA-256 hex
  });

  test("resumes a session with the same visitorId and a rotated token", async () => {
    const visitorId = randomUUID();
    const first = await createWebchatSession(PUBLIC_ID, visitorId, ORIGIN);
    const second = await createWebchatSession(PUBLIC_ID, visitorId, ORIGIN);

    expect(first.session.visitorId).toBe(second.session.visitorId);
    expect(first.sessionToken).not.toBe(second.sessionToken);

    // Old token should be invalid
    const old = await getWebchatSessionByToken(PUBLIC_ID, first.sessionToken, ORIGIN);
    expect(old).toBeNull();

    // New token should work
    const current = await getWebchatSessionByToken(PUBLIC_ID, second.sessionToken, ORIGIN);
    expect(current?.id).toBe(second.session.id);
  });

  test("rejects wrong origin", async () => {
    await expect(createWebchatSession(PUBLIC_ID, undefined, "https://evil.com")).rejects.toThrow(/Origin/);
  });

  test("rejects disabled widget", async () => {
    const disabledPublic = "webchat-test-disabled";
    const disabledWidget = "webchat-test-disabled-widget";
    const disabledChannel = "webchat-test-disabled-channel";
    await db.query(`DELETE FROM webchat_widgets WHERE id = ?`, [disabledWidget]);
    await db.query(`DELETE FROM channel_connections WHERE id = ?`, [disabledChannel]);
    await db.query(
      `INSERT INTO channel_connections (id, tenant_id, provider, status, external_account_id, display_name)
       VALUES (?, ?, 'webchat', 'active', ?, 'Disabled Channel')`,
      [disabledChannel, TENANT_ID, "webchat-ext-disabled"],
    );
    await db.query(
      `INSERT INTO webchat_widgets (id, tenant_id, channel_connection_id, public_id, enabled, title)
       VALUES (?, ?, ?, ?, 0, 'Disabled')`,
      [disabledWidget, TENANT_ID, disabledChannel, disabledPublic],
    );
    await expect(createWebchatSession(disabledPublic, undefined, ORIGIN)).rejects.toThrow(/disabled/);
    await db.query(`DELETE FROM webchat_widgets WHERE id = ?`, [disabledWidget]);
    await db.query(`DELETE FROM channel_connections WHERE id = ?`, [disabledChannel]);
  });

  test("rejects invalid token", async () => {
    const session = await getWebchatSessionByToken(PUBLIC_ID, "not-a-token", ORIGIN);
    expect(session).toBeNull();
  });
});
