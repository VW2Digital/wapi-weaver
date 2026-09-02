import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { readFileSync } from "fs";
import { join } from "path";

const counters = new Map<string, number>();
const expired = new Set<string>();

jest.mock("@/lib/cache", () => ({
  redis: {
    incr: jest.fn(async (key: string) => {
      const next = (counters.get(key) || 0) + 1;
      counters.set(key, next);
      return next;
    }),
    expire: jest.fn(async (key: string) => {
      expired.add(key);
      return 1;
    }),
  },
}));

import {
  checkMessageRateLimit,
  checkSessionCreationRateLimit,
  checkStatusAckRateLimit,
} from "@/lib/webchat/rate-limit.service";

function requestFrom(ip: string): Request {
  return new Request("https://app.example.com/api/public/webchat/w/messages", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

beforeEach(() => {
  counters.clear();
  expired.clear();
});

describe("WebChat Step 3 — status ACK rate limit", () => {
  test("allows a normal burst and then blocks", async () => {
    let allowedCount = 0;
    for (let i = 0; i < 130; i++) {
      if (await checkStatusAckRateLimit("widget-a", "session-1")) allowedCount++;
    }
    expect(allowedCount).toBe(120);
    expect(await checkStatusAckRateLimit("widget-a", "session-1")).toBe(false);
  });

  test("one exhausted session does not block another session", async () => {
    for (let i = 0; i < 130; i++) await checkStatusAckRateLimit("widget-a", "session-1");
    expect(await checkStatusAckRateLimit("widget-a", "session-1")).toBe(false);
    expect(await checkStatusAckRateLimit("widget-a", "session-2")).toBe(true);
  });

  test("one exhausted widget does not block another tenant's widget", async () => {
    for (let i = 0; i < 130; i++) await checkStatusAckRateLimit("widget-tenant-a", "s1");
    expect(await checkStatusAckRateLimit("widget-tenant-a", "s1")).toBe(false);
    expect(await checkStatusAckRateLimit("widget-tenant-b", "s1")).toBe(true);
  });

  test("sets a TTL on the first hit so the window rolls", async () => {
    await checkStatusAckRateLimit("widget-a", "session-1");
    expect(expired.has("webchat:rate:status:widget-a:session-1")).toBe(true);
  });
});

describe("WebChat Step 3 — message rate limit tenant isolation", () => {
  test("the IP bucket is scoped per widget so tenants cannot starve each other", async () => {
    const ip = "203.0.113.10";

    // Exhaust the IP bucket against widget A.
    for (let i = 0; i < 70; i++) {
      await checkMessageRateLimit(`session-a-${i}`, requestFrom(ip), "widget-a");
    }
    expect(await checkMessageRateLimit("session-a-new", requestFrom(ip), "widget-a")).toBe(false);

    // The same IP hitting a different tenant's widget must still be allowed.
    expect(await checkMessageRateLimit("session-b", requestFrom(ip), "widget-b")).toBe(true);
  });

  test("a single session cannot exceed its own quota", async () => {
    const ip = "203.0.113.11";
    let allowed = 0;
    for (let i = 0; i < 70; i++) {
      if (await checkMessageRateLimit("session-fixed", requestFrom(ip), "widget-a")) allowed++;
    }
    expect(allowed).toBe(60);
  });
});

describe("WebChat Step 3 — session creation rate limit", () => {
  test("is scoped per widget and IP", async () => {
    const ip = "203.0.113.12";
    let allowed = 0;
    for (let i = 0; i < 15; i++) {
      if (await checkSessionCreationRateLimit("widget-a", requestFrom(ip))) allowed++;
    }
    expect(allowed).toBe(10);
    expect(await checkSessionCreationRateLimit("widget-b", requestFrom(ip))).toBe(true);
  });
});

describe("WebChat Step 3 — status ACK has no bot or messaging side effects", () => {
  const servicePath = join(
    process.cwd(),
    "src",
    "lib",
    "webchat",
    "message-status.service.ts",
  );
  const source = readFileSync(servicePath, "utf8");

  test.each([
    ["bot trigger", "bot-trigger"],
    ["bot flow executor", "botflow"],
    ["message persistence", "saveMessage"],
    ["conversation creation", "ensureConversation"],
    ["contact creation", "ensureContact"],
    ["outbound dispatch", "providerDispatcher"],
  ])("never imports %s", (_label, needle) => {
    expect(source).not.toContain(needle);
  });

  test.each([
    ["INSERT INTO direct_messages", "INSERT INTO direct_messages"],
    ["INSERT INTO chat_sessions", "INSERT INTO chat_sessions"],
    ["INSERT INTO contacts", "INSERT INTO contacts"],
    ["unread mutation", "is_unread"],
    ["body mutation", "SET body"],
  ])("never performs %s", (_label, needle) => {
    expect(source).not.toContain(needle);
  });

  test("only ever updates direct_messages", () => {
    // Case-sensitive so prose like "status update" is not mistaken for SQL.
    const updateTargets = [...source.matchAll(/\bUPDATE\s+(\w+)/g)].map((m) => m[1]);
    expect(updateTargets.length).toBeGreaterThan(0);
    expect(new Set(updateTargets)).toEqual(new Set(["direct_messages"]));
  });

  test("every status update is scoped by tenant and conversation", () => {
    expect(source).toContain("AND tenant_id = ?");
    expect(source).toContain("AND conversation_id = ?");
    expect(source).toContain("AND channel_connection_id = ?");
    expect(source).toContain("AND direction = 'outgoing'");
    expect(source).toContain("AND channel = 'webchat'");
  });
});
