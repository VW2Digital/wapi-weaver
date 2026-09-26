/**
 * Embedded Signup Coexistência (WhatsApp Business app onboarding).
 *
 * Graph API deste projeto: v24–v26 (padrão v26.0). Não usar v21.0.
 * O fluxo CoEx da Meta não depende de Graph v21: o seletor é extras.featureType
 * + um Login for Business config (variação Embedded Signup = experiência v4).
 *
 * Docs: Onboard WhatsApp Business app users
 * extras oficiais: setup, featureType=whatsapp_business_app_onboarding, sessionInfoVersion=3
 */

export const META_GRAPH_DEFAULT = "v26.0";

export type EmbeddedSignupMode = "cloud" | "coexistence";

export type EmbeddedSignupSession = {
  event: string;
  waba_id?: string;
  phone_number_id?: string;
  customer_business_id?: string;
  is_coexistence: boolean;
  migration_type: "new" | "coexistence" | "obo" | "grant_only" | "phone";
};

export function buildEmbeddedSignupLoginOptions(
  configId: string,
  mode: EmbeddedSignupMode,
): Record<string, unknown> {
  const extras: Record<string, unknown> = {
    setup: {},
    sessionInfoVersion: "3",
  };
  if (mode === "coexistence") {
    extras.featureType = "whatsapp_business_app_onboarding";
  }
  return {
    config_id: configId,
    response_type: "code",
    override_default_response_type: true,
    extras,
  };
}

export function parseEmbeddedSignupSession(payload: unknown): EmbeddedSignupSession | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, any>;
  if (data.type !== "WA_EMBEDDED_SIGNUP") return null;
  const event = String(data.event || "");
  const inner = data.data && typeof data.data === "object" ? data.data : {};
  const isCoex = event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING";
  const migration_type: EmbeddedSignupSession["migration_type"] = isCoex
    ? "coexistence"
    : event === "FINISH_OBO_MIGRATION"
      ? "obo"
      : event === "FINISH_GRANT_ONLY_API_ACCESS"
        ? "grant_only"
        : "new";
  return {
    event,
    waba_id: inner.waba_id ? String(inner.waba_id) : undefined,
    phone_number_id: inner.phone_number_id ? String(inner.phone_number_id) : undefined,
    customer_business_id: inner.business_id
      ? String(inner.business_id)
      : inner.business_portfolio_id
        ? String(inner.business_portfolio_id)
        : undefined,
    is_coexistence: isCoex,
    migration_type,
  };
}

export function mapCoexistenceError(raw: unknown): {
  title: string;
  message: string;
} {
  const text = String(
    typeof raw === "string"
      ? raw
      : (raw as any)?.message || (raw as any)?.error?.message || "",
  );
  const lower = text.toLowerCase();
  const code = Number((raw as any)?.code ?? (raw as any)?.error?.code);

  if (code === 10 || code === 200 || lower.includes("whatsapp_business_management")) {
    return {
      title: "Permissão da Meta insuficiente",
      message:
        "O login não concedeu whatsapp_business_management (e whatsapp_business_messaging). Recrie o Facebook Login for Business (Embedded Signup v4) com esses produtos e peça o fluxo de novo.",
    };
  }
  if (
    code === 133010 ||
    lower.includes("not eligible") ||
    lower.includes("ineligible") ||
    lower.includes("whatsapp business app")
  ) {
    return {
      title: "Número não elegível para coexistência",
      message:
        "A Meta recusou o onboarding do app WhatsApp Business. O número precisa estar no app Business (2.24.17+), em país suportado, sem Cloud API já registrada por outro BSP, e o cliente deve escolher o caminho de coexistência no popup.",
    };
  }
  if (lower.includes("waba_id") || lower.includes("não retornou a waba")) {
    return {
      title: "WABA não retornada",
      message:
        "O Embedded Signup terminou sem waba_id. Confira o Config ID v4 e se o postMessage WA_EMBEDDED_SIGNUP chegou deste domínio.",
    };
  }
  return {
    title: "Falha no Embedded Signup",
    message: text || "A Meta não concluiu a conexão do WhatsApp.",
  };
}
