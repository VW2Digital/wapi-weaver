"use server";

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { query } from "@/lib/db";
import { decryptMetaCredential, encryptMetaCredential } from "@/lib/encryption";
import { hasMasterRole } from "@/lib/roles";

const GRAPH_VERSION = "v26.0";
const PAYMENT_SETUP_URL = "https://business.facebook.com/wa/manage/home/";
const SUPPORTED_CREDIT_CURRENCIES = ["AUD", "EUR", "GBP", "IDR", "INR", "USD"] as const;

type MigrationType = "new" | "coexistence" | "obo" | "grant_only" | "phone";

interface PartnerAccountRow {
  id: string;
  tenant_id: string;
  channel_connection_id: string | null;
  meta_app_connection_id: string | null;
  customer_business_id: string | null;
  waba_id: string;
  phone_number_id: string | null;
  business_token_encrypted: string | null;
  billing_mode: "customer_payment" | "shared_credit";
  payment_status: "pending" | "action_required" | "ready" | "error";
  primary_funding_id: string | null;
  credit_allocation_id: string | null;
  partner_status: "pending" | "active" | "revoked" | "error";
  system_user_assigned: number;
  migration_type: MigrationType;
  migration_status: "not_required" | "pending" | "completed" | "action_required" | "error";
  flow_finish_type: string | null;
  last_error: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface PartnerConfig {
  businessPortfolioId: string;
  systemUserId: string;
  systemUserToken: string;
  extendedCreditLineId: string;
  graphVersion: string;
}

interface GraphErrorBody {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

async function assertMaster(userId: string) {
  const rows = await query<Array<{ role: string }>>(
    "SELECT role FROM user_roles WHERE user_id = ?",
    [userId],
  );
  if (!hasMasterRole(rows.map(({ role }) => role))) {
    throw new Error("Acesso restrito ao administrador master.");
  }
}

async function getPartnerConfig(): Promise<PartnerConfig> {
  const rows = await query<
    Array<{
      business_account_id: string | null;
      meta_system_user_id: string | null;
      meta_system_user_token_encrypted: string | null;
      system_user_token: string | null;
      meta_extended_credit_line_id: string | null;
      meta_graph_version: string | null;
    }>
  >(
    `SELECT business_account_id, meta_system_user_id,
            meta_system_user_token_encrypted, system_user_token,
            meta_extended_credit_line_id, meta_graph_version
     FROM platform_settings
     WHERE id = 1
     LIMIT 1`,
  );
  const row = rows[0];
  let systemUserToken = "";
  if (row?.meta_system_user_token_encrypted) {
    systemUserToken = decryptMetaCredential(row.meta_system_user_token_encrypted);
  } else if (row?.system_user_token) {
    systemUserToken = row.system_user_token;
  }
  return {
    businessPortfolioId: row?.business_account_id || "",
    systemUserId: row?.meta_system_user_id || "",
    systemUserToken,
    extendedCreditLineId: row?.meta_extended_credit_line_id || "",
    graphVersion: row?.meta_graph_version || GRAPH_VERSION,
  };
}

async function saveWhatsAppPartnerChannel(options: {
  tenantId: string;
  metaAppConnectionId: string | null;
  externalAccountId: string;
  accessToken: string;
  metadata: Record<string, unknown>;
}) {
  const existing = await query<Array<{ id: string; tenant_id: string }>>(
    `SELECT id, tenant_id
     FROM channel_connections
     WHERE provider = 'whatsapp' AND external_account_id = ?
     LIMIT 1`,
    [options.externalAccountId],
  );
  if (existing[0] && existing[0].tenant_id !== options.tenantId) {
    throw new Error("CONFLICT: Este número do WhatsApp já está vinculado a outro tenant.");
  }
  const encryptedToken = encryptMetaCredential(options.accessToken);
  if (existing[0]) {
    await query(
      `UPDATE channel_connections
       SET meta_app_connection_id = ?, metadata = ?,
           access_token_encrypted = ?, status = 'pending',
           disconnected_at = NULL, updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [
        options.metaAppConnectionId,
        JSON.stringify(options.metadata),
        encryptedToken,
        existing[0].id,
        options.tenantId,
      ],
    );
    return { id: existing[0].id };
  }
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO channel_connections (
       id, tenant_id, meta_app_connection_id, provider, status,
       external_account_id, metadata, access_token_encrypted,
       connected_at, created_at, updated_at
     ) VALUES (?, ?, ?, 'whatsapp', 'pending', ?, ?, ?, NOW(), NOW(), NOW())`,
    [
      id,
      options.tenantId,
      options.metaAppConnectionId,
      options.externalAccountId,
      JSON.stringify(options.metadata),
      encryptedToken,
    ],
  );
  return { id };
}

async function graphRequest<T>(
  path: string,
  accessToken: string,
  options: RequestInit = {},
  graphVersion = GRAPH_VERSION,
): Promise<T> {
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...options.headers,
    },
  });
  const body = (await response.json().catch(() => ({}))) as T & GraphErrorBody;
  if (!response.ok || body.error) {
    const error = new Error(
      body.error?.message || `Meta Graph API retornou HTTP ${response.status}`,
    );
    Object.assign(error, {
      metaTraceId: body.error?.fbtrace_id || null,
      metaCode: body.error?.code || null,
      metaSubcode: body.error?.error_subcode || null,
    });
    throw error;
  }
  return body;
}

