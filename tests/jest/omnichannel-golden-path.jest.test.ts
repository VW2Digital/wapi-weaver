import { beforeEach, describe, expect, jest, test } from "@jest/globals";

/**
 * OMNICHANNEL GOLDEN PATH
 *
 * Mandatory regression gate for any change to chat.tsx, chat.functions.ts,
 * chat-outbox.server.ts, messaging/outbound/**, channel routing, conversation
 * service or message service.
 *
 * Proves that WhatsApp and Instagram both send in the SAME build, each through
 * its own channel connection, with the channel credential decrypted before it
 * reaches the provider API.
 */

const WA_CHANNEL_ID = "wa-channel-1";
const IG_CHANNEL_ID = "ig-channel-1";
const TENANT_ID = "tenant-1";

const WA_PLAINTEXT_TOKEN = "WA_PLAINTEXT_TOKEN";
const IG_PLAINTEXT_TOKEN = "IG_PLAINTEXT_TOKEN";

// Shape produced by encryptMetaCredential: iv:ciphertext:authTag (all hex).
const WA_ENCRYPTED_TOKEN =
  "ecbe6123a0df6bcefc4b75cd:bcdb0e1d18405ddfa12ad4e3f4dda3986:4db680bdce77e41dc21e8b6673230ce6";
const IG_ENCRYPTED_TOKEN =
  "20410439da1171a497d486be:dc0822fc863207897d0883f3c2f8e7e1:9d393c7d3abb18087a7f06f2a1c45fad";

const channelRows: Record<string, any> = {
  [WA_CHANNEL_ID]: {
    id: WA_CHANNEL_ID,
    tenant_id: TENANT_ID,
    meta_app_connection_id: "meta-app-1",
    provider: "whatsapp",
    status: "active",
    external_account_id: "1107720082434785",
    display_name: "WhatsApp",
    metadata: { graphVersion: "v26.0" },
    access_token_encrypted: WA_ENCRYPTED_TOKEN,
  },
  [IG_CHANNEL_ID]: {
    id: IG_CHANNEL_ID,
    tenant_id: TENANT_ID,
    meta_app_connection_id: "meta-app-1",
    provider: "instagram",
    status: "active",
    external_account_id: "17841402223701464",
    display_name: "Instagram",
    metadata: null,
    access_token_encrypted: IG_ENCRYPTED_TOKEN,
  },
};

jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: {
    query: async (_sql: string, params: unknown[]) => {
      const row = channelRows[String((params as any[])?.[0])];
      return row ? [row] : [];
    },
  },
}));

jest.mock("@/lib/encryption", () => ({
  __esModule: true,
  decryptMetaCredential: (value: string) => {
    if (value === WA_ENCRYPTED_TOKEN) return WA_PLAINTEXT_TOKEN;
    if (value === IG_ENCRYPTED_TOKEN) return IG_PLAINTEXT_TOKEN;
    throw new Error("Unsupported state or unable to authenticate data");
  },
}));

import { providerDispatcher } from "../../src/lib/messaging/outbound/provider-dispatcher";

type FetchCall = { url: string; init: any };

let fetchCalls: FetchCall[] = [];
let failingProvider: "whatsapp" | "instagram" | null = null;

function installFetch() {
  fetchCalls = [];
  (global as any).fetch = jest.fn(async (url: string, init: any) => {
    fetchCalls.push({ url, init });
    const isWhatsApp = url.includes("/1107720082434785/messages");
    const provider = isWhatsApp ? "whatsapp" : "instagram";

    if (failingProvider === provider) {
      return {
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: { message: "Invalid OAuth access token" } }),
      } as unknown as Response;
    }

    return {
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify(
          isWhatsApp
            ? { messages: [{ id: "wamid.GOLDEN" }] }
            : { message_id: "ig.GOLDEN", recipient_id: "1086930670737976" },
        ),
    } as unknown as Response;
  });
}

function waContext(messageId: string) {
  return {
    tenantId: TENANT_ID,
    userId: TENANT_ID,
    messageId,
    conversationId: "conv-wa",
    channelConnectionId: WA_CHANNEL_ID,
    provider: "whatsapp" as const,
    contactPhone: "559185646076",
    providerRecipientId: "559185646076",
    type: "text",
    payload: { type: "text", text: { body: "wa reply" } },
    metadata: null,
  };
}

