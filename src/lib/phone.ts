// Normalização para formato E.164 sem o "+" (apenas dígitos com DDI).
// Regra: se vier com DDI internacional (12+ dígitos OU prefixo "00" / "+"),
// respeita. Caso contrário, assume Brasil (DDD + número, 10-11 dígitos).
export function normalizeToE164(raw: string, defaultCountry = "55"): string | null {
  if (!raw) return null;
  const original = String(raw).trim();
  const hadPlus = original.startsWith("+");
  let digits = original.replace(/\D+/g, "");
  if (!digits) return null;

  // "00" prefix → discado internacional
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
    return digits.length >= 8 ? digits : null;
  }

  // Veio com "+" explícito → respeita o DDI informado
  if (hadPlus) {
    return digits.length >= 8 ? digits : null;
  }

  // Já tem DDI BR
  if (digits.length >= 12 && digits.startsWith(defaultCountry)) return digits;

  // Formato local BR (10-11 dígitos = DDD + número)
  if (digits.length === 10 || digits.length === 11) {
    return defaultCountry + digits;
  }

  // 12-15 dígitos sem "+": assume já em formato internacional
  if (digits.length >= 11 && digits.length <= 15) return digits;

  return null;
}
