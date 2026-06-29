import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { toFriendlyError } from "@/lib/meta-errors";

const buttonSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("QUICK_REPLY"), text: z.string().min(1).max(25) }),
  z.object({
    type: z.literal("URL"),
    text: z.string().min(1).max(25),
    url: z.string().url().max(2000),
    example: z.array(z.string().max(2000)).max(1).optional(),
  }),
  z.object({
    type: z.literal("PHONE_NUMBER"),
    text: z.string().min(1).max(25),
    phone_number: z.string().min(5).max(20),
  }),
  z.object({
    type: z.literal("COPY_CODE"),
    example: z.array(z.string().min(1).max(15)).min(1).max(1),
  }),
  z.object({ type: z.literal("CATALOG"), text: z.string().min(1).max(25).default("Ver catálogo") }),
  z.object({ type: z.literal("MPM"), text: z.string().min(1).max(25).default("Ver produtos") }),
  z.object({
    type: z.literal("FLOW"),
    text: z.string().min(1).max(25),
    flow_id: z.string().min(1).max(64),
    flow_action: z.enum(["navigate", "data_exchange"]).default("navigate"),
    navigate_screen: z.string().max(64).optional(),
  }),
  z.object({
    type: z.literal("OTP"),
    otp_type: z.enum(["COPY_CODE", "ONE_TAP", "ZERO_TAP"]),
    text: z.string().min(1).max(25).optional(),
    autofill_text: z.string().max(25).optional(),
    package_name: z.string().max(224).optional(),
    signature_hash: z.string().max(64).optional(),
  }),
  z.object({
    type: z.literal("VOICE_CALL"),
    text: z.string().min(1).max(25),
  }),
]);

const createTemplateInput = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .regex(/^[a-z0-9_]+$/, "Use apenas letras minúsculas, números e _"),
  language: z.string().min(2).max(10),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  header: z.discriminatedUnion("format", [
    z.object({ format: z.literal("NONE") }),
    z.object({
      format: z.literal("TEXT"),
      text: z.string().min(1).max(60),
      examples: z.array(z.string().max(200)).max(10).optional(),
    }),
    z.object({ format: z.literal("IMAGE"), example_url: z.string().url() }),
    z.object({ format: z.literal("VIDEO"), example_url: z.string().url() }),
    z.object({ format: z.literal("DOCUMENT"), example_url: z.string().url() }),
    z.object({ format: z.literal("LOCATION") }),
  ]),
  body: z.string().min(1).max(1024),
  body_examples: z.array(z.string().max(200)).max(20).optional(),
  footer: z.string().max(60).optional(),
  buttons: z.array(buttonSchema).max(10).optional(),
  parameter_format: z.enum(["NAMED", "POSITIONAL"]).optional(),
  allow_category_change: z.boolean().optional(),
  cta_url_link_tracking_opted_out: z.boolean().optional(),
  message_send_ttl_seconds: z.number().int().positive().optional(),
  sub_category: z
    .enum([
      "BOOKING_STATUS",
      "CALL_PERMISSIONS_REQUEST",
      "FLIGHT_DELAY_AND_GATE_CHANGE_ALERT",
      "FRAUD_ALERT",
      "ORDER_DETAILS",
      "ORDER_STATUS",
      "RICH_ORDER_STATUS",
    ])
    .optional(),
  display_format: z.enum(["ORDER_DETAILS"]).optional(),
  is_primary_device_delivery_only: z.boolean().optional(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateInput>;

function extractTemplatePlaceholders(text: string) {
  const matches = String(text ?? "").match(/\{\{\s*([^}]+)\s*\}\}/g) ?? [];
  const placeholders: string[] = [];
  for (const match of matches) {
    const token = match.replace(/^\{\{\s*|\s*\}\}$/g, "").trim();
    if (token && !placeholders.includes(token)) placeholders.push(token);
  }
  return placeholders;
}

