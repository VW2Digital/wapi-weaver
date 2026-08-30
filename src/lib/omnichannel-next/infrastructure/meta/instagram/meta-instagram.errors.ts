import { OmnichannelError } from "@/lib/omnichannel-next/domain/errors";

export interface MetaInstagramErrorContext {
  provider: "instagram";
  safeCode: string;
  httpStatus: number;
  retryable: boolean;
  metaCode?: string;
  metaMessage?: string;
}

export class MetaInstagramTransportError extends OmnichannelError {
  constructor(
    message: string,
    readonly context: MetaInstagramErrorContext,
  ) {
    super(context.safeCode, message);
  }
}