async function recordOperation(options: {
  tenantId: string;
  partnerAccountId: string;
  operationType:
    | "onboarding"
    | "payment_check"
    | "credit_share"
    | "system_user_assign"
    | "migration";
  idempotencyKey: string;
  status: "pending" | "processing" | "completed" | "action_required" | "failed";
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: unknown;
}) {
  const error = options.error as { message?: string; metaTraceId?: string } | undefined;
  await query(
    `INSERT INTO whatsapp_partner_operations (
       id, tenant_id, partner_account_id, operation_type, idempotency_key,
       status, request_json, response_json, meta_trace_id, error_message,
       completed_at, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       status = VALUES(status),
       response_json = VALUES(response_json),
       meta_trace_id = VALUES(meta_trace_id),
       error_message = VALUES(error_message),
       completed_at = VALUES(completed_at),
       updated_at = NOW()`,
    [
      crypto.randomUUID(),
      options.tenantId,
      options.partnerAccountId,
      options.operationType,
      options.idempotencyKey,
      options.status,
      options.request ? JSON.stringify(options.request) : null,
      options.response ? JSON.stringify(options.response) : null,
      error?.metaTraceId || null,
      error?.message || null,
      ["completed", "action_required", "failed"].includes(options.status) ? new Date() : null,
    ],
  );
}

