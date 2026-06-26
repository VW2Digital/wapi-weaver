/**
 * jwt-secret.ts
 *
 * Centralized module for JWT Secret management.
 * Throws a fatal error if the secret is missing in production, preventing
 * insecure fallback tokens from being used.
 */

if (!process.env.JWT_SECRET) {
  // We allow a fallback for local dev ONLY if NODE_ENV is explicitly not production.
  // In production, failing fast is the most secure option.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[FATAL] JWT_SECRET environment variable is missing. Authentication cannot be secured.",
    );
  } else {
    console.warn(
      "⚠️ [WARNING] JWT_SECRET is missing. Using insecure fallback for local development only.",
    );
  }
}

export const JWT_SECRET =
  process.env.JWT_SECRET ||
  "super-secret-key-change-this-in-production-or-use-a-strong-uuid-or-hash";
