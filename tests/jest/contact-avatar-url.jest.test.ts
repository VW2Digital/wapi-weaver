import { describe, expect, it } from "@jest/globals";
import { getContactAvatarUrl } from "@/lib/messaging/services/contact-display.service";

const META_CDN_URL =
  "https://scontent.xx.fbcdn.net/v/t51.2885-15/123456789_n.jpg?_nc_ht=scontent.xx&_nc_cat=1";

describe("getContactAvatarUrl", () => {
  it("does not proxy a WhatsApp contact with a leftover Meta CDN URL (initials fallback)", () => {
    const url = getContactAvatarUrl({
      id: "wa-contact-1",
      channel: "whatsapp",
      name: "Maria Silva",
      custom_fields: { avatar_url: META_CDN_URL },
    });

    expect(url).toBe("");
    expect(url).not.toContain("/api/whatsapp/media");
    expect(url).not.toContain("id=profile");
  });

  it("proxies Instagram profile photos through the authenticated media endpoint", () => {
    expect(
      getContactAvatarUrl({
        id: "ig-contact-1",
        channel: "instagram",
        custom_fields: { avatar_url: META_CDN_URL },
      }),
    ).toBe("/api/whatsapp/media?id=profile&contactId=ig-contact-1");
  });

  it("proxies Messenger profile photos through the authenticated media endpoint", () => {
    expect(
      getContactAvatarUrl({
        id: "fb-contact-1",
        channel: "messenger",
        custom_fields: { photo_url: META_CDN_URL },
      }),
    ).toBe("/api/whatsapp/media?id=profile&contactId=fb-contact-1");
  });
});