function buildMetaComponents(input: CreateTemplateInput) {
  const components: any[] = [];
  if (input.header.format !== "NONE") {
    if (input.header.format === "TEXT") {
      const h: any = { type: "HEADER", format: "TEXT", text: input.header.text };
      if (input.header.examples && input.header.examples.length > 0) {
        h.example = { header_text: input.header.examples };
      }
      components.push(h);
    } else if (input.header.format === "LOCATION") {
      components.push({ type: "HEADER", format: "LOCATION" });
    } else {
      components.push({
        type: "HEADER",
        format: input.header.format,
        example: { header_handle: [input.header.example_url] },
      });
    }
  }
  const bodyComp: any = { type: "BODY", text: input.body };
  if (input.body_examples && input.body_examples.length > 0) {
    if (input.parameter_format === "NAMED") {
      const placeholders = extractTemplatePlaceholders(input.body).filter(
        (token) => !/^\d+$/.test(token),
      );
      bodyComp.example = {
        body_text_named_params: placeholders.map((paramName, index) => ({
          param_name: paramName,
          example: input.body_examples?.[index] ?? "",
        })),
      };
    } else {
      bodyComp.example = { body_text: [input.body_examples] };
    }
  }
  components.push(bodyComp);
  if (input.footer && input.footer.trim()) {
    components.push({ type: "FOOTER", text: input.footer.trim() });
  }
  if (input.buttons && input.buttons.length > 0) {
    components.push({ type: "BUTTONS", buttons: input.buttons });
  }
  return components;
}

export const createTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => createTemplateInput.parse(d))
  .handler(async ({ data, context }) => {
    const bodyPlaceholders = extractTemplatePlaceholders(data.body);
    if (bodyPlaceholders.length > 0) {
      const missingExamples = bodyPlaceholders.filter(
        (_, index) => !data.body_examples?.[index]?.trim(),
      );
      if (missingExamples.length > 0) {
        throw new Error(
          "Preencha um exemplo para cada variável do corpo do template antes de enviar para a Meta.",
        );
      }
    }

    const components = buildMetaComponents(data);

    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_waba_id, whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    let status = "PENDING";
    let meta_template_id: string | null = null;

    if (p?.whatsapp_waba_id && p?.whatsapp_access_token) {
      const apiVersion = p.meta_graph_version || "v20.0";
      const res = await fetch(
        `https://graph.facebook.com/${apiVersion}/${p.whatsapp_waba_id}/message_templates`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${p.whatsapp_access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: data.name,
            language: data.language,
            category: data.category,
            components,
            parameter_format: data.parameter_format,
            allow_category_change: data.allow_category_change,
            cta_url_link_tracking_opted_out: data.cta_url_link_tracking_opted_out,
            message_send_ttl_seconds: data.message_send_ttl_seconds,
            sub_category: data.sub_category,
            display_format: data.display_format,
            is_primary_device_delivery_only: data.is_primary_device_delivery_only,
          }),
        },
      );
      const body: any = await res.json();
      if (!res.ok) {
        const friendly = toFriendlyError(body, "Falha ao enviar template à Meta");
        throw new Error(
          `${friendly.title}: ${friendly.message}${friendly.hint ? `\n\n💡 Dica: ${friendly.hint}` : ""}`,
        );
      }
      status = body.status ?? "PENDING";
      meta_template_id = body.id ?? null;
    }

    const { data: row, error } = await context.db
      .from("templates")
      .upsert(
        {
          user_id: context.userId,
          name: data.name,
          language: data.language,
          category: data.category,
          status: status as any,
          components,
          parameter_format: data.parameter_format,
          allow_category_change: data.allow_category_change ? 1 : 0,
          cta_url_link_tracking_opted_out: data.cta_url_link_tracking_opted_out ? 1 : 0,
          message_send_ttl_seconds: data.message_send_ttl_seconds,
          sub_category: data.sub_category,
          display_format: data.display_format,
          is_primary_device_delivery_only: data.is_primary_device_delivery_only ? 1 : 0,
          meta_template_id: meta_template_id ?? `local_${data.name}_${data.language}`,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,name,language" },
      )
      .select()
      .single();
    if (error) throw error;
    return row;
  });