export function resolveWhatsAppMigrationType(finishType?: string | null): MigrationType {
  if (finishType === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") return "coexistence";
  if (finishType === "FINISH_OBO_MIGRATION") return "obo";
  if (finishType === "FINISH_GRANT_ONLY_API_ACCESS") return "grant_only";
  return "new";
}

export function resolveWhatsAppPaymentStatus(primaryFundingId?: string | null) {
  return primaryFundingId ? ("ready" as const) : ("action_required" as const);
}

export function buildWhatsAppCreditSharePath(creditLineId: string) {
  return `${encodeURIComponent(creditLineId)}/whatsapp_credit_sharing_and_attach`;
}

async function assignSystemUser(account: PartnerAccountRow, config: PartnerConfig) {
  if (!config.systemUserId || !config.systemUserToken) {
    return {
      assigned: false,
      actionRequired: true,
      message: "System User master não configurado.",
    };
  }
  const tasks = [
    "DEVELOP",
    "MANAGE_TEMPLATES",
    "MANAGE_PHONE",
    "VIEW_COST",
    "VIEW_PHONE_ASSETS",
    "MANAGE_PHONE_ASSETS",
    "VIEW_TEMPLATES",
    "VIEW_INSIGHTS",
    "MANAGE_USERS",
    "MANAGE_BILLING",
  ];
  try {
    await graphRequest(
      `${encodeURIComponent(account.waba_id)}/assigned_users`,
      config.systemUserToken,
      {
        method: "POST",
        body: new URLSearchParams({
          user: config.systemUserId,
          tasks: JSON.stringify(tasks),
        }),
      },
      config.graphVersion,
    );
    await query(
      `UPDATE whatsapp_partner_accounts
       SET system_user_assigned = 1, partner_status = 'active',
           last_error = NULL, last_synced_at = NOW(), updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [account.id, account.tenant_id],
    );
    await recordOperation({
      tenantId: account.tenant_id,
      partnerAccountId: account.id,
      operationType: "system_user_assign",
      idempotencyKey: `system-user:${account.waba_id}:${config.systemUserId}`,
      status: "completed",
      request: { wabaId: account.waba_id, systemUserId: config.systemUserId, tasks },
      response: { assigned: true },
    });
    return { assigned: true, actionRequired: false };
  } catch (error) {
    await query(
      `UPDATE whatsapp_partner_accounts
       SET partner_status = 'error', last_error = ?, last_synced_at = NOW(), updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [(error as Error).message, account.id, account.tenant_id],
    );
    await recordOperation({
      tenantId: account.tenant_id,
      partnerAccountId: account.id,
      operationType: "system_user_assign",
      idempotencyKey: `system-user:${account.waba_id}:${config.systemUserId}`,
      status: "failed",
      request: { wabaId: account.waba_id, systemUserId: config.systemUserId, tasks },
      error,
    });
    return { assigned: false, actionRequired: true, message: (error as Error).message };
  }
}

async function refreshPayment(
  account: PartnerAccountRow,
  businessToken: string,
  graphVersion: string,
) {
  try {
    const waba = await graphRequest<{
      id: string;
      name?: string;
      primary_funding_id?: string;
      account_review_status?: string;
      business_verification_status?: string;
      ownership_type?: string;
    }>(
      `${encodeURIComponent(account.waba_id)}?fields=id,name,primary_funding_id,account_review_status,business_verification_status,ownership_type`,
      businessToken,
      {},
      graphVersion,
    );
    const paymentStatus = resolveWhatsAppPaymentStatus(waba.primary_funding_id);
    await query(
      `UPDATE whatsapp_partner_accounts
       SET payment_status = ?, primary_funding_id = ?, last_error = NULL,
           last_synced_at = NOW(), updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [paymentStatus, waba.primary_funding_id || null, account.id, account.tenant_id],
    );
    await recordOperation({
      tenantId: account.tenant_id,
      partnerAccountId: account.id,
      operationType: "payment_check",
      idempotencyKey: `payment:${account.waba_id}:${waba.primary_funding_id || "missing"}`,
      status: waba.primary_funding_id ? "completed" : "action_required",
      request: { wabaId: account.waba_id },
      response: {
        paymentStatus,
        primaryFundingConfigured: Boolean(waba.primary_funding_id),
        accountReviewStatus: waba.account_review_status || null,
        businessVerificationStatus: waba.business_verification_status || null,
      },
    });
    return { paymentStatus, primaryFundingId: waba.primary_funding_id || null };
  } catch (error) {
    await query(
      `UPDATE whatsapp_partner_accounts
       SET payment_status = 'error', last_error = ?, last_synced_at = NOW(), updated_at = NOW()
       WHERE id = ? AND tenant_id = ?`,
      [(error as Error).message, account.id, account.tenant_id],
    );
    await recordOperation({
      tenantId: account.tenant_id,
      partnerAccountId: account.id,
      operationType: "payment_check",
      idempotencyKey: `payment-error:${account.waba_id}:${Date.now()}`,
      status: "failed",
      request: { wabaId: account.waba_id },
      error,
    });
    return { paymentStatus: "error", primaryFundingId: null, error: (error as Error).message };
  }
}

export async function finalizeWhatsAppPartnerOnboarding(options: {
  tenantId: string;
  metaAppConnectionId: string | null;
  customerBusinessId?: string | null;
  wabaId: string;
  phoneNumberId?: string | null;
  businessToken: string;
  flowFinishType?: string | null;
  migrationType?: MigrationType;
  billingMode?: "customer_payment" | "shared_credit";
}) {
  const migrationType =
    options.migrationType || resolveWhatsAppMigrationType(options.flowFinishType);
  const migrationStatus =
    migrationType === "new"
      ? "not_required"
      : options.phoneNumberId
        ? "completed"
        : "action_required";
  const channel = options.phoneNumberId
    ? await saveWhatsAppPartnerChannel({
        tenantId: options.tenantId,
        metaAppConnectionId: options.metaAppConnectionId,
        externalAccountId: options.phoneNumberId,
        metadata: {
          waba_id: options.wabaId,
          phone_number_id: options.phoneNumberId,
          customer_business_id: options.customerBusinessId || null,
          flow_finish_type: options.flowFinishType || null,
          migration_type: migrationType,
        },
        accessToken: options.businessToken,
      })
    : null;

  const existing = await query<Array<{ id: string }>>(
    "SELECT id FROM whatsapp_partner_accounts WHERE tenant_id = ? AND waba_id = ? LIMIT 1",
    [options.tenantId, options.wabaId],
  );
  const accountId = existing[0]?.id || crypto.randomUUID();
  await query(
    `INSERT INTO whatsapp_partner_accounts (
       id, tenant_id, channel_connection_id, meta_app_connection_id,
       customer_business_id, waba_id, phone_number_id, business_token_encrypted,
       billing_mode, payment_status, partner_status, migration_type,
       migration_status, flow_finish_type, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE
       channel_connection_id = VALUES(channel_connection_id),
       meta_app_connection_id = VALUES(meta_app_connection_id),
       customer_business_id = COALESCE(VALUES(customer_business_id), customer_business_id),
       phone_number_id = COALESCE(VALUES(phone_number_id), phone_number_id),
       business_token_encrypted = VALUES(business_token_encrypted),
       billing_mode = VALUES(billing_mode),
       migration_type = VALUES(migration_type),
       migration_status = VALUES(migration_status),
       flow_finish_type = VALUES(flow_finish_type),
       last_error = NULL,
       updated_at = NOW()`,
    [
      accountId,
      options.tenantId,
      channel?.id || null,
      options.metaAppConnectionId,
      options.customerBusinessId || null,
      options.wabaId,
      options.phoneNumberId || null,
      encryptMetaCredential(options.businessToken),
      options.billingMode || "customer_payment",
      migrationType,
      migrationStatus,
      options.flowFinishType || null,
    ],
  );

  const accountRows = await query<Array<PartnerAccountRow>>(
    "SELECT * FROM whatsapp_partner_accounts WHERE id = ? AND tenant_id = ? LIMIT 1",
    [accountId, options.tenantId],
  );
  const account = accountRows[0];
  await recordOperation({
    tenantId: options.tenantId,
    partnerAccountId: accountId,
    operationType: migrationType === "new" ? "onboarding" : "migration",
    idempotencyKey: `onboarding:${options.wabaId}:${options.phoneNumberId || "waba-only"}`,
    status: migrationStatus === "action_required" ? "action_required" : "completed",
    request: {
      wabaId: options.wabaId,
      phoneNumberId: options.phoneNumberId || null,
      customerBusinessId: options.customerBusinessId || null,
      migrationType,
    },
    response: { channelConnectionId: channel?.id || null, migrationStatus },
  });

  const config = await getPartnerConfig();
  const [assignment, payment] = await Promise.all([
    assignSystemUser(account, config),
    refreshPayment(account, options.businessToken, config.graphVersion),
  ]);

  return {
    accountId,
    channelConnectionId: channel?.id || null,
    migrationType,
    migrationStatus,
    assignment,
    payment,
  };
}

export const getWhatsAppPartnerStatus = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const rows = await query<Array<PartnerAccountRow>>(
      `SELECT * FROM whatsapp_partner_accounts
       WHERE tenant_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
      [context.tenantId],
    );
    const account = rows[0];
    if (!account) return null;
    return {
      id: account.id,
      customerBusinessId: account.customer_business_id,
      wabaId: account.waba_id,
      phoneNumberId: account.phone_number_id,
      billingMode: account.billing_mode,
      paymentStatus: account.payment_status,
      primaryFundingConfigured: Boolean(account.primary_funding_id),
      partnerStatus: account.partner_status,
      systemUserAssigned: Boolean(account.system_user_assigned),
      migrationType: account.migration_type,
      migrationStatus: account.migration_status,
      lastError: account.last_error,
      lastSyncedAt: account.last_synced_at,
      paymentSetupUrl: PAYMENT_SETUP_URL,
    };
  });

export const listWhatsAppPartnerAccountsForMaster = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    await assertMaster(context.userId);
    const rows = await query<
      Array<
        PartnerAccountRow & {
          customer_email: string | null;
          customer_name: string | null;
        }
      >
    >(
      `SELECT wpa.*, u.email AS customer_email, p.company_name AS customer_name
       FROM whatsapp_partner_accounts wpa
       JOIN users u ON u.id = wpa.tenant_id
       LEFT JOIN profiles p ON p.id = wpa.tenant_id
       WHERE wpa.tenant_id IS NOT NULL
       ORDER BY wpa.updated_at DESC`,
    );
    return rows.map((account) => ({
      id: account.id,
      tenantId: account.tenant_id,
      customerEmail: account.customer_email,
      customerName: account.customer_name,
      wabaId: account.waba_id,
      phoneNumberId: account.phone_number_id,
      paymentStatus: account.payment_status,
      partnerStatus: account.partner_status,
      migrationType: account.migration_type,
      migrationStatus: account.migration_status,
      systemUserAssigned: Boolean(account.system_user_assigned),
      billingMode: account.billing_mode,
      updatedAt: account.updated_at,
    }));
  });

