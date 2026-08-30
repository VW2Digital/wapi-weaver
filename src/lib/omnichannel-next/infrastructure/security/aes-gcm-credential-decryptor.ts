import crypto from "crypto";
import { CredentialDecryptionError, CredentialFormatError } from "./credential-vault.errors";
import type { CredentialDecryptorPort, EncryptedCredentialPayload, EncryptionKeyProvider, ResolvedSecret } from "./credential-vault.types";

const ALGORITHM = "aes-256-gcm";
const IV_HEX_LENGTH = 24;
const AUTH_TAG_HEX_LENGTH = 32;
const ENCRYPTED_PATTERN = new RegExp(`^[0-9a-f]{${IV_HEX_LENGTH}}:[0-9a-f]+:[0-9a-f]{${AUTH_TAG_HEX_LENGTH}}$`, "i");

export class AesGcmCredentialDecryptor implements CredentialDecryptorPort {
  constructor(private readonly keyProvider: EncryptionKeyProvider) {}

  async decrypt(encrypted: EncryptedCredentialPayload): Promise<ResolvedSecret> {
    if (!encrypted.ciphertext || !ENCRYPTED_PATTERN.test(encrypted.ciphertext)) {
      throw new CredentialFormatError();
    }

    const parts = encrypted.ciphertext.split(":");
    const iv = Buffer.from(parts[0], "hex");
    const ciphertext = Buffer.from(parts[1], "hex");
    const authTag = Buffer.from(parts[2], "hex");

    const key = await this.keyProvider.getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    try {
      const decrypted = decipher.update(ciphertext, undefined, "utf8");
      const final = decipher.final("utf8");
      return { kind: "whatsapp-access-token", token: decrypted + final } as ResolvedSecret;
    } catch {
      throw new CredentialDecryptionError();
    }
  }
}
