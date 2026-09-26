import { describe, expect, it } from "@jest/globals";
import {
  buildEmbeddedSignupLoginOptions,
  mapCoexistenceError,
  parseEmbeddedSignupSession,
} from "../../src/lib/whatsapp-embedded-signup-coex";

describe("Embedded Signup Coexistência", () => {
  it("launches CoEx with featureType and without Graph v21", () => {
    const options = buildEmbeddedSignupLoginOptions("CFG123", "coexistence") as any;
    expect(options.config_id).toBe("CFG123");
    expect(options.response_type).toBe("code");
    expect(options.extras.featureType).toBe("whatsapp_business_app_onboarding");
    expect(options.extras.sessionInfoVersion).toBe("3");
    expect(JSON.stringify(options)).not.toMatch(/v21/);
  });

  it("keeps default Cloud API onboarding without the CoEx featureType", () => {
    const options = buildEmbeddedSignupLoginOptions("CFG123", "cloud") as any;
    expect(options.extras.featureType).toBeUndefined();
  });

  it("marks FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING as coexistence and skips needing SMS register", () => {
    const session = parseEmbeddedSignupSession({
      type: "WA_EMBEDDED_SIGNUP",
      event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
      version: 3,
      data: { waba_id: "1234567890" },
    });
    expect(session?.is_coexistence).toBe(true);
    expect(session?.migration_type).toBe("coexistence");
    expect(session?.waba_id).toBe("1234567890");
    expect(session?.phone_number_id).toBeUndefined();
  });

  it("maps missing whatsapp_business_management to a partner-facing error", () => {
    const mapped = mapCoexistenceError({
      code: 200,
      message: "Permissions error: whatsapp_business_management",
    });
    expect(mapped.title).toMatch(/Permissão/);
    expect(mapped.message).toMatch(/whatsapp_business_management/);
  });
});
