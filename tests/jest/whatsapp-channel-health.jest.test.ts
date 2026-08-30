import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { promoteChannelStatusIfHealthy } from "../../src/lib/messaging/services/channel.service";

const mockDb = jest.fn() as jest.Mock<any>;
jest.mock("@/lib/db", () => ({
  __esModule: true,
  default: { query: (...args: any[]) => mockDb(...args) },
}));

jest.mock("@/lib/encryption", () => ({
  __esModule: true,
  decryptMetaCredential: () => "secret",
}));

describe("WhatsApp channel health", () => {
  beforeEach(() => { mockDb.mockReset(); });

  it("promotes pending to active when credentials are present", async () => {
    mockDb
      .mockResolvedValueOnce([{
        id: "WA_CHANNEL_1",
        status: "pending",
        provider: "whatsapp",
        external_account_id: "1107720082434785",
        access_token_encrypted: "encrypted-token",
        meta_app_connection_id: "META_APP_1",
      }])
      .mockResolvedValueOnce([{
        channel_id: "WA_CHANNEL_1",
        tenant_id: "T1",
        external_account_id: "1107720082434785",
        metadata: null,
        access_token_encrypted: "encrypted-token",
        meta_app_connection_id: "META_APP_1",
        app_id: "APP_ID",
        app_secret_encrypted: "encrypted-secret",
        graph_version: "v26.0",
      }])
      .mockResolvedValueOnce({ affectedRows: 1 });

    await promoteChannelStatusIfHealthy("WA_CHANNEL_1", "T1");
    expect(mockDb.mock.calls[2][0]).toMatch(/UPDATE channel_connections/);
  });
});
