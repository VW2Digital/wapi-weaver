# Custom Fields & Webhook Mapping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement global contact custom fields with dynamic forms, customizable columns, detail view, and visual webhook field mapping.

**Architecture:** EAV pattern — `contact_custom_fields` (definitions per tenant), `contact_custom_field_values` (values per contact), `webhook_field_mappings` (payload-to-field mapping per webhook). All tables include `user_id` for multi-tenant isolation.

**Tech Stack:** TanStack Start (server functions), MySQL, shadcn/ui, TanStack Query, Zod, localStorage for column prefs.

## Global Constraints

- Every new table MUST have `user_id` with FK to `users(id)` and all queries filtered by it
- Webhook `user_id` is ALWAYS derived from token — NEVER from payload
- Dedup order: external_id > phone (E164) > email, always within same user_id
- `localStorage` key: `crm_contacts_visible_columns_v1_{user_id}`
- Type-check must pass: `tsc --noEmit`

---

## File Structure

### New files
- `src/lib/custom-fields.functions.ts` — Server functions: CRUD for custom fields, value batch ops, field list for dropdown
- `src/routes/_app/settings/custom-fields.tsx` — Settings page: table list + create/edit modal
- `src/components/contacts/custom-field-input.tsx` — Renders the correct input based on field type (text, select, boolean, etc.)
- `src/components/contacts/column-selector.tsx` — Popover with checkboxes for visible columns

### Modified files
- `schema_mysql.sql` — New tables + altered tables
- `scripts/ensure-schema.js` — Migration entries: new tables + new columns
- `src/lib/contacts.functions.ts` — Add `listStandardFields`, `getCustomFieldValuesBatch`, `saveCustomFieldValues`
- `src/routes/_app/contacts.index.tsx` — Dynamic custom fields in form, column selector in toolbar, batch value loading in rows
- `src/routes/_app/contacts.$id.tsx` — Custom fields section in sidebar
- `src/routes/_app/webhooks.tsx` — Full field mapping UI + create custom field modal + events table
- `src/lib/webhooks.server.ts` — Updated `upsertContactFromWebhook` with field mapping support, new dedup order, custom field values
- `src/routes/api/public/webhooks/incoming/$token.ts` — Updated handler with idempotency, field mapping, full audit logging
- `src/routes/_app/settings.tsx` (or layout) — Add nav entry for "Campos personalizados"

---

### Task 1: Schema + Migration Scripts

**Files:**
- Modify: `schema_mysql.sql`
- Modify: `scripts/ensure-schema.js`

**Interfaces:**
- Consumes: existing `contacts`, `incoming_webhooks`, `contact_activities` table structures
- Produces: all new tables and columns that all backend tasks depend on

- [ ] **Step 1: Add `contact_custom_fields` table to `schema_mysql.sql`**

Append before the Webhooks Module section:

