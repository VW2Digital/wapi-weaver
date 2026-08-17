import { normalizeBotFlowMessageType } from "@/lib/bot-registry";

type JsonObject = Record<string, unknown>;

export type WhatsAppBotStep = { id?: string; message_type?: string | null; message_content?: string | null; media_url?: string | null; media_caption?: string | null; footer_text?: string | null; buttons_config?: unknown; filename?: string | null; original_filename?: string | null };
export type WhatsAppMessageBuildResult =
  | { ok: true; payload: JsonObject; meta: { botflowType: string; metaType: string; interactiveType?: string } }
  | { ok: false; code: "BOTFLOW_INVALID_WHATSAPP_ACTION"; message: string };

const MEDIA_TYPES = ["image", "video", "audio", "document", "sticker"] as const;
const MEDIA_EXTENSIONS: Record<(typeof MEDIA_TYPES)[number], string[]> = {
  image: ["jpg", "jpeg", "png"], video: ["mp4", "3gp"], audio: ["aac", "amr", "mp3", "m4a", "ogg"],
  document: ["txt", "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"], sticker: ["webp"],
};
const invalid = (message: string): WhatsAppMessageBuildResult => ({ ok: false, code: "BOTFLOW_INVALID_WHATSAPP_ACTION", message });
const object = (value: unknown): JsonObject | null => value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
function config(value: unknown): JsonObject { if (typeof value === "string") { try { return object(JSON.parse(value)) || {}; } catch { return {}; } } return object(value) || {}; }
const text = (value: unknown): string => String(value ?? "").trim();
function mediaReference(value: unknown): { id: string } | { link: string } | null { const ref = text(value); if (!ref) return null; if (/^https:\/\//i.test(ref)) return { link: ref }; if (/^\d{6,30}$/.test(ref)) return { id: ref }; return null; }
function extension(ref: string): string { try { return new URL(ref).pathname.split(".").pop()?.toLowerCase() || ""; } catch { return ref.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase() || ""; } }
function base(to: string, contextMessageId?: string | null): JsonObject { return { messaging_product: "whatsapp", recipient_type: "individual", to, ...(contextMessageId ? { context: { message_id: contextMessageId } } : {}) }; }
function success(payload: JsonObject, botflowType: string, metaType: string, interactiveType?: string): WhatsAppMessageBuildResult { return { ok: true, payload, meta: { botflowType, metaType, ...(interactiveType ? { interactiveType } : {}) } }; }
function requireText(value: string, label: string, max: number): string | WhatsAppMessageBuildResult { if (!value) return invalid(`${label} é obrigatório.`); if (value.length > max) return invalid(`${label} excede ${max} caracteres.`); return value; }

/** Compila ações do BotFlow em payloads oficiais para /{phone-number-id}/messages. */
export function buildWhatsAppBotMessage(to: string, step: WhatsAppBotStep, contextMessageId?: string | null): WhatsAppMessageBuildResult {
  const rawType = text(step.message_type || "text"); const type = normalizeBotFlowMessageType(rawType); const body = text(step.message_content);
  const cfg = config(step.buttons_config); const action = object(cfg.action) || {}; const context = Boolean(cfg.reply_to_incoming || action.reply_to_incoming) ? contextMessageId : null; const payloadBase = base(to, context);
  if (type === "text") { const value = requireText(body, "Texto da mensagem", 4096); if (typeof value !== "string") return value; return success({ ...payloadBase, type: "text", text: { preview_url: Boolean(cfg.preview_url ?? action.preview_url), body: value } }, type, "text"); }
  if ((MEDIA_TYPES as readonly string[]).includes(type)) {
    const ref = mediaReference(step.media_url); if (!ref) return invalid(`${type} exige uma mídia válida (ID Meta ou URL HTTPS).`);
    if ("link" in ref) { const ext = extension(ref.link); if (!MEDIA_EXTENSIONS[type as (typeof MEDIA_TYPES)[number]].includes(ext)) return invalid(`Formato .${ext || "desconhecido"} não é suportado para ${type}.`); }
    const media: JsonObject = { ...ref }; const caption = text(step.media_caption || body);
    if (caption && ["image", "video", "document"].includes(type)) { if (caption.length > 1024) return invalid("Legenda excede 1024 caracteres."); media.caption = caption; }
    if (type === "audio" && Boolean(action.voice ?? cfg.voice)) media.voice = true;
    if (type === "document") { const filename = text(step.filename || step.original_filename || action.filename); if (filename) media.filename = filename; }
    return success({ ...payloadBase, type, [type]: media }, type, type);
  }
  if (type === "buttons") {
    const source = Array.isArray(action.buttons) ? action.buttons : []; if (source.length < 1 || source.length > 3) return invalid("Botões de resposta exigem entre 1 e 3 opções.");
    const ids = new Set<string>(); const buttons: JsonObject[] = [];
    for (const raw of source) { const button = object(raw); const reply = object(button?.reply) || button; const id = text(reply?.id); const title = text(reply?.title); if (!id || !title) return invalid("Cada botão exige id e título."); if (id.length > 256 || title.length > 20) return invalid("ID ou título de botão excede o limite da Meta."); if (ids.has(id)) return invalid("Os IDs dos botões devem ser únicos."); ids.add(id); buttons.push({ type: "reply", reply: { id, title } }); }
    const validBody = requireText(body, "Texto dos botões", 1024); if (typeof validBody !== "string") return validBody;
    const headerCfg = object(action.header) || {}; let header: JsonObject | undefined;
    if (rawType === "image_buttons") { const ref = mediaReference(step.media_url); if (!ref) return invalid("Imagem com botões exige uma imagem."); header = { type: "image", image: ref }; }
    else if (text(headerCfg.type) === "text") { const headerText = requireText(text(headerCfg.text), "Cabeçalho", 60); if (typeof headerText !== "string") return headerText; header = { type: "text", text: headerText }; }
    else if (["image", "video", "document"].includes(text(headerCfg.type))) { const headerType = text(headerCfg.type); const ref = mediaReference(headerCfg.media || step.media_url); if (!ref) return invalid(`Cabeçalho ${headerType} exige mídia.`); header = { type: headerType, [headerType]: ref }; }
    else if (step.media_url) {
      const ref = mediaReference(step.media_url);
      const mediaName = text(step.filename || step.original_filename);
      const mediaExt = extension(mediaName || text(step.media_url));
      const inferredHeaderType = MEDIA_EXTENSIONS.document.includes(mediaExt)
        ? "document"
        : MEDIA_EXTENSIONS.video.includes(mediaExt)
          ? "video"
          : MEDIA_EXTENSIONS.image.includes(mediaExt)
            ? "image"
            : "";
      if (ref && inferredHeaderType) {
        const headerMedia = inferredHeaderType === "document" && mediaName
          ? { ...ref, filename: mediaName }
          : ref;
        header = { type: inferredHeaderType, [inferredHeaderType]: headerMedia };
      }
    }
    const footer = text(step.footer_text); if (footer.length > 60) return invalid("Rodapé excede 60 caracteres.");
    return success({ ...payloadBase, type: "interactive", interactive: { type: "button", ...(header ? { header } : {}), body: { text: validBody }, ...(footer ? { footer: { text: footer } } : {}), action: { buttons } } }, type, "interactive", "button");
  }
  if (type === "list" || type === "poll") {
    const source = type === "poll" ? (Array.isArray(action.options) ? action.options : []) : (Array.isArray(action.sections) ? action.sections : []);
    const sections = type === "poll" ? [{ rows: source.map((entry) => { const o = object(entry); return { id: text(o?.id), title: text(o?.title || o?.label), ...(text(o?.description) ? { description: text(o?.description) } : {}) }; }) }] : source.map((entry) => { const s = object(entry) || {}; return { ...(text(s.title) ? { title: text(s.title) } : {}), rows: (Array.isArray(s.rows) ? s.rows : []).map((row) => { const r = object(row); return { id: text(r?.id), title: text(r?.title), ...(text(r?.description) ? { description: text(r?.description) } : {}) }; }) }; });
    const rows = sections.flatMap((s) => s.rows); if (!rows.length || rows.length > 10) return invalid("A lista exige entre 1 e 10 opções no total."); const ids = new Set<string>();
    for (const row of rows) { if (!row.id || !row.title || row.id.length > 200 || row.title.length > 24 || (row.description && row.description.length > 72) || ids.has(row.id)) return invalid("Cada opção da lista exige id/título válidos e únicos."); ids.add(row.id); }
    const validBody = requireText(body, "Texto da lista", 1024); if (typeof validBody !== "string") return validBody; const button = text(action.button || (type === "poll" ? "Escolher" : "Ver opções")); if (!button || button.length > 20) return invalid("Texto do botão da lista é inválido.");
    return success({ ...payloadBase, type: "interactive", interactive: { type: "list", ...(text(action.header) ? { header: { type: "text", text: text(action.header) } } : {}), body: { text: validBody }, ...(text(step.footer_text) ? { footer: { text: text(step.footer_text) } } : {}), action: { button, sections } } }, type, "interactive", "list");
  }
  if (type === "product_list") {
    const catalogId = text(action.catalog_id); const header = text(action.header); const validBody = requireText(body, "Texto da lista de produtos", 1024);
    if (typeof validBody !== "string") return validBody;
    if (!catalogId || !header) return invalid("Lista de produtos exige Catalog ID e cabeçalho.");
    const rawSections = Array.isArray(action.sections) ? action.sections : [];
    if (!rawSections.length || rawSections.length > 10) return invalid("Lista de produtos exige entre 1 e 10 seções.");
    const sections: JsonObject[] = [];
    for (const rawSection of rawSections) {
      const section = object(rawSection) || {}; const title = text(section.title); const items = Array.isArray(section.product_items) ? section.product_items : [];
      if (!title || !items.length || items.length > 30) return invalid("Cada seção exige título e de 1 a 30 produtos.");
      const product_items = items.map((item) => ({ product_retailer_id: text(object(item)?.product_retailer_id) }));
      if (product_items.some((item) => !item.product_retailer_id)) return invalid("Cada produto exige o Retailer ID.");
      sections.push({ title, product_items });
    }
    const footer = text(step.footer_text); if (footer.length > 60) return invalid("Rodapé excede 60 caracteres.");
    return success({ ...payloadBase, type: "interactive", interactive: { type: "product_list", header: { type: "text", text: header }, body: { text: validBody }, ...(footer ? { footer: { text: footer } } : {}), action: { catalog_id: catalogId, sections } } }, type, "interactive", "product_list");
  }
  if (type === "catalog_message") {
    const validBody = requireText(body, "Texto da mensagem de catálogo", 1024);
    if (typeof validBody !== "string") return validBody;
    const parameters = object(action.parameters) || {};
    const thumbnail = text(parameters.thumbnail_product_retailer_id);
    const footer = text(step.footer_text); if (footer.length > 60) return invalid("Rodapé excede 60 caracteres.");
    return success({ ...payloadBase, type: "interactive", interactive: { type: "catalog_message", body: { text: validBody }, ...(footer ? { footer: { text: footer } } : {}), action: { name: "catalog_message", parameters: { ...(thumbnail ? { thumbnail_product_retailer_id: thumbnail } : {}) } } } }, type, "interactive", "catalog_message");
  }
  if (type === "cta_url") { const params = object(action.parameters) || action; const url = text(params.url); const display = text(params.display_text || params.button); const validBody = requireText(body, "Texto do CTA", 1024); if (typeof validBody !== "string") return validBody; try { if (new URL(url).protocol !== "https:") return invalid("CTA exige URL HTTPS."); } catch { return invalid("CTA exige URL válida."); } if (!display || display.length > 20) return invalid("CTA exige texto de botão de até 20 caracteres."); return success({ ...payloadBase, type: "interactive", interactive: { type: "cta_url", body: { text: validBody }, action: { name: "cta_url", parameters: { display_text: display, url } } } }, type, "interactive", "cta_url"); }
  if (type === "pix") { const key = text(action.copyPaste || action.pixKey); const amount = text(action.amount); const description = text(action.description); if (!key) return invalid("PIX exige código Copia e Cola ou chave PIX."); const value = requireText([body, amount ? `Valor: ${amount}` : "", description, `PIX: ${key}`].filter(Boolean).join("\n"), "Mensagem PIX", 4096); if (typeof value !== "string") return value; return success({ ...payloadBase, type: "text", text: { preview_url: false, body: value } }, type, "text"); }
  if (["link_ai_agent", "transfer_chat", "create_chat"].includes(type)) return invalid(`${type} é uma ação interna e deve ser executada pelo motor do fluxo.`);
  return invalid(`Tipo de ação WhatsApp não suportado: ${rawType}.`);
}
