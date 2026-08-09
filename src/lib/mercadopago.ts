import db from "./db";
import { decrypt } from "./encryption";

export interface MercadoPagoConfig {
  accessToken: string;
  publicKey: string;
  environment: "sandbox" | "production";
  checkoutMode: "redirect" | "transparent";
}

/**
 * Recovers the active payment gateway configuration for a tenant and decrypts tokens.
 */
export async function getMercadoPagoConfig(tenantId: string): Promise<MercadoPagoConfig | null> {
  if (!tenantId || tenantId === "__any__") return null;

  const rows = (await db.query(
    "SELECT environment, checkout_mode, sandbox_access_token, sandbox_public_key, production_access_token, production_public_key FROM payment_gateway_settings WHERE tenant_id = ? LIMIT 1",
    [tenantId],
  )) as any[];

  if (rows.length === 0) return null;
  const row = rows[0];
  const env: "sandbox" | "production" = row.environment === "production" ? "production" : "sandbox";
  const checkoutMode: "redirect" | "transparent" = row.checkout_mode === "transparent" ? "transparent" : "redirect";

  let accessToken = "";
  let publicKey = "";

  if (env === "production") {
    accessToken = row.production_access_token ? decrypt(row.production_access_token) : "";
    publicKey = row.production_public_key || "";
  } else {
    accessToken = row.sandbox_access_token ? decrypt(row.sandbox_access_token) : "";
    publicKey = row.sandbox_public_key || "";
  }

  console.log(`[getMercadoPagoConfig] tenantId=${tenantId} env=${env} mode=${checkoutMode} configured=${Boolean(accessToken)}`);

  return {
    accessToken,
    publicKey,
    environment: env,
    checkoutMode,
  };
}


/**
 * Creates a checkout preference (Checkout Pro) on Mercado Pago.
 */
export async function createPreference(
  config: MercadoPagoConfig,
  params: {
    title: string;
    amount: number;
    externalReference: string;
    payerEmail: string;
    webhookUrl?: string;
    successUrl?: string;
    pendingUrl?: string;
    failureUrl?: string;
  },
): Promise<{ id: string; init_point: string; sandbox_init_point: string }> {
  if (!config.accessToken) {
    throw new Error("Mercado Pago Access Token is not configured.");
  }

  const body: Record<string, unknown> = {
    items: [
      {
        title: params.title,
        quantity: 1,
        unit_price: Number(params.amount),
        currency_id: "BRL",
      },
    ],
    payer: {
      email: params.payerEmail,
    },
    external_reference: params.externalReference,
  };

  if (params.successUrl && params.pendingUrl && params.failureUrl) {
    body.back_urls = {
      success: params.successUrl,
      pending: params.pendingUrl,
      failure: params.failureUrl,
    };
    body.auto_return = "all";
  }

  if (params.webhookUrl) {
    body.notification_url = params.webhookUrl;
  }

  console.log("[createPreference] body:", JSON.stringify(body));

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[MercadoPago API Error] createPreference:", errorBody);
    throw new Error(`Failed to create payment preference: ${errorBody}`);
  }

  const data = (await response.json()) as any;
  return {
    id: data.id,
    init_point: data.init_point,
    sandbox_init_point: data.sandbox_init_point,
  };
}


/**
 * Creates a transparent card/PIX payment on Mercado Pago.
 */
export async function createPayment(
  config: MercadoPagoConfig,
  paymentData: any,
): Promise<any> {
  if (!config.accessToken) {
    throw new Error("Mercado Pago Access Token is not configured.");
  }

  // Extract idempotencyKey from payload (it must NOT be sent in the JSON body to MP)
  const { idempotencyKey, ...bodyPayload } = paymentData;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.accessToken}`,
    "Content-Type": "application/json",
  };
  if (idempotencyKey) {
    headers["X-Idempotency-Key"] = idempotencyKey;
  }

  const response = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers,
    body: JSON.stringify(bodyPayload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[MercadoPago API Error] createPayment:", errorBody);
    throw new Error(`Failed to create payment: ${errorBody}`);
  }

  return response.json();
}

/**
 * Retrieves payment details by ID directly from Mercado Pago API.
 */
export async function getPaymentDetails(config: MercadoPagoConfig, paymentId: string): Promise<any> {
  if (!config.accessToken) {
    throw new Error("Mercado Pago Access Token is not configured.");
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("[MercadoPago API Error] getPaymentDetails:", errorBody);
    throw new Error(`Failed to fetch payment details: ${errorBody}`);
  }

  return response.json();
}

/**
 * Validates a connection with Mercado Pago API using a simple non-financial GET call.
 */
export async function testConnection(accessToken: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.mercadopago.com/v1/payment_methods", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return response.ok;
  } catch (e) {
    console.error("[MercadoPago Test Connection Error]", e);
    return false;
  }
}
