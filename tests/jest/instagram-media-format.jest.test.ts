import { describe, expect, it } from "@jest/globals";
import {
  inferInstagramVideoMime,
  isAcceptedInstagramVideoMime,
} from "@/lib/instagram-media-format";

describe("instagram media format", () => {
  it("aceita MOV do iPhone mesmo quando o mime vem vazio", () => {
    expect(inferInstagramVideoMime("", "IMG_1234.MOV")).toBe("video/quicktime");
    expect(isAcceptedInstagramVideoMime("video/quicktime")).toBe(true);
  });

  it("aceita webm gravado no navegador", () => {
    expect(inferInstagramVideoMime("video/webm;codecs=vp9", "gravacao.webm")).toBe("video/webm");
    expect(isAcceptedInstagramVideoMime("video/webm")).toBe(true);
  });

  it("rejeita mime que não é vídeo de envio", () => {
    expect(isAcceptedInstagramVideoMime("application/pdf")).toBe(false);
  });
});
