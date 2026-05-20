import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("templates")
      .select("*")
      .order("name");
    if (error) throw error;
    return data ?? [];
  });

export const syncTemplatesFromMeta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: p } = await context.supabase
      .from("profiles")
      .select("whatsapp_waba_id, whatsapp_access_token")
      .eq("id", context.userId)
      .maybeSingle();
    if (!p?.whatsapp_waba_id || !p?.whatsapp_access_token) {
      throw new Error("Configure WABA ID e Access Token em Configurações");
    }
    const all: any[] = [];
    let url: string | null = `https://graph.facebook.com/v20.0/${p.whatsapp_waba_id}/message_templates?fields=name,language,status,category,components,id&limit=200`;
    while (url) {
      const r: Response = await fetch(url, { headers: { Authorization: `Bearer ${p.whatsapp_access_token}` } });
      const body: any = await r.json();
      if (!r.ok) throw new Error(body?.error?.message ?? "Falha ao consultar templates");
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
      }));
      const { error } = await context.supabase
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
      { type: "BODY", text: "Seja bem-vindo(a) à {{2}}! Estamos felizes em ter você por aqui. Se precisar de qualquer coisa, é só responder esta mensagem." },
      { type: "FOOTER", text: "Equipe {{2}}" },
    ],
  },
  {
    name: "confirmacao_pedido",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      { type: "HEADER", format: "TEXT", text: "Pedido #{{1}} confirmado ✅" },
      { type: "BODY", text: "Oi {{2}}! Recebemos seu pedido no valor de R$ {{3}}. A previsão de entrega é {{4}}. Obrigado pela compra!" },
      { type: "FOOTER", text: "Acompanhe pelo nosso site" },
      { type: "BUTTONS", buttons: [{ type: "URL", text: "Acompanhar pedido", url: "https://example.com/pedidos/{{1}}" }] },
    ],
  },
  {
    name: "codigo_verificacao",
    language: "pt_BR",
    category: "AUTHENTICATION",
    components: [
      { type: "BODY", text: "Seu código de verificação é {{1}}. Ele expira em 10 minutos. Não compartilhe com ninguém." },
      { type: "FOOTER", text: "Mensagem automática" },
    ],
  },
  {
    name: "lembrete_agendamento",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      { type: "HEADER", format: "TEXT", text: "Lembrete de agendamento 📅" },
      { type: "BODY", text: "Olá {{1}}, lembrando seu compromisso em {{2}} às {{3}}. Confirma sua presença?" },
      { type: "BUTTONS", buttons: [
        { type: "QUICK_REPLY", text: "Sim, confirmo" },
        { type: "QUICK_REPLY", text: "Preciso remarcar" },
      ] },
    ],
  },
  {
    name: "carrinho_abandonado",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      { type: "BODY", text: "Oi {{1}}! Notamos que você deixou itens no carrinho. Finalize agora e ganhe {{2}}% de desconto usando o cupom {{3}}." },
      { type: "BUTTONS", buttons: [{ type: "URL", text: "Voltar ao carrinho", url: "https://example.com/carrinho" }] },
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
      { type: "BUTTONS", buttons: [{ type: "URL", text: "Ver oferta", url: "https://example.com/oferta" }] },
    ],
  },
  {
    name: "pesquisa_satisfacao",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      { type: "BODY", text: "Olá {{1}}, como foi sua experiência com {{2}}? Sua opinião nos ajuda muito 💚" },
      { type: "BUTTONS", buttons: [
        { type: "QUICK_REPLY", text: "😍 Excelente" },
        { type: "QUICK_REPLY", text: "🙂 Boa" },
        { type: "QUICK_REPLY", text: "😕 Pode melhorar" },
      ] },
    ],
  },
  {
    name: "pagamento_recebido",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      { type: "HEADER", format: "TEXT", text: "Pagamento confirmado 💚" },
      { type: "BODY", text: "Oi {{1}}, recebemos seu pagamento de R$ {{2}} referente ao pedido #{{3}}. Obrigado!" },
      { type: "FOOTER", text: "Recibo enviado por e-mail" },
    ],
  },
  {
    name: "novidade_lancamento",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      { type: "HEADER", format: "TEXT", text: "Novidade chegando 🚀" },
      { type: "BODY", text: "{{1}}, acabamos de lançar {{2}}. Dá uma olhada e nos conta o que achou!" },
      { type: "BUTTONS", buttons: [{ type: "URL", text: "Conhecer agora", url: "https://example.com/novidades" }] },
    ],
  },
  {
    name: "reativacao_cliente",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      { type: "BODY", text: "Sentimos sua falta, {{1}}! Que tal voltar com {{2}}% de desconto na próxima compra? Cupom: {{3}}" },
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
      { type: "BUTTONS", buttons: [{ type: "URL", text: "Track order", url: "https://example.com/track/{{2}}" }] },
    ],
  },
  {
    name: "promo_imagem_oferta",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      { type: "HEADER", format: "IMAGE", example: { header_handle: ["https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=1200"] } },
      { type: "BODY", text: "{{1}}, oferta exclusiva: {{2}} com {{3}}% OFF. Use o cupom {{4}} no checkout!" },
      { type: "FOOTER", text: "Válido até o fim do estoque" },
      { type: "BUTTONS", buttons: [
        { type: "URL", text: "Comprar agora", url: "https://example.com/oferta" },
        { type: "QUICK_REPLY", text: "Quero saber mais" },
        { type: "QUICK_REPLY", text: "Não tenho interesse" },
      ] },
    ],
  },
  {
    name: "catalogo_novidades_imagem",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      { type: "HEADER", format: "IMAGE", example: { header_handle: ["https://images.unsplash.com/photo-1483985988355-763728e1935b?w=1200"] } },
      { type: "BODY", text: "Olá {{1}}! Acabou de chegar a coleção {{2}}. Confira no nosso catálogo." },
      { type: "BUTTONS", buttons: [
        { type: "URL", text: "Ver catálogo", url: "https://example.com/catalogo" },
        { type: "PHONE_NUMBER", text: "Falar com vendedor", phone_number: "+5511999999999" },
      ] },
    ],
  },
  {
    name: "evento_convite_imagem",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      { type: "HEADER", format: "IMAGE", example: { header_handle: ["https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200"] } },
      { type: "BODY", text: "{{1}}, você está convidado(a) para {{2}} no dia {{3}} às {{4}}. Garanta sua vaga!" },
      { type: "FOOTER", text: "Vagas limitadas" },
      { type: "BUTTONS", buttons: [
        { type: "URL", text: "Confirmar presença", url: "https://example.com/evento" },
        { type: "QUICK_REPLY", text: "Não poderei ir" },
      ] },
    ],
  },
  {
    name: "boas_vindas_video",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      { type: "HEADER", format: "VIDEO", example: { header_handle: ["https://example.com/welcome.mp4"] } },
      { type: "BODY", text: "Bem-vindo(a) à {{1}}, {{2}}! Veja esse vídeo rápido para começar." },
      { type: "BUTTONS", buttons: [
        { type: "URL", text: "Acessar minha conta", url: "https://example.com/login" },
      ] },
    ],
  },
  {
    name: "fatura_documento",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      { type: "HEADER", format: "DOCUMENT", example: { header_handle: ["https://example.com/fatura.pdf"] } },
      { type: "BODY", text: "Olá {{1}}, sua fatura referente a {{2}} no valor de R$ {{3}} está disponível. Vencimento: {{4}}." },
      { type: "BUTTONS", buttons: [
        { type: "URL", text: "Pagar agora", url: "https://example.com/pagar" },
        { type: "QUICK_REPLY", text: "Falar com atendente" },
      ] },
    ],
  },
  {
    name: "rastreio_pedido_imagem",
    language: "pt_BR",
    category: "UTILITY",
    components: [
      { type: "HEADER", format: "IMAGE", example: { header_handle: ["https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=1200"] } },
      { type: "BODY", text: "Oi {{1}}, seu pedido #{{2}} saiu para entrega 🚚. Previsão: até {{3}}." },
      { type: "BUTTONS", buttons: [
        { type: "URL", text: "Rastrear", url: "https://example.com/rastreio" },
        { type: "PHONE_NUMBER", text: "Suporte", phone_number: "+5511999999999" },
      ] },
    ],
  },
  {
    name: "cupom_aniversario_imagem",
    language: "pt_BR",
    category: "MARKETING",
    components: [
      { type: "HEADER", format: "IMAGE", example: { header_handle: ["https://images.unsplash.com/photo-1513151233558-d860c5398176?w=1200"] } },
      { type: "BODY", text: "Feliz aniversário, {{1}}! 🎉 Temos um presente: {{2}}% OFF com o cupom {{3}}." },
      { type: "FOOTER", text: "Cupom válido por 7 dias" },
      { type: "BUTTONS", buttons: [
        { type: "URL", text: "Aproveitar agora", url: "https://example.com/cupom" },
      ] },
    ],
  },
];

export const seedSampleTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
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
    const { error } = await context.supabase
      .from("templates")
      .upsert(rows, { onConflict: "user_id,name,language" });
    if (error) throw error;
    return { inserted: rows.length };
  });
