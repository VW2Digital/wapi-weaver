import { describe, expect, test } from "@jest/globals";
import { AesGcmCredentialDecryptor, CredentialDecryptionError, CredentialFormatError } from "@/lib/omnichannel-next/infrastructure/security";
import { FixedEncryptionKeyProvider, syntheticEncrypt } from "./test-helpers";

describe("AesGcmCredentialDecryptor", () => {
  test("decrypts a valid AES-256-GCM token", async () => {
    const key = new FixedEncryptionKeyProvider("test-encryption-key-123");
    const ciphertext = syntheticEncrypt("WHATSAPP_PLAINTEXT_SENTINEL_DO_NOT_LEAK", key);
    const decryptor = new AesGcmCredentialDecryptor(key);
    const ref = { kind: "channel-access-token" as const, recordId: "wa-1", tenantId: "tenant-a", provider: "whatsapp" as const };
    const result = await decryptor.decrypt({ reference: ref, ciphertext });

    expect(result.kind).toBe("whatsapp-access-token");
    expect(result.token).toBe("WHATSAPP_PLAINTEXT_SENTINEL_DO_NOT_LEAK");
  });

  test("rejects tampered ciphertext", async () => {
    const key = new FixedEncryptionKeyProvider("test-encryption-key-123");
    const ciphertext = syntheticEncrypt("WHATSAPP_PLAINTEXT_SENTINEL_DO_NOT_LEAK", key);
    const flipAt = 25;
    const flipChar = ciphertext[flipAt] === "0" ? "1" : "0";
    const tampered = ciphertext.slice(0, flipAt) + flipChar + ciphertext.slice(flipAt + 1);
    const decryptor = new AesGcmCredentialDecryptor(key);
    const ref = { kind: "channel-access-token" as const, recordId: "wa-1", tenantId: "tenant-a", provider: "whatsapp" as const };

    await expect(decryptor.decrypt({ reference: ref, ciphertext: tampered })).rejects.toThrow(CredentialDecryptionError);
  });

  test("rejects wrong key", async () => {
    const keyA = new FixedEncryptionKeyProvider("key-a-");
    const keyB = new FixedEncryptionKeyProvider("key-b-");
    const ciphertext = syntheticEncrypt("WHATSAPP_PLAINTEXT_SENTINEL_DO_NOT_LEAK", keyA);
    const decryptor = new AesGcmCredentialDecryptor(keyB);
    const ref = { kind: "channel-access-token" as const, recordId: "wa-1", tenantId: "tenant-a", provider: "whatsapp" as const };

    await expect(decryptor.decrypt({ reference: ref, ciphertext })).rejects.toThrow(CredentialDecryptionError);
  });

  test("rejects missing IV", async () => {
    const key = new FixedEncryptionKeyProvider("test-encryption-key-123");
    const decryptor = new AesGcmCredentialDecryptor(key);
    const ref = { kind: "channel-access-token" as const, recordId: "wa-1", tenantId: "tenant-a", provider: "whatsapp" as const };

    await expect(decryptor.decrypt({ reference: ref, ciphertext: "ciphertextonly" })).rejects.toThrow(CredentialFormatError);
  });

  test("rejects malformed payload", async () => {
    const key = new FixedEncryptionKeyProvider("test-encryption-key-123");
    const decryptor = new AesGcmCredentialDecryptor(key);
    const ref = { kind: "channel-access-token" as const, recordId: "wa-1", tenantId: "tenant-a", provider: "whatsapp" as const };

    await expect(decryptor.decrypt({ reference: ref, ciphertext: "iv:only" })).rejects.toThrow(CredentialFormatError);
  });
});
