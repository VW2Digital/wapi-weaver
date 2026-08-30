export type Provider = "whatsapp" | "instagram" | "messenger";

export interface CredentialReference {
  kind: "channel-access-token" | "meta-app";
  recordId: string;
  tenantId: string;
  provider: Provider;
}

export interface ChannelReadModel {
  id: string;
  tenantId: string;
  provider: Provider;
  externalAccountId: string | null;
  metaAppConnectionId: string | null;
  status: string;
  displayName: string | null;
  credentialReference: CredentialReference | null;
}

export interface WhatsAppResolvedChannelConfig {
  channelConnectionId: string;
  tenantId: string;
  phoneNumberId: string;
  credentialReference: CredentialReference;
  metaAppConnectionId: string | null;
}

export interface InstagramChannelIdentityReadModel {
  channelConnectionId: string;
  tenantId: string;
  externalAccountId: string | null;
  pageId: string | null;
  instagramUserId: string | null;
  metaAppConnectionId: string | null;
  credentialReference: CredentialReference | null;
}

export interface MetaAppReadModel {
  id: string;
  tenantId: string;
  appId: string;
  graphVersion: string | null;
  status: string;
  hasAppSecretEncrypted: boolean;
  hasWebhookVerifyTokenEncrypted: boolean;
}

export interface EncryptedCredentialRecord {
  reference: CredentialReference;
  exists: boolean;
  ciphertextPresent: boolean;
}

export interface ChannelReadiness {
  channelConnectionId: string;
  provider: Provider;
  configResolvable: boolean;
  credentialReferenceResolvable: boolean;
  blockers: string[];
}