const updateTemplateInput = createTemplateInput.extend({
  id: z.string().uuid(),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateInput>;

export const updateTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => updateTemplateInput.parse(d))
  .handler(async ({ data, context }) => {
    const bodyPlaceholders = extractTemplatePlaceholders(data.body);
    if (bodyPlaceholders.length > 0) {
      const missingExamples = bodyPlaceholders.filter(
        (_, index) => !data.body_examples?.[index]?.trim(),
      );
      if (missingExamples.length > 0) {
        throw new Error(
          "Preencha um exemplo para cada variável do corpo do template antes de enviar para a Meta.",
        );
      }
    }

    const components = buildMetaComponents(data);

    const { data: tpl } = await context.db
      .from("templates")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();

    if (!tpl) throw new Error("Template não encontrado.");

    let status: string = tpl.status ?? "PENDING";
    const meta_template_id: string | null = tpl.meta_template_id;

    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_waba_id, whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    const isRemote =
      meta_template_id &&
      !meta_template_id.startsWith("local_") &&
      !meta_template_id.startsWith("sample_");

    if (isRemote && p?.whatsapp_waba_id && p?.whatsapp_access_token) {
      const apiVersion = p.meta_graph_version || "v20.0";
      const res = await fetch(`https://graph.facebook.com/${apiVersion}/${meta_template_id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.whatsapp_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: data.name,
          components,
          language: data.language,
          category: data.category,
          parameter_format: data.parameter_format,
          allow_category_change: data.allow_category_change,
          cta_url_link_tracking_opted_out: data.cta_url_link_tracking_opted_out,
          message_send_ttl_seconds: data.message_send_ttl_seconds,
          sub_category: data.sub_category,
          display_format: data.display_format,
          is_primary_device_delivery_only: data.is_primary_device_delivery_only,
        }),
      });
      const body: any = await res.json();
      if (!res.ok) {
        const friendly = toFriendlyError(body, "Falha ao editar template na Meta");
        throw new Error(
          `${friendly.title}: ${friendly.message}${friendly.hint ? `\n\n💡 Dica: ${friendly.hint}` : ""}`,
        );
      }
      status = body.status ?? status;
    }

    const { data: row, error } = await context.db
      .from("templates")
      .update({
        name: data.name,
        language: data.language,
        category: data.category,
        status: status as any,
        components,
        parameter_format: data.parameter_format,
        allow_category_change: data.allow_category_change ? 1 : 0,
        cta_url_link_tracking_opted_out: data.cta_url_link_tracking_opted_out ? 1 : 0,
        message_send_ttl_seconds: data.message_send_ttl_seconds,
        sub_category: data.sub_category,
        display_format: data.display_format,
        is_primary_device_delivery_only: data.is_primary_device_delivery_only ? 1 : 0,
        meta_template_id,
        synced_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .single();

    if (error) throw error;
    return row;
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({ id: z.string().uuid(), deleteMode: z.enum(["single", "all"]).default("single") })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: tpl } = await context.db
      .from("templates")
      .select("name, language, meta_template_id")
      .eq("id", data.id)
      .maybeSingle();

    if (
      tpl?.meta_template_id &&
      !tpl.meta_template_id.startsWith("local_") &&
      !tpl.meta_template_id.startsWith("sample_")
    ) {
      const { data: p } = await context.db
        .from("profiles")
        .select("whatsapp_waba_id, whatsapp_access_token, meta_graph_version")
        .eq("id", context.userId)
        .maybeSingle();
      if (p?.whatsapp_waba_id && p?.whatsapp_access_token && tpl?.name) {
        const apiVersion = p.meta_graph_version || "v20.0";
        let url = `https://graph.facebook.com/${apiVersion}/${p.whatsapp_waba_id}/message_templates?name=${encodeURIComponent(tpl.name)}`;
        if (data.deleteMode === "single") {
          url += `&hsm_id=${encodeURIComponent(tpl.meta_template_id)}`;
        }
        const res = await fetch(url, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
        });
        if (!res.ok) {
          const body: any = await res.json().catch(() => null);
          if (body) {
            const friendly = toFriendlyError(body, "Falha ao excluir template na Meta");
            throw new Error(
              `${friendly.title}: ${friendly.message}${friendly.hint ? `\n\n💡 Dica: ${friendly.hint}` : ""}`,
            );
          }
        }
      }
    }

    if (data.deleteMode === "all" && tpl?.name) {
      const { error } = await context.db.from("templates").delete().eq("name", tpl.name);
      if (error) throw error;
    } else {
      const { error } = await context.db.from("templates").delete().eq("id", data.id);
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteTemplatesBulk = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: tpls } = await context.db
      .from("templates")
      .select("id, name, meta_template_id")
      .in("id", data.ids);

    const remote = (tpls ?? []).filter(
      (t: any) =>
        t.meta_template_id &&
        !t.meta_template_id.startsWith("local_") &&
        !t.meta_template_id.startsWith("sample_"),
    );

    if (remote.length > 0) {
      const { data: p } = await context.db
        .from("profiles")
        .select("whatsapp_waba_id, whatsapp_access_token, meta_graph_version")
        .eq("id", context.userId)
        .maybeSingle();
      if (p?.whatsapp_waba_id && p?.whatsapp_access_token) {
        const apiVersion = p.meta_graph_version || "v20.0";
        const remoteMetaIds = remote.map((t: any) => t.meta_template_id);
        const url = `https://graph.facebook.com/${apiVersion}/${p.whatsapp_waba_id}/message_templates?hsm_ids=${encodeURIComponent(JSON.stringify(remoteMetaIds))}`;
        const res = await fetch(url, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          if (body) {
            const friendly = toFriendlyError(body, "Falha ao excluir templates em massa na Meta");
            throw new Error(
              `${friendly.title}: ${friendly.message}${friendly.hint ? `\n\n💡 Dica: ${friendly.hint}` : ""}`,
            );
          }
        }
      }
    }

    const { error } = await context.db.from("templates").delete().in("id", data.ids);
    if (error) throw error;
    return { ok: true, deleted: data.ids.length };
  });

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const data: any[] = (await db.query(
      `SELECT * FROM templates WHERE user_id = ? AND status = 'APPROVED' AND meta_template_id IS NOT NULL
       AND meta_template_id NOT LIKE 'local_%' AND meta_template_id NOT LIKE 'sample_%'
       ORDER BY name`,
      [effectiveUserId],
    )) as any[];
    return data ?? [];
  });

