import { isMetaHotlinkUrl } from "@/lib/media-content-type";

export interface ContactDisplayInput {
  channel?: string | null;
  name?: string | null;
  phone_e164?: string | null;
  id?: string | null;
  avatar_url?: string | null;
  custom_fields?: Record<string, unknown> | null;
}

const PLACEHOLDER_PATTERNS = [
  /^instagram\s*\(/i,
  /^ig_/i,
  /^contato\s*\(/i,
  /^facebook\s*\(/i,
  /^instagram$/i,
];

export function isInstagramPlaceholderName(value: string | null | undefined): boolean {
  if (!value || typeof value !== "string") return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function resolveInstagramFallback(contact: ContactDisplayInput): string {
  const raw = contact.phone_e164 || contact.name || "";
  const igsid = raw.replace(/^ig_/, "");
  return igsid ? `Instagram (${igsid})` : "Instagram";
}

/**
 * Resolve the display name for a contact in the conversation list.
 * For Instagram, prefer the real profile name, then @username, then a fallback.
 * For other providers, keep the existing name behavior.
 */
export function resolveContactDisplayName(contact: ContactDisplayInput): string {
  const channel = contact.channel ?? "";
  const customFields = contact.custom_fields ?? {};

  if (channel === "instagram") {
    const profileName = typeof customFields.instagram_profile_name === "string" ? customFields.instagram_profile_name : null;
    if (profileName && !isInstagramPlaceholderName(profileName)) {
      return profileName;
    }

    const username = typeof customFields.instagram_username === "string" ? customFields.instagram_username : null;
    if (username && !isInstagramPlaceholderName(username)) {
      return `@${username}`;
    }

    if (contact.name && !isInstagramPlaceholderName(contact.name)) {
      return contact.name;
    }

    return resolveInstagramFallback(contact);
  }

  return contact.name || "Sem Nome";
}

function firstCustomPhotoUrl(customFields: Record<string, unknown> | null | undefined): string {
  if (!customFields) return "";
  for (const key of ["avatar_url", "photo_url", "photo", "picture", "image_url", "image"]) {
    const value = customFields[key];
    if (typeof value === "string" && value) return value;
  }
  return "";
}

/**
 * Extrai a URL de foto de perfil dos custom_fields do contato.
 * WhatsApp continua com fallback de iniciais (não usa avatares de terceiros).
 * Instagram e Messenger passam por proxy autenticado — o CDN da Meta expira no browser.
 */
export function getContactAvatarUrl(contact: ContactDisplayInput | null): string {
  const fromRecord = typeof contact?.avatar_url === "string" ? contact.avatar_url : "";
  const rawUrl = fromRecord || firstCustomPhotoUrl(contact?.custom_fields);
  if (typeof rawUrl !== "string" || !rawUrl) return "";
  if (rawUrl.includes("whatsapp.net") || rawUrl.includes("whatsapp.com")) {
    return "";
  }
  const channel = contact?.channel;
  const canProxyProfile = channel === "instagram" || channel === "messenger";
  if (contact?.id && isMetaHotlinkUrl(rawUrl) && canProxyProfile) {
    return `/api/whatsapp/media?id=profile&contactId=${encodeURIComponent(contact.id)}`;
  }
  if (isMetaHotlinkUrl(rawUrl)) {
    return "";
  }
  return rawUrl;
}
