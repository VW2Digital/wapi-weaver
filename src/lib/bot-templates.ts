export type BotTemplate = {
  id: string;
  name: string;
  description: string;
  steps: any[];
};

export const BOT_TEMPLATES: BotTemplate[] = [
  {
    id: "demo_completa",
    name: "Demonstração Completa",
    description: "Um fluxo gigantesco explorando todos os envios: Áudio, Imagem, PDF, Botões, Listas, Link e Transbordo Humano.",
    steps: [
      {
        id: "step_start",
        step_order: 1,
        trigger_type: "start",
        message_type: "list",
        message_content: "Olá! 👋 Bem-vindo à demonstração de todos os recursos nativos da Cloud API. O que você gostaria de testar hoje?",
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
                  { id: "step_audio", title: "3. Áudio + Botões", description: "Ver envio de áudio" },
                ]
              },
              {
                title: "Ações",
                rows: [
                  { id: "step_link", title: "4. Botão de Link", description: "Ver Call to Action URL" },
                  { id: "step_catalog", title: "5. Catálogo", description: "Ver Lista de Produtos" },
                  { id: "step_handoff", title: "6. Falar com Humano", description: "Testar o transbordo" },
                ]
              }
            ]
          }
        }
      },
      {
        id: "step_image",
        step_order: 2,
        trigger_type: "keyword",
        trigger_value: "step_image",
        message_type: "buttons",
        message_content: "Aqui está o teste de **Imagem**. Essa imagem é injetada nativamente no cabeçalho (header) da mensagem de botões!",
        media_url: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=600",
        position_x: 100,
        position_y: 300,
        buttons_config: {
          action: {
            buttons: [
              { type: "reply", reply: { id: "step_start", title: "Voltar" } }
            ]
          }
        }
      },
      {
        id: "step_doc",
        step_order: 3,
        trigger_type: "keyword",
        trigger_value: "step_doc",
        message_type: "buttons",
        message_content: "Aqui está o envio de um **Documento PDF**. Excelente para e-books, contratos e cardápios.",
        media_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        position_x: 400,
        position_y: 300,
        buttons_config: {
          action: {
            buttons: [
              { type: "reply", reply: { id: "step_start", title: "Voltar" } }
            ]
          }
        }
      },
      {
        id: "step_audio",
        step_order: 4,
        trigger_type: "keyword",
        trigger_value: "step_audio",
        message_type: "buttons",
        message_content: "O **Áudio** acabou de ser enviado acima! O nosso motor detectou que era MP3 e enviou separado, já que a Meta não permite áudio no header de botões.",
        media_url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        position_x: 700,
        position_y: 300,
        buttons_config: {
          action: {
            buttons: [
              { type: "reply", reply: { id: "step_start", title: "Voltar" } }
            ]
          }
        }
      },
      {
        id: "step_link",
        step_order: 5,
        trigger_type: "keyword",
        trigger_value: "step_link",
        message_type: "cta_url",
        message_content: "Teste do Botão de Link Call-to-Action. O WhatsApp só permite 1 botão desse tipo por mensagem.",
        position_x: 100,
        position_y: 550,
        next_step_id: "step_start",
        buttons_config: {
          action: {
            name: "cta_url",
            parameters: { display_text: "Acessar Google", url: "https://google.com" }
          }
        }
      },
      {
        id: "step_catalog",
        step_order: 6,
        trigger_type: "keyword",
        trigger_value: "step_catalog",
        message_type: "product_list",
        message_content: "Infelizmente eu preciso de um Catalog ID real para enviar o catálogo! Mas é assim que o bloco funciona.",
        position_x: 400,
        position_y: 550,
        buttons_config: {
          action: {
            catalog_id: "SEU_CATALOGO_ID",
            sections: [{ title: "Destaques", product_items: [{ product_retailer_id: "SKU_001" }] }]
          }
        }
      },
      {
        id: "step_handoff",
        step_order: 7,
        trigger_type: "keyword",
        trigger_value: "step_handoff",
        message_type: "text",
        message_content: "Transferindo você para um humano! O bot será pausado por 24h para este número.",
        position_x: 700,
        position_y: 550,
        next_step_id: "-999"
      }
    ]
  },
  {
    id: "atendimento_basico",
    name: "Atendimento Básico",
    description: "Estrutura simples de saudação e redirecionamento de suporte/comercial.",
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
            ]
          }
        }
      },
      {
        id: "step_comercial",
        step_order: 2,
        trigger_type: "keyword",
        trigger_value: "step_comercial",
        message_type: "text",
        message_content: "Nossos vendedores estão prontos! Digite sua dúvida ou o produto que procura.",
        next_step_id: "-999",
        position_x: 150,
        position_y: 350
      },
      {
        id: "step_suporte",
        step_order: 3,
        trigger_type: "keyword",
        trigger_value: "step_suporte",
        message_type: "text",
        message_content: "Qual é o problema? Vou chamar um técnico para você. Por favor, descreva.",
        next_step_id: "-999",
        position_x: 450,
        position_y: 350
      }
    ]
  },
  {
    id: "loja_virtual",
    name: "Loja Virtual Express",
    description: "Fluxo focado em vendas com imagem em destaque e botão de compra.",
    steps: [
      {
        id: "step_start",
        step_order: 1,
        trigger_type: "start",
        message_type: "buttons",
        media_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=600",
        message_content: "Oferta Especial! 🎉\n\nFone de Ouvido Bluetooth Premium com 50% de desconto apenas hoje.",
        position_x: 300,
        position_y: 100,
        buttons_config: {
          action: {
            buttons: [
              { type: "reply", reply: { id: "step_comprar", title: "Comprar Agora!" } },
              { type: "reply", reply: { id: "step_duvidas", title: "Tenho Dúvidas" } },
            ]
          }
        }
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
            parameters: { display_text: "Ir para Checkout", url: "https://seusite.com/checkout" }
          }
        }
      },
      {
        id: "step_duvidas",
        step_order: 3,
        trigger_type: "keyword",
        trigger_value: "step_duvidas",
        message_type: "text",
        message_content: "Sem problemas! Vou chamar um consultor para te explicar tudo sobre o produto.",
        next_step_id: "-999",
        position_x: 450,
        position_y: 350
      }
    ]
  }
];