export const listAllTemplates = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const data: any[] = (await db.query(
      `SELECT * FROM templates WHERE user_id = ? ORDER BY name`,
      [effectiveUserId],
    )) as any[];
    return data ?? [];
  });

export const syncTemplatesFromMeta = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_waba_id, whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();
    if (!p?.whatsapp_waba_id || !p?.whatsapp_access_token) {
      throw new Error("Configure WABA ID e Access Token em Configurações");
    }
    const apiVersion = p.meta_graph_version || "v20.0";
    const all: any[] = [];
    const fields = [
      "name",
      "language",
      "status",
      "category",
      "components",
      "id",
      "sub_category",
      "parameter_format",
      "allow_category_change",
      "cta_url_link_tracking_opted_out",
      "message_send_ttl_seconds",
      "is_primary_device_delivery_only",
    ].join(",");
    let url: string | null =
      `https://graph.facebook.com/${apiVersion}/${p.whatsapp_waba_id}/message_templates?fields=${fields}&limit=200`;
    while (url) {
      const r: Response = await fetch(url, {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      });
      const body: any = await r.json();
      if (!r.ok) {
        const friendly = toFriendlyError(body, "Falha ao consultar templates");
        throw new Error(
          `${friendly.title}: ${friendly.message}${friendly.hint ? `\n\n💡 Dica: ${friendly.hint}` : ""}`,
        );
      }
      all.push(...(body.data ?? []));
      url = body.paging?.next ?? null;
    }
    if (all.length > 0) {
      const rows = all.map((t) => ({
        user_id: context.userId,
        meta_template_id: t.id,
        name: t.name,
        language: t.language,
        category: t.category,
        status: t.status,
        components: t.components ?? [],
        synced_at: new Date().toISOString(),
        parameter_format: t.parameter_format,
        allow_category_change: t.allow_category_change ? 1 : 0,
        cta_url_link_tracking_opted_out: t.cta_url_link_tracking_opted_out ? 1 : 0,
        message_send_ttl_seconds: t.message_send_ttl_seconds,
        sub_category: t.sub_category,
        is_primary_device_delivery_only: t.is_primary_device_delivery_only ? 1 : 0,
      }));
      const { error } = await context.db
        .from("templates")
        .upsert(rows, { onConflict: "user_id,name,language" });
      if (error) throw error;
    }
    return { synced: all.length };
  });

