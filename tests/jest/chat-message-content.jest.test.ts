import { resolveSharedContactsData } from "../../src/lib/chat-message-content";
import { describe, expect, it } from "@jest/globals";

describe("resolveSharedContactsData", () => {
  const senderContacts = [{ wa_id: "5591985646076", profile: { name: "Cliente" } }];
  const sharedContacts = [
    { name: { formatted_name: "Maria" }, phones: [{ phone: "+5591999999999" }] },
  ];

  it("does not turn an inbound text sender into a shared-contact card", () => {
    expect(
      resolveSharedContactsData("text", { contacts: senderContacts }, { type: "text" }, null),
    ).toBeNull();
  });

  it("does not turn inbound media sender metadata into a shared-contact card", () => {
    expect(
      resolveSharedContactsData(
        "image",
        { contacts: senderContacts },
        { type: "image", image: { id: "media-id" } },
        null,
      ),
    ).toBeNull();
  });

  it("keeps legacy contact-card rows working", () => {
    expect(
      resolveSharedContactsData("contacts", { contacts: sharedContacts }, null, null),
    ).toEqual(sharedContacts);
  });

  it("reads a real inbound shared-contact payload from the message", () => {
    expect(
      resolveSharedContactsData(
        "text",
        { contacts: senderContacts },
        { type: "contacts", contacts: sharedContacts },
        null,
      ),
    ).toEqual(sharedContacts);
  });
});
