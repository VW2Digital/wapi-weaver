"use server";

import db from "@/lib/db";
import { getChannelConnection, requireActiveChannel, resolveChannelAccessToken, type ChannelConnection } from "@/lib/messaging/channel-connection.service";
import type { IOutboundAdapter, OutboundMessageContext, OutboundSendResult } from "../types";
import { buildInstagramOutboundPayload, resolveInstagramAuthMode } from "./instagram.payload-builder";
import { InstagramClient } from "./instagram.api";

export class InstagramOutboundAdapter implements IOutboundAdapter {
  readonly provider = "instagram" as const;

  async send(context: OutboundMessageContext): Promise<OutboundSendResult> {
    if (context.provider !== this.provider) {
      throw new Error(`InstagramOutboundAdapter cannot send for provider: ${context.provider}`);
    }

    const channel = await this.resolveChannel(context);
    const credentials = await this.resolveSendCredentials(channel, context.tenantId, context.userId);
    const { assertInstagramHumanSend, recordInstagramAttention, friendlyInstagramSendError } = await import(
      "@/lib/instagram/attention.server"
    );
    const decision = await assertInstagramHumanSend(context.tenantId, context.contactPhone);

    const payload = buildInstagramOutboundPayload(context.providerRecipientId || "", context.payload as any, {
      replyToMessageId: context.payload.reply_to_message_id,
      useHumanAgentTag: credentials.authMode === "facebook_login" && decision.useHumanAgentTag,
      authMode: credentials.authMode,
    });

    const client = new InstagramClient({
      igUserId: credentials.igUserId,
      pageId: credentials.pageId,
      authMode: credentials.authMode,
      accessToken: credentials.accessToken,
    });

    let result;
    try {
      result = await client.send({ payload });
    } catch (error) {
      const body = (error as { body?: unknown })?.body;
      const friendly = friendlyInstagramSendError(body);
      await recordInstagramAttention({
        tenantId: context.tenantId,
        contactPhone: context.contactPhone,
        action: "META_MESSAGE_ERROR",
        windowState: decision.window.state,
        messageId: context.messageId,
        igAccountId: credentials.igUserId,
        metaBody: body,
      });
      const wrapped = new Error(friendly);
      (wrapped as Error & { retryable?: boolean }).retryable = false;
      throw wrapped;
    }

    await recordInstagramAttention({
      tenantId: context.tenantId,
      contactPhone: context.contactPhone,
      action: decision.auditAction,
      windowState: decision.window.state,
      messageId: result.providerMessageId,
      igAccountId: credentials.igUserId,
    });

    return {
      provider: this.provider,
      providerMessageId: result.providerMessageId,
      providerAccountId: credentials.igUserId,
      status: "sent",
      responsePayload: result.body,
    };
  }

  private async resolveSendCredentials(
    channel: ChannelConnection,
    tenantId: string,
    userId: string,
  ): Promise<{
    graphNodeId: string;
    igUserId: string;
    pageId: string | null;
    authMode: "facebook_login" | "instagram_login";
    accessToken: string;
  }> {
    const externalId = channel.externalAccountId || "";
    const rows = (await db.query(
      `SELECT ig_user_id, instagram_business_account_id, page_id, access_token
       FROM instagram_accounts
       WHERE (tenant_id = ? OR user_id = ?)
         AND is_active = 1
         AND access_token IS NOT NULL
         AND access_token <> ''
         AND (
           page_id = ?
           OR ig_user_id = ?
           OR instagram_business_account_id = ?
         )
       ORDER BY updated_at DESC
       LIMIT 1`,
      [tenantId, userId || tenantId, externalId, externalId, externalId],
    )) as Array<{
      ig_user_id: string | null;
      instagram_business_account_id: string | null;
      page_id: string | null;
      access_token: string | null;
    }>;
    const account = rows[0];
    const freshToken = account?.access_token?.trim() || "";
    if (account && freshToken) {
      const igUserId = account.ig_user_id || account.instagram_business_account_id || externalId;
      const pageId = account.page_id || null;
      const authMode = resolveInstagramAuthMode({ pageId });
      return {
        graphNodeId: authMode === "facebook_login" ? pageId || igUserId : igUserId,
        igUserId,
        pageId,
        authMode,
        accessToken: freshToken,
      };
    }

    return {
      graphNodeId: externalId,
      igUserId: externalId,
      pageId: externalId || null,
      authMode: resolveInstagramAuthMode({ pageId: externalId }),
      accessToken: resolveChannelAccessToken(channel),
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
