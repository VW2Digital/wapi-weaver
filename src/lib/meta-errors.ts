// Traduz erros da Meta/WhatsApp Cloud API para mensagens amigáveis em PT-BR.
// Códigos: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes

export type FriendlyError = {
  title: string;
  message: string;
  hint?: string;
  code?: number | string;
  type?: string;
  trace?: string;
};

function pickMetaError(details: any): any | null {
  if (!details) return null;
  if (details.error) return details.error;
  if (typeof details === "object" && "code" in details && "message" in details) return details;
  return null;
}

export function toFriendlyError(
  raw: unknown,
  fallback = "Falha ao executar a operação.",
): FriendlyError {
  let details: any = raw;
  if (typeof raw === "string") {
    try {
      details = JSON.parse(raw);
    } catch {
      details = { message: raw };
    }
  }
  const meta = pickMetaError(details) ?? details ?? {};
  const code = meta.code;
  const type = meta.type;
  const trace = meta.fbtrace_id;
  const userTitle = String(meta.error_user_title || "").trim();
  const userMsg = String(meta.error_user_msg || "").trim();
  const dataDetails = meta.error_data?.details;
  const detailsText = typeof dataDetails === "string" ? dataDetails.trim() : "";
  const message: string = meta.message || (typeof raw === "string" ? raw : fallback);
  const blob = [message, userTitle, userMsg, detailsText].filter(Boolean).join(" ");
  const lowerEarly = blob.toLowerCase();
  const callingMapped = mapWhatsAppCallingError({
    code,
    message,
    detailsText,
    type,
    trace,
    lower: lowerEarly,
  });
  if (callingMapped) return callingMapped;

  // Heurística prioritária: "Object with ID ... does not exist" vem como code 100 da Meta,
  // mas precisa de mensagem específica antes do mapeamento genérico de código.
  if (lowerEarly.includes("does not exist") && lowerEarly.includes("missing permissions")) {
    const idMatch = message.match(/ID ['"]?(\d+)['"]?/i);
    const objectId = idMatch?.[1];
    return {
      title: "Objeto não encontrado na Meta",
      message: objectId
        ? `O ID "${objectId}" não foi encontrado, não pode ser acessado por falta de permissão, ou não suporta esta operação.`
        : "O ID informado não foi encontrado, não pode ser acessado por falta de permissão, ou não suporta esta operação.",
      hint: "Verifique 3 coisas: 1) O ID está no campo certo (Phone Number ID ≠ WABA ID — são diferentes). 2) O Access Token tem as permissões whatsapp_business_messaging e whatsapp_business_management. 3) O Usuário de Sistema que gerou o token foi adicionado à WABA como Administrador em Meta Business → Configurações → Contas do WhatsApp → Adicionar pessoas.",
      code,
      type,
      trace,
    };
  }

  if (
    lowerEarly.startsWith("unsupported get request") ||
    lowerEarly.startsWith("unsupported post request")
  ) {
    return {
      title: "Requisição não suportada pela Meta",
      message:
        "A Meta rejeitou a chamada. Em geral, isso significa que o ID usado é de outro tipo de objeto (ex.: WABA ID no lugar de Phone Number ID) ou o token não tem permissão para esse recurso.",
      hint: "Confira se Phone Number ID e WABA ID não estão trocados nas configurações, e se o Access Token tem permissão para o objeto que está sendo consultado.",
      code,
      type,
      trace,
    };
  }

  // Mapas por código
  switch (code) {
    case "template_not_found":
      return {
        title: "Template não encontrado para esta campanha",
        message:
          "Essa campanha está usando um template que não existe ou não está aprovado na conta WhatsApp conectada.",
        hint: "Escolha um template aprovado da lista e recrie a campanha.",
        code,
        type,
        trace,
      };
    case 190:
      return {
        title: "Token de acesso inválido ou expirado",
        message:
          "A Meta rejeitou suas credenciais. O Access Token do WhatsApp expirou ou foi revogado.",
        hint: 'Gere um novo token em Meta for Developers → seu App → WhatsApp → API Setup e cole no campo "Access Token" acima.',
        code,
        type,
        trace,
      };
    case 100: {
      const fieldMatch = String(message || "").match(/nonexisting field \(([^)]+)\)/i);
      if (fieldMatch) {
        return {
          title: "Parâmetro inválido",
          message: message || "A Meta não aceitou um dos parâmetros enviados.",
          hint: `A Graph API não reconhece o campo "${fieldMatch[1]}" neste objeto. A consulta de detalhes do template será ajustada automaticamente.`,
          code,
          type,
          trace,
        };
      }
      return {
        title: "Parâmetro inválido",
        message: message || "A Meta não aceitou um dos parâmetros enviados.",
        hint: "Confira o Phone Number ID e o formato do destinatário.",
        code,
        type,
        trace,
      };
    }
    case 131030:
      return {
        title: "Número não permitido",
        message: "Este destinatário não está na lista de números autorizados do seu app.",
        hint: "Em modo de desenvolvimento, adicione o número em WhatsApp → API Setup → Recipient phone numbers.",
        code,
        type,
        trace,
      };
    case 131047:
      return {
        title: "Janela de 24h expirada",
        message:
          "O contato não interagiu nas últimas 24 horas, então só é possível enviar um template aprovado.",
        hint: "Use uma campanha com template ou peça para o contato responder primeiro.",
        code,
        type,
        trace,
      };
    case 131051:
      return {
        title: "Tipo de mensagem não suportado",
        message: message || "A Meta não aceitou este tipo de mensagem.",
        code,
        type,
        trace,
      };
    case 132000:
    case 132001:
    case 132005:
    case 132007:
      if (code === 132001) {
        return {
          title: "O template escolhido não existe nessa conta ou nesse idioma",
          message:
            "A campanha tentou usar um template que a Meta não encontrou na conta WhatsApp conectada. Isso acontece quando o nome está desatualizado, o idioma não bate, ou o template nunca foi aprovado nessa conta.",
          hint:
            meta?.error_data?.details ||
            "Escolha um template aprovado da lista de templates e recrie a campanha.",
          code,
          type,
          trace,
        };
      }
      return {
        title: "Template não disponível",
        message: "O template informado não existe, não está aprovado ou o idioma não confere.",
        hint: "Verifique nome, idioma e status do template em Templates.",
        code,
        type,
        trace,
      };
    case 132012:
      return {
        title: "Os dados do template foram enviados no formato errado",
        message:
          "O WhatsApp rejeitou os campos dinâmicos deste template. Isso costuma acontecer quando falta preencher alguma variável, sobra variável, ou um botão com link dinâmico foi montado no formato incorreto.",
        hint: "Revise os parâmetros do template. Se ele tiver variáveis no corpo, cabeçalho ou botão com link, cada parte precisa ser enviada no lugar certo. Depois reenviamos a campanha.",
        code,
        type,
        trace,
      };
    case 4:
    case 80007:
      return {
        title: "Limite de envio atingido",
        message: "Você excedeu o rate limit da Meta. Aguarde alguns segundos e tente de novo.",
        code,
        type,
        trace,
      };
    case 10:
    case 200:
    case 278:
      return {
        title: "Permissão insuficiente",
        message: "O token não tem permissão para esta ação.",
        hint: "Garanta que o token tenha a permissão whatsapp_business_messaging e que o app esteja em modo Live se necessário.",
        code,
        type,
        trace,
      };
    case 131042:
      return metaWabaBillingError("messaging", code, type, trace);
    case 131044:
      return metaWabaBillingError("calling", code, type, trace);
  }

  // Heurísticas por mensagem (inclui error_user_title / error_user_msg da Meta)
  const lower = lowerEarly;

  if (
    String(code) === "131044" ||
    (lower.includes("eligibility payment") && lower.includes("calling"))
  ) {
    return metaWabaBillingError("calling", code ?? 131044, type, trace);
  }
  if (String(code) === "131042" || (lower.includes("eligibility payment") && !lower.includes("calling"))) {
    return metaWabaBillingError("messaging", code ?? 131042, type, trace);
  }

  // "Unsupported get/post request. Object with ID '...' does not exist, cannot be loaded due to missing permissions, or does not support this operation."
  if (lower.includes("does not exist") && lower.includes("missing permissions")) {
    const idMatch = message.match(/ID ['"]?(\d+)['"]?/i);
    const objectId = idMatch?.[1];
    return {
      title: "Objeto não encontrado na Meta",
      message: objectId
        ? `O ID "${objectId}" não foi encontrado, não pode ser acessado por falta de permissão ou não suporta esta operação.`
        : "O ID informado não foi encontrado, não pode ser acessado por falta de permissão ou não suporta esta operação.",
      hint: "Verifique 3 coisas: 1) O ID está no campo certo (Phone Number ID ≠ WABA ID). 2) O Access Token tem as permissões whatsapp_business_messaging e whatsapp_business_management. 3) O Usuário de Sistema que gerou o token foi adicionado à WABA com perfil de Administrador em Meta Business → Configurações → Contas do WhatsApp → Adicionar pessoas.",
      code,
      type,
      trace,
    };
  }

  if (lower.startsWith("unsupported get request") || lower.startsWith("unsupported post request")) {
    return {
      title: "Requisição não suportada pela Meta",
      message:
        "A Meta rejeitou a chamada. Geralmente isso significa que o ID usado é de outro tipo de objeto (ex.: WABA ID no lugar de Phone Number ID) ou o token não tem permissão para esse recurso.",
      hint: "Confira nas configurações se o Phone Number ID e o WABA ID não estão trocados, e se o Access Token tem permissão para o objeto que está sendo consultado.",
      code,
      type,
      trace,
    };
  }

  if (lower.includes("access token")) {
    return {
      title: "Problema com o Access Token",
      message:
        "A Meta recusou o Access Token. Ele pode estar incompleto, expirado, revogado ou pertencer a outro App.",
      hint: "Gere um novo token em Meta Business → Configurações → Usuários do sistema → seu usuário → Gerar token, com as permissões whatsapp_business_messaging e whatsapp_business_management, e cole sem espaços.",
      code,
      type,
      trace,
    };
  }
  if (lower.includes("phone number")) {
    return {
      title: "Phone Number ID inválido",
      message: "O ID do número de telefone informado não foi reconhecido pela Meta.",
      hint: "Copie novamente o Phone Number ID em WhatsApp Manager → clique no número → 'ID do número de telefone'. Não use o número de telefone em si.",
      code,
      type,
      trace,
    };
  }
  if (lower.includes("permission") || lower.includes("permissões")) {
    return {
      title: "Permissão insuficiente",
      message: "O Access Token não tem permissão para executar esta operação.",
      hint: "Garanta as permissões whatsapp_business_messaging e whatsapp_business_management, e que o Usuário de Sistema tenha acesso de Administrador à WABA.",
      code,
      type,
      trace,
    };
  }
  if (lower.includes("rate") && lower.includes("limit")) {
    return {
      title: "Limite de requisições atingido",
      message: "Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.",
      code,
      type,
      trace,
    };
  }
  if (lower.includes("invalid parameter") || lower.includes("invalid value")) {
    return {
      title: "Parâmetro inválido",
      message: "A Meta rejeitou um dos valores enviados.",
      hint: "Revise os campos preenchidos — verifique se os IDs nas configurações estão corretos, se preencheu exemplos de variáveis (caso existam) e se os números de telefone estão no formato internacional (só dígitos).",
      code,
      type,
      trace,
    };
  }

  return {
    title: type === "OAuthException" ? "Erro de autenticação na Meta" : "Não foi possível concluir",
    message: message || fallback,
    code,
    type,
    trace,
  };
}

function callingNumericCode(code: unknown): number | null {
  if (typeof code === "number" && Number.isFinite(code)) return code;
  const raw = String(code ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Códigos oficiais: WhatsApp Calling API troubleshooting (Graph + webhooks de término). */
export function mapWhatsAppCallingError(input: {
  code?: unknown;
  message?: string;
  detailsText?: string;
  type?: unknown;
  trace?: unknown;
  lower?: string;
}): FriendlyError | null {
  const numeric = callingNumericCode(input.code);
  const type = input.type as string | undefined;
  const trace = input.trace as string | undefined;
  const detailsText = input.detailsText || "";
  const message = input.message || "";
  const lower = (input.lower || `${message} ${detailsText}`).toLowerCase();

  const pack = (title: string, body: string, hint?: string, code: number | string | undefined = numeric ?? undefined): FriendlyError => ({
    title,
    message: body,
    hint,
    code,
    type,
    trace,
  });

  if (numeric === 100 && /sdp|ice|session description/i.test(`${message} ${detailsText}`)) {
    return pack(
      "Parametro de chamada invalido",
      message || "A Meta rejeitou o SDP ou um parametro da Calling API.",
      detailsText || "Revise o SDP (RFC 8866, Opus 48 kHz, ptime 20). Codigo 100.",
    );
  }

  switch (numeric) {
    case 613:
      return pack(
        "Limite de consulta de permissao",
        "Muitas consultas a call_permissions neste segundo (maximo 5).",
        "Aguarde e tente de novo. Codigo 613.",
      );
    case 131009:
      return pack(
        "Botao voice_call nao suportado",
        "Este numero nao pode enviar mensagem interativa voice_call.",
        "Confirme se o pais do remetente esta na lista da Calling API. Codigo 131009.",
      );
    case 131030:
      return pack(
        "Destinatario fora da lista de teste",
        "Numero de teste publico: o destinatario nao esta na allowlist da Meta.",
        "Adicione o numero em API Setup e tente de novo. Codigo 131030.",
      );
    case 138000:
      return pack(
        "Calling API desligada neste numero",
        "As APIs de ligacao nao estao habilitadas neste Phone Number ID.",
        "Abra Configuracoes do telefone, ligue Chamadas de voz e salve (SIP desligado). Codigo 138000.",
      );
    case 138001:
      return pack(
        "Destinatario nao pode receber ligacao",
        "O numero nao e WhatsApp, o cliente nao aceitou os termos, ou o app nao e Android/iOS suportado.",
        "Peca para atualizar o WhatsApp e confirmar que aceita contato. Codigo 138001.",
      );
    case 138002:
      return pack("Limite de chamadas simultaneas", "Este numero atingiu 1000 chamadas concorrentes.", "Tente mais tarde. Codigo 138002.");
    case 138003:
      return pack("Chamada duplicada", "Ja existe uma chamada em andamento com este contato.", "Encerrar a atual e tentar de novo. Codigo 138003.");
    case 138004:
      return pack(
        "Erro de conexao da chamada",
        message || "A Meta nao conseguiu conectar a chamada.",
        detailsText || "Revise SDP/ICE e tente de novo. Codigo 138004.",
      );
    case 138005:
      return pack("Limite de iniciacao de chamadas", "Este numero iniciou chamadas demais.", "Reduza a frequencia. Codigo 138005.");
    case 138006:
      return pack(
        "Sem permissao de ligacao",
        "O cliente nao aprovou permissao temporaria para a empresa ligar.",
        "Envie a solicitacao de permissao ou espere o cliente ligar para voce. Codigo 138006.",
      );
    case 138007:
      return pack(
        "Timeout ao conectar",
        "A oferta/resposta SDP da Cloud API nao foi aplicada a tempo.",
        "Aplique o SDP do webhook connect imediatamente no WebRTC. Codigo 138007.",
      );
    case 138009:
      return pack(
        "Limite de pedidos de permissao",
        "Muitos pedidos de permissao para este par empresa/cliente.",
        "Uma chamada atendida zera o limite. Codigo 138009.",
      );
    case 138012:
      return pack(
        "Limite diario de chamadas da empresa",
        "Limite de chamadas iniciadas pela empresa nas ultimas 24h (ate 100 conectadas).",
        detailsText ||
          "A permissao do cliente continua valida. Espere o timestamp do Call Permissions API. Codigo 138012.",
      );
    case 138013:
      return pack(
        "Chamada iniciada pela empresa indisponivel",
        "Este numero nao tem business-initiated calling.",
        "Confira a disponibilidade regional da Calling API. Codigo 138013.",
      );
    case 138014:
      return pack(
        "Chamadas suspensas por qualidade",
        "A Meta desligou temporariamente a Calling API neste numero (qualidade baixa).",
        "Evite spam e tente depois do desbloqueio. Codigo 138014.",
      );
    case 138015:
      return pack(
        "Nao e possivel habilitar chamadas",
        "O limite de mensagens deste numero e menor que 2000.",
        "Suba o messaging limit na Meta e tente de novo. Codigo 138015.",
      );
    case 138017:
      return pack(
        "Permissao permanente ja existe",
        "Nao envie outro pedido: o cliente ja concedeu permissao permanente.",
        "Ligue direto. Codigo 138017.",
      );
    case 138018:
      return pack(
        "Pre-requisito tecnico ausente",
        "Nao ha app inscrito no campo calls desta WABA (e SIP nao e o caminho da Bliv).",
        "No app Meta, assine o webhook calls. Codigo 138018.",
      );
    case 138019:
      return pack("Falha no setup da chamada", "O cliente WhatsApp nao conseguiu montar a chamada.", "Tente de novo. Codigo 138019.");
    case 138020:
      return pack("Falha no relay", "O cliente WhatsApp nao conectou ao servidor de midia da Meta.", "Tente de novo. Codigo 138020.");
    case 138021:
      return pack(
        "Timeout de midia recebida",
        "O WhatsApp encerrou: nao chegou midia do negocio por tempo demais (cerca de 20s no inicio ou 30s depois).",
        "Mantenha o microfone enviando RTP/RTCP apos o accept 200. Codigo 138021.",
      );
    case 138022:
      return pack(
        "Timeout de midia enviada",
        "O WhatsApp encerrou por nao transmitir midia por tempo demais.",
        "Tente de novo. Codigo 138022.",
      );
    case 138023:
      return pack(
        "Atendida sem sinal de midia",
        "A chamada foi aceita, mas a Cloud API nao viu conexao de midia.",
        "Confira ICE e se o audio so flui apos o accept 200. Codigo 138023.",
      );
    case 131044:
      return metaWabaBillingError("calling", 131044, type, trace);
    case 131055:
      return pack(
        "Graph bloqueado: SIP ligado",
        "Com SIP ENABLED a Meta recusa POST /calls da Graph API.",
        "Salve as configuracoes do telefone na Bliv para forcar SIP DISABLED. Codigo 131055.",
      );
    default:
      break;
  }

  if (lower.includes("method not allowed") && lower.includes("sip")) {
    return pack("Graph bloqueado: SIP ligado", message || "Este numero esta com SIP ENABLED.", "Desligue o SIP nas configuracoes. Codigo 131055.", 131055);
  }
  return null;
}

function metaWabaBillingError(
  kind: "calling" | "messaging",
  code: number | string | undefined,
  type: unknown,
  trace: unknown,
): FriendlyError {
  const isCalling = kind === "calling";
  return {
    title: isCalling ? "A Meta bloqueou esta ligação" : "A Meta bloqueou o envio",
    message: isCalling
      ? "A WhatsApp Cloud API recusou a chamada porque a conta comercial no Meta (WABA) não tem cobrança válida para ligações. Isso não é um erro da Bliv nem da assinatura do CRM."
      : "A WhatsApp Cloud API recusou o envio porque a conta comercial no Meta (WABA) não tem cobrança válida. Isso não é um erro da Bliv nem da assinatura do CRM.",
    hint: isCalling
      ? "No Meta Business Suite, abra o WhatsApp Manager da mesma WABA deste número e vincule um método de pagamento à conta WhatsApp (não só à conta de anúncios). Quite faturas em atraso e confirme fuso e moeda. Código Meta 131044."
      : "No Meta Business Suite, vincule um método de pagamento à WABA (não só à conta de anúncios), quite faturas em atraso e confirme fuso e moeda. Código Meta 131042.",
    code,
    type: type as string | undefined,
    trace: trace as string | undefined,
  };
}

export type TemplateMetaErrorLog = {
  endpoint: string;
  apiVersion: string;
  httpStatus: number;
  code?: number | string;
  error_subcode?: number | string;
  message?: string;
  details?: unknown;
  fbtrace_id?: string;
  payload: Record<string, unknown>;
};

export function toFriendlyTemplateError(
  raw: unknown,
  fallback = "Falha ao cadastrar o template na Meta.",
): FriendlyError {
  let details: any = raw;
  if (typeof raw === "string") {
    try {
      details = JSON.parse(raw);
    } catch {
      details = { message: raw };
    }
  }
  const meta = pickMetaError(details) ?? details ?? {};
  const code = meta.code;
  const type = meta.type;
  const trace = meta.fbtrace_id;
  const subcode = meta.error_subcode;
  const dataDetails = meta.error_data?.details || meta.error_data?.blame_field_specs;
  const userTitle = String(meta.error_user_title || "").trim();
  const userMsg = String(meta.error_user_msg || "").trim();
  const message: string = meta.message || fallback;
  const lower = String(message).toLowerCase();
  const detailsText =
    typeof dataDetails === "string"
      ? dataDetails
      : dataDetails
        ? JSON.stringify(dataDetails)
        : [userTitle, userMsg].filter(Boolean).join(" — ");

  if (code === 100 || lower.includes("invalid parameter")) {
    let hint =
      "O cadastro POST /{WABA_ID}/message_templates rejeitou um campo do JSON. Confira componentes, exemplos e header_handle.";
    if (userMsg) {
      hint = userTitle ? `${userTitle}: ${userMsg}` : userMsg;
    } else if (/already exists|duplicate|nome já/i.test(message + detailsText)) {
      hint = "Já existe um template com este nome nesta WABA. Altere o nome interno e envie de novo.";
    } else if (/header_handle|handle|file type/i.test(message + detailsText + userTitle + userMsg)) {
      hint =
        "O campo rejeitado é example.header_handle. A Bliv reenvia o arquivo à Meta no cadastro; se persistir, escolha a imagem de novo na biblioteca.";
    } else if (/body_text_named_params|named param|parameter_format/i.test(message + detailsText)) {
      hint =
        "O formato das variáveis não bate com o JSON. NAMED usa body_text_named_params; POSITIONAL usa body_text como array de arrays.";
    } else if (/header_text/i.test(message + detailsText)) {
      hint = "O cabeçalho TEXT com variável precisa de example.header_text (ou header_text_named_params).";
    } else if (/button/i.test(message + detailsText)) {
      hint = "Há um botão incompatível com a categoria ou sem example/url/flow_id obrigatório.";
    } else if (detailsText) {
      hint = String(detailsText);
    }
    return {
      title: "Parâmetro inválido no cadastro do template",
      message: detailsText ? `${message} — ${detailsText}` : message,
      hint,
      code: subcode ? `${code}/${subcode}` : code,
      type,
      trace,
    };
  }

  if (lower.includes("does not exist") || lower.includes("unsupported post request")) {
    return {
      title: "WABA ID inválido ou sem permissão para templates",
      message,
      hint: "A criação usa o WABA ID (não o Phone Number ID nem o App ID). O token precisa de whatsapp_business_management na WABA selecionada.",
      code,
      type,
      trace,
    };
  }

  return toFriendlyError(raw, fallback);
}

export function logTemplateMetaFailure(info: TemplateMetaErrorLog) {
  console.error("[templates] meta_create_failed", {
    endpoint: info.endpoint,
    apiVersion: info.apiVersion,
    httpStatus: info.httpStatus,
    code: info.code,
    error_subcode: info.error_subcode,
    message: info.message,
    details: info.details,
    fbtrace_id: info.fbtrace_id,
    payload: info.payload,
  });
}
