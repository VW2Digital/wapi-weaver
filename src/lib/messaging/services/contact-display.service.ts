export interface ContactDisplayInput {
  channel?: string | null;
  name?: string | null;
  phone_e164?: string | null;
  id?: string | null;
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
