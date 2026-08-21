type MessageRecord = Record<string, unknown> | null;

/**
 * Resolves contact-card content without confusing Meta's top-level sender
 * identity (`value.contacts`) with an actual WhatsApp `contacts` message.
 */
export function resolveSharedContactsData<T = unknown>(
  rowType: string | null | undefined,
  metadata: MessageRecord,
  metadataMessage: MessageRecord,
  rawMessage: MessageRecord,
): T[] | null {
  if (Array.isArray(metadataMessage?.contacts)) return metadataMessage.contacts as T[];
  if (Array.isArray(rawMessage?.contacts)) return rawMessage.contacts as T[];

  // Legacy outgoing/contact-card rows stored the actual payload here. For
  // every other type, metadata.contacts may only be the webhook sender.
  if (rowType === "contacts" && Array.isArray(metadata?.contacts)) {
    return metadata.contacts as T[];
  }

  return null;
}
