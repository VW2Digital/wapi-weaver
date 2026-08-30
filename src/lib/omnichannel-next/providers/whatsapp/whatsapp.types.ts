export interface WhatsAppChannelConfig {
  channelConnectionId: string;
  senderIdentifier: string;
  credentialReference: string;
}

export interface WhatsAppTextMessage {
  type: "text";
  text: string;
}

export type WhatsAppTransportMessage = WhatsAppTextMessage;

export interface WhatsAppTransportRequest {
  recipient: string;
  sender: string;
  credentialReference: string;
  message: WhatsAppTransportMessage;
}

export interface WhatsAppTransportResult {
  providerMessageId: string;
}
