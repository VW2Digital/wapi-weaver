export type BotTemplate = {
  id: string;
  name: string;
  category: "vendas" | "suporte" | "qualificacao" | "geral";
  description: string;
  badge?: string;
  steps: any[];
};

function generateUUID(): string {
  if (typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function") {
    try {
      return window.crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const BOT_TEMPLATES: BotTemplate[] = [
  {
    id: "qualificacao_sdr_ia",
    name: "Qualificação SDR + Agente IA",
    category: "qualificacao",
    badge: "Recomendado",
    description: "Triagem automatizada com integração de agente de IA para qualificar leads e agendar reuniões.",
    steps: [
      {
        id: "step_start",
        step_order: 1,
        trigger_type: "start",
        message_type: "text",
        message_content: "Olá! 👋 Sou o assistente virtual da Bliv. Como posso te ajudar hoje?",
        position_x: 300,
        position_y: 100,
        next_step_id: "step_link_agent",
      },
      {
        id: "step_link_agent",
        step_order: 2,
        trigger_type: "keyword",
        trigger_value: "step_link_agent",
        message_type: "link_ai_agent",
        message_content: "Vincular Agente IA: SDR - Vendas",
        position_x: 300,
        position_y: 280,
      },
    ],
  },
  {
    id: "atendimento_basico",
    name: "Atendimento Básico & Suporte",
    category: "suporte",
    badge: "Mais Usado",
    description: "Estrutura simples de saudação e redirecionamento para filas de comercial e suporte técnico.",
    steps: [
      {
        id: "step_start",
        step_order: 1,
        trigger_type: "start",
        message_type: "buttons",
        message_content: "Olá! Como podemos te ajudar hoje? Escolha uma opção abaixo:",
        position_x: 300,
        position_y: 100,
        buttons_config: {
          action: {
            buttons: [
              { type: "reply", reply: { id: "step_comercial", title: "Comercial 💰" } },
              { type: "reply", reply: { id: "step_suporte", title: "Suporte 🛠️" } },
            ],
          },
        },
      },
      {
        id: "step_comercial",
        step_order: 2,
        trigger_type: "keyword",
        trigger_value: "step_comercial",
        message_type: "text",
        message_content: "Nossos consultores comerciais estão prontos! Por favor, digite seu nome e o produto de interesse.",
        next_step_id: "-999",
        position_x: 150,
        position_y: 350,
      },
      {
        id: "step_suporte",
        step_order: 3,
        trigger_type: "keyword",
        trigger_value: "step_suporte",
        message_type: "text",
        message_content: "Entendido! Vou transferir sua conversa para a equipe de suporte. Aguarde um instante...",
        next_step_id: "-999",
        position_x: 450,
        position_y: 350,
      },
    ],
  },
  {
    id: "loja_virtual",
    name: "Campanha Promocional & Checkout",
    category: "vendas",
    badge: "Alta Conversão",
    description: "Fluxo focado em vendas com mídia em destaque (imagem/vídeo) e botão de compra rápida.",
    steps: [
      {
        id: "step_start",
        step_order: 1,
        trigger_type: "start",
        message_type: "buttons",
        media_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=600",
        message_content: "Oferta Especial! 🎉\n\nGaranta seu produto exclusivo com 50% de desconto no primeiro pedido.",
        position_x: 300,
        position_y: 100,
        buttons_config: {
          action: {
            buttons: [
              { type: "reply", reply: { id: "step_comprar", title: "Comprar Agora!" } },
              { type: "reply", reply: { id: "step_duvidas", title: "Tenho Dúvidas" } },
            ],
          },
        },
      },
      {
        id: "step_comprar",
        step_order: 2,
        trigger_type: "keyword",
        trigger_value: "step_comprar",
        message_type: "cta_url",
        message_content: "Ótima escolha! Clique no botão abaixo para finalizar o pagamento seguro no nosso site.",
        position_x: 150,
        position_y: 350,
        buttons_config: {
          action: {
            name: "cta_url",
            parameters: { display_text: "Ir para Checkout", url: "https://seusite.com/checkout" },
          },
        },
      },
      {
        id: "step_duvidas",
        step_order: 3,
        trigger_type: "keyword",
        trigger_value: "step_duvidas",
        message_type: "text",
        message_content: "Sem problemas! Um consultor irá tirar todas as suas dúvidas em instantes.",
        next_step_id: "-999",
        position_x: 450,
        position_y: 350,
      },
    ],
  },
  {
    id: "pesquisa_nps",
    name: "Pesquisa de Satisfação NPS",
    category: "suporte",
    description: "Pesquisa interativa de satisfação do cliente com salvamento de resposta em variável.",
    steps: [
      {
        id: "step_start",
        step_order: 1,
        trigger_type: "start",
        message_type: "list",
        message_content: "Como você avalia seu último atendimento na Bliv?",
        position_x: 300,
        position_y: 100,
        buttons_config: {
          action: {
            button: "Avaliar Atendimento",
            sections: [
              {
                title: "Nota de 1 a 5",
                rows: [
                  { id: "step_nps_5", title: "⭐⭐⭐⭐⭐ Excelente", description: "5 estrelas" },
                  { id: "step_nps_3", title: "⭐⭐⭐ Regular", description: "3 estrelas" },
                  { id: "step_nps_1", title: "⭐ Ruim", description: "1 estrela" },
                ],
              },
            ],
          },
        },
      },
      {
        id: "step_nps_5",
        step_order: 2,
        trigger_type: "keyword",
        trigger_value: "step_nps_5",
        message_type: "text",
        message_content: "Ficamos extremamente felizes! Muito obrigado pelo seu feedback positivo! ❤️",
        position_x: 100,
        position_y: 350,
      },
      {
        id: "step_nps_3",
        step_order: 3,
        trigger_type: "keyword",
        trigger_value: "step_nps_3",
        message_type: "text",
        message_content: "Obrigado por responder! O que podemos fazer para melhorar seu atendimento?",
        position_x: 350,
        position_y: 350,
      },
      {
        id: "step_nps_1",
        step_order: 4,
        trigger_type: "keyword",
        trigger_value: "step_nps_1",
        message_type: "text",
        message_content: "Pedimos desculpas pelo inconveniente. Um supervisor irá entrar em contato com você.",
        next_step_id: "-999",
        position_x: 600,
        position_y: 350,
      },
    ],
  },
  {
    id: "demo_completa",
    name: "Demonstração Completa de Recursos",
    category: "geral",
    description: "Um fluxo completo explorando mídias (áudio, vídeo, PDF), botões, listas, links e transbordo.",
    steps: [
      {
        id: "step_start",
        step_order: 1,
        trigger_type: "start",
        message_type: "list",
        message_content: "Olá! 👋 Bem-vindo à demonstração de todos os recursos nativos. O que você gostaria de testar hoje?",
        position_x: 300,
        position_y: 100,
        buttons_config: {
          action: {
            button: "Ver Recursos",
            sections: [
              {
                title: "Tipos de Mídia",
                rows: [
                  { id: "step_image", title: "1. Imagem + Botões", description: "Ver envio de foto" },
                  { id: "step_doc", title: "2. Documento (PDF)", description: "Ver envio de arquivo" },
                ],
              },
              {
                title: "Ações",
                rows: [
                  { id: "step_link", title: "3. Botão de Link", description: "Ver Call to Action URL" },
                  { id: "step_handoff", title: "4. Falar com Humano", description: "Testar o transbordo" },
                ],
              },
            ],
          },
        },
      },
      {
        id: "step_image",
        step_order: 2,
        trigger_type: "keyword",
        trigger_value: "step_image",
        message_type: "buttons",
        message_content: "Aqui está o teste de **Imagem** enviada com botões interativos!",
        media_url: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=600",
        position_x: 100,
        position_y: 350,
        buttons_config: {
          action: {
            buttons: [{ type: "reply", reply: { id: "step_start", title: "Voltar ao Início" } }],
          },
        },
      },
      {
        id: "step_doc",
        step_order: 3,
        trigger_type: "keyword",
        trigger_value: "step_doc",
        message_type: "buttons",
        message_content: "Envio de **Documento PDF**. Excelente para contratos e propostas.",
        media_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        position_x: 400,
        position_y: 350,
        buttons_config: {
          action: {
            buttons: [{ type: "reply", reply: { id: "step_start", title: "Voltar ao Início" } }],
          },
        },
      },
      {
        id: "step_link",
        step_order: 4,
        trigger_type: "keyword",
        trigger_value: "step_link",
        message_type: "cta_url",
        message_content: "Teste do Botão de Link Call-to-Action.",
        position_x: 700,
        position_y: 350,
        next_step_id: "step_start",
        buttons_config: {
          action: {
            name: "cta_url",
            parameters: { display_text: "Acessar Site", url: "https://google.com" },
          },
        },
      },
      {
        id: "step_handoff",
        step_order: 5,
        trigger_type: "keyword",
        trigger_value: "step_handoff",
        message_type: "text",
        message_content: "Transferindo você para um atendente humano!",
        position_x: 400,
        position_y: 550,
        next_step_id: "-999",
      },
    ],
  },
];

export function mapTemplateSteps(templateSteps: any[]) {
  const idMap: Record<string, string> = {};
  templateSteps.forEach((s) => {
    idMap[s.id] = generateUUID();
  });

  idMap["-999"] = "-999";
  idMap["-998"] = "-998";
  idMap["-997"] = "-997";
  idMap["0"] = "0";

  return templateSteps.map((step) => {
    const newStep = { ...step, id: idMap[step.id] || generateUUID() };

    if (newStep.trigger_value && idMap[newStep.trigger_value]) {
      newStep.trigger_value = idMap[newStep.trigger_value];
    }

    if (newStep.next_step_id && idMap[newStep.next_step_id]) {
      newStep.next_step_id = idMap[newStep.next_step_id];
    }

    if (newStep.buttons_config) {
      const newConfig = JSON.parse(JSON.stringify(newStep.buttons_config));

      if (newConfig?.action?.buttons) {
        newConfig.action.buttons.forEach((btn: any) => {
          if (btn.reply?.id && idMap[btn.reply.id]) {
            btn.reply.id = idMap[btn.reply.id];
          }
        });
      }

      if (newConfig?.action?.sections) {
        newConfig.action.sections.forEach((sec: any) => {
          if (sec.rows) {
            sec.rows.forEach((row: any) => {
              if (row.id && idMap[row.id]) {
                row.id = idMap[row.id];
              }
            });
          }
        });
      }

      newStep.buttons_config = newConfig;
    }

    return newStep;
  });
}
