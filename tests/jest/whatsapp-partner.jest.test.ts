import { describe, expect, it } from "@jest/globals";
import {
  buildWhatsAppCreditSharePath,
  resolveWhatsAppMigrationType,
  resolveWhatsAppPaymentStatus,
} from "../../src/lib/whatsapp-partner.functions";

describe("WhatsApp Solution Partner helpers", () => {
  it.each([
    ["FINISH", "new"],
    ["FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING", "coexistence"],
    ["FINISH_OBO_MIGRATION", "obo"],
    ["FINISH_GRANT_ONLY_API_ACCESS", "grant_only"],
  ])("maps Embedded Signup finish type %s", (finishType, expected) => {
    expect(resolveWhatsAppMigrationType(finishType)).toBe(expected);
  });

  it("requires a customer action when the WABA has no primary funding", () => {
    expect(resolveWhatsAppPaymentStatus(null)).toBe("action_required");
    expect(resolveWhatsAppPaymentStatus("funding-id")).toBe("ready");
  });

  it("uses the current combined credit sharing endpoint", () => {
    expect(buildWhatsAppCreditSharePath("credit/line")).toBe(
      "credit%2Fline/whatsapp_credit_sharing_and_attach",
    );
  });
});
