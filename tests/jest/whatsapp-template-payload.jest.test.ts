import { describe, expect, it } from "@jest/globals";
import {
  buildMetaComponents,
  compactMetaCreatePayload,
  dropUnknownGraphField,
  looksLikeHttpUrl,
  looksLikeMetaUploadHandle,
  META_TEMPLATE_DETAIL_FIELDS,
  validateTemplateInput,
  type BuildTemplateInput,
} from "../../src/lib/whatsapp-template-payload";
import { toFriendlyError, toFriendlyTemplateError } from "../../src/lib/meta-errors";

const simple: BuildTemplateInput = {
  name: "hello_world_bliv",
  language: "pt_BR",
  category: "UTILITY",
  header: { format: "NONE" },
  body: "Olá, seu pedido foi confirmado.",
};

describe("WhatsApp template payload vs Meta contract", () => {
  it("builds a simple UTILITY template without unused optional fields", () => {
    const components = buildMetaComponents(simple);
    const payload = compactMetaCreatePayload(simple, components);
    expect(payload).toEqual({
      name: "hello_world_bliv",
      language: "pt_BR",
      category: "UTILITY",
      components: [{ type: "BODY", text: "Olá, seu pedido foi confirmado." }],
    });
    expect(payload.parameter_format).toBeUndefined();
    expect(payload.allow_category_change).toBeUndefined();
  });

  it("uses nested body_text array for POSITIONAL variables", () => {
    const input: BuildTemplateInput = {
      ...simple,
      body: "Olá {{1}}, reserva em {{2}}.",
      body_examples: ["Maria", "Hotel Centro"],
    };
    const components = buildMetaComponents(input);
    const body = components.find((c) => c.type === "BODY") as any;
    expect(body.example).toEqual({ body_text: [["Maria", "Hotel Centro"]] });
    const payload = compactMetaCreatePayload(input, components);
    expect(payload.parameter_format).toBeUndefined();
  });

  it("uses body_text_named_params for NAMED variables and sets parameter_format", () => {
    const input: BuildTemplateInput = {
      ...simple,
      body: "Olá {{primeiro_nome}}, código {{codigo}}.",
      body_examples: ["Maria", "A1B2"],
      parameter_format: "NAMED",
    };
    const components = buildMetaComponents(input);
    const body = components.find((c) => c.type === "BODY") as any;
    expect(body.example).toEqual({
      body_text_named_params: [
        { param_name: "primeiro_nome", example: "Maria" },
        { param_name: "codigo", example: "A1B2" },
      ],
    });
    expect(compactMetaCreatePayload(input, components).parameter_format).toBe("NAMED");
  });

  it("rejects mixing positional and named placeholders", () => {
    const fields = validateTemplateInput({
      ...simple,
      body: "Oi {{1}} {{nome}}",
      body_examples: ["a", "b"],
    });
    expect(fields.body).toMatch(/misture/i);
  });

  it("puts Meta upload handle — never a public URL — in header_handle", () => {
    expect(looksLikeHttpUrl("https://cdn.example.com/a.jpg")).toBe(true);
    expect(looksLikeMetaUploadHandle("https://cdn.example.com/a.jpg")).toBe(false);
    const input: BuildTemplateInput = {
      ...simple,
      header: { format: "IMAGE", header_handle: "4:aW1hZ2UtZXhhbXBsZS1oYW5kbGU" },
    };
    const header = buildMetaComponents(input).find((c) => c.type === "HEADER") as any;
    expect(header.example.header_handle[0].startsWith("4:")).toBe(true);
    expect(looksLikeHttpUrl(header.example.header_handle[0])).toBe(false);
  });

  it("rejects http URL as header_handle", () => {
    const fields = validateTemplateInput({
      ...simple,
      header: { format: "IMAGE", header_handle: "https://example.com/x.jpg" },
    });
    expect(fields.header_media).toMatch(/header_handle/);
  });

  it("does not treat library filenames or UUIDs as Meta handles", () => {
    expect(looksLikeMetaUploadHandle("39546b60-0751-4b8c-ae78-2dad773af32e.png")).toBe(false);
    expect(looksLikeMetaUploadHandle("tenant/template-headers/a.png")).toBe(false);
    expect(looksLikeMetaUploadHandle("4:local-draft-placeholder")).toBe(false);
    expect(looksLikeMetaUploadHandle("4:aW1hZ2UtZXhhbXBsZS1oYW5kbGU")).toBe(true);
  });

  it("drops retired bid_spec from Graph field lists", () => {
    expect(META_TEMPLATE_DETAIL_FIELDS).not.toContain("bid_spec");
    expect(META_TEMPLATE_DETAIL_FIELDS).toContain("optimization_spec");
    expect(
      dropUnknownGraphField(
        ["id", "bid_spec", "name"],
        "(#100) Tried accessing nonexisting field (bid_spec)",
      ),
    ).toEqual(["id", "name"]);
  });

  it("rejects incomplete URL buttons", () => {
    const fields = validateTemplateInput({
      ...simple,
      category: "MARKETING",
      buttons: [{ type: "URL", text: "Site", url: "https://" }],
    });
    expect(fields["buttons.0"]).toMatch(/URL/i);
  });

  it("compacts URL / PHONE / QR / OTP buttons per category rules", () => {
    const marketing: BuildTemplateInput = {
      ...simple,
      category: "MARKETING",
      buttons: [
        { type: "QUICK_REPLY", text: "Sim" },
        { type: "URL", text: "Site", url: "https://loja.example/{{1}}", example: ["abc"] },
        { type: "PHONE_NUMBER", text: "Ligar", phone_number: "+5511999998888" },
      ],
    };
    const buttons = (buildMetaComponents(marketing).find((c) => c.type === "BUTTONS") as any)
      .buttons;
    expect(buttons).toEqual([
      { type: "QUICK_REPLY", text: "Sim" },
      { type: "URL", text: "Site", url: "https://loja.example/{{1}}", example: ["abc"] },
      { type: "PHONE_NUMBER", text: "Ligar", phone_number: "+5511999998888" },
    ]);

    const authFields = validateTemplateInput({
      ...simple,
      category: "AUTHENTICATION",
      body: "{{1}} é o seu código.",
      body_examples: ["123456"],
      buttons: [{ type: "QUICK_REPLY", text: "Ok" }],
    });
    expect(authFields["buttons.0"]).toMatch(/OTP/);
  });
});

describe("toFriendlyTemplateError", () => {
  it("maps #100 header_handle without mixing send-message hints", () => {
    const friendly = toFriendlyTemplateError({
      error: {
        message: "(#100) Invalid parameter",
        type: "OAuthException",
        code: 100,
        error_subcode: 2018001,
        error_data: { details: "header_handle: Invalid header handle" },
        fbtrace_id: "TRACE123",
      },
    });
    expect(friendly.title).toMatch(/cadastro do template/i);
    expect(friendly.hint).toMatch(/header_handle/);
    expect(friendly.hint).not.toMatch(/Phone Number ID e o formato do destinatário/);
    expect(String(friendly.code)).toContain("100");
  });

  it("maps Graph nonexisting field without Phone Number ID hint", () => {
    const friendly = toFriendlyError({
      error: {
        message: "(#100) Tried accessing nonexisting field (bid_spec)",
        type: "GraphMethodException",
        code: 100,
      },
    });
    expect(friendly.hint).toMatch(/bid_spec/);
    expect(friendly.hint).not.toMatch(/destinatário/);
  });
});
