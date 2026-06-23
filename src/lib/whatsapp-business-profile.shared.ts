export type WhatsAppBusinessProfile = {
  about: string | null;
  address: string | null;
  description: string | null;
  email: string | null;
  profile_picture_url: string | null;
  websites: string[];
  vertical: string | null;
  messaging_product: "whatsapp";
};

export const WHATSAPP_VERTICALS = [
  "ALCOHOL",
  "APPAREL",
  "AUTO",
  "BEAUTY",
  "EDU",
  "ENTERTAIN",
  "EVENT_PLAN",
  "FINANCE",
  "GOVT",
  "GROCERY",
  "HEALTH",
  "HOTEL",
  "NONPROFIT",
  "ONLINE_GAMBLING",
  "OTC_DRUGS",
  "OTHER",
  "PHYSICAL_GAMBLING",
  "PROF_SERVICES",
  "RESTAURANT",
  "RETAIL",
  "TRAVEL",
] as const;

export type WhatsAppVertical = (typeof WHATSAPP_VERTICALS)[number];

export function normalizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  const lowered = s.toLowerCase();
  if (lowered === "undefined" || lowered === "null") return null;
  return s;
}

export function normalizeWebsites(value: unknown): string[] {
  const arr = Array.isArray(value) ? value : [];
  return arr
    .map((x) => normalizeOptionalString(x))
    .filter(Boolean)
    .map((x) => x as string);
}

export function normalizeBusinessProfile(raw: any): WhatsAppBusinessProfile {
  return {
    messaging_product: "whatsapp",
    about: normalizeOptionalString(raw?.about),
    address: normalizeOptionalString(raw?.address),
    description: normalizeOptionalString(raw?.description),
    email: normalizeOptionalString(raw?.email),
    profile_picture_url: normalizeOptionalString(raw?.profile_picture_url),
    websites: normalizeWebsites(raw?.websites),
    vertical: normalizeOptionalString(raw?.vertical),
  };
}

