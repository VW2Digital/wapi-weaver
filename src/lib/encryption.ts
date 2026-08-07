import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const rawKey = process.env.MERCADOPAGO_ENCRYPTION_KEY;
  if (!rawKey) {
    const fallbackKey = process.env.JWT_SECRET || "default-encryption-key-for-mercadopago";
    return crypto.createHash("sha256").update(fallbackKey).digest();
  }

  // If the key is a 64-character hex string (32 bytes), parse it
  if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
    return Buffer.from(rawKey, "hex");
  }

  // Fallback: Hash the raw key using SHA-256 to ensure it is exactly 32 bytes
  return crypto.createHash("sha256").update(rawKey).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a colon-separated string: "iv:ciphertext:authTag" (all hex-encoded).
 */
export function encrypt(text: string): string {
  if (!text) return "";
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag().toString("hex");
  
  return `${iv.toString("hex")}:${encrypted}:${authTag}`;
}

/**
 * Decrypts a ciphertext string formatted as "iv:ciphertext:authTag".
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted text format. Expected iv:ciphertext:authTag");
  }
  
  const key = getEncryptionKey();
  const iv = Buffer.from(parts[0], "hex");
  const encrypted = Buffer.from(parts[1], "hex");
  const authTag = Buffer.from(parts[2], "hex");
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, undefined, "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}