function igContext(messageId: string) {
  return {
    tenantId: TENANT_ID,
    userId: TENANT_ID,
    messageId,
    conversationId: "conv-ig",
    channelConnectionId: IG_CHANNEL_ID,
    provider: "instagram" as const,
    contactPhone: "ig_1086930670737976",
    providerRecipientId: "1086930670737976",
    type: "text",
    payload: { type: "text", text: { body: "ig reply" } },
    metadata: null,
  };
}

function authHeaderFor(index: number): string {
  return String(fetchCalls[index].init.headers.Authorization);
}

beforeEach(() => {
  failingProvider = null;
  installFetch();
});

describe("OMNICHANNEL GOLDEN PATH — credential resolution", () => {
  test("WhatsApp outbound decrypts the channel token before calling Meta", async () => {
    const result = await providerDispatcher.dispatch(waContext("m-wa"));

    expect(result.providerMessageId).toBe("wamid.GOLDEN");
    expect(authHeaderFor(0)).toBe(`Bearer ${WA_PLAINTEXT_TOKEN}`);
    expect(authHeaderFor(0)).not.toContain(":");
  });

  test("Instagram outbound decrypts the channel token before calling Meta", async () => {
    const result = await providerDispatcher.dispatch(igContext("m-ig"));

    expect(result.providerMessageId).toBe("ig.GOLDEN");
    expect(authHeaderFor(0)).toBe(`Bearer ${IG_PLAINTEXT_TOKEN}`);
    expect(authHeaderFor(0)).not.toContain(":");
  });
});

describe("OMNICHANNEL GOLDEN PATH — channel isolation", () => {
  test("each provider uses its own channel account and token", async () => {
    await providerDispatcher.dispatch(waContext("m-wa"));
    await providerDispatcher.dispatch(igContext("m-ig"));

    expect(fetchCalls[0].url).toContain("/1107720082434785/messages");
    expect(fetchCalls[1].url).toContain("/17841402223701464/messages");
    expect(authHeaderFor(0)).toBe(`Bearer ${WA_PLAINTEXT_TOKEN}`);
    expect(authHeaderFor(1)).toBe(`Bearer ${IG_PLAINTEXT_TOKEN}`);
  });
});

describe("OMNICHANNEL GOLDEN PATH — sequential", () => {
  test("WA -> IG -> WA", async () => {
    const a = await providerDispatcher.dispatch(waContext("m1"));
    const b = await providerDispatcher.dispatch(igContext("m2"));
    const c = await providerDispatcher.dispatch(waContext("m3"));

    expect([a.provider, b.provider, c.provider]).toEqual(["whatsapp", "instagram", "whatsapp"]);
    expect([a.providerMessageId, b.providerMessageId, c.providerMessageId]).toEqual([
      "wamid.GOLDEN",
      "ig.GOLDEN",
      "wamid.GOLDEN",
    ]);
  });

  test("IG -> WA -> IG", async () => {
    const a = await providerDispatcher.dispatch(igContext("m1"));
    const b = await providerDispatcher.dispatch(waContext("m2"));
    const c = await providerDispatcher.dispatch(igContext("m3"));

    expect([a.provider, b.provider, c.provider]).toEqual(["instagram", "whatsapp", "instagram"]);
  });
});

describe("OMNICHANNEL GOLDEN PATH — parallel", () => {
  test("WhatsApp and Instagram send concurrently", async () => {
    const [wa, ig] = await Promise.all([
      providerDispatcher.dispatch(waContext("m-wa")),
      providerDispatcher.dispatch(igContext("m-ig")),
    ]);

    expect(wa.providerMessageId).toBe("wamid.GOLDEN");
    expect(ig.providerMessageId).toBe("ig.GOLDEN");
  });
});

describe("OMNICHANNEL GOLDEN PATH — failure isolation", () => {
  test("WhatsApp failure does not block Instagram", async () => {
    failingProvider = "whatsapp";

    await expect(providerDispatcher.dispatch(waContext("m-wa"))).rejects.toThrow();
    const ig = await providerDispatcher.dispatch(igContext("m-ig"));

    expect(ig.providerMessageId).toBe("ig.GOLDEN");
  });

  test("Instagram failure does not block WhatsApp", async () => {
    failingProvider = "instagram";

    await expect(providerDispatcher.dispatch(igContext("m-ig"))).rejects.toThrow();
    const wa = await providerDispatcher.dispatch(waContext("m-wa"));

    expect(wa.providerMessageId).toBe("wamid.GOLDEN");
  });
});
