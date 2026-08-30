import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";

export class CredentialRecordNotFoundError extends OmnichannelError {
  constructor(reference: string) {
    super("CREDENTIAL_RECORD_NOT_FOUND", `Credential record not found for reference ${reference}`);
  }
}

export class CredentialTenantMismatchError extends OmnichannelError {
  constructor() {
    super("CREDENTIAL_TENANT_MISMATCH", "Credential record does not belong to the expected tenant");
  }
}

export class CredentialProviderMismatchError extends OmnichannelError {
  constructor() {
    super("CREDENTIAL_PROVIDER_MISMATCH", "Credential reference provider does not match the resolver");
  }
}

export class CredentialDecryptionError extends OmnichannelError {
  constructor() {
    super("CREDENTIAL_DECRYPTION_ERROR", "Failed to decrypt credential payload");
  }
}

export class CredentialFormatError extends OmnichannelError {
  constructor() {
    super("CREDENTIAL_FORMAT_ERROR", "Encrypted credential payload has an invalid format");
  }
}

export class CredentialReferenceMalformedError extends OmnichannelError {
  constructor() {
    super("CREDENTIAL_REFERENCE_MALFORMED", "Credential reference is malformed");
  }
}
