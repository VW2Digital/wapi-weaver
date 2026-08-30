export interface ResolvedCredential {
  token: string;
}

export interface CredentialResolverPort {
  resolve(reference: string): Promise<ResolvedCredential>;
}