export const refreshWhatsAppPartnerStatus = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const rows = await query<Array<PartnerAccountRow>>(
      `SELECT * FROM whatsapp_partner_accounts
       WHERE tenant_id = ?
       ORDER BY updated_at DESC
       LIMIT 1`,
      [context.tenantId],
    );
    const account = rows[0];
    if (!account?.business_token_encrypted) {
      throw new Error("Onboarding de parceiro não encontrado para este tenant.");
    }
    const config = await getPartnerConfig();
    const payment = await refreshPayment(
      account,
      decryptMetaCredential(account.business_token_encrypted),
      config.graphVersion,
    );
    return {
      ok: payment.paymentStatus !== "error",
      ...payment,
      paymentSetupUrl: PAYMENT_SETUP_URL,
    };
  });

export const assignWhatsAppPartnerSystemUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z.object({ tenantId: z.string().uuid(), partnerAccountId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId);
    const rows = await query<Array<PartnerAccountRow>>(
      "SELECT * FROM whatsapp_partner_accounts WHERE id = ? AND tenant_id = ? LIMIT 1",
      [data.partnerAccountId, data.tenantId],
    );
    if (!rows[0]) throw new Error("Conta de parceiro não encontrada para o tenant.");
    return assignSystemUser(rows[0], await getPartnerConfig());
  });