const SAMPLE_TEMPLATES = [
  {
    name: "boas_vindas",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      { type: "HEADER", format: "TEXT", text: "Olá, {{1}} 👋" },
      {
        type: "BODY",
        text: "Seja bem-vindo(a) à {{2}}! Estamos felizes em ter você por aqui. Se precisar de qualquer coisa, é só responder esta mensagem.",
      },
      { type: "FOOTER", text: "Equipe {{2}}" },
    ],
  },
  {
    name: "confirmacao_pedido",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      { type: "HEADER", format: "TEXT", text: "Pedido #{{1}} confirmado ✅" },
      {
        type: "BODY",
        text: "Oi {{2}}! Recebemos seu pedido no valor de R$ {{3}}. A previsão de entrega é {{4}}. Obrigado pela compra!",
      },
      { type: "FOOTER", text: "Acompanhe pelo nosso site" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "URL", text: "Acompanhar pedido", url: "https://example.com/pedidos/{{1}}" },
        ],
      },
    ],
  },
  {
    name: "codigo_verificacao",
    language: "pt_BR",
    category: "AUTHENTICATION",
    components: [
      {
        type: "BODY",
        text: "Seu código de verificação é {{1}}. Ele expira em 10 minutos. Não compartilhe com ninguém.",
      },
      { type: "FOOTER", text: "Mensagem automática" },
    ],
  },
  {
    name: "lembrete_agendamento",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      { type: "HEADER", format: "TEXT", text: "Lembrete de agendamento 📅" },
      {
        type: "BODY",
        text: "Olá {{1}}, lembrando seu compromisso em {{2}} às {{3}}. Confirma sua presença?",
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Sim, confirmo" },
          { type: "QUICK_REPLY", text: "Preciso remarcar" },
        ],
      },
    ],
  },
  {
    name: "confirmacao_agendamento_simples",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}! Confirmamos o seu agendamento de {{2}} no dia {{3}} às {{4}}. Caso precise remarcar ou cancelar, pedimos que nos avise respondendo a esta mensagem. Aguardamos você!",
      },
    ],
  },
  {
    name: "confirmacao_agendamento_botoes",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá, {{1}}! Passando para confirmar o seu agendamento de {{2}} com o(a) {{3}} para o dia {{4}} às {{5}}.\n\nPor favor, confirme a sua presença selecionando uma das opções abaixo:",
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Sim, confirmado!" },
          { type: "QUICK_REPLY", text: "Preciso remarcar" },
        ],
      },
    ],
  },
  {
    name: "carrinho_abandonado",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      {
        type: "BODY",
        text: "Oi {{1}}! Notamos que você deixou itens no carrinho. Finalize agora e ganhe {{2}}% de desconto usando o cupom {{3}}.",
      },
      {
        type: "BUTTONS",
        buttons: [{ type: "URL", text: "Voltar ao carrinho", url: "https://example.com/carrinho" }],
      },
    ],
  },
  {
    name: "promocao_relampago",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      { type: "HEADER", format: "TEXT", text: "Oferta relâmpago ⚡" },
      { type: "BODY", text: "{{1}}, só hoje: {{2}} com {{3}}% OFF. Aproveite antes que acabe!" },
      { type: "FOOTER", text: "Válido até 23h59" },
      {
        type: "BUTTONS",
        buttons: [{ type: "URL", text: "Ver oferta", url: "https://example.com/oferta" }],
      },
    ],
  },
  {
    name: "pesquisa_satisfacao",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "BODY",
        text: "Olá {{1}}, como foi sua experiência com {{2}}? Sua opinião nos ajuda muito 💚",
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "😍 Excelente" },
          { type: "QUICK_REPLY", text: "🙂 Boa" },
          { type: "QUICK_REPLY", text: "😕 Pode melhorar" },
        ],
      },
    ],
  },
  {
    name: "pagamento_recebido",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      { type: "HEADER", format: "TEXT", text: "Pagamento confirmado 💚" },
      {
        type: "BODY",
        text: "Oi {{1}}, recebemos seu pagamento de R$ {{2}} referente ao pedido #{{3}}. Obrigado!",
      },
      { type: "FOOTER", text: "Recibo enviado por e-mail" },
    ],
  },
  {
    name: "novidade_lancamento",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      { type: "HEADER", format: "TEXT", text: "Novidade chegando 🚀" },
      {
        type: "BODY",
        text: "{{1}}, acabamos de lançar {{2}}. Dá uma olhada e nos conta o que achou!",
      },
      {
        type: "BUTTONS",
        buttons: [{ type: "URL", text: "Conhecer agora", url: "https://example.com/novidades" }],
      },
    ],
  },
  {
    name: "reativacao_cliente",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      {
        type: "BODY",
        text: "Sentimos sua falta, {{1}}! Que tal voltar com {{2}}% de desconto na próxima compra? Cupom: {{3}}",
      },
      { type: "FOOTER", text: "Cupom válido por 7 dias" },
    ],
  },
  {
    name: "welcome_en",
    language: "en_US",
    category: "MARKETING",
    components: [
      { type: "HEADER", format: "TEXT", text: "Welcome, {{1}} 👋" },
      { type: "BODY", text: "Thanks for joining {{2}}! Reply anytime if you need help." },
      { type: "FOOTER", text: "{{2}} team" },
    ],
  },
  {
    name: "order_shipped_en",
    language: "en_US",
    category: "UTILITY",
    components: [
      { type: "HEADER", format: "TEXT", text: "Your order is on the way 📦" },
      { type: "BODY", text: "Hi {{1}}, order #{{2}} just shipped. Estimated delivery: {{3}}." },
      {
        type: "BUTTONS",
        buttons: [{ type: "URL", text: "Track order", url: "https://example.com/track/{{2}}" }],
      },
    ],
  },
  {
    name: "promo_imagem_oferta",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      {
        type: "HEADER",
        format: "IMAGE",
        example: {
          header_handle: ["https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200"],
        },
      },
      {
        type: "BODY",
        text: "{{1}}, oferta exclusiva: {{2}} com {{3}}% OFF. Use o cupom {{4}} no checkout!",
      },
      { type: "FOOTER", text: "Válido até o fim do estoque" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "URL", text: "Comprar agora", url: "https://example.com/oferta" },
          { type: "QUICK_REPLY", text: "Quero saber mais" },
          { type: "QUICK_REPLY", text: "Não tenho interesse" },
        ],
      },
    ],
  },
  {
    name: "catalogo_novidades_imagem",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      {
        type: "HEADER",
        format: "IMAGE",
        example: {
          header_handle: ["https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200"],
        },
      },
      {
        type: "BODY",
        text: "Olá {{1}}! Acabou de chegar a coleção {{2}}. Confira no nosso catálogo.",
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "URL", text: "Ver catálogo", url: "https://example.com/catalogo" },
          { type: "PHONE_NUMBER", text: "Falar com vendedor", phone_number: "+5511999999999" },
        ],
      },
    ],
  },
  {
    name: "evento_convite_imagem",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      {
        type: "HEADER",
        format: "IMAGE",
        example: {
          header_handle: ["https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200"],
        },
      },
      {
        type: "BODY",
        text: "{{1}}, você está convidado(a) para {{2}} no dia {{3}} às {{4}}. Garanta sua vaga!",
      },
      { type: "FOOTER", text: "Vagas limitadas" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "URL", text: "Confirmar presença", url: "https://example.com/evento" },
          { type: "QUICK_REPLY", text: "Não poderei ir" },
        ],
      },
    ],
  },
  {
    name: "boas_vindas_video",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      {
        type: "HEADER",
        format: "VIDEO",
        example: { header_handle: ["https://example.com/welcome.mp4"] },
      },
      { type: "BODY", text: "Bem-vindo(a) à {{1}}, {{2}}! Veja esse vídeo rápido para começar." },
      {
        type: "BUTTONS",
        buttons: [{ type: "URL", text: "Acessar minha conta", url: "https://example.com/login" }],
      },
    ],
  },
  {
    name: "fatura_documento",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "HEADER",
        format: "DOCUMENT",
        example: { header_handle: ["https://example.com/fatura.pdf"] },
      },
      {
        type: "BODY",
        text: "Olá {{1}}, sua fatura referente a {{2}} no valor de R$ {{3}} está disponível. Vencimento: {{4}}.",
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "URL", text: "Pagar agora", url: "https://example.com/pagar" },
          { type: "QUICK_REPLY", text: "Falar com atendente" },
        ],
      },
    ],
  },
  {
    name: "rastreio_pedido_imagem",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      {
        type: "HEADER",
        format: "IMAGE",
        example: {
          header_handle: ["https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=1200"],
        },
      },
      {
        type: "BODY",
        text: "Oi {{1}}, seu pedido #{{2}} saiu para entrega 🚚. Previsão: até {{3}}.",
      },
      {
        type: "BUTTONS",
        buttons: [
          { type: "URL", text: "Rastrear", url: "https://example.com/rastreio" },
          { type: "PHONE_NUMBER", text: "Suporte", phone_number: "+5511999999999" },
        ],
      },
    ],
  },
  {
    name: "cupom_aniversario_imagem",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      {
        type: "HEADER",
        format: "IMAGE",
        example: {
          header_handle: ["https://images.unsplash.com/photo-1513151233558-d860c5398176?w=1200"],
        },
      },
      {
        type: "BODY",
        text: "Feliz aniversário, {{1}}! 🎉 Temos um presente: {{2}}% OFF com o cupom {{3}}.",
      },
      { type: "FOOTER", text: "Cupom válido por 7 dias" },
      {
        type: "BUTTONS",
        buttons: [{ type: "URL", text: "Aproveitar agora", url: "https://example.com/cupom" }],
      },
    ],
  },
];

