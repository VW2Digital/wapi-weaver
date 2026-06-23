export function normalizeWaMessageId(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim();
  if (!normalized) return null;

  const lowered = normalized.toLowerCase();
  if (lowered === "undefined" || lowered === "null") return null;

  return normalized;
}
