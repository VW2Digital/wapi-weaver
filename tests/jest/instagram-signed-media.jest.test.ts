import { describe, expect, it, afterEach } from "@jest/globals";
import {
  applyInstagramSignedMediaLinks,
  createInstagramSignedMediaUrl,
  extractLocalStoragePath,
  isPublicHttpsUrl,
  verifyInstagramSignedMedia,
} from "@/lib/instagram-signed-media";

describe("instagram signed media", () => {
  const previousAppUrl = process.env.APP_URL;

  afterEach(() => {
    process.env.APP_URL = previousAppUrl;
  });

  it("rejeita localhost e IPs privados", () => {
    expect(isPublicHttpsUrl("http://app.blivcrm.com")).toBe(false);
    expect(isPublicHttpsUrl("https://localhost:8080")).toBe(false);
    expect(isPublicHttpsUrl("https://127.0.0.1")).toBe(false);
    expect(isPublicHttpsUrl("https://192.168.0.10/file")).toBe(false);
    expect(isPublicHttpsUrl("https://app.blivcrm.com")).toBe(true);
  });

  it("extrai path autenticado do storage da Bliv", () => {
    expect(
      extractLocalStoragePath(
        "https://app.blivcrm.com/api/storage/file?path=tenant-1%2F2026%2F09%2Fphoto.jpg",
      ),
    ).toBe("tenant-1/2026/09/photo.jpg");
  });

  it("gera URL assinada e rejeita outro tenant", () => {
    process.env.APP_URL = "https://app.blivcrm.com";
    const url = createInstagramSignedMediaUrl({
      tenantId: "tenant-1",
      mediaPath: "tenant-1/2026/09/photo.jpg",
      now: new Date("2026-09-22T20:00:00Z"),
    });
    expect(url.startsWith("https://app.blivcrm.com/api/public/instagram-media?")).toBe(true);
    expect(url.includes("/api/storage/file")).toBe(false);
    expect(() =>
      createInstagramSignedMediaUrl({
        tenantId: "tenant-1",
        mediaPath: "tenant-2/2026/09/photo.jpg",
      }),
    ).toThrow(/tenant/);
  });

  it("rejeita assinatura expirada e path traversal", () => {
    process.env.APP_URL = "https://app.blivcrm.com";
    const url = createInstagramSignedMediaUrl({
      tenantId: "tenant-1",
      mediaPath: "tenant-1/2026/09/photo.jpg",
      ttlSeconds: 60,
      now: new Date("2026-09-22T20:00:00Z"),
    });
    const parsed = new URL(url);
    expect(() =>
      verifyInstagramSignedMedia({
        path: parsed.searchParams.get("path"),
        exp: parsed.searchParams.get("exp"),
        sig: parsed.searchParams.get("sig"),
        now: new Date("2026-09-22T20:05:00Z"),
      }),
    ).toThrow(/expirada/);
    expect(() =>
      createInstagramSignedMediaUrl({
        tenantId: "tenant-1",
        mediaPath: "tenant-1/../secret.jpg",
      }),
    ).toThrow(/inválido/);
  });

  it("reescreve link autenticado no payload na hora do envio", () => {
    process.env.APP_URL = "https://app.blivcrm.com";
    const rewritten = applyInstagramSignedMediaLinks(
      {
        type: "image",
        image: { link: "/api/storage/file?path=tenant-1%2F2026%2F09%2Fa.jpg" },
        local_file_path: "tenant-1/2026/09/a.jpg",
      },
      "tenant-1",
    );
    expect(rewritten.image.link).toContain("/api/public/instagram-media?");
    expect(rewritten.image.id).toBeNull();
  });
});
