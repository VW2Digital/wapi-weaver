import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { DbInterface } from "./db";
import crypto from "crypto";

function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase()
    .slice(0, 100);
}

async function uniqueKey(userId: string, label: string, db: DbInterface, excludeId?: string): Promise<string> {
  const base = slugify(label);
  if (!base) throw new Error("Não foi possível gerar uma chave a partir do label");
  let key = base;
  let suffix = 2;
  while (true) {
    const rows = await db.query(
      "SELECT id FROM contact_custom_fields WHERE user_id = ? AND `key` = ?" + (excludeId ? " AND id != ?" : "") + " LIMIT 1",
      excludeId ? [userId, key, excludeId] : [userId, key],
    );
    if ((rows as any[]).length === 0) return key;
    key = `${base}_${suffix}`;
    suffix++;
  }
}

async function ensureWebhookFieldMappingsTable(db: any) {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS webhook_field_mappings (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        webhook_id VARCHAR(36) NOT NULL,
        external_field VARCHAR(255) NOT NULL,
        target_type VARCHAR(50) NOT NULL DEFAULT 'standard',
        target_key VARCHAR(100) NULL,
        custom_field_id VARCHAR(36) NULL,
        transformation VARCHAR(50) NULL,
        default_value TEXT NULL,
        is_required BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (err) {
    console.warn("[WebhookFieldMappings] Aviso ao auto-criar tabela:", err);
  }
}

export const customFieldTypeEnum = z.enum([
  "text", "textarea", "number", "currency", "date", "datetime",
  "select", "multi_select", "boolean", "email", "phone", "url",
]);

const createFieldSchema = z.object({
  label: z.string().trim().min(1).max(255),
  type: customFieldTypeEnum,
  placeholder: z.string().max(500).optional().default(""),
  options: z.array(z.string()).optional(),
  default_value: z.string().optional().default(""),
  required: z.boolean().optional().default(false),
  show_on_form: z.boolean().optional().default(true),
  show_on_table: z.boolean().optional().default(false),
  show_on_details: z.boolean().optional().default(true),
  is_active: z.boolean().optional().default(true),
});

const updateFieldSchema = createFieldSchema.extend({
  id: z.string().uuid(),
});

export const listCustomFields = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const rows = (await db.query(
      "SELECT * FROM contact_custom_fields WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC",
      [effectiveUserId],
    )) as any[];
    return rows ?? [];
  });

export const createCustomField = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => createFieldSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const id = crypto.randomUUID();
    const key = await uniqueKey(effectiveUserId, data.label, db);
    await db.query(
      `INSERT INTO contact_custom_fields (id, user_id, tenant_id, label, \`key\`, type, placeholder, options, default_value, required, show_on_form, show_on_table, show_on_details, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, effectiveUserId, effectiveUserId, data.label, key, data.type,
        data.placeholder || null,
        data.options && data.options.length > 0 ? JSON.stringify(data.options) : null,
        data.default_value || null,
        data.required ? 1 : 0,
        data.show_on_form ? 1 : 0,
        data.show_on_table ? 1 : 0,
        data.show_on_details ? 1 : 0,
        data.is_active ? 1 : 0,
      ],
    );
    return { id, key };
  });

export const updateCustomField = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => updateFieldSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const key = await uniqueKey(effectiveUserId, data.label, db, data.id);
    await db.query(
      `UPDATE contact_custom_fields SET label = ?, \`key\` = ?, type = ?, placeholder = ?, options = ?, default_value = ?, required = ?, show_on_form = ?, show_on_table = ?, show_on_details = ?, is_active = ?
       WHERE id = ? AND user_id = ?`,
      [
        data.label, key, data.type,
        data.placeholder || null,
        data.options && data.options.length > 0 ? JSON.stringify(data.options) : null,
        data.default_value || null,
        data.required ? 1 : 0,
        data.show_on_form ? 1 : 0,
        data.show_on_table ? 1 : 0,
        data.show_on_details ? 1 : 0,
        data.is_active ? 1 : 0,
        data.id, effectiveUserId,
      ],
    );
    return { ok: true };
  });

export const deleteCustomField = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    await db.query("DELETE FROM contact_custom_fields WHERE id = ? AND user_id = ?", [
      data.id, effectiveUserId,
    ]);
    return { ok: true };
  });