export const seedSampleTemplates = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const rows = SAMPLE_TEMPLATES.map((t) => ({
      user_id: context.userId,
      name: t.name,
      language: t.language,
      category: t.category,
      status: "APPROVED" as const,
      components: t.components,
      meta_template_id: `sample_${t.name}_${t.language}`,
      synced_at: new Date().toISOString(),
    }));
    const { error } = await context.db
      .from("templates")
      .upsert(rows, { onConflict: "user_id,name,language" });
    if (error) throw error;
    return { inserted: rows.length };
  });

export const submitTemplateToMeta = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // 1. Busca o template no banco (query-compiler já filtra por user_id automaticamente)
    const { data: tpl, error: fetchErr } = await context.db
      .from("templates")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();

    if (fetchErr || !tpl) {
      throw new Error("Template não encontrado.");
    }

    // 2. Busca credenciais Meta
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_waba_id, whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_waba_id || !p?.whatsapp_access_token) {
      throw new Error(
        "Configure WABA ID e Access Token nas Configurações antes de enviar para a Meta.",
      );
    }

    // 3. Envia para a Meta API
    const apiVersion = p.meta_graph_version || "v20.0";
    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${p.whatsapp_waba_id}/message_templates`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${p.whatsapp_access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: tpl.name,
          language: tpl.language,
          category: tpl.category,
          components: tpl.components,
          parameter_format: tpl.parameter_format ?? undefined,
          allow_category_change:
            tpl.allow_category_change === null || tpl.allow_category_change === undefined
              ? undefined
              : !!tpl.allow_category_change,
          cta_url_link_tracking_opted_out:
            tpl.cta_url_link_tracking_opted_out === null ||
            tpl.cta_url_link_tracking_opted_out === undefined
              ? undefined
              : !!tpl.cta_url_link_tracking_opted_out,
          message_send_ttl_seconds: tpl.message_send_ttl_seconds ?? undefined,
          sub_category: tpl.sub_category ?? undefined,
          is_primary_device_delivery_only:
            tpl.is_primary_device_delivery_only === null ||
            tpl.is_primary_device_delivery_only === undefined
              ? undefined
              : !!tpl.is_primary_device_delivery_only,
        }),
      },
    );

    const body: any = await res.json();
    if (!res.ok) {
      const friendly = toFriendlyError(body, "Falha ao enviar template à Meta");
      throw new Error(
        `${friendly.title}: ${friendly.message}${friendly.hint ? `\n\n💡 Dica: ${friendly.hint}` : ""}`,
      );
    }

    const status = body.status ?? "PENDING";
    const meta_template_id = body.id ?? null;

    // 4. Atualiza no banco com o ID e status da Meta
    const { data: updated, error: updateErr } = await context.db
      .from("templates")
      .update({
        status,
        meta_template_id: meta_template_id ?? tpl.meta_template_id,
        synced_at: new Date().toISOString(),
      })
      .eq("id", tpl.id)
      .select()
      .single();

    if (updateErr) throw updateErr;
    return updated;
  });

export const getMetaTemplateDetails = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({ id: z.string().uuid().optional(), meta_template_id: z.string().optional() })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let metaTemplateId = data.meta_template_id;
    if (data.id) {
      const { data: tpl } = await context.db
        .from("templates")
        .select("meta_template_id")
        .eq("id", data.id)
        .maybeSingle();
      if (tpl?.meta_template_id) {
        metaTemplateId = tpl.meta_template_id;
      }
    }

    if (
      !metaTemplateId ||
      metaTemplateId.startsWith("local_") ||
      metaTemplateId.startsWith("sample_")
    ) {
      throw new Error("Este template não possui um ID da Meta ativo.");
    }

    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_access_token) {
      throw new Error("Configure seu Token de Acesso em Configurações.");
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const fields = [
      "id",
      "ad_account_id",
      "ad_adset_id",
      "ad_campaign_id",
      "ad_id",
      "bid_spec",
      "category",
      "components",
      "correct_category",
      "cta_url_link_tracking_opted_out",
      "degrees_of_freedom_spec",
      "display_format",
      "health_status",
      "is_primary_device_delivery_only",
      "is_sms_fallback_enabled",
      "language",
      "last_updated_time",
      "library_template_name",
      "message_send_ttl_seconds",
      "name",
      "parameter_format",
      "previous_category",
      "quality_score",
      "rejected_reason",
      "source",
      "status",
      "sub_category",
    ].join(",");

    const res = await fetch(
      `https://graph.facebook.com/${apiVersion}/${metaTemplateId}?fields=${fields}`,
      {
        headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
      },
    );
    const body: any = await res.json();
    if (!res.ok) {
      const friendly = toFriendlyError(body, "Falha ao obter detalhes do template na Meta");
      throw new Error(
        `${friendly.title}: ${friendly.message}${friendly.hint ? `\n\n💡 Dica: ${friendly.hint}` : ""}`,
      );
    }
    return body;
  });

