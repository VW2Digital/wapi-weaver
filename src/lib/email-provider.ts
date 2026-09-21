import crypto from "crypto";
import db from "@/lib/db";
import { decrypt, encrypt } from "@/lib/encryption";
import { MASKED_SECRET } from "@/lib/payment-gateway-admin";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

const GLOBAL_TENANT = "global";
const RESET_TTL_MS = 60 * 60 * 1000;
const RESEND_API = "https://api.resend.com/emails";

export type EmailProviderRow = {
  id: string;
  tenant_id: string;
  provider: string;
  api_key_encrypted: string | null;
  from_email: string | null;
  from_name: string | null;
  reply_to: string | null;
  is_active: number;
};

export async function getGlobalEmailProviderRow(): Promise<EmailProviderRow | null> {
  const rows = (await db.query(
    "SELECT * FROM email_provider_settings WHERE tenant_id = ? LIMIT 1",
    [GLOBAL_TENANT],
  )) as EmailProviderRow[];
  return rows[0] ?? null;
}

export function decryptApiKey(value?: string | null): string {
  if (!value) return "";
  if (!value.includes(":")) return value;
  try {
    return decrypt(value);
  } catch {
    console.error("[EmailProvider] API key decryption failed");
    return "";
  }
}

export function encryptApiKeyIfChanged(value: unknown, currentEncrypted?: string | null): string | null {
  if (value === undefined || value === null) return currentEncrypted ?? null;
  const normalized = typeof value === "string" ? value.trim() : "";
  if (normalized === MASKED_SECRET || /^[•*.\s]+$/.test(normalized)) {
    return currentEncrypted ?? null;
  }
  if (normalized === "") return null;
  return encrypt(normalized);
}

export function publicEmailProviderView(row: EmailProviderRow | null, revealKey: boolean) {
  const hasKey = Boolean(row?.api_key_encrypted);
  return {
    provider: row?.provider ?? "resend",
    from_email: row?.from_email ?? "",
    from_name: row?.from_name ?? SITE_NAME,
    reply_to: row?.reply_to ?? "",
    is_active: row ? Number(row.is_active) === 1 : true,
    has_api_key: hasKey,
    api_key: revealKey && hasKey ? decryptApiKey(row?.api_key_encrypted) : hasKey ? MASKED_SECRET : "",
  };
}

export async function upsertGlobalEmailProvider(input: {
  from_email: string;
  from_name: string;
  reply_to: string;
  is_active: boolean;
  api_key: unknown;
}) {
  const current = await getGlobalEmailProviderRow();
  const apiKeyEncrypted = encryptApiKeyIfChanged(input.api_key, current?.api_key_encrypted);
  const fromEmail = input.from_email.trim();
  const fromName = input.from_name.trim() || SITE_NAME;
  const replyTo = input.reply_to.trim() || null;
  const isActive = input.is_active ? 1 : 0;

  if (current) {
    await db.query(
      `UPDATE email_provider_settings
       SET provider = 'resend', api_key_encrypted = ?, from_email = ?, from_name = ?, reply_to = ?, is_active = ?
       WHERE tenant_id = ?`,
      [apiKeyEncrypted, fromEmail || null, fromName, replyTo, isActive, GLOBAL_TENANT],
    );
    return;
  }

  await db.query(
    `INSERT INTO email_provider_settings
      (id, tenant_id, provider, api_key_encrypted, from_email, from_name, reply_to, is_active)
     VALUES (?, ?, 'resend', ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), GLOBAL_TENANT, apiKeyEncrypted, fromEmail || null, fromName, replyTo, isActive],
  );
}

function formatFrom(fromName: string, fromEmail: string) {
  const name = fromName.replace(/"/g, "").trim() || SITE_NAME;
  return `"${name}" <${fromEmail}>`;
}

export async function sendResendEmail(params: {
  to: string;
  subject: string;
  html: string;
  apiKey?: string;
  fromEmail?: string;
  fromName?: string;
  replyTo?: string | null;
}): Promise<{ ok: boolean; message: string }> {
  const row = await getGlobalEmailProviderRow();
  const apiKey = params.apiKey ?? decryptApiKey(row?.api_key_encrypted);
  const fromEmail = (params.fromEmail ?? row?.from_email ?? "").trim();
  const fromName = (params.fromName ?? row?.from_name ?? SITE_NAME).trim();
  const replyTo = (params.replyTo ?? row?.reply_to ?? "").trim();

  if (!apiKey) {
    return { ok: false, message: "API key da Resend não configurada." };
  }
  if (!fromEmail) {
    return { ok: false, message: "E-mail remetente (from) é obrigatório." };
  }
  if (row && Number(row.is_active) !== 1 && !params.apiKey) {
    return { ok: false, message: "Provedor de e-mail está desativado." };
  }

  const payload: Record<string, unknown> = {
    from: formatFrom(fromName, fromEmail),
    to: [params.to],
    subject: params.subject,
    html: params.html,
  };
  if (replyTo) payload.reply_to = replyTo;

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = `Resend HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string; name?: string };
      if (body?.message) detail = body.message;
    } catch {
      /* ignore */
    }
    console.error("[EmailProvider] Resend send failed:", detail);
    return { ok: false, message: detail };
  }

  return { ok: true, message: "E-mail enviado." };
}

function hashResetToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function appOrigin(requestOrigin: string) {
  const configured = (process.env.PUBLIC_APP_URL || process.env.SITE_URL || process.env.APP_URL || "").replace(
    /\/$/,
    "",
  );
  if (configured) return configured;
  if (SITE_URL && !SITE_URL.includes("localhost")) return SITE_URL.replace(/\/$/, "");
  return requestOrigin.replace(/\/$/, "");
}

function passwordResetHtml(resetLink: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family:Arial,sans-serif;background:#f4f4f5;padding:32px;color:#18181b;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e4e4e7;">
    <tr><td>
      <p style="font-size:18px;font-weight:600;margin:0 0 12px;">Redefinir senha</p>
      <p style="font-size:14px;line-height:1.5;margin:0 0 24px;color:#52525b;">
        Recebemos um pedido para redefinir a senha da sua conta ${SITE_NAME}.
        O link expira em 1 hora.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${resetLink}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:600;">
          Definir nova senha
        </a>
      </p>
      <p style="font-size:12px;line-height:1.5;color:#71717a;margin:0;">
        Se você não pediu esta alteração, ignore este e-mail.
      </p>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function issuePasswordResetEmail(params: {
  userId: string;
  email: string;
  requestOrigin: string;
  requestedIp?: string | null;
}): Promise<void> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  const tenantId = params.userId;

  await db.query(
    "UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = ? AND tenant_id = ? AND used_at IS NULL",
    [params.userId, tenantId],
  );

  await db.query(
    `INSERT INTO password_reset_tokens
      (id, tenant_id, user_id, token_hash, expires_at, requested_ip)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), tenantId, params.userId, tokenHash, expiresAt, params.requestedIp ?? null],
  );

  const resetLink = `${appOrigin(params.requestOrigin)}/reset-password?token=${rawToken}`;
  const result = await sendResendEmail({
    to: params.email,
    subject: `Redefinir senha — ${SITE_NAME}`,
    html: passwordResetHtml(resetLink),
  });

  if (!result.ok) {
    console.error("[AUTH] Password reset email not sent:", result.message);
  }
}

export async function consumePasswordResetToken(rawToken: string) {
  const tokenHash = hashResetToken(rawToken);
  const rows = (await db.query(
    `SELECT id, tenant_id, user_id, expires_at, used_at
     FROM password_reset_tokens
     WHERE token_hash = ?
     LIMIT 1`,
    [tokenHash],
  )) as Array<{
    id: string;
    tenant_id: string;
    user_id: string;
    expires_at: Date | string;
    used_at: Date | string | null;
  }>;

  const row = rows[0];
  if (!row) {
    return { ok: false as const, message: "Link inválido ou expirado." };
  }
  if (row.used_at) {
    return { ok: false as const, message: "Este link já foi utilizado." };
  }
  const expires = new Date(row.expires_at).getTime();
  if (!Number.isFinite(expires) || expires < Date.now()) {
    return { ok: false as const, message: "Link inválido ou expirado." };
  }

  return { ok: true as const, userId: row.user_id, tenantId: row.tenant_id, tokenId: row.id };
}

export async function markPasswordResetUsed(tokenId: string, tenantId: string, userId: string) {
  await db.query(
    "UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ? AND tenant_id = ? AND user_id = ? AND used_at IS NULL",
    [tokenId, tenantId, userId],
  );
}