export const reorderCustomFields = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) => z.object({ ids: z.array(z.string().uuid()) }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    for (let i = 0; i < data.ids.length; i++) {
      await db.query(
        "UPDATE contact_custom_fields SET sort_order = ? WHERE id = ? AND user_id = ?",
        [i, data.ids[i], effectiveUserId],
      );
    }
    return { ok: true };
  });

export const getCustomFieldValuesBatch = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d) => z.object({ contact_ids: z.array(z.string().uuid()) }).parse(d))
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    if (data.contact_ids.length === 0) return [];
    const placeholders = data.contact_ids.map(() => "?").join(",");
    return db.query(
      `SELECT cfv.*, cf.label, cf.key, cf.type
       FROM contact_custom_field_values cfv
       JOIN contact_custom_fields cf ON cf.id = cfv.custom_field_id
       WHERE cfv.user_id = ? AND cfv.contact_id IN (${placeholders})`,
      [effectiveUserId, ...data.contact_ids],
    );
  });

export const saveContactCustomFieldValues = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z.object({
      contact_id: z.string().uuid(),
      values: z.array(
        z.object({
          custom_field_id: z.string().uuid(),
          value: z.any().nullable(),
        }),
      ),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);
    const { contact_id, values } = data;
    for (const v of values) {
      const valueText = v.value === null || v.value === undefined ? null : String(v.value);
      const valueJson = Array.isArray(v.value) || (v.value !== null && typeof v.value === "object")
        ? JSON.stringify(v.value)
        : null;
      await db.query(
        `INSERT INTO contact_custom_field_values (user_id, contact_id, custom_field_id, value, value_json)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value), value_json = VALUES(value_json)`,
        [effectiveUserId, contact_id, v.custom_field_id, valueText, valueJson],
      );
    }
    return { ok: true };
  });

export const STANDARD_FIELDS = [
  { key: "name", label: "Nome", type: "text" },
  { key: "phone", label: "Telefone", type: "phone" },
  { key: "email", label: "E-mail", type: "email" },
  { key: "company", label: "Empresa", type: "text" },
  { key: "position", label: "Cargo", type: "text" },
  { key: "status", label: "Status", type: "text" },
  { key: "notes", label: "Observações", type: "textarea" },
  { key: "tags", label: "Tags", type: "text" },
  { key: "responsible_user_id", label: "Responsável", type: "text" },
  { key: "source_name", label: "Origem (detalhe)", type: "text" },
  { key: "external_id", label: "External ID", type: "text" },
] as const;

export const listStandardFields = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => {
    return STANDARD_FIELDS;
  });

export const saveWebhookFieldMappings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d) =>
    z.object({
      webhook_id: z.string().uuid(),
      mappings: z.array(
        z.object({
          external_field: z.string().min(1).max(255),
          target_type: z.enum(["standard", "custom", "ignore"]),
          target_key: z.string().max(100).nullable().optional(),
          custom_field_id: z.string().uuid().nullable().optional(),
          transformation: z.string().max(50).nullable().optional(),
          default_value: z.string().nullable().optional(),
          is_required: z.coerce.boolean().optional().default(false),
        }),
      ),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    await ensureWebhookFieldMappingsTable(db);

    const [webhook] = (await db.query(
      "SELECT id FROM incoming_webhooks WHERE id = ? AND tenant_id = ? LIMIT 1",
      [data.webhook_id, effectiveUserId],
    )) as any[];
    if (!webhook) throw new Error("Webhook não encontrado");

    await db.query("DELETE FROM webhook_field_mappings WHERE webhook_id = ? AND user_id = ?", [
      data.webhook_id, effectiveUserId,
    ]);

    for (const m of data.mappings) {
      if (m.target_type === "custom" && m.custom_field_id) {
        const [cf] = (await db.query(
          "SELECT id FROM contact_custom_fields WHERE id = ? AND user_id = ? LIMIT 1",
          [m.custom_field_id, effectiveUserId],
        )) as any[];
        if (!cf) throw new Error(`Campo personalizado ${m.custom_field_id} não encontrado`);
      }
      await db.query(
        `INSERT INTO webhook_field_mappings (id, user_id, webhook_id, external_field, target_type, target_key, custom_field_id, transformation, default_value, is_required)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(), effectiveUserId, data.webhook_id,
          m.external_field, m.target_type, m.target_key || null,
          m.custom_field_id || null, m.transformation || null,
          m.default_value || null, m.is_required ? 1 : 0,
        ],
      );
    }

    return { ok: true };
  });