export function mapTemplateSteps(templateSteps: any[]) {
  // Gera um mapeamento de ID antigo -> ID novo (UUID)
  const idMap: Record<string, string> = {};
  templateSteps.forEach((s) => {
    idMap[s.id] = crypto.randomUUID();
  });
  
  // -999 é o handoff especial, mantemos igual
  idMap["-999"] = "-999";

  return templateSteps.map((step) => {
    const newStep = { ...step, id: idMap[step.id] };

    // Corrige trigger se for baseado em ID (as vezes keyword bate com id)
    // No nosso template usamos trigger_value = "step_xyz".
    // Se o trigger_value tiver no idMap, atualizamos. (para bater com os botões!)
    if (newStep.trigger_value && idMap[newStep.trigger_value]) {
      newStep.trigger_value = idMap[newStep.trigger_value];
    }

    // Corrige next_step_id
    if (newStep.next_step_id && idMap[newStep.next_step_id]) {
      newStep.next_step_id = idMap[newStep.next_step_id];
    }

    // Varre o config de botões para corrigir os IDs nos options (para os botões de reply)
    if (newStep.buttons_config) {
      const newConfig = JSON.parse(JSON.stringify(newStep.buttons_config));
      
      // Update interactive buttons
      if (newConfig?.action?.buttons) {
        newConfig.action.buttons.forEach((btn: any) => {
          if (btn.reply?.id && idMap[btn.reply.id]) {
            btn.reply.id = idMap[btn.reply.id];
          }
        });
      }

      // Update lists rows id
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
