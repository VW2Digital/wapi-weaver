export function normalizeToE164(raw: string, defaultCountry = "55"): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D+/g, "");
  if (!digits) return null;
  // remove leading 00
  if (digits.startsWith("00")) digits = digits.slice(2);
  // already with country code (length >= 11 and starts with country)
  if (digits.length >= 11 && digits.startsWith(defaultCountry)) {
    return digits;
  }
  // Brazilian local format (10-11 digits with DDD)
  if (digits.length === 10 || digits.length === 11) {
    return defaultCountry + digits;
  }
  // International form already
  if (digits.length >= 11) return digits;
  return null;
}
