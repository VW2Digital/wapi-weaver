import { describe, expect, test } from "@jest/globals";
import {
  WhatsAppCredentialResolver,
  SecureCredentialVault,
  MySQLEncryptedCredentialRepository,
  AesGcmCredentialDecryptor,
} from "@/lib/omnichannel-next/infrastructure/security";
import { FakeSqlExecutor } from "../test-fixtures";
import { FixedEncryptionKeyProvider, syntheticEncrypt } from "./test-helpers";

const KEY = new FixedEncryptionKeyProvider("test-encryption-key-123");

function buildResolver() {
  const sql = new FakeSqlExecutor();
  const repo = new MySQLEncryptedCredentialRepository(sql);
  const vault = new SecureCredentialVault(repo, new AesGcmCredentialDecryptor(KEY));
  return { resolver: new WhatsAppCredentialResolver(vault), sql };
}

const REF = { kind: "channel-access-token" as const, recordId: "wa-1", tenantId: "tenant-a", provider: "whatsapp" as const };
const REFERENCE = JSON.stringify(REF);

describe("WhatsAppCredentialResolver", () => {
  test("resolves a WhatsApp token from encrypted record", async () => {
    const { resolver, sql } = buildResolver();
    const token = "WHATSAPP_PLAINTEXT_SENTINEL_DO_NOT_LEAK";
    const ciphertext = syntheticEncrypt(token, KEY);
    sql.addResult(
      `SELECT id, tenant_id, provider, access_token_encrypted FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = ? LIMIT 1`,
      [{ id: "wa-1", tenant_id: "tenant-a", provider: "whatsapp", access_token_encrypted: ciphertext }],
      ["wa-1", "tenant-a", "whatsapp"],
    );

    const resolved = await resolver.resolve(REFERENCE);
    expect(resolved.token).toBe(token);
  });

  test("rejects malformed reference", async () => {
    const { resolver } = buildResolver();
    await expect(resolver.resolve("not-json")).rejects.toMatchObject({ code: "CREDENTIAL_REFERENCE_MALFORMED" });
  });

  test("rejects Instagram reference", async () => {
    const { resolver } = buildResolver();
    const ig = { kind: "channel-access-token" as const, recordId: "ig-1", tenantId: "tenant-a", provider: "instagram" as const };
    await expect(resolver.resolve(JSON.stringify(ig))).rejects.toMatchObject({ code: "CREDENTIAL_PROVIDER_MISMATCH" });
  });

  test("rejects wrong tenant", async () => {
    const { resolver, sql } = buildResolver();
    const token = "WHATSAPP_PLAINTEXT_SENTINEL_DO_NOT_LEAK";
    const ciphertext = syntheticEncrypt(token, KEY);
    sql.addResult(
      `SELECT id, tenant_id, provider, access_token_encrypted FROM channel_connections WHERE id = ? AND tenant_id = ? AND provider = ? LIMIT 1`,
      [{ id: "wa-1", tenant_id: "tenant-a", provider: "whatsapp", access_token_encrypted: ciphertext }],
      ["wa-1", "tenant-a", "whatsapp"],
    );

    const wrong = { ...REF, tenantId: "tenant-b" };
    await expect(resolver.resolve(JSON.stringify(wrong))).rejects.toMatchObject({ code: "CREDENTIAL_RECORD_NOT_FOUND" });
  });
});
