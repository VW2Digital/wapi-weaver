"use server";

import db from "@/lib/db";
import { getChannelConnection, requireActiveChannel, type ChannelConnection } from "@/lib/messaging/channel-connection.service";
import type { IOutboundAdapter, OutboundMessageContext, OutboundSendResult } from "../types";
import { buildInstagramOutboundPayload } from "./instagram.payload-builder";
import { InstagramClient } from "./instagram.api";

export class InstagramOutboundAdapter implements IOutboundAdapter {
  readonly provider = "instagram" as const;

  async send(context: OutboundMessageContext): Promise<OutboundSendResult> {
    if (context.provider !== this.provider) {
      throw new Error(`InstagramOutboundAdapter cannot send for provider: ${context.provider}`);
    }

    const channel = await this.resolveChannel(context);

    const payload = buildInstagramOutboundPayload(context.providerRecipientId || "", context.payload as any, {
      replyToMessageId: context.payload.reply_to_message_id,
      useHumanAgentTag: false,
    });

    const client = new InstagramClient({
      igUserId: channel.externalAccountId || "",
      accessToken: channel.accessTokenEncrypted || "",
    });

    const result = await client.send({ payload });

    return {
      provider: this.provider,
      providerMessageId: result.providerMessageId,
      providerAccountId: channel.externalAccountId,
      status: "sent",
      responsePayload: result.body,
    };
  }

  private async resolveChannel(context: OutboundMessageContext): Promise<ChannelConnection> {
    if (context.channelConnectionId) {
      const channel = await getChannelConnection(context.channelConnectionId, context.tenantId);
      if (channel.provider !== this.provider) {
        throw new Error(`Channel ${channel.id} is not an Instagram channel.`);
      }
      await requireActiveChannel(channel);
      return channel;
    }

    const accounts = (await db.query(
      `SELECT ig_user_id, access_token
       FROM instagram_accounts WHERE user_id = ? AND is_active = 1 LIMIT 1`,
      [context.userId],
    )) as any[];

    const account = accounts[0];
    if (!account) {
      throw new Error("Conta ou destinatário do Instagram indisponível.");
    }

    console.warn(`[Instagram Outbound] Using legacy account resolution for message ${context.messageId}`);
    return {
      id: "LEGACY",
      tenantId: context.tenantId,
      metaAppConnectionId: null,
      provider: "instagram",
      status: "active",
      externalAccountId: account.ig_user_id,
      displayName: null,
      metadata: null,
      accessTokenEncrypted: account.access_token,
    };
  }
}
