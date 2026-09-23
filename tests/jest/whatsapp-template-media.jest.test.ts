import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import {
  assertPublicHttpUrl,
  detectTemplateMediaKind,
  fetchExternalTemplateMedia,
  parseBlivStorageFilePath,
  uploadTemplateMediaHandle,
  validateTemplateMediaBytes,
  TemplateMediaError,
} from "../../src/lib/whatsapp-template-media";
import {
  buildMetaComponents,
  compactMetaCreatePayload,
  stripBlivTemplateFields,
  type BuildTemplateInput,
} from "../../src/lib/whatsapp-template-payload";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function jpegStub(): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes[0] = 0xff;
  bytes[1] = 0xd8;
  bytes[2] = 0xff;
  bytes[3] = 0xd9;
  return bytes;
}

const simple: BuildTemplateInput = {
  name: "promo_banner",
  language: "pt_BR",
  category: "MARKETING",
  header: { format: "IMAGE", header_handle: "4:aaaaaaaaaaaaaaaaaaaaaaaa" },
  body: "Confira a oferta.",
};

describe("template media magic bytes", () => {
  it("accepts JPEG and PNG for IMAGE", () => {
    expect(detectTemplateMediaKind(jpegStub())?.format).toBe("IMAGE");
    expect(detectTemplateMediaKind(new Uint8Array(PNG_1X1))?.mimeType).toBe("image/png");
    expect(validateTemplateMediaBytes({ format: "IMAGE", bytes: new Uint8Array(PNG_1X1) }).mimeType).toBe(
      "image/png",
    );
  });

  it("accepts MP4 ftyp and PDF headers", () => {
    const mp4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
    expect(detectTemplateMediaKind(mp4)?.format).toBe("VIDEO");
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x34]);
    expect(validateTemplateMediaBytes({ format: "DOCUMENT", bytes: pdf }).mimeType).toBe("application/pdf");
  });

  it("rejects fake extension / wrong magic", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(() => validateTemplateMediaBytes({ format: "IMAGE", bytes: pdf, filename: "foto.png" })).toThrow(
      TemplateMediaError,
    );
  });

  it("rejects invalid claimed MIME", () => {
    expect(() =>
      validateTemplateMediaBytes({
        format: "IMAGE",
        bytes: new Uint8Array(PNG_1X1),
        claimedMime: "application/pdf",
      }),
    ).toThrow(/MIME declarado/);
  });

  it("rejects oversized files", () => {
    const bytes = new Uint8Array(5 * 1024 * 1024 + 12);
    bytes[0] = 0xff;
    bytes[1] = 0xd8;
    bytes[2] = 0xff;
    expect(() => validateTemplateMediaBytes({ format: "IMAGE", bytes })).toThrow(/excede/);
  });
});

describe("SSRF guards", () => {
  it("blocks loopback and private IPs", async () => {
    await expect(assertPublicHttpUrl("http://127.0.0.1/secret.jpg")).rejects.toThrow(/SSRF|privado/i);
    await expect(assertPublicHttpUrl("http://10.1.2.3/x")).rejects.toThrow(/SSRF|privado/i);
    await expect(assertPublicHttpUrl("http://localhost/x")).rejects.toThrow(/SSRF|interna/i);
  });
});

describe("Bliv storage URLs", () => {
  it("extracts tenant path from authenticated storage URLs", () => {
    expect(
      parseBlivStorageFilePath(
        "https://app.blivcrm.com/api/storage/file?path=eb98852e-25a1-4aaa-8bbb-ccc%2Fbanner.png&token=secret",
      ),
    ).toBe("eb98852e-25a1-4aaa-8bbb-ccc/banner.png");
    expect(parseBlivStorageFilePath("/api/storage/file?path=tenant%2Fimg.jpg")).toBe("tenant/img.jpg");
    expect(parseBlivStorageFilePath("https://cdn.example.com/photo.jpg")).toBeNull();
  });

  it("refuses to HTTP-fetch authenticated library URLs", async () => {
    await expect(
      fetchExternalTemplateMedia({
        format: "IMAGE",
        sourceUrl: "https://app.blivcrm.com/api/storage/file?path=tenant%2Fa.png",
      }),
    ).rejects.toThrow(/biblioteca|disco/i);
  });
});

describe("payload after upload", () => {
  it("sends only the Meta handle in HEADER and strips local metadata", () => {
    const components = buildMetaComponents(simple);
    components[0]._bliv = { local_path: "tenant/a.png", preview: "https://cdn.example/a.png" };
    const payload = compactMetaCreatePayload(simple, components);
    const header = (payload.components as any[])[0];
    expect(header.example.header_handle[0]).toBe("4:aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(header._bliv).toBeUndefined();
    expect(String(header.example.header_handle[0]).startsWith("http")).toBe(false);
    expect(stripBlivTemplateFields(components)[0]._bliv).toBeUndefined();
  });
});

describe("uploadTemplateMediaHandle", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("returns handle h from resumable session", async () => {
    const fetchMock = jest.fn(async (input: any, init?: any) => {
      const url = String(input);
      if (url.includes("/uploads") && !url.includes("upload:")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ id: "upload:session123" }),
        } as Response;
      }
      expect(init?.headers?.Authorization).toMatch(/^OAuth /);
      expect(init?.headers?.file_offset).toBe("0");
      return {
        ok: true,
        status: 200,
        json: async () => ({ h: "4:bbbbbbbbbbbbbbbbbbbbbbbb" }),
      } as Response;
    });
    global.fetch = fetchMock as any;
    const handle = await uploadTemplateMediaHandle({
      appId: "111",
      accessToken: "token",
      format: "IMAGE",
      filename: "a.png",
      mimeType: "image/png",
      bytes: new Uint8Array(PNG_1X1),
    });
    expect(handle.startsWith("4:")).toBe(true);
  });

  it("maps expired session and auth errors", async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({
        error: { message: "Invalid OAuth access token", code: 190, type: "OAuthException", fbtrace_id: "abc" },
      }),
    })) as any;
    await expect(
      uploadTemplateMediaHandle({
        appId: "111",
        accessToken: "bad",
        format: "IMAGE",
        filename: "a.png",
        mimeType: "image/png",
        bytes: new Uint8Array(PNG_1X1),
      }),
    ).rejects.toThrow(/OAuth|autentica|token|Falha/i);
  });

  it("retries once when the upload session expired", async () => {
    let binaryCalls = 0;
    global.fetch = jest.fn(async (input: any) => {
      const url = String(input);
      if (url.includes("/uploads") && !url.includes("upload:")) {
        return { ok: true, status: 200, json: async () => ({ id: "upload:s" }) } as Response;
      }
      binaryCalls += 1;
      if (binaryCalls === 1) {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: { message: "Upload session has expired", code: 100 } }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ h: "4:cccccccccccccccccccccccc" }) } as Response;
    }) as any;
    const handle = await uploadTemplateMediaHandle({
      appId: "111",
      accessToken: "token",
      format: "IMAGE",
      filename: "a.png",
      mimeType: "image/png",
      bytes: new Uint8Array(PNG_1X1),
    });
    expect(handle).toContain("4:");
    expect(binaryCalls).toBe(2);
  });
});
