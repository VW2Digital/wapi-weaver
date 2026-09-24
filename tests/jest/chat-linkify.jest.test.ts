import { describe, expect, it } from "@jest/globals";
import { extractHttpUrls, linkifyHtml, normalizeExtractedUrl } from "../../src/lib/chat-linkify";

describe("chat linkify", () => {
  it("extracts http(s) urls and strips trailing punctuation", () => {
    const text =
      "Segue o link: https://calendar.app.google/hUuTgprW32SUZvZk8.";
    expect(extractHttpUrls(text)).toEqual(["https://calendar.app.google/hUuTgprW32SUZvZk8"]);
    expect(normalizeExtractedUrl("javascript:alert(1)")).toBeNull();
  });

  it("turns urls into safe anchors after html escape", () => {
    const html = linkifyHtml("veja https://blivcrm.com/app");
    expect(html).toContain('href="https://blivcrm.com/app"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("noopener");
  });
});
