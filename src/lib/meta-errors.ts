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
  if (lower.includes("access token")) {
    return {
      title: "Problema com o Access Token",
      message: message,
      hint: "Confira se o token foi colado por completo, sem espaços.",
      code, type, trace,
    };
  }
  if (lower.includes("phone number")) {
    return {
      title: "Phone Number ID inválido",
      message: message,
      hint: "Copie novamente o Phone Number ID em WhatsApp → API Setup.",
      code, type, trace,
    };
  }

  return {
    title: type === "OAuthException" ? "Erro de autenticação na Meta" : "Não foi possível concluir",
    message: message || fallback,
    code, type, trace,
  };
}
