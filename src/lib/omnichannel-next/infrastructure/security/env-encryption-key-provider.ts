import crypto from "crypto";
import type { EncryptionKeyProvider } from "./credential-vault.types";

export class EnvMetaEncryptionKeyProvider implements EncryptionKeyProvider {
  private readonly key: Buffer;

  constructor(rawKey = process.env.META_CREDENTIALS_ENCRYPTION_KEY ?? "") {
    const trimmed = rawKey.trim();
    if (!trimmed) {
      throw new Error("META_CREDENTIALS_ENCRYPTION_KEY is not set");
    }
    if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
      this.key = Buffer.from(trimmed, "hex");
    } else {
      this.key = crypto.createHash("sha256").update(trimmed).digest();
    }
  }

  getKey(): Buffer {
    return this.key;
  }
}
