import crypto from "crypto";
import type { EncryptionKeyProvider } from "@/lib/omnichannel-next/infrastructure/security";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function deriveKey(raw: string): Buffer {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

export class FixedEncryptionKeyProvider implements EncryptionKeyProvider {
  private readonly key: Buffer;

  constructor(raw: string) {
    this.key = deriveKey(raw);
  }

  getKey(): Buffer {
    return this.key;
  }
}

export function syntheticEncrypt(plaintext: string, keyProvider: EncryptionKeyProvider): string {
  const raw = keyProvider.getKey();
  const key = raw instanceof Promise ? (() => { throw new Error("syntheticEncrypt requires a synchronous key provider") })() : raw;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
}
