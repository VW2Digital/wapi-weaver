import { buildWhatsAppBotMessage } from "@/lib/meta-whatsapp-message";
import { describe, expect, test } from "@jest/globals";

const to = "5511999999999";
const buttonConfig = { action: { buttons: [{ reply: { id: "yes", title: "Sim" } }, { reply: { id: "no", title: "Não" } }] } };

describe("buildWhatsAppBotMessage", () => {
  test("gera texto com preview e contexto somente quando solicitado", () => {
    const noContext = buildWhatsAppBotMessage(to, { message_type: "text", message_content: "Olá", buttons_config: { preview_url: true } }, "wamid.in");
    expect(noContext).toMatchObject({ ok: true, payload: { type: "text", text: { body: "Olá", preview_url: true } } });
    expect((noContext as any).payload.context).toBeUndefined();
    const withContext = buildWhatsAppBotMessage(to, { message_type: "text", message_content: "Olá", buttons_config: { reply_to_incoming: true } }, "wamid.in");
    expect(withContext).toMatchObject({ ok: true, payload: { context: { message_id: "wamid.in" } } });
  });

  test("gera mídia por ID e URL oficial", () => {
    expect(buildWhatsAppBotMessage(to, { message_type: "image", media_url: "123456789012", media_caption: "foto" })).toMatchObject({ ok: true, payload: { type: "image", image: { id: "123456789012", caption: "foto" } } });
    expect(buildWhatsAppBotMessage(to, { message_type: "video", media_url: "https://cdn.example.com/movie.mp4" })).toMatchObject({ ok: true, payload: { type: "video", video: { link: "https://cdn.example.com/movie.mp4" } } });
  });

  test("mantém áudio voz e nome real do documento", () => {
    expect(buildWhatsAppBotMessage(to, { message_type: "audio", media_url: "https://cdn.example.com/a.ogg", buttons_config: { voice: true } })).toMatchObject({ ok: true, payload: { audio: { voice: true } } });
    expect(buildWhatsAppBotMessage(to, { message_type: "document", media_url: "123456789012", original_filename: "proposta.pdf", media_caption: "Proposta" })).toMatchObject({ ok: true, payload: { document: { id: "123456789012", filename: "proposta.pdf", caption: "Proposta" } } });
  });

  test("inclui PDF anexado como cabeçalho de botões de resposta", () => {
    expect(buildWhatsAppBotMessage("5511999999999", {
      message_type: "buttons",
      message_content: "Escolha uma opção",
      media_url: "123456789012",
      original_filename: "contrato.pdf",
      buttons_config: {
        action: {
          buttons: [{ type: "reply", reply: { id: "aceitar", title: "Aceitar" } }],
        },
      },
    })).toMatchObject({
      ok: true,
      payload: {
        interactive: {
          header: {
            type: "document",
            document: { id: "123456789012", filename: "contrato.pdf" },
          },
        },
      },
    });
  });

  test("normaliza dynamic_buttons e valida limite", () => {
    expect(buildWhatsAppBotMessage(to, { message_type: "dynamic_buttons", message_content: "Escolha", buttons_config: buttonConfig })).toMatchObject({ ok: true, payload: { type: "interactive", interactive: { type: "button" } } });
    expect(buildWhatsAppBotMessage(to, { message_type: "buttons", message_content: "Escolha", buttons_config: { action: { buttons: [...buttonConfig.action.buttons, { reply: { id: "x", title: "X" } }, { reply: { id: "y", title: "Y" } }] } } }).ok).toBe(false);
  });

  test("imagem com botões, lista e enquete nunca usam tipos inválidos", () => {
    expect(buildWhatsAppBotMessage(to, { message_type: "image_buttons", message_content: "Escolha", media_url: "123456789012", buttons_config: buttonConfig })).toMatchObject({ ok: true, payload: { type: "interactive", interactive: { header: { type: "image" } } } });
    const list = buildWhatsAppBotMessage(to, { message_type: "list", message_content: "Menu", buttons_config: { action: { button: "Abrir", sections: [{ rows: [{ id: "a", title: "A" }] }] } } });
    expect(list).toMatchObject({ ok: true, payload: { type: "interactive", interactive: { type: "list" } } });
    const poll = buildWhatsAppBotMessage(to, { message_type: "poll", message_content: "Qual?", buttons_config: { action: { options: [{ id: "a", title: "A" }, { id: "b", title: "B" }] } } });
    expect(poll).toMatchObject({ ok: true, payload: { type: "interactive", interactive: { type: "list" } } });
  });

  test("rejeita lista acima do máximo, CTA inseguro e ações internas", () => {
    const rows = Array.from({ length: 11 }, (_, i) => ({ id: String(i), title: `Opção ${i}` }));
    expect(buildWhatsAppBotMessage(to, { message_type: "list", message_content: "Menu", buttons_config: { action: { sections: [{ rows }] } } }).ok).toBe(false);
    expect(buildWhatsAppBotMessage(to, { message_type: "cta_url", message_content: "Abrir", buttons_config: { action: { parameters: { display_text: "Abrir", url: "http://inseguro.example" } } } }).ok).toBe(false);
    expect(buildWhatsAppBotMessage(to, { message_type: "transfer_chat" }).ok).toBe(false);
  });

  test("PIX compila como texto e nunca como payload pix", () => {
    const result = buildWhatsAppBotMessage(to, { message_type: "pix", message_content: "Pagamento", buttons_config: { action: { copyPaste: "000201abc", amount: "R$ 10" } } });
    expect(result).toMatchObject({ ok: true, payload: { type: "text", text: { body: expect.stringContaining("000201abc") } } });
  });

  test("gera lista de produtos como mensagem interativa oficial", () => {
    const result = buildWhatsAppBotMessage(to, {
      message_type: "product_list",
      message_content: "Veja nossos produtos",
      buttons_config: { action: { catalog_id: "catalog-1", header: "Ofertas", sections: [{ title: "Destaques", product_items: [{ product_retailer_id: "SKU-1" }] }] } },
    });
    expect(result).toMatchObject({ ok: true, payload: { type: "interactive", interactive: { type: "product_list", action: { catalog_id: "catalog-1", sections: [{ product_items: [{ product_retailer_id: "SKU-1" }] }] } } } });
  });

  test("gera mensagem de catálogo sem usar type catalog_message no topo", () => {
    const result = buildWhatsAppBotMessage(to, {
      message_type: "catalog_message",
      message_content: "Confira nosso catálogo",
      buttons_config: { action: { name: "catalog_message", parameters: { thumbnail_product_retailer_id: "SKU-CAPA" } } },
    });
    expect(result).toMatchObject({ ok: true, payload: { type: "interactive", interactive: { type: "catalog_message", action: { name: "catalog_message", parameters: { thumbnail_product_retailer_id: "SKU-CAPA" } } } } });
  });
});
