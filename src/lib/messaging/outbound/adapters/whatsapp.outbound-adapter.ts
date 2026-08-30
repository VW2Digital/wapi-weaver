"use server";

import db from "@/lib/db";
import { getChannelConnection, requireActiveChannel, type ChannelConnection } from "@/lib/messaging/channel-connection.service";
import type { IOutboundAdapter, OutboundMessageContext, OutboundSendResult } from "../types";
import { WhatsAppClient } from "./whatsapp.api";

export class WhatsAppOutboundAdapter implements IOutboundAdapter {
  readonly provider = "whatsapp" as const;

  async send(context: OutboundMessageContext): Promise<OutboundSendResult> {
    if (context.provider !== this.provider) {
      throw new Error(`WhatsAppOutboundAdapter cannot send for provider: ${context.provider}`);
    }

    const channel = await this.resolveChannel(context);
    const graphVersion = recentMetaVersion(channel.metadata && typeof (channel.metadata as any)?.graphVersion === "string" ? (channel.metadata as any).graphVersion : undefined);

    const client = new WhatsAppClient({
      phoneNumberId: channel.externalAccountId || "",
      accessToken: channel.accessTokenEncrypted || "",
      graphVersion,
    });

    const isVoiceMessage = context.payload.type === "audio" && Boolean(context.payload.audio?.voice);
    if (isVoiceMessage) {
      console.log("[VOICE] 13 iniciando envio /messages");
      console.log("[VOICE] 14 usando voice:true");
    }

    try {
      const result = await client.send({
        recipient: context.contactPhone,
        payload: context.payload as any,
      });

      if (isVoiceMessage) {
        console.log(`[VOICE] 16 message_id retornado pela Meta: ${result.providerMessageId}`);
        console.log("[VOICE] 17 envio concluído");
      }

      return {
        provider: this.provider,
        providerMessageId: result.providerMessageId,
        providerAccountId: channel.externalAccountId,
        status: "sent",
        responsePayload: result.responsePayload,
      };
    } catch (error) {
      if (isVoiceMessage) {
        console.error("[VOICE ERROR] etapa: POST /messages");
      }
      throw error;
    }
  }

  private async resolveChannel(context: OutboundMessageContext): Promise<ChannelConnection> {
    if (context.channelConnectionId) {
      const channel = await getChannelConnection(context.channelConnectionId, context.tenantId);
      if (channel.provider !== this.provider) {
        throw new Error(`Channel ${channel.id} is not a WhatsApp channel.`);
      }
      await requireActiveChannel(channel);
      return channel;
    }

    const profiles = (await db.query(
      `SELECT whatsapp_phone_number_id, whatsapp_access_token, meta_graph_version
       FROM profiles WHERE id = ? LIMIT 1`,
      [context.userId],
    )) as any[];

    const profile = profiles[0];
    if (!profile?.whatsapp_phone_number_id || !profile.whatsapp_access_token) {
      throw new Error("Credenciais do WhatsApp não configuradas.");
    }

    console.warn(`[WhatsApp Outbound] Using legacy profile resolution for message ${context.messageId}`);
    return {
      id: "LEGACY",
      tenantId: context.tenantId,
      metaAppConnectionId: null,
      provider: "whatsapp",
      status: "active",
      externalAccountId: profile.whatsapp_phone_number_id,
      displayName: null,
      metadata: { graphVersion: profile.meta_graph_version },
      accessTokenEncrypted: profile.whatsapp_access_token,
    };
  }
}

function recentMetaVersion(rawVersion?: string | null): string {
  const version = rawVersion || "v26.0";
  if (!/^v\d+(?:\.\d+)?$/.test(version)) return "v26.0";
  const numeric = Number(version.slice(1));
  return numeric >= 24 && numeric <= 26 ? version : "v26.0";
}
