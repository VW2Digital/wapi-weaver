import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const secret = process.env.VITE_SUPABASE_JWT_SECRET || process.env.JWT_SECRET || "fallback_default_secret_key_32_bytes";
  // Guarantee it's exactly 32 bytes for aes-256
  return crypto.createHash("sha256").update(String(secret)).digest();
}

export function encryptApiKey(apiKey: string): string {
  if (!apiKey) return "";
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  
  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  // Format: iv:authTag:encryptedData
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

export function decryptApiKey(encryptedData: string): string {
  if (!encryptedData || !encryptedData.includes(":")) return "";
  
  try {
    const parts = encryptedData.split(":");
    if (parts.length !== 3) return "";

    const iv = Buffer.from(parts[0], "hex");
    const authTag = Buffer.from(parts[1], "hex");
    const encryptedText = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    
    return decrypted;
  } catch (error) {
    console.error("Failed to decrypt API Key:", error);
    return "";
  }
}

export function maskApiKey(apiKey: string): string {
  if (!apiKey) return "";
  if (apiKey.length <= 8) return "********";
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}