export const listMetaTemplatesDirect = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .inputValidator(
    z.object({
      limit: z.number().int().min(1).max(100).optional(),
      after: z.string().optional(),
      before: z.string().optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const { data: p } = await context.db
      .from("profiles")
      .select("whatsapp_waba_id, whatsapp_access_token, meta_graph_version")
      .eq("id", context.userId)
      .maybeSingle();

    if (!p?.whatsapp_waba_id || !p?.whatsapp_access_token) {
      throw new Error("Configure seu WABA ID e Token de Acesso em Configurações.");
    }

    const apiVersion = p.meta_graph_version || "v20.0";
    const fields = [
      "id",
      "name",
      "language",
      "status",
      "category",
      "components",
      "quality_score",
      "rejected_reason",
      "sub_category",
      "last_updated_time",
      "parameter_format",
      "allow_category_change",
      "cta_url_link_tracking_opted_out",
      "message_send_ttl_seconds",
      "is_primary_device_delivery_only",
      "health_status",
    ].join(",");

    let url = `https://graph.facebook.com/${apiVersion}/${p.whatsapp_waba_id}/message_templates?fields=${fields}`;
    if (data.limit) url += `&limit=${data.limit}`;
    if (data.after) url += `&after=${data.after}`;
    if (data.before) url += `&before=${data.before}`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${p.whatsapp_access_token}` },
    });
    const body: any = await res.json();
    if (!res.ok) {
      const friendly = toFriendlyError(body, "Falha ao obter lista de templates da Meta");
      throw new Error(
        `${friendly.title}: ${friendly.message}${friendly.hint ? `\n\n💡 Dica: ${friendly.hint}` : ""}`,
      );
    }
    return body;
  });
