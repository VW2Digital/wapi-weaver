/// <reference types="jest" />
import {
  resolveContactDisplayName,
  isInstagramPlaceholderName,
} from "@/lib/messaging/services/contact-display.service";

describe("resolveContactDisplayName", () => {
  it("shows real Instagram profile name when available", () => {
    const contact = {
      channel: "instagram",
      name: "Instagram (10869300000000000)",
      custom_fields: {
        instagram_profile_name: "João Silva",
        instagram_username: "joaosilva",
      },
    };
    expect(resolveContactDisplayName(contact)).toBe("João Silva");
  });

  it("shows @username when name is absent but username exists", () => {
    const contact = {
      channel: "instagram",
      name: "Instagram (10869300000000000)",
      custom_fields: {
        instagram_username: "joaosilva",
      },
    };
    expect(resolveContactDisplayName(contact)).toBe("@joaosilva");
  });

  it("keeps existing name when it is already a real value", () => {
    const contact = {
      channel: "instagram",
      name: "Maria Oliveira",
      custom_fields: {},
    };
    expect(resolveContactDisplayName(contact)).toBe("Maria Oliveira");
  });

  it("falls back to Instagram (igsid) when nothing real is available", () => {
    const contact = {
      channel: "instagram",
      name: "Instagram (10869300000000000)",
      phone_e164: "ig_10869300000000000",
      custom_fields: {},
    };
    expect(resolveContactDisplayName(contact)).toBe("Instagram (10869300000000000)");
  });

  it("strips ig_ prefix from phone_e164 for the fallback", () => {
    const contact = {
      channel: "instagram",
      name: "",
      phone_e164: "ig_10869300000000000",
      custom_fields: {},
    };
    expect(resolveContactDisplayName(contact)).toBe("Instagram (10869300000000000)");
  });

  it("keeps WhatsApp name unchanged", () => {
    const contact = {
      channel: "whatsapp",
      name: "+55 11 98888-8888",
      custom_fields: {},
    };
    expect(resolveContactDisplayName(contact)).toBe("+55 11 98888-8888");
  });

  it("returns 'Sem Nome' for non-Instagram contacts without name", () => {
    const contact = {
      channel: "whatsapp",
      name: "",
      custom_fields: {},
    };
    expect(resolveContactDisplayName(contact)).toBe("Sem Nome");
  });
});

describe("isInstagramPlaceholderName", () => {
  it("detects Instagram (id) placeholder", () => {
    expect(isInstagramPlaceholderName("Instagram (1086...)")).toBe(true);
  });

  it("detects ig_ prefix as placeholder", () => {
    expect(isInstagramPlaceholderName("ig_1086...")).toBe(true);
  });

  it("detects plain 'Instagram' as placeholder", () => {
    expect(isInstagramPlaceholderName("Instagram")).toBe(true);
  });

  it("does not flag real names as placeholder", () => {
    expect(isInstagramPlaceholderName("João Silva")).toBe(false);
    expect(isInstagramPlaceholderName("joaosilva")).toBe(false);
  });
});