```sql
-- -------------------------------------------------------------------
-- CUSTOM FIELDS MODULE
-- -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contact_custom_fields (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  label VARCHAR(255) NOT NULL,
  `key` VARCHAR(100) NOT NULL,
  type ENUM('text','textarea','number','currency','date','datetime','select','multi_select','boolean','email','phone','url') NOT NULL DEFAULT 'text',
  placeholder TEXT NULL,
  options JSON NULL,
  default_value TEXT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  show_on_form BOOLEAN NOT NULL DEFAULT TRUE,
  show_on_table BOOLEAN NOT NULL DEFAULT FALSE,
  show_on_details BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_field (user_id, `key`),
  INDEX idx_cf_user (user_id),
  INDEX idx_cf_active (is_active),
  INDEX idx_cf_sort (user_id, sort_order),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_custom_field_values (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  contact_id VARCHAR(36) NOT NULL,
  custom_field_id VARCHAR(36) NOT NULL,
  value TEXT NULL,
  value_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contact_field (user_id, contact_id, custom_field_id),
  INDEX idx_cfv_user (user_id),
  INDEX idx_cfv_contact (user_id, contact_id),
  INDEX idx_cfv_field (custom_field_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (custom_field_id) REFERENCES contact_custom_fields(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS webhook_field_mappings (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  webhook_id VARCHAR(36) NOT NULL,
  external_field VARCHAR(255) NOT NULL,
  target_type ENUM('standard','custom','ignore') NOT NULL,
  target_key VARCHAR(100) NULL,
  custom_field_id VARCHAR(36) NULL,
  transformation VARCHAR(50) NULL,
  default_value TEXT NULL,
  is_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_webhook_field (user_id, webhook_id, external_field),
  INDEX idx_wfm_user (user_id),
  INDEX idx_wfm_webhook (user_id, webhook_id),
  INDEX idx_wfm_target_type (target_type),
  INDEX idx_wfm_custom_field (custom_field_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (webhook_id) REFERENCES incoming_webhooks(id) ON DELETE CASCADE,
  FOREIGN KEY (custom_field_id) REFERENCES contact_custom_fields(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 2: Replace `incoming_webhook_events` table in `schema_mysql.sql`**

Find the existing `incoming_webhook_events` table definition and replace with:

```sql
CREATE TABLE IF NOT EXISTS incoming_webhook_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  webhook_id VARCHAR(36) NOT NULL,
  contact_id VARCHAR(36) NULL,
  idempotency_key VARCHAR(64) NULL,
  status ENUM('received','processing','processed','failed') NOT NULL DEFAULT 'received',
  action VARCHAR(50) NULL,
  raw_payload JSON NOT NULL,
  mapped_standard_fields JSON NULL,
  mapped_custom_fields JSON NULL,
  unmapped_fields JSON NULL,
  headers JSON NULL,
  ip_address VARCHAR(45) NULL,
  user_agent TEXT NULL,
  error_code VARCHAR(50) NULL,
  error_message TEXT NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME NULL,
  processing_duration_ms INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_iwe_user (user_id),
  INDEX idx_iwe_webhook (user_id, webhook_id),
  INDEX idx_iwe_contact (contact_id),
  INDEX idx_iwe_status (user_id, status),
  INDEX idx_iwe_received (user_id, received_at),
  UNIQUE KEY uq_iwe_idempotency (webhook_id, idempotency_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (webhook_id) REFERENCES incoming_webhooks(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 3: Add new columns to `contacts` table in `schema_mysql.sql`**

Find the `contacts` CREATE TABLE and add after `email VARCHAR(255) NULL,`:

```sql
  company VARCHAR(255) NULL,
  position VARCHAR(255) NULL,
  notes TEXT NULL,
```

Add after `kanban_stage_id VARCHAR(36) NULL,`:

```sql
  status VARCHAR(50) NULL,
  responsible_user_id VARCHAR(36) NULL,
```

Add after the existing indexes:

```sql
  INDEX idx_contacts_company (user_id, company),
  INDEX idx_contacts_status (user_id, status),
```

Add before the closing `) ENGINE=...`:

```sql
  FOREIGN KEY (responsible_user_id) REFERENCES users(id) ON DELETE SET NULL
```

- [ ] **Step 4: Add `user_id` to `contact_activities` table in `schema_mysql.sql`**

Find `contact_id VARCHAR(36) NOT NULL,` and add after it:

```sql
  user_id VARCHAR(36) NULL,
```

Add before the `FOREIGN KEY`:

```sql
  INDEX idx_ca_user (user_id),
```

Add before the closing `) ENGINE=...`:

```sql
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
```

- [ ] **Step 5: Update `incoming_webhooks` table in `schema_mysql.sql`**

Replace existing `incoming_webhooks` with:

```sql
CREATE TABLE IF NOT EXISTS incoming_webhooks (
  id VARCHAR(36) NOT NULL PRIMARY KEY,
  tenant_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  token VARCHAR(64) NOT NULL UNIQUE,
  status ENUM('listening','paused') NOT NULL DEFAULT 'listening',
  last_event_at DATETIME NULL,
  last_contact_id VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (last_contact_id) REFERENCES contacts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- [ ] **Step 6: Add migration entries to `scripts/ensure-schema.js`**

Open `scripts/ensure-schema.js` and find the main `ensureSchema` function. After the existing webhook section (after the `incoming_webhooks` ensureTableExists block), add:

```javascript
// ── Custom Fields Module ─────────────────────────────────────────

await ensureTableExists(
  connection,
  "contact_custom_fields",
  `CREATE TABLE IF NOT EXISTS contact_custom_fields (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    label VARCHAR(255) NOT NULL,
    \`key\` VARCHAR(100) NOT NULL,
    type ENUM('text','textarea','number','currency','date','datetime','select','multi_select','boolean','email','phone','url') NOT NULL DEFAULT 'text',
    placeholder TEXT NULL,
    options JSON NULL,
    default_value TEXT NULL,
    required BOOLEAN NOT NULL DEFAULT FALSE,
    show_on_form BOOLEAN NOT NULL DEFAULT TRUE,
    show_on_table BOOLEAN NOT NULL DEFAULT FALSE,
    show_on_details BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_field (user_id, \`key\`),
    INDEX idx_cf_user (user_id),
    INDEX idx_cf_active (is_active),
    INDEX idx_cf_sort (user_id, sort_order),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
);

await ensureTableExists(
  connection,
  "contact_custom_field_values",
  `CREATE TABLE IF NOT EXISTS contact_custom_field_values (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    contact_id VARCHAR(36) NOT NULL,
    custom_field_id VARCHAR(36) NOT NULL,
    value TEXT NULL,
    value_json JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_contact_field (user_id, contact_id, custom_field_id),
    INDEX idx_cfv_user (user_id),
    INDEX idx_cfv_contact (user_id, contact_id),
    INDEX idx_cfv_field (custom_field_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (custom_field_id) REFERENCES contact_custom_fields(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
);

await ensureTableExists(
  connection,
  "webhook_field_mappings",
  `CREATE TABLE IF NOT EXISTS webhook_field_mappings (
    id VARCHAR(36) NOT NULL PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    webhook_id VARCHAR(36) NOT NULL,
    external_field VARCHAR(255) NOT NULL,
    target_type ENUM('standard','custom','ignore') NOT NULL,
    target_key VARCHAR(100) NULL,
    custom_field_id VARCHAR(36) NULL,
    transformation VARCHAR(50) NULL,
    default_value TEXT NULL,
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_webhook_field (user_id, webhook_id, external_field),
    INDEX idx_wfm_user (user_id),
    INDEX idx_wfm_webhook (user_id, webhook_id),
    INDEX idx_wfm_target_type (target_type),
    INDEX idx_wfm_custom_field (custom_field_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (webhook_id) REFERENCES incoming_webhooks(id) ON DELETE CASCADE,
    FOREIGN KEY (custom_field_id) REFERENCES contact_custom_fields(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
);

// New columns on contacts
await ensureColumnExists(connection, "contacts", "company", "VARCHAR(255) NULL");
await ensureColumnExists(connection, "contacts", "position", "VARCHAR(255) NULL");
await ensureColumnExists(connection, "contacts", "notes", "TEXT NULL");
await ensureColumnExists(connection, "contacts", "status", "VARCHAR(50) NULL");
await ensureColumnExists(connection, "contacts", "responsible_user_id", "VARCHAR(36) NULL");

// user_id on contact_activities
await ensureColumnExists(connection, "contact_activities", "user_id", "VARCHAR(36) NULL");
```

- [ ] **Step 7: Commit**

```bash
git add schema_mysql.sql scripts/ensure-schema.js
git commit -m "feat: add custom fields and webhook mapping tables"
```

---

### Task 2: Custom Fields Server Functions

**Files:**
- Create: `src/lib/custom-fields.functions.ts`

**Interfaces:**
- Consumes: Task 1 schema (contact_custom_fields, contact_custom_field_values, webhook_field_mappings)
- Produces: `listCustomFields`, `createCustomField`, `updateCustomField`, `deleteCustomField`, `reorderCustomFields`, `getCustomFieldValuesBatch`, `saveContactCustomFieldValues`, `listStandardFields`

- [ ] **Step 1: Create the file with imports and helpers**

Create `src/lib/custom-fields.functions.ts`:

```typescript
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
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

async function uniqueKey(userId: string, label: string, db: any, excludeId?: string): Promise<string> {
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
```

- [ ] **Step 2: Add custom field type and list/create/update/delete functions**

```typescript
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
    return db.query(
      "SELECT * FROM contact_custom_fields WHERE user_id = ? ORDER BY sort_order ASC, created_at ASC",
      [effectiveUserId],
    );
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
      `INSERT INTO contact_custom_fields (id, user_id, label, \`key\`, type, placeholder, options, default_value, required, show_on_form, show_on_table, show_on_details, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, effectiveUserId, data.label, key, data.type,
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
```

- [ ] **Step 3: Add custom field values functions**

```typescript
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
```

- [ ] **Step 4: Add standard fields list function**

```typescript
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
```

- [ ] **Step 5: Run type-check**

```bash
npm run type-check
```

Expected: PASS (0 errors)

- [ ] **Step 6: Commit**

```bash
git add src/lib/custom-fields.functions.ts
git commit -m "feat: add custom fields server functions"
```

---

### Task 3: Settings UI — Custom Fields CRUD

**Files:**
- Create: `src/routes/_app/settings/custom-fields.tsx`
- Modify: `src/routes/_app/settings.tsx` (add nav entry)

**Interfaces:**
- Consumes: Task 2 (`listCustomFields`, `createCustomField`, `updateCustomField`, `deleteCustomField`, `reorderCustomFields`, `customFieldTypeEnum`)
- Produces: Visual CRUD for custom fields

- [ ] **Step 1: Create settings custom fields page**

Create `src/routes/_app/settings/custom-fields.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCustomFields, createCustomField, updateCustomField, deleteCustomField } from "@/lib/custom-fields.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/settings/custom-fields")({ component: CustomFieldsSettingsPage });

const FIELD_TYPES = [
  { value: "text", label: "Texto curto" },
  { value: "textarea", label: "Texto longo" },
  { value: "number", label: "Número" },
  { value: "currency", label: "Valor monetário" },
  { value: "date", label: "Data" },
  { value: "datetime", label: "Data e hora" },
  { value: "select", label: "Seleção única" },
  { value: "multi_select", label: "Múltipla seleção" },
  { value: "boolean", label: "Sim/Não" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefone" },
  { value: "url", label: "URL" },
];

const defaultForm = {
  label: "",
  type: "text" as string,
  placeholder: "",
  options: [] as string[],
  default_value: "",
  required: false,
  show_on_form: true,
  show_on_table: false,
  show_on_details: true,
  is_active: true,
};

function CustomFieldsSettingsPage() {
  const qc = useQueryClient();
  const { data: fields, isLoading } = useQuery({
    queryKey: ["custom-fields"],
    queryFn: () => listCustomFields(),
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [newOption, setNewOption] = useState("");

  const createMut = useMutation({
    mutationFn: (d: typeof form) => createCustomField({ data: d as any }),
    onSuccess: () => { toast.success("Campo criado"); setOpen(false); setForm(defaultForm); qc.invalidateQueries({ queryKey: ["custom-fields"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (d: any) => updateCustomField({ data: d }),
    onSuccess: () => { toast.success("Campo atualizado"); setOpen(false); setEditing(null); setForm(defaultForm); qc.invalidateQueries({ queryKey: ["custom-fields"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteCustomField({ data: { id } }),
    onSuccess: () => { toast.success("Campo removido"); qc.invalidateQueries({ queryKey: ["custom-fields"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setOpen(true);
  };

  const openEdit = (f: any) => {
    setEditing(f);
    setForm({
      label: f.label,
      type: f.type,
      placeholder: f.placeholder || "",
      options: f.options ? (typeof f.options === "string" ? JSON.parse(f.options) : f.options) : [],
      default_value: f.default_value || "",
      required: !!f.required,
      show_on_form: !!f.show_on_form,
      show_on_table: !!f.show_on_table,
      show_on_details: !!f.show_on_details,
      is_active: !!f.is_active,
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.label.trim()) { toast.error("Nome do campo é obrigatório"); return; }
    if (editing) {
      updateMut.mutate({ id: editing.id, ...form });
    } else {
      createMut.mutate(form);
    }
  };

  const addOption = () => {
    if (!newOption.trim()) return;
    setForm({ ...form, options: [...form.options, newOption.trim()] });
    setNewOption("");
  };

  const removeOption = (idx: number) => {
    setForm({ ...form, options: form.options.filter((_: any, i: number) => i !== idx) });
  };

  const needsOptions = form.type === "select" || form.type === "multi_select";

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando...</div>;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Campos personalizados dos contatos</h1>
          <p className="text-sm text-muted-foreground">Gerencie os campos personalizados que aparecem no formulário, lista e detalhe dos contatos.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Novo campo
        </Button>
      </div>

      <Card>
        <div className="divide-y">
          {(fields as any[] ?? []).map((f: any) => (
            <div key={f.id} className="flex items-center justify-between p-3">
              <div className="flex items-center gap-3 min-w-0">
                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{f.label}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">({f.key})</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{FIELD_TYPES.find(t => t.value === f.type)?.label || f.type}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={f.is_active ? "default" : "secondary"} className="text-[10px]">
                  {f.is_active ? "Ativo" : "Inativo"}
                </Badge>
                <Button size="icon" variant="ghost" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remover este campo?")) deleteMut.mutate(f.id); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </div>
          ))}
          {(fields as any[] ?? []).length === 0 && (
            <p className="p-6 text-sm text-muted-foreground text-center">Nenhum campo personalizado criado ainda.</p>
          )}
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar campo" : "Novo campo personalizado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome do campo *</Label>
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex: Profissão" />
              {editing && <p className="text-[10px] text-muted-foreground font-mono">Chave interna: {editing.key}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de campo *</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Placeholder</Label>
              <Input value={form.placeholder} onChange={(e) => setForm({ ...form, placeholder: e.target.value })} />
            </div>
            {needsOptions && (
              <div className="space-y-1.5">
                <Label>Opções</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {form.options.map((opt: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="gap-1 pr-1">
                      {opt}
                      <button className="text-muted-foreground hover:text-foreground text-xs ml-1" onClick={() => removeOption(idx)}>✕</button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={newOption} onChange={(e) => setNewOption(e.target.value)} placeholder="Nova opção..." onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }} />
                  <Button size="sm" variant="outline" onClick={addOption}>Adicionar</Button>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Valor padrão</Label>
              <Input value={form.default_value} onChange={(e) => setForm({ ...form, default_value: e.target.value })} />
            </div>
            <div className="flex flex-wrap gap-4 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.required} onCheckedChange={(v) => setForm({ ...form, required: !!v })} />
                <span className="text-sm">Obrigatório</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.show_on_form} onCheckedChange={(v) => setForm({ ...form, show_on_form: !!v })} />
                <span className="text-sm">Mostrar no formulário</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.show_on_table} onCheckedChange={(v) => setForm({ ...form, show_on_table: !!v })} />
                <span className="text-sm">Mostrar na lista</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.show_on_details} onCheckedChange={(v) => setForm({ ...form, show_on_details: !!v })} />
                <span className="text-sm">Mostrar no detalhe</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} />
                <span className="text-sm">Ativo</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={save} disabled={createMut.isPending || updateMut.isPending}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 2: Add nav entry to settings layout**

Find the settings page navigation/route setup and add "Campos personalizados" entry linking to `/settings/custom-fields`.

- [ ] **Step 3: Run type-check**

```bash
npm run type-check
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/routes/_app/settings/custom-fields.tsx
git commit -m "feat: add custom fields settings page with CRUD"
```

---

### Task 4: Custom Field Input Component

**Files:**
- Create: `src/components/contacts/custom-field-input.tsx`

**Interfaces:**
- Consumes: field definition from `contact_custom_fields`
- Produces: `<CustomFieldInput field={...} value={...} onChange={...} />`

- [ ] **Step 1: Create the component**

Create `src/components/contacts/custom-field-input.tsx`:

```tsx
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface CustomField {
  id: string;
  label: string;
  key: string;
  type: string;
  placeholder: string | null;
  options: string[] | null;
  required: boolean;
  is_active: boolean;
}

interface Props {
  field: CustomField;
  value: any;
  onChange: (value: any) => void;
}

export function CustomFieldInput({ field, value, onChange }: Props) {
  const id = `cf-${field.id}`;

  switch (field.type) {
    case "textarea":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Textarea id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} rows={3} />
        </div>
      );

    case "number":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Input id={id} type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} />
        </div>
      );

    case "currency":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
            <Input id={id} className="pl-8" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="0,00" />
          </div>
        </div>
      );

    case "date":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Input id={id} type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      );

    case "datetime":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Input id={id} type="datetime-local" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      );

    case "select": {
      const opts: string[] = field.options ?? [];
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Select value={value ?? ""} onValueChange={onChange}>
            <SelectTrigger id={id}><SelectValue placeholder={field.placeholder ?? "Selecione..."} /></SelectTrigger>
            <SelectContent>
              {opts.map((o: string) => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    case "multi_select": {
      const opts: string[] = field.options ?? [];
      const selected: string[] = Array.isArray(value) ? value : [];
      const toggle = (opt: string) => {
        onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
      };
      return (
        <div className="space-y-1.5">
          <Label>{field.label}{field.required ? " *" : ""}</Label>
          <div className="flex flex-wrap gap-2">
            {opts.map((o: string) => (
              <label key={o} className="flex items-center gap-1.5 cursor-pointer text-sm">
                <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} className="rounded border-border" />
                {o}
              </label>
            ))}
          </div>
        </div>
      );
    }

    case "boolean":
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={value === "true" || value === true} onCheckedChange={(v) => onChange(v ? "true" : "false")} />
          <span className="text-sm">{field.label}{field.required ? " *" : ""}</span>
        </label>
      );

    case "email":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Input id={id} type="email" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} />
        </div>
      );

    case "phone":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Input id={id} type="tel" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? "+55 11 99999-0000"} />
        </div>
      );

    case "url":
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Input id={id} type="url" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? "https://"} />
        </div>
      );

    default:
      return (
        <div className="space-y-1.5">
          <Label htmlFor={id}>{field.label}{field.required ? " *" : ""}</Label>
          <Input id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? ""} />
        </div>
      );
  }
}
```

- [ ] **Step 2: Run type-check**

```bash
npm run type-check
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/contacts/custom-field-input.tsx
git commit -m "feat: add custom field input component with type-aware rendering"
```

---

### Task 5: Contact Form — Dynamic Custom Fields

**Files:**
- Modify: `src/routes/_app/contacts.index.tsx`

**Interfaces:**
- Consumes: Task 2 (`listCustomFields`, `getCustomFieldValuesBatch`, `saveContactCustomFieldValues`), Task 4 (`CustomFieldInput`)
- Produces: Dynamic fields in create/edit sheets + save flow

- [ ] **Step 1: Add imports and state for custom fields in `contacts.index.tsx`**

Add to imports:
```tsx
import { listCustomFields, getCustomFieldValuesBatch, saveContactCustomFieldValues } from "@/lib/custom-fields.functions";
import { CustomFieldInput } from "@/components/contacts/custom-field-input";
```

- [ ] **Step 2: Add custom fields query and state**

After existing queries:
```tsx
const customFields = useQuery({
  queryKey: ["custom-fields"],
  queryFn: () => listCustomFields(),
  staleTime: 60000,
});
const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
```

- [ ] **Step 3: When opening edit sheet, load custom field values**

After the existing `setEditForm(...)` in the edit handler, add:
```tsx
getCustomFieldValuesBatch({ data: { contact_ids: [c.id] } }).then((vals: any) => {
  const map: Record<string, any> = {};
  (vals ?? []).forEach((v: any) => { map[v.custom_field_id] = v.value_json ?? v.value; });
  setCustomFieldValues(map);
});
```

- [ ] **Step 4: Render custom fields in create and edit sheets**

After the standard fields section and before the save button in the edit Sheet, add:
```tsx
{(customFields.data as any[] ?? []).filter((f: any) => f.show_on_form && f.is_active).length > 0 && (
  <div className="pt-3 border-t">
    <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Campos personalizados</p>
    <div className="space-y-3">
      {(customFields.data as any[] ?? []).filter((f: any) => f.show_on_form && f.is_active).map((f: any) => (
        <CustomFieldInput
          key={f.id}
          field={f}
          value={customFieldValues[f.id] ?? null}
          onChange={(val: any) => setCustomFieldValues({ ...customFieldValues, [f.id]: val })}
        />
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 5: Save custom field values when saving contact**

In the `updateMut.mutate` call for edit, add before/after:

After the contact update mutation success handler, also call:
```tsx
if (Object.keys(customFieldValues).length > 0) {
  saveContactCustomFieldValues({
    data: {
      contact_id: editingContact.id,
      values: Object.entries(customFieldValues).map(([custom_field_id, value]) => ({ custom_field_id, value })),
    },
  });
}
```

- [ ] **Step 6: In the create sheet, when creating a contact, also save custom field values**

In the `createMut.onSuccess`, reset `customFieldValues`.

In the create mutation, after `createMut.mutate(form)` succeeds, if the contact was created, save custom field values. Use a follow-up mutation or call from the onSuccess.

- [ ] **Step 7: Run type-check**

```bash
npm run type-check
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/routes/_app/contacts.index.tsx
git commit -m "feat: add dynamic custom fields to contact create/edit forms"
```

---

### Task 6: Column Selector + Customizable Columns in Contacts List

**Files:**
- Create: `src/components/contacts/column-selector.tsx`
- Modify: `src/routes/_app/contacts.index.tsx`

**Interfaces:**
- Consumes: Task 2 (`listCustomFields`, `getCustomFieldValuesBatch`), `localStorage`
- Produces: Column toggle popover + conditional column rendering

- [ ] **Step 1: Create column selector component**

Create `src/components/contacts/column-selector.tsx`:

```tsx
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Columns3 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

interface ColumnDef {
  key: string;
  label: string;
  fixed?: boolean;
}

interface Props {
  columns: ColumnDef[];
  visible: string[];
  onChange: (keys: string[]) => void;
}

export function ColumnSelector({ columns, visible, onChange }: Props) {
  const toggle = (key: string) => {
    if (visible.includes(key)) {
      onChange(visible.filter((k) => k !== key));
    } else {
      onChange([...visible, key]);
    }
  };

  const standard = columns.filter((c) => c.fixed);
  const custom = columns.filter((c) => !c.fixed);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Columns3 className="mr-1 h-4 w-4" /> Colunas
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-3">
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Colunas visíveis</p>
        {standard.map((c) => (
          <label key={c.key} className="flex items-center gap-2 py-1 cursor-pointer">
            <Checkbox checked={visible.includes(c.key)} onCheckedChange={() => toggle(c.key)} />
            <span className="text-sm">{c.label}</span>
          </label>
        ))}
        {custom.length > 0 && (
          <>
            <p className="text-xs font-semibold text-muted-foreground mt-3 mb-2 uppercase tracking-wider">Personalizados</p>
            {custom.map((c) => (
              <label key={c.key} className="flex items-center gap-2 py-1 cursor-pointer">
                <Checkbox checked={visible.includes(c.key)} onCheckedChange={() => toggle(c.key)} />
                <span className="text-sm">{c.label}</span>
              </label>
            ))}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Integrate column selector in contacts list page**

In `contacts.index.tsx`, add near the search/filter toolbar:

```tsx
const userId = /* get current user id from context */;
const lsKey = `crm_contacts_visible_columns_v1_${userId}`;

const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
  try {
    const saved = localStorage.getItem(lsKey);
    return saved ? JSON.parse(saved) : ["name", "phone", "email", "source", "last_interaction"];
  } catch { return ["name", "phone", "email", "source", "last_interaction"]; }
});

const saveVisibleColumns = (keys: string[]) => {
  setVisibleColumns(keys);
  localStorage.setItem(lsKey, JSON.stringify(keys));
};

const allColumns = [
  { key: "name", label: "Nome", fixed: true },
  { key: "phone", label: "Telefone", fixed: true },
  { key: "email", label: "E-mail", fixed: true },
  { key: "source", label: "Origem", fixed: true },
  { key: "company", label: "Empresa", fixed: true },
  { key: "position", label: "Cargo", fixed: true },
  { key: "status", label: "Status", fixed: true },
  { key: "last_interaction", label: "Última interação", fixed: true },
  ...(customFields.data as any[] ?? []).filter((f: any) => f.show_on_table).map((f: any) => ({
    key: `cf_${f.key}`,
    label: f.label,
    fixed: false,
  })),
];
```

Add the ColumnSelector in the toolbar:
```tsx
<ColumnSelector columns={allColumns} visible={visibleColumns} onChange={saveVisibleColumns} />
```

- [ ] **Step 3: Render columns conditionally in the table**

In the table header, only render `<th>` for visible columns:
```tsx
{allColumns.filter(c => visibleColumns.includes(c.key)).map((c) => (
  <th key={c.key}>{c.label}</th>
))}
<th>Ações</th>
```

In table rows, render cell values based on visible columns. For custom fields (`cf_*`), look up value from a loaded batch map.

- [ ] **Step 4: Load custom field values in batch**

After loading contacts, load batch values:

```tsx
const { data: cfValuesBatch } = useQuery({
  queryKey: ["cf-values-batch", (contacts ?? []).map((c: any) => c.id)],
  queryFn: () => getCustomFieldValuesBatch({ data: { contact_ids: (contacts ?? []).map((c: any) => c.id) } }),
  enabled: (contacts ?? []).length > 0,
});
```

Build a lookup map: `cfValuesMap[contactId][customFieldId] = value`

- [ ] **Step 5: Run type-check**

```bash
npm run type-check
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/contacts/column-selector.tsx src/routes/_app/contacts.index.tsx
git commit -m "feat: add customizable columns selector for contacts list"
```

---

### Task 7: Contact Detail — Custom Fields Section

**Files:**
- Modify: `src/routes/_app/contacts.$id.tsx`

**Interfaces:**
- Consumes: Task 2 (`listCustomFields`, `getCustomFieldValuesBatch`)
- Produces: Custom fields in sidebar with type-aware rendering

- [ ] **Step 1: Add imports and load custom fields + values**

Add to imports:
```tsx
import { listCustomFields, getCustomFieldValuesBatch } from "@/lib/custom-fields.functions";
import { Badge } from "@/components/ui/badge";
```

In the component, add after existing queries:
```tsx
const { data: customFields } = useQuery({
  queryKey: ["custom-fields"],
  queryFn: () => listCustomFields(),
  staleTime: 60000,
});

const { data: cfValues } = useQuery({
  queryKey: ["cf-values", id],
  queryFn: () => getCustomFieldValuesBatch({ data: { contact_ids: [id] } }),
  enabled: !!id,
});
```

Build value map:
```tsx
const cfValueMap: Record<string, any> = {};
(cfValues ?? []).forEach((v: any) => { cfValueMap[v.custom_field_id] = v.value_json ?? v.value; });
```

- [ ] **Step 2: Add custom fields section in the sidebar**

After the "Campos personalizados" comment in the sidebar JSX, add:

```tsx
{(customFields as any[] ?? []).filter((f: any) => f.show_on_details && f.is_active).length > 0 && (
  <div className="space-y-2 pt-2 border-t border-border/40">
    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Campos personalizados</p>
    {(customFields as any[] ?? []).filter((f: any) => f.show_on_details && f.is_active).map((f: any) => {
      const val = cfValueMap[f.id];
      if (val === null || val === undefined || val === "") return null;
      return (
        <div key={f.id} className="flex items-start gap-2 text-sm">
          <span className="text-xs text-muted-foreground shrink-0 min-w-[100px]">{f.label}:</span>
          <span className="text-sm font-medium">{renderValue(f, val)}</span>
        </div>
      );
    })}
  </div>
)}
```

- [ ] **Step 3: Add `renderValue` helper for type-aware display**

Add function:
```tsx
function renderValue(field: any, value: any): React.ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  switch (field.type) {
    case "boolean":
      return value === "true" || value === true
        ? <Badge className="bg-emerald-500 text-[10px]">Sim</Badge>
        : <Badge variant="secondary" className="text-[10px]">Não</Badge>;
    case "currency": {
      const num = parseFloat(String(value).replace(/[^\d,.-]/g, "").replace(",", "."));
      return isNaN(num) ? value : num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    case "url": return <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary underline">{value}</a>;
    case "email": return <a href={`mailto:${value}`} className="text-primary underline">{value}</a>;
    case "phone": return <a href={`tel:${value}`} className="text-primary underline">{value}</a>;
    case "date": return new Date(value).toLocaleDateString("pt-BR");
    case "datetime": return new Date(value).toLocaleString("pt-BR");
    case "multi_select": {
      const items = Array.isArray(value) ? value : (typeof value === "string" ? JSON.parse(value) : [value]);
      return <div className="flex flex-wrap gap-1">{items.map((i: string, idx: number) => <Badge key={idx} variant="outline" className="text-[10px]">{i}</Badge>)}</div>;
    }
    default: return value;
  }
}
```

- [ ] **Step 4: Run type-check**

```bash
npm run type-check
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/_app/contacts.$id.tsx
git commit -m "feat: add custom fields section to contact detail page"
```

---

### Task 8: Webhook Field Mapping UI

**Files:**
- Modify: `src/routes/_app/webhooks.tsx`

**Interfaces:**
- Consumes: Task 2 (`listCustomFields`, `createCustomField`, `listStandardFields`, `STANDARD_FIELDS`), Task 3 (create custom field modal)
- Produces: Field mapping table, unmapped fields, events view

- [ ] **Step 1: Load existing mappings and custom fields in webhook page**

Add imports:
```tsx
import { listCustomFields, createCustomField, STANDARD_FIELDS } from "@/lib/custom-fields.functions";
```

Add state/query:
```tsx
const { data: customFields } = useQuery({
  queryKey: ["custom-fields"],
  queryFn: () => listCustomFields(),
  staleTime: 60000,
});
```

- [ ] **Step 2: Build the mapping table UI**

Create a state for mappings array:
```tsx
const [mappings, setMappings] = useState<Array<{
  external_field: string;
  target_type: "standard" | "custom" | "ignore";
  target_key: string;
  custom_field_id: string;
  example_value?: string;
}>>([]);
```

Render table with columns: Campo recebido | Exemplo valor | Campo no CRM (dropdown) | Ação

The dropdown options are:
- Grupo "Campos padrão": STANDARD_FIELDS.map
- Grupo "Campos personalizados": customFields.filter(is_active)
- Grupo "Ações": "Ignorar campo", "Salvar apenas no payload bruto", "+ Criar novo campo personalizado"

- [ ] **Step 3: Add "Detectar campos" button**

Parse the JSON from test payload textarea, extract all keys (using dot notation for nested), prepopulate the mappings table.

- [ ] **Step 4: Add "Criar novo campo personalizado" option**

When selected, open the same Dialog from Task 3. After creation, refresh custom fields list and auto-select the new field.

- [ ] **Step 5: Save mappings**

Create a save button that calls a new server function to upsert `webhook_field_mappings` entries.

Add server function in `custom-fields.functions.ts`:

```typescript
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
          is_required: z.boolean().optional().default(false),
        }),
      ),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { resolveEffectiveUserId } = await import("./chat-helpers");
    const { default: db } = await import("./db");
    const effectiveUserId = await resolveEffectiveUserId(context.userId);

    // Verify webhook belongs to user
    const [webhook] = await db.query(
      "SELECT id FROM incoming_webhooks WHERE id = ? AND tenant_id = ? LIMIT 1",
      [data.webhook_id, effectiveUserId],
    );
    if (!webhook) throw new Error("Webhook não encontrado");

    // Delete existing mappings for this webhook
    await db.query("DELETE FROM webhook_field_mappings WHERE webhook_id = ? AND user_id = ?", [
      data.webhook_id, effectiveUserId,
    ]);

    // Insert new mappings
    for (const m of data.mappings) {
      if (m.target_type === "custom" && m.custom_field_id) {
        // Validate custom field belongs to same user
        const [cf] = await db.query(
          "SELECT id FROM contact_custom_fields WHERE id = ? AND user_id = ? LIMIT 1",
          [m.custom_field_id, effectiveUserId],
        );
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
```

- [ ] **Step 6: Add events table**

Load and display `incoming_webhook_events` for this webhook, showing:
Date, Status (badge), Action (created/updated/error), Contact name

- [ ] **Step 7: Run type-check**

```bash
npm run type-check
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/routes/_app/webhooks.tsx src/lib/custom-fields.functions.ts
git commit -m "feat: add webhook field mapping UI and save endpoint"
```

---

### Task 9: Webhook Handler — Updated Backend

**Files:**
- Modify: `src/lib/webhooks.server.ts`
- Modify: `src/routes/api/public/webhooks/incoming/$token.ts`

**Interfaces:**
- Consumes: Task 2 (field mapping + custom field value functions)
- Produces: Updated webhook processing flow with field mapping, dedup, idempotency, audit logging

- [ ] **Step 1: Create `applyFieldMappings` helper in `webhooks.server.ts`**

```typescript
import { normalizeToE164 } from "@/lib/phone";

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

function applyTransformation(value: any, transformation: string | null): any {
  if (value === null || value === undefined || !transformation) return value;
  switch (transformation) {
    case "normalize_phone": return normalizeToE164(String(value)) || value;
    case "lowercase": return String(value).toLowerCase();
    case "uppercase": return String(value).toUpperCase();
    case "trim": return String(value).trim();
    case "parse_number": {
      const cleaned = String(value).replace(/[^\d,.-]/g, "").replace(",", ".");
      return isNaN(Number(cleaned)) ? value : cleaned;
    }
    case "parse_date": return new Date(value).toISOString().slice(0, 10);
    case "parse_boolean": {
      const s = String(value).toLowerCase().trim();
      return ["true", "1", "sim", "yes", "y", "s"].includes(s) ? "true" : "false";
    }
    default: return value;
  }
}

export interface MappingResult {
  standardFields: Record<string, any>;
  customFields: Array<{ custom_field_id: string; value: any }>;
  unmappedFields: Record<string, any>;
}

export async function applyFieldMappings(
  payload: Record<string, any>,
  mappings: Array<{
    external_field: string;
    target_type: string;
    target_key: string | null;
    custom_field_id: string | null;
    transformation: string | null;
    default_value: string | null;
    is_required: boolean;
  }>,
): Promise<MappingResult> {
  const standardFields: Record<string, any> = {};
  const customFields: Array<{ custom_field_id: string; value: any }> = [];
  const unmappedFields: Record<string, any> = {};
  const mappedExternalFields = new Set<string>();

  for (const m of mappings) {
    const raw = getNestedValue(payload, m.external_field);
    const value = raw !== undefined && raw !== null ? applyTransformation(raw, m.transformation) : (m.default_value ?? undefined);
    mappedExternalFields.add(m.external_field);

    if (m.target_type === "ignore") continue;

    if (value === undefined && m.is_required) {
      throw new Error(`Campo obrigatório '${m.external_field}' não foi recebido`);
    }
    if (value === undefined) continue;

    if (m.target_type === "standard" && m.target_key) {
      standardFields[m.target_key] = value;
    } else if (m.target_type === "custom" && m.custom_field_id) {
      customFields.push({ custom_field_id: m.custom_field_id, value });
    }
  }

  // Detect unmapped fields
  function collectKeys(obj: any, prefix = ""): void {
    if (typeof obj !== "object" || obj === null) return;
    for (const key of Object.keys(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (!mappedExternalFields.has(path)) {
        unmappedFields[path] = obj[key];
      }
      collectKeys(obj[key], path);
    }
  }
  collectKeys(payload);

  return { standardFields, customFields, unmappedFields };
}
```

- [ ] **Step 2: Update `upsertContactFromWebhook` — new dedup order + custom fields**

Update the function signature to accept `customFields` array and save them:

```typescript
export async function upsertContactFromWebhook(
  tenantId: string,
  payload: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    position?: string;
    notes?: string;
    status?: string;
    responsible_user_id?: string;
    external_id?: string;
    tags?: string;
    metadata?: Record<string, unknown>;
  },
  customFieldValues: Array<{ custom_field_id: string; value: any }>,
  webhook?: { id: string; name: string },
): Promise<{ id: string; created: boolean }> {
  const { normalizeToE164 } = await import("@/lib/phone");
  const phone = payload.phone ? normalizeToE164(payload.phone) : null;

  if (!phone && !payload.email && !payload.external_id) {
    throw new Error("É necessário fornecer telefone, email ou external_id");
  }

  return await db.transaction(async (conn) => {
    let contactId: string;
    let created = false;
    let found = false;

    // Dedup by external_id > phone > email
    if (payload.external_id) {
      const [rows] = await conn.execute(
        "SELECT id FROM contacts WHERE user_id = ? AND external_id = ? LIMIT 1",
        [tenantId, payload.external_id],
      );
      if (rows?.length > 0) { contactId = rows[0].id; found = true; }
    }

    if (!found && phone) {
      const [rows] = await conn.execute(
        "SELECT id FROM contacts WHERE user_id = ? AND phone_e164 = ? LIMIT 1",
        [tenantId, phone],
      );
      if (rows?.length > 0) { contactId = rows[0].id; found = true; }
    }

    if (!found && payload.email) {
      const [rows] = await conn.execute(
        "SELECT id FROM contacts WHERE user_id = ? AND email = ? LIMIT 1",
        [tenantId, payload.email],
      );
      if (rows?.length > 0) { contactId = rows[0].id; found = true; }
    }

    if (!found) {
      created = true;
      contactId = crypto.randomUUID();
      const columns = ["id", "user_id", "phone_e164", "name", "email", "source", "source_type", "source_name", "source_id", "external_id", "metadata", "last_interaction_at"];
      const values: any[] = [contactId, tenantId, phone, payload.name ?? null, payload.email ?? null, "webhook", "incoming_webhook", webhook?.name ?? null, webhook?.id ?? null, payload.external_id ?? null, JSON.stringify({ last_payload: payload }), new Date()];
      if (payload.company) { columns.push("company"); values.push(payload.company); }
      if (payload.position) { columns.push("position"); values.push(payload.position); }
      if (payload.notes) { columns.push("notes"); values.push(payload.notes); }
      if (payload.status) { columns.push("status"); values.push(payload.status); }
      if (payload.responsible_user_id) { columns.push("responsible_user_id"); values.push(payload.responsible_user_id); }
      await conn.execute(
        `INSERT INTO contacts (${columns.map(c => `\`${c}\``).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
        values,
      );
    } else {
      const updates: string[] = ["last_interaction_at = NOW()"];
      const updateVals: any[] = [];
      if (payload.name) { updates.push("name = ?"); updateVals.push(payload.name); }
      if (payload.email) { updates.push("email = ?"); updateVals.push(payload.email); }
      if (payload.company) { updates.push("company = ?"); updateVals.push(payload.company); }
      if (payload.position) { updates.push("position = ?"); updateVals.push(payload.position); }
      if (payload.notes) { updates.push("notes = ?"); updateVals.push(payload.notes); }
      if (payload.status) { updates.push("status = ?"); updateVals.push(payload.status); }
      if (payload.responsible_user_id) { updates.push("responsible_user_id = ?"); updateVals.push(payload.responsible_user_id); }
      if (payload.external_id) { updates.push("external_id = ?"); updateVals.push(payload.external_id); }
      if (Object.keys(payload).length > 0) {
        updates.push("metadata = JSON_SET(COALESCE(metadata, '{}'), '$.last_payload', CAST(? AS JSON))");
        updateVals.push(JSON.stringify(payload));
      }
      updateVals.push(contactId);
      await conn.execute(`UPDATE contacts SET ${updates.join(", ")} WHERE id = ?`, updateVals);
    }

    // Save custom field values
    for (const cf of customFieldValues) {
      const valueText = cf.value === null ? null : String(cf.value);
      const valueJson = Array.isArray(cf.value) || (cf.value !== null && typeof cf.value === "object")
        ? JSON.stringify(cf.value)
        : null;
      await conn.execute(
        `INSERT INTO contact_custom_field_values (user_id, contact_id, custom_field_id, value, value_json)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value), value_json = VALUES(value_json)`,
        [tenantId, contactId, cf.custom_field_id, valueText, valueJson],
      );
    }

    // Log activity
    try {
      await conn.execute(
        `INSERT INTO contact_activities (contact_id, user_id, type, title, description, source_type, source_id, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          contactId, tenantId,
          created ? "created" : "updated",
          created
            ? `Contato criado via Webhook${webhook ? `: ${webhook.name}` : ""}`
            : `Contato atualizado via Webhook${webhook ? `: ${webhook.name}` : ""}`,
          created ? null : `Campos atualizados: ${Object.keys(payload).join(", ")}`,
          "incoming_webhook",
          webhook?.id ?? null,
          JSON.stringify(payload),
        ],
      );
    } catch { /* non-critical */ }

    return { id: contactId, created };
  });
}
```

- [ ] **Step 3: Update the public webhook handler (`$token.ts`)**

Update the handler with idempotency, field mapping, full audit logging:

```typescript
POST: async ({ request, params }) => {
  const { token } = params;
  const headers = corsHeaders();
  const startTime = Date.now();

  try {
    const {
      findIncomingWebhookByToken, logIncomingWebhookEvent,
      incrementIncomingWebhookStats, upsertContactFromWebhook,
      applyFieldMappings,
    } = await import("@/lib/webhooks.server");
    const { default: db } = await import("@/lib/db");

    // 1. Find webhook by token
    const webhook = await findIncomingWebhookByToken(token);
    if (!webhook) {
      return new Response(JSON.stringify({ error: "Webhook não encontrado" }), { status: 404, headers });
    }
    if (webhook.status === "paused") {
      return new Response(JSON.stringify({ error: "Webhook está pausado" }), { status: 403, headers });
    }

    // 2. Parse body
    let body: any;
    try { body = await request.json(); }
    catch { return new Response(JSON.stringify({ error: "Payload JSON inválido" }), { status: 400, headers }); }

    // 3. Check idempotency
    const idempotencyKey = request.headers.get("X-Idempotency-Key") || undefined;
    if (idempotencyKey) {
      const [existing] = await db.query(
        "SELECT id, raw_payload, status FROM incoming_webhook_events WHERE webhook_id = ? AND idempotency_key = ? LIMIT 1",
        [webhook.id, idempotencyKey],
      );
      if (existing?.length > 0) {
        const cached = existing[0];
        if (cached.status === "processed") {
          return new Response(JSON.stringify({ ok: true, cached: true }), { status: 200, headers });
        }
      }
    }

    // 4. Get headers info for audit
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || null;
    const reqHeaders = Object.fromEntries(request.headers.entries());

    // 5. Load field mappings
    const mappings = await db.query(
      `SELECT wfm.external_field, wfm.target_type, wfm.target_key, wfm.custom_field_id, wfm.transformation, wfm.default_value, wfm.is_required
       FROM webhook_field_mappings wfm
       WHERE wfm.webhook_id = ? AND wfm.user_id = ?
       ORDER BY wfm.external_field`,
      [webhook.id, webhook.tenant_id],
    );

    // 6. Apply mappings
    const { standardFields, customFields, unmappedFields } = await applyFieldMappings(body, mappings);

    // 7. Validate minimum fields
    if (!standardFields.phone && !standardFields.email && !standardFields.external_id) {
      const errorMsg = "É necessário fornecer 'phone', 'email' ou 'external_id'";
      await logIncomingWebhookEvent(webhook.id, body, "error", errorMsg);
      await incrementIncomingWebhookStats(webhook.id, false);
      return new Response(JSON.stringify({ error: errorMsg }), { status: 400, headers });
    }

    // 8. Create or update contact
    try {
      const contact = await upsertContactFromWebhook(
        webhook.tenant_id,
        standardFields,
        customFields,
        { id: webhook.id, name: webhook.name },
      );

      const durationMs = Date.now() - startTime;

      // 9. Log event
      await db.query(
        `INSERT INTO incoming_webhook_events (user_id, webhook_id, contact_id, idempotency_key, status, action, raw_payload, mapped_standard_fields, mapped_custom_fields, unmapped_fields, headers, ip_address, user_agent, received_at, processed_at, processing_duration_ms)
         VALUES (?, ?, ?, ?, 'processed', ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)`,
        [
          webhook.tenant_id, webhook.id, contact.id,
          idempotencyKey || null,
          contact.created ? "created" : "updated",
          JSON.stringify(body),
          JSON.stringify(standardFields),
          JSON.stringify(customFields),
          JSON.stringify(unmappedFields),
          JSON.stringify(reqHeaders), ip, userAgent,
          durationMs,
        ],
      );

      await incrementIncomingWebhookStats(webhook.id, contact.created);

      return new Response(
        JSON.stringify({ ok: true, contact_id: contact.id, created: contact.created }),
        { status: 200, headers },
      );
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - startTime;
      await db.query(
        `INSERT INTO incoming_webhook_events (user_id, webhook_id, idempotency_key, status, action, raw_payload, mapped_standard_fields, mapped_custom_fields, unmapped_fields, headers, ip_address, user_agent, error_message, received_at, processed_at, processing_duration_ms)
         VALUES (?, ?, ?, 'failed', 'error', ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), ?)`,
        [webhook.tenant_id, webhook.id, idempotencyKey || null,
         JSON.stringify(body), JSON.stringify(standardFields),
         JSON.stringify(customFields), JSON.stringify(unmappedFields),
         JSON.stringify(reqHeaders), ip, userAgent, errMsg, durationMs],
      );
      return new Response(JSON.stringify({ error: errMsg }), { status: 400, headers });
    }
  } catch (err: unknown) {
    return new Response(JSON.stringify({ error: "Erro interno", detail: err instanceof Error ? err.message : String(err) }), { status: 500, headers });
  }
},
```

- [ ] **Step 4: Run type-check**

```bash
npm run type-check
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/webhooks.server.ts src/routes/api/public/webhooks/incoming/\$token.ts
git commit -m "feat: update webhook handler with field mapping, dedup, idempotency, audit"
```
