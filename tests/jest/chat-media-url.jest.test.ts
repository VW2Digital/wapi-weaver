import { describe, expect, it } from "@jest/globals";
import {
  decodeDataUrl,
  normalizeGraphScopedId,
  pickPreferredMediaRef,
} from "@/lib/chat-media-url";

describe("pickPreferredMediaRef", () => {
  it("prefers an embedded data URL over an expired Graph media id", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
    expect(pickPreferredMediaRef("1022849364123613", dataUrl)).toBe(dataUrl);
    expect(pickPreferredMediaRef("1022849364123613", dataUrl)).not.toMatch(/^\d+$/);
  });

  it("prefers a local storage path over a Graph media id", () => {
    expect(
      pickPreferredMediaRef(
        "1086503870395190",
        "/api/storage/file?path=tenant/2026/08/file.jpg",
      ),
    ).toBe("/api/storage/file?path=tenant/2026/08/file.jpg");
  });
});

describe("decodeDataUrl", () => {
  it("decodes a PNG data URL into bytes", () => {
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
    const decoded = decodeDataUrl(dataUrl);
    expect(decoded?.mime).toBe("image/png");
    expect(decoded?.bytes.byteLength).toBeGreaterThan(16);
    expect(decoded?.bytes[0]).toBe(0x89);
  });
});

describe("normalizeGraphScopedId", () => {
  it("strips ig_ so Instagram profile_pic can be fetched", () => {
    expect(normalizeGraphScopedId("ig_2562048147648251")).toBe("2562048147648251");
    expect(normalizeGraphScopedId("2562048147648251")).toBe("2562048147648251");
  });
});
