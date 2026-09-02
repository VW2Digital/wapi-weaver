import { afterAll, beforeAll, describe, expect, jest, test } from "@jest/globals";
import { randomUUID, createHash } from "crypto";
import db from "@/lib/db";
import {
  sanitizeColor,
  sanitizeUrl,
  buildFrameAncestors,
  isOriginAllowed,
} from "@/routes/api/public/webchat.$publicId.iframe";
import { createWebchatSession, getWebchatSessionByToken } from "@/lib/webchat/session.service";

const counters = new Map<string, number>();

jest.mock("@/lib/cache", () => ({
  redis: {
    incr: jest.fn(async (key: string) => {
      const next = (counters.get(key) || 0) + 1;
      counters.set(key, next);
      return next;
    }),
    expire: jest.fn(async () => 1),
    publish: jest.fn(async () => 1),
  },
}));

describe("WebChat Step 3 — accent color sanitization (XSS)", () => {
  test.each([
    ["#0ea5e9", "#0ea5e9"],
    ["#FFF", "#FFF"],
    ["  #abc123  ", "#abc123"],
  ])("accepts the valid hex color %s", (input, expected) => {
    expect(sanitizeColor(input)).toBe(expected);
  });

  test.each([
    "';alert(1);//",
    "red; } body { background: url(http://evil) } .x {",
    "javascript:alert(1)",
    "</script><script>alert(1)</script>",
    "#0ea5e9; background-image: url(http://evil)",
    "rgb(1,2,3)",
    "expression(alert(1))",
  ])("falls back to the default for the hostile value %p", (input) => {
    expect(sanitizeColor(input)).toBe("#0ea5e9");
  });

  test("falls back for null and undefined", () => {
    expect(sanitizeColor(null)).toBe("#0ea5e9");
    expect(sanitizeColor(undefined)).toBe("#0ea5e9");
  });

  test("a sanitized color can never break out of a JS string literal", () => {
    const hostile = "';alert(document.domain);//";
    const serialized = JSON.stringify(sanitizeColor(hostile));
    expect(serialized).toBe('"#0ea5e9"');
    expect(serialized).not.toContain("alert");
  });
});

describe("WebChat Step 3 — avatar URL sanitization", () => {
  test.each(["https://cdn.example.com/a.png", "/api/storage/file?path=x", "http://localhost/a.png"])(
    "accepts the safe URL %s",
    (input) => {
      expect(sanitizeUrl(input)).toBe(input);
    },
  );

  test.each([
    "javascript:alert(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "vbscript:msgbox(1)",
  ])("rejects the dangerous scheme %p", (input) => {
    expect(sanitizeUrl(input)).toBe("");
  });

  test("rejects null and empty values", () => {
    expect(sanitizeUrl(null)).toBe("");
    expect(sanitizeUrl("   ")).toBe("");
  });
});

describe("WebChat Step 3 — CSP frame-ancestors", () => {
  test("uses the configured origins instead of the request Origin", () => {
    const csp = buildFrameAncestors(["https://empresa.com.br", "https://www.empresa.com.br"]);
    expect(csp).toBe("frame-ancestors 'self' https://empresa.com.br https://www.empresa.com.br;");
    expect(csp).not.toContain("*");
  });

  test("normalizes configured origins to protocol + host", () => {
    expect(buildFrameAncestors(["https://empresa.com.br/algum/caminho"])).toBe(
      "frame-ancestors 'self' https://empresa.com.br;",
    );
  });

  test("drops invalid entries", () => {
    expect(buildFrameAncestors(["not a url", "javascript:alert(1)"])).toBe("frame-ancestors *;");
  });

  test("an attacker-controlled Origin can never widen the policy", () => {
    const csp = buildFrameAncestors(["https://empresa.com.br"]);
    expect(csp).not.toContain("evil");
  });
});

describe("WebChat Step 3 — origin allow-list matching", () => {
  const allowed = ["https://empresa.com.br"];

  test("accepts the exact origin", () => {
    expect(isOriginAllowed(allowed, "https://empresa.com.br")).toBe(true);
  });

  test.each([
    "https://empresa.com.br.evil.com",
    "https://evil-empresa.com.br",
    "https://empresa.com.br.attacker.io",
    "http://empresa.com.br",
    "https://sub.empresa.com.br",
  ])("rejects the look-alike origin %s", (origin) => {
    expect(isOriginAllowed(allowed, origin)).toBe(false);
  });

  test("rejects a null origin", () => {
    expect(isOriginAllowed(allowed, null)).toBe(false);
  });
});

