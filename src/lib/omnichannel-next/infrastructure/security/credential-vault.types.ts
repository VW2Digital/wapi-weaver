import type { CredentialReference } from "@/lib/omnichannel-next/infrastructure/mysql/read-model";

export type CredentialKind = "whatsapp-access-token";

export interface EncryptedCredentialPayload {
  reference: CredentialReference;
  ciphertext: string;
}

export interface ResolvedSecret {
  kind: CredentialKind;
  token: string;
}

export interface EncryptionKeyProvider {
  getKey(): Promise<Buffer> | Buffer;
}

export interface CredentialDecryptorPort {
  decrypt(encrypted: EncryptedCredentialPayload): Promise<ResolvedSecret> | ResolvedSecret;
}

export interface EncryptedCredentialRepository {
  find(reference: CredentialReference): Promise<EncryptedCredentialPayload | null>;
}
