import { describe, expect, it } from "@jest/globals";
import { classifyGalleryKind, formatFileSize, sanitizeGalleryFileName } from "../../src/lib/gallery-media";

describe("gallery media helpers", () => {
  it("classifies common extensions", () => {
    expect(classifyGalleryKind("foto.JPG")).toBe("image");
    expect(classifyGalleryKind("clipe.mp4")).toBe("video");
    expect(classifyGalleryKind("voz.ogg")).toBe("audio");
    expect(classifyGalleryKind("proposta.pdf")).toBe("document");
  });

  it("formats sizes and sanitizes names", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(sanitizeGalleryFileName("meu arquivo?.png")).toBe("meu-arquivo-.png");
  });
});
