export interface InstagramChannelConfig {
  channelConnectionId: string;
  senderIdentifier: string;
  credentialReference: string;
}

export interface InstagramTextMessage {
  type: "text";
  text: string;
}

export type InstagramTransportMessage = InstagramTextMessage;

export interface InstagramTransportRequest {
  recipient: string;
  sender: string;
  credentialReference: string;
  message: InstagramTransportMessage;
}

export interface InstagramTransportResult {
  providerMessageId: string;
}
