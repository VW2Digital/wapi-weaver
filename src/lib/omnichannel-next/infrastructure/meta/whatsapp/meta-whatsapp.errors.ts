import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";

export interface MetaWhatsAppErrorContext {
  provider: "whatsapp";
  safeCode: string;
  httpStatus: number;
  retryable: boolean;
  metaCode?: string;
  metaMessage?: string;
}

export class MetaWhatsAppTransportError extends OmnichannelError {
  constructor(
    message: string,
    readonly context: MetaWhatsAppErrorContext,
  ) {
    super(context.safeCode, message);
  }
}
