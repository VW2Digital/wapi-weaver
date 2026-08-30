"use server";

import db from "@/lib/db";
import {
  type ChannelConnection,
  getChannelConnection,
  listChannelConnectionsForTenant,
} from "./channel-connection.service";

export interface ResolvedConversationChannel {
  conversationId: string;
  channelConnectionId: string;
  resolutionSource: "conversation" | "external_account" | "legacy_phone" | "manual";
}

export class ConversationChannelError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ConversationChannelError";
  }
}

export async function resolveConversationChannel(
  conversationId: string,
  tenantId: string,
  providerHint?: string,
  externalAccountId?: string | null,
): Promise<ResolvedConversationChannel> {
  const sessions = (await db.query(
    `SELECT id, tenant_id, channel_connection_id, contact_id FROM chat_sessions WHERE id = ? AND tenant_id = ? LIMIT 1`,
    [conversationId, tenantId],
  )) as any[];

  const session = sessions[0];
  if (!session) {
    throw new ConversationChannelError("CONVERSATION_NOT_FOUND", "Conversation not found or access denied.");
  }

  if (session.channel_connection_id) {
    const channel = await getChannelConnection(session.channel_connection_id, tenantId);
    if (channel.tenantId !== tenantId) {
      throw new ConversationChannelError("CHANNEL_TENANT_MISMATCH", "Channel does not belong to this tenant.");
    }
    return {
      conversationId,
      channelConnectionId: channel.id,
      resolutionSource: "conversation",
    };
  }

  if (providerHint && externalAccountId) {
    const candidates = await listChannelConnectionsForTenant(tenantId, providerHint);
    const exact = candidates.find((c) => c.externalAccountId === externalAccountId);
    if (exact) {
      return {
        conversationId,
        channelConnectionId: exact.id,
        resolutionSource: "external_account",
      };
    }
  }

  return await resolveLegacyConversationChannel(session, tenantId);
}

async function resolveLegacyConversationChannel(session: any, tenantId: string): Promise<ResolvedConversationChannel> {
  const identities = (await db.query(
    `SELECT provider, external_id, phone_e164
     FROM contact_identities
     WHERE contact_id = ? AND tenant_id = ?`,
    [session.contact_id, tenantId],
  )) as any[];

  const candidates: ChannelConnection[] = [];
  for (const identity of identities) {
    const channels = await listChannelConnectionsForTenant(tenantId, identity.provider);
    for (const channel of channels) {
      if (
        channel.externalAccountId === identity.external_id ||
        channel.externalAccountId === identity.phone_e164
      ) {
        candidates.push(channel);
      }
    }
  }

  if (candidates.length === 0) {
    throw new ConversationChannelError("CHANNEL_NOT_FOUND", "No channel found for this conversation.");
  }

  if (candidates.length > 1) {
    throw new ConversationChannelError(
      "CHANNEL_AMBIGUOUS_REQUIRES_RELINK",
      "Multiple possible channels for this conversation. Please relink conversation to a specific channel.",
    );
  }

  return {
    conversationId: session.id,
    channelConnectionId: candidates[0].id,
    resolutionSource: "legacy_phone",
  };
}

export async function findConversationByContactPhone(
  tenantId: string,
  contactPhone: string,
): Promise<{ id: string; channelConnectionId: string | null } | null> {
  const sessions = (await db.query(
    `SELECT cs.id, cs.channel_connection_id
     FROM chat_sessions cs
     JOIN contacts c ON c.id = cs.contact_id
     WHERE cs.tenant_id = ? AND c.phone_e164 = ?
     ORDER BY cs.created_at DESC`,
    [tenantId, contactPhone],
  )) as any[];

  if (sessions.length === 0) return null;
  if (sessions.length === 1) {
    return { id: sessions[0].id, channelConnectionId: sessions[0].channel_connection_id };
  }

  const withChannel = sessions.find((s: any) => s.channel_connection_id);
  if (withChannel) {
    return { id: withChannel.id, channelConnectionId: withChannel.channel_connection_id };
  }

  throw new ConversationChannelError(
    "AMBIGUOUS_CONVERSATION",
    "Múltiplas conversas para este contato. Envie conversation_id ou channel_connection_id explicitamente.",
  );
}

export async function persistConversationChannel(
  conversationId: string,
  channelConnectionId: string,
  tenantId: string,
): Promise<void> {
  await db.query(
    `UPDATE chat_sessions
     SET channel_connection_id = ?
     WHERE id = ? AND tenant_id = ?`,
    [channelConnectionId, conversationId, tenantId],
  );
}

export async function persistMessageChannel(
  messageId: string,
  channelConnectionId: string,
  tenantId: string,
): Promise<void> {
  await db.query(
    `UPDATE direct_messages
     SET channel_connection_id = ?
     WHERE id = ? AND tenant_id = ?`,
    [channelConnectionId, messageId, tenantId],
  );
}