describe("WebChat Step 3 — session hardening", () => {
  const tenantId = randomUUID();
  const channelId = randomUUID();
  const widgetId = randomUUID();
  const publicId = randomUUID().replace(/-/g, "").slice(0, 20);
  const ORIGIN = "https://allowed.example.com";
  let sessionToken = "";

  beforeAll(async () => {
    await db.query(`INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)`, [
      tenantId,
      `${tenantId}@test.local`,
      "test",
    ]);
    await db.query(
      `INSERT INTO channel_connections (id, tenant_id, provider, status, external_account_id, display_name)
       VALUES (?, ?, 'webchat', 'active', ?, 'Hardening')`,
      [channelId, tenantId, `ext-${publicId}`],
    );
    await db.query(
      `INSERT INTO webchat_widgets (id, tenant_id, channel_connection_id, public_id, enabled, title, allowed_origins)
       VALUES (?, ?, ?, ?, 1, 'Hardening', ?)`,
      [widgetId, tenantId, channelId, publicId, JSON.stringify([ORIGIN])],
    );

    const created = await createWebchatSession(publicId, undefined, ORIGIN);
    sessionToken = created.sessionToken;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM webchat_sessions WHERE tenant_id = ?`, [tenantId]);
    await db.query(`DELETE FROM webchat_widgets WHERE id = ?`, [widgetId]);
    await db.query(`DELETE FROM channel_connections WHERE id = ?`, [channelId]);
    await db.query(`DELETE FROM users WHERE id = ?`, [tenantId]);
  });

  test("the database stores only the SHA-256 hash, never the raw token", async () => {
    const rows = (await db.query(`SELECT token_hash FROM webchat_sessions WHERE tenant_id = ?`, [
      tenantId,
    ])) as any[];

    expect(rows.length).toBe(1);
    expect(rows[0].token_hash).toBe(createHash("sha256").update(sessionToken).digest("hex"));
    expect(rows[0].token_hash).not.toBe(sessionToken);
  });

  test("the raw token appears in no column of the session row", async () => {
    const rows = (await db.query(`SELECT * FROM webchat_sessions WHERE tenant_id = ?`, [
      tenantId,
    ])) as any[];
    expect(JSON.stringify(rows[0])).not.toContain(sessionToken);
  });

  test("a look-alike origin cannot create a session", async () => {
    await expect(
      createWebchatSession(publicId, undefined, "https://allowed.example.com.evil.com"),
    ).rejects.toThrow(/Origin not allowed/);
  });

  test("a look-alike origin cannot resume a session", async () => {
    const session = await getWebchatSessionByToken(
      publicId,
      sessionToken,
      "https://allowed.example.com.evil.com",
    );
    expect(session).toBeNull();
  });

  test("a forged token is rejected", async () => {
    const session = await getWebchatSessionByToken(publicId, "forged-token", ORIGIN);
    expect(session).toBeNull();
  });

  test("a valid token from another widget's publicId is rejected", async () => {
    const session = await getWebchatSessionByToken("some-other-public-id", sessionToken, ORIGIN);
    expect(session).toBeNull();
  });

  test("an expired session is rejected", async () => {
    await db.query(
      `UPDATE webchat_sessions SET expires_at = DATE_SUB(NOW(), INTERVAL 1 DAY) WHERE tenant_id = ?`,
      [tenantId],
    );
    expect(await getWebchatSessionByToken(publicId, sessionToken, ORIGIN)).toBeNull();

    await db.query(
      `UPDATE webchat_sessions SET expires_at = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE tenant_id = ?`,
      [tenantId],
    );
    expect(await getWebchatSessionByToken(publicId, sessionToken, ORIGIN)).not.toBeNull();
  });

  test("a revoked (closed) session is rejected", async () => {
    await db.query(`UPDATE webchat_sessions SET status = 'closed' WHERE tenant_id = ?`, [tenantId]);
    expect(await getWebchatSessionByToken(publicId, sessionToken, ORIGIN)).toBeNull();

    await db.query(`UPDATE webchat_sessions SET status = 'active' WHERE tenant_id = ?`, [tenantId]);
  });

  test("a disabled widget blocks session resume", async () => {
    await db.query(`UPDATE webchat_widgets SET enabled = 0 WHERE id = ?`, [widgetId]);
    expect(await getWebchatSessionByToken(publicId, sessionToken, ORIGIN)).toBeNull();

    await db.query(`UPDATE webchat_widgets SET enabled = 1 WHERE id = ?`, [widgetId]);
  });

  test("a disabled widget blocks new sessions", async () => {
    await db.query(`UPDATE webchat_widgets SET enabled = 0 WHERE id = ?`, [widgetId]);
    await expect(createWebchatSession(publicId, undefined, ORIGIN)).rejects.toThrow(
      /not found or disabled/,
    );

    await db.query(`UPDATE webchat_widgets SET enabled = 1 WHERE id = ?`, [widgetId]);
  });
});
