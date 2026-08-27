"use server";
import crypto from "crypto";

const KEY_ENV = "TOKEN_ENCRYPTION_KEY";
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env[KEY_ENV];
  if (!hex) {
    throw new Error(`${KEY_ENV} não configurada`);
  }
  if (hex.length !== 64) {
    throw new Error(`${KEY_ENV} deve ter 64 caracteres hex (32 bytes)`);
  }
  return Buffer.from(hex, "hex");
}

export function isEncryptedToken(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("enc:");
}

export function encryptToken(plainText: string | null | undefined): string {
  if (!plainText) return plainText ?? "";
  // Não criptografa se já estiver criptografado
  if (isEncryptedToken(plainText)) return plainText;

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, encrypted]).toString("base64");
  return `enc:${payload}`;
}

export function decryptToken(cipherText: string | null | undefined): string {
  if (!cipherText) return cipherText ?? "";
  if (!isEncryptedToken(cipherText)) return cipherText; // legado / plaintext

  const key = getKey();
  const buffer = Buffer.from(cipherText.slice(4), "base64");
  if (buffer.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Token criptografado com formato inválido");
  }

  const iv = buffer.subarray(0, IV_LENGTH);
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
