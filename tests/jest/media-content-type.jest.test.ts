import { resolveMediaContentType } from "../../src/lib/media-content-type";
import { describe, expect, test } from "@jest/globals";

describe("resolveMediaContentType", () => {
  test("serve arquivo .ogg como audio/ogg", () => {
    expect(
      resolveMediaContentType({
        fileName: "tenant/outbound-audio/audio.ogg",
        bytes: new Uint8Array(),
      }),
    ).toBe("audio/ogg");
  });

  test("detecta Ogg pelos bytes mesmo sem extensão e com MIME genérico", () => {
    expect(
      resolveMediaContentType({
        fileName: "registro-sem-extensao",
        declaredMimeType: "application/octet-stream",
        upstreamContentType: "application/octet-stream",
        bytes: new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00]),
      }),
    ).toBe("audio/ogg");
  });

  test("preserva MIME específico retornado pela origem", () => {
    expect(
      resolveMediaContentType({
        bytes: new Uint8Array(),
        upstreamContentType: "audio/mpeg; charset=binary",
      }),
    ).toBe("audio/mpeg");
  });
});
