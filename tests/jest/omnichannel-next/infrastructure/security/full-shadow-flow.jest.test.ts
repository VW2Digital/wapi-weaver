import { describe, expect, test } from "@jest/globals";
import {
  MetaWhatsAppTransport,
  MySQLEncryptedCredentialRepository,
  AesGcmCredentialDecryptor,
  SecureCredentialVault,
  WhatsAppCredentialResolver,
} from "@/lib/omnichannel-next/infrastructure";
import { WhatsAppProvider } from "@/lib/omnichannel-next/providers/whatsapp";
import { FakeHttpClient } from "../meta/test-fakes";
import { FakeSqlExecutor } from "../test-fixtures";
import { FixedEncryptionKeyProvider, syntheticEncrypt } from "./test-helpers";
import type { WhatsAppChannelConfigPort } from "@/lib/omnichannel-next/providers/whatsapp";
import type { ProviderSendContext } from "@/lib/omnichannel-next/application/ports/outbound-provider.port";

const KEY = new FixedEncryptionKeyProvider("test-encryption-key-123");
const REFERENCE = JSON.stringify({
  kind: "channel-access-token",
  recordId: "wa-1",
  tenantId: "tenant-a",
  provider: "whatsapp",
});

describe("WhatsApp secure shadow flow", () => {
  function build() {
    const sql = new FakeSqlExecutor();
    const token = "WHATSAPP_PLAINTEXT_SENTINEL_DO_NOT_LEAK";
    const ciphertext = syntheticEncrypt(token, KEY);
    sql.addResult(
      `SELECT id, tenant_id, provider, access_token_encrypted FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = ? LIMIT 1`,
      [{ id: "wa-1", tenant_id: "tenant-a", provider: "whatsapp", access_token_encrypted: ciphertext }],
      ["wa-1", "tenant-a", "whatsapp"],
    );

    const repo = new MySQLEncryptedCredentialRepository(sql);
    const vault = new SecureCredentialVault(repo, new AesGcmCredentialDecryptor(KEY));
    const credentials = new WhatsAppCredentialResolver(vault);
    const http = new FakeHttpClient();
    http.setFixture("https://graph.facebook.com/v25.0/PHONE_123/messages", 200, { messages: [{ id: "wamid.FLOW" }] });

    const transport = new MetaWhatsAppTransport({ graphApiVersion: "25.0" }, http, credentials);

    const configPort: WhatsAppChannelConfigPort = {
      async resolve() {
        return {
          channelConnectionId: "wa-1",
          senderIdentifier: "PHONE_123",
          credentialReference: REFERENCE,
        };
      },
    };

    const provider = new WhatsAppProvider(configPort, transport);

    const context: ProviderSendContext = {
      tenantId: "tenant-a",
      conversationId: "conv-1",
      channelConnectionId: "wa-1",
      messageId: "msg-1",
      provider: "whatsapp",
      message: { type: "text", text: "hello" } as any,
    };

    return { provider, http, token, context };
  }

  test("decrypts token only inside transport boundary", async () => {
    const { provider, http, token, context } = build();
    const result = await provider.send(context);

    expect(result.providerMessageId).toBe("wamid.FLOW");
    expect(result.status).toBe("sent");
    expect(JSON.stringify(result)).not.toContain(token);

    expect(http.requests).toHaveLength(1);
    expect(http.requests[0].headers?.Authorization).toBe(`Bearer ${token}`);
    expect(http.requests[0].headers?.Authorization).not.toContain("[REDACTED]");
  });
});
