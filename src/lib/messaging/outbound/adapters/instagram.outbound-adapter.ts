"use server";

import db from "@/lib/db";
import type { IOutboundAdapter, OutboundMessageContext, OutboundSendResult } from "../types";
import { buildInstagramOutboundPayload } from "./instagram.payload-builder";
import { InstagramClient } from "./instagram.api";

export class InstagramOutboundAdapter implements IOutboundAdapter {
  readonly provider = "instagram" as const;

  async send(context: OutboundMessageContext): Promise<OutboundSendResult> {
    if (context.provider !== this.provider) {
      throw new Error(`InstagramOutboundAdapter cannot send for provider: ${context.provider}`);
    }

    const accounts = (await db.query(
      `SELECT ig_user_id, access_token
       FROM instagram_accounts WHERE user_id = ? AND is_active = 1 LIMIT 1`,
      [context.userId],
    )) as Array<{ ig_user_id: string; access_token: string }>;

    const account = accounts[0];
    if (!account || !context.providerRecipientId) {
      throw new Error("Conta ou destinatário do Instagram indisponível.");
    }

    const payload = buildInstagramOutboundPayload(context.providerRecipientId, context.payload as any, {
      replyToMessageId: context.payload.reply_to_message_id,
      useHumanAgentTag: false,
    });

    const client = new InstagramClient({
      igUserId: account.ig_user_id,
      accessToken: account.access_token,
    });

    const result = await client.send({ payload });

    return {
      provider: this.provider,
      providerMessageId: result.providerMessageId,
      providerAccountId: account.ig_user_id,
      status: "sent",
      responsePayload: result.body,
    };
  }
}
