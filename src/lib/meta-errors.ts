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

export function toFriendlyError(raw: unknown, fallback = "Falha ao executar a operação."): FriendlyError {
  let details: any = raw;
  if (typeof raw === "string") {
    try { details = JSON.parse(raw); } catch { details = { message: raw }; }
  }
  const meta = pickMetaError(details) ?? details ?? {};
  const code = meta.code;
  const type = meta.type;
  const trace = meta.fbtrace_id;
  const message: string = meta.message || (typeof raw === "string" ? raw : fallback);

  // Mapas por código
  switch (code) {
    case 190:
      return {
        title: "Token de acesso inválido ou expirado",
        message: "A Meta rejeitou suas credenciais. O Access Token do WhatsApp expirou ou foi revogado.",
        hint: "Gere um novo token em Meta for Developers → seu App → WhatsApp → API Setup e cole no campo \"Access Token\" acima.",
        code, type, trace,
      };
    case 100:
      return {
        title: "Parâmetro inválido",
        message: message || "A Meta não aceitou um dos parâmetros enviados.",
        hint: "Confira Phone Number ID, WABA ID e o formato do destinatário (E.164 sem o sinal +).",
        code, type, trace,
      };
    case 131030:
      return {
        title: "Número não permitido",
        message: "Este destinatário não está na lista de números autorizados do seu app.",
        hint: "Em modo de desenvolvimento, adicione o número em WhatsApp → API Setup → Recipient phone numbers.",
        code, type, trace,
      };
    case 131047:
      return {
        title: "Janela de 24h expirada",
        message: "O contato não interagiu nas últimas 24 horas, então só é possível enviar um template aprovado.",
        hint: "Use uma campanha com template ou peça para o contato responder primeiro.",
        code, type, trace,
      };
    case 131051:
      return {
        title: "Tipo de mensagem não suportado",
        message: message || "A Meta não aceitou este tipo de mensagem.",
        code, type, trace,
      };
    case 132000:
    case 132001:
    case 132005:
    case 132007:
      return {
        title: "Template não disponível",
        message: "O template informado não existe, não está aprovado ou o idioma não confere.",
        hint: "Verifique nome, idioma e status do template em Templates.",
        code, type, trace,
      };
    case 4:
    case 80007:
      return {
        title: "Limite de envio atingido",
        message: "Você excedeu o rate limit da Meta. Aguarde alguns segundos e tente de novo.",
        code, type, trace,
      };
    case 10:
    case 200:
    case 278:
      return {
        title: "Permissão insuficiente",
        message: "O token não tem permissão para esta ação.",
        hint: "Garanta que o token tenha a permissão whatsapp_business_messaging e que o app esteja em modo Live se necessário.",
        code, type, trace,
      };
  }

  // Heurísticas por mensagem
  const lower = (message || "").toLowerCase();

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
      code, type, trace,
    };
  }

  if (lower.startsWith("unsupported get request") || lower.startsWith("unsupported post request")) {
    return {
      title: "Requisição não suportada pela Meta",
      message: "A Meta rejeitou a chamada. Geralmente isso significa que o ID usado é de outro tipo de objeto (ex.: WABA ID no lugar de Phone Number ID) ou o token não tem permissão para esse recurso.",
      hint: "Confira nas configurações se o Phone Number ID e o WABA ID não estão trocados, e se o Access Token tem permissão para o objeto que está sendo consultado.",
      code, type, trace,
    };
  }

  if (lower.includes("access token")) {
    return {
      title: "Problema com o Access Token",
      message: "A Meta recusou o Access Token. Ele pode estar incompleto, expirado, revogado ou pertencer a outro App.",
      hint: "Gere um novo token em Meta Business → Configurações → Usuários do sistema → seu usuário → Gerar token, com as permissões whatsapp_business_messaging e whatsapp_business_management, e cole sem espaços.",
      code, type, trace,
    };
  }
  if (lower.includes("phone number")) {
    return {
      title: "Phone Number ID inválido",
      message: "O ID do número de telefone informado não foi reconhecido pela Meta.",
      hint: "Copie novamente o Phone Number ID em WhatsApp Manager → clique no número → 'ID do número de telefone'. Não use o número de telefone em si.",
      code, type, trace,
    };
  }
  if (lower.includes("permission") || lower.includes("permissões")) {
    return {
      title: "Permissão insuficiente",
      message: "O Access Token não tem permissão para executar esta operação.",
      hint: "Garanta as permissões whatsapp_business_messaging e whatsapp_business_management, e que o Usuário de Sistema tenha acesso de Administrador à WABA.",
      code, type, trace,
    };
  }
  if (lower.includes("rate") && lower.includes("limit")) {
    return {
      title: "Limite de requisições atingido",
      message: "Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.",
      code, type, trace,
    };
  }
  if (lower.includes("invalid parameter") || lower.includes("invalid value")) {
    return {
      title: "Parâmetro inválido",
      message: "A Meta rejeitou um dos valores enviados.",
      hint: "Revise os campos preenchidos — especialmente IDs numéricos e números de telefone (formato internacional, só dígitos).",
      code, type, trace,
    };
  }

  return {
    title: type === "OAuthException" ? "Erro de autenticação na Meta" : "Não foi possível concluir",
    message: message || fallback,
    code, type, trace,
  };
}