export const shareWhatsAppCreditLine = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z
      .object({
        tenantId: z.string().uuid(),
        partnerAccountId: z.string().uuid(),
        currency: z.enum(SUPPORTED_CREDIT_CURRENCIES),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertMaster(context.userId);
    const rows = await query<Array<PartnerAccountRow>>(
      "SELECT * FROM whatsapp_partner_accounts WHERE id = ? AND tenant_id = ? LIMIT 1",
      [data.partnerAccountId, data.tenantId],
    );
    const account = rows[0];
    if (!account) throw new Error("Conta de parceiro não encontrada para o tenant.");
    const config = await getPartnerConfig();
    if (!config.extendedCreditLineId || !config.systemUserToken) {
      throw new Error("Linha de crédito e System User Token master precisam estar configurados.");
    }
    const idempotencyKey = `credit:${account.waba_id}:${data.currency}`;
    try {
      const response = await graphRequest<{
        id?: string;
        allocation_config_id?: string;
        success?: boolean;
      }>(
        buildWhatsAppCreditSharePath(config.extendedCreditLineId),
        config.systemUserToken,
        {
          method: "POST",
          body: new URLSearchParams({
            waba_currency: data.currency,
            waba_id: account.waba_id,
          }),
        },
        config.graphVersion,
      );
      const allocationId = response.allocation_config_id || response.id || null;
      await query(
        `UPDATE whatsapp_partner_accounts
         SET billing_mode = 'shared_credit', payment_status = 'ready',
             credit_allocation_id = ?, last_error = NULL,
             last_synced_at = NOW(), updated_at = NOW()
         WHERE id = ? AND tenant_id = ?`,
        [allocationId, account.id, data.tenantId],
      );
      await recordOperation({
        tenantId: data.tenantId,
        partnerAccountId: account.id,
        operationType: "credit_share",
        idempotencyKey,
        status: "completed",
        request: { wabaId: account.waba_id, currency: data.currency },
        response: { allocationId, success: response.success !== false },
      });
      return { ok: true, allocationId };
    } catch (error) {
      await recordOperation({
        tenantId: data.tenantId,
        partnerAccountId: account.id,
        operationType: "credit_share",
        idempotencyKey,
        status: "failed",
        request: { wabaId: account.waba_id, currency: data.currency },
        error,
      });
      throw error;
    }
  });
