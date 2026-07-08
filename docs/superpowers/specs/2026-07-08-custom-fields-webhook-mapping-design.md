# Custom Fields & Webhook Mapping — Design Spec

## Objective

Evoluir o sistema de "rótulos soltos no webhook" para um sistema profissional de campos personalizados globais de contatos com mapeamento visual de dados recebidos via webhook.

## Architecture

### Key decisions

1. **EAV (Entity-Attribute-Value)** pattern com 3 tabelas novas: `contact_custom_fields`, `contact_custom_field_values`, `webhook_field_mappings`
2. `contact_custom_fields` é por `user_id` — cada tenant gerencia seus próprios campos
3. Colunas visíveis na lista de contatos salvas em `localStorage`
4. Webhook **apenas mapeia** dados para campos existentes — não cria dados soltos
5. Todo payload bruto é preservado em `incoming_webhook_events.payload` para auditoria

---

## 1. Database Schema

### 1.1 contact_custom_fields

```sql
CREATE TABLE contact_custom_fields (
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
);
```

**Key generation**: slug a partir do label (sem acentos, sem espaços, lowercase). Se conflito para mesmo `user_id`, sufixo incremental: `produto_de_interesse_2`.

### 1.2 contact_custom_field_values

```sql
CREATE TABLE contact_custom_field_values (
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
);
```

| Type | Storage |
|------|---------|
| text, textarea, number, currency, email, phone, url | `value TEXT` |
| boolean | `value TEXT` ("true" / "false") |
| date, datetime | `value TEXT` (ISO 8601) |
| select | `value TEXT` |
| multi_select | `value_json JSON` |

### 1.3 webhook_field_mappings

```sql
CREATE TABLE webhook_field_mappings (
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
);
```

**Allowed standard targets**: `name`, `phone`, `email`, `company`, `position`, `status`, `tags`, `notes`, `responsible_user_id`, `source_name`, `external_id`

**Transformations**: `null` (none), `normalize_phone`, `lowercase`, `uppercase`, `trim`, `parse_number`, `parse_date`, `parse_boolean`

**Dot notation**: `external_field` suporta paths aninhados como `cliente.nome`, `campanha.nome`

### 1.4 contacts — new columns for standard fields

The `contacts` table needs new columns to support the standard fields listed in webhook mapping and forms:

```sql
ALTER TABLE contacts
  ADD COLUMN company VARCHAR(255) NULL AFTER email,            -- Empresa
  ADD COLUMN position VARCHAR(255) NULL AFTER company,         -- Cargo
  ADD COLUMN notes TEXT NULL AFTER position,                   -- Observações
  ADD COLUMN status VARCHAR(50) NULL AFTER kanban_stage_id,    -- Status do lead
  ADD COLUMN responsible_user_id VARCHAR(36) NULL AFTER status, -- Responsável
  ADD INDEX idx_contacts_company (user_id, company),
  ADD INDEX idx_contacts_status (user_id, status),
  ADD FOREIGN KEY (responsible_user_id) REFERENCES users(id) ON DELETE SET NULL;
```

- `tags` é tratado via pivot `contact_tags` (já existente). No webhook, se mapeado, o sistema criará/associará tags automaticamente.
- `status` é um campo livre (ex: "novo", "qualificado", "perdido") — não substitui `kanban_stage_id` que é para funil de vendas.
- `responsible_user_id` → FK para `users`, dono/responsável pelo contato.

### 1.5 incoming_webhook_events (substituída)

```sql
CREATE TABLE IF NOT EXISTS incoming_webhook_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  webhook_id VARCHAR(36) NOT NULL,
  contact_id VARCHAR(36) NULL,
  idempotency_key VARCHAR(64) NULL,
  status ENUM('received','processing','processed','failed') NOT NULL DEFAULT 'received',
  action VARCHAR(50) NULL COMMENT 'created, updated, ignored, error',
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

### 1.6 contact_activities — adicionar `user_id`

```sql
ALTER TABLE contact_activities
  ADD COLUMN user_id VARCHAR(36) NULL AFTER contact_id,
  ADD INDEX idx_ca_user (user_id),
  ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
```

### 1.7 incoming_webhooks — limpeza de colunas obsoletas

```sql
ALTER TABLE incoming_webhooks
  DROP COLUMN field_labels,
  DROP COLUMN events_count,
  DROP COLUMN leads_count,
  ADD COLUMN last_contact_id VARCHAR(36) NULL AFTER last_event_at,
  ADD FOREIGN KEY (last_contact_id) REFERENCES contacts(id) ON DELETE SET NULL;
```

---

## 2. Settings UI — Custom Fields CRUD

- New route: `_app/settings/custom-fields`
- Table list with label, type, active badge, edit/delete actions
- Modal with: label, type (dropdown), placeholder, options (if select/multi_select), required, show_on_form, show_on_table, show_on_details, active
- Key auto-generated from label, shown readonly
- Server functions: `listCustomFields`, `createCustomField`, `updateCustomField`, `deleteCustomField`, `reorderCustomFields`

---

## 3. Contact Form — Dynamic Custom Fields

- Creation and edit sheets render dynamic fields from `contact_custom_fields WHERE show_on_form = true AND is_active = true`
- Each type maps to a different input component
- Required fields validated before save
- Values upserted in `contact_custom_field_values`
- Standard fields no formulário: Nome, Telefone, E-mail, Empresa, Cargo, Status, Origem, Responsável (dropdown de usuários), Tags (multi-select), Observações (textarea)
  - `company`, `position`, `notes`, `status`, `responsible_user_id` usam as novas colunas em contacts
  - `tags` usa a pivot `contact_tags`
- Added default fields to form: Empresa, Cargo, Observações

---

## 4. Contact List — Customizable Columns

- "Colunas" popover button in toolbar
- Checkboxes for: default columns + custom fields with `show_on_table = true`
- Preference saved in `localStorage` key `contacts_visible_columns`
- Custom field values loaded in batch: `SELECT * FROM contact_custom_field_values WHERE contact_id IN (...)`
- Columns render value or `—` if empty

---

## 5. Contact Detail — Custom Fields Section

- Sidebar section "Campos personalizados" below default info
- Only visible if fields exist with `show_on_details = true` AND have values
- Type-aware rendering: boolean → badge, currency → R$, url → link, phone → tel:, email → mailto:

---

## 6. Webhook — Field Mapping UI

- Refactored from Sheet to full-page layout (or enhanced Sheet)
- Bloco 1: Webhook info (name, status, URL, token, copy button)
- Bloco 2: Test payload (JSON textarea, "Detectar campos" and "Enviar teste" buttons)
- Bloco 3: Mapping table — external_field → example value → dropdown (standard + custom fields + ignore/create new)
- Bloco 4: Unmapped fields section
- Bloco 5: Recent events table from `incoming_webhook_events`
- Dropdown includes "+ Criar novo campo personalizado" option that opens same modal from Settings

---

## 7. Webhook Handler — Updated Flow

```
POST /api/public/webhooks/incoming/:token
  → validate token, webhook active
  → check idempotency_key header, return cached result if exists
  → parse JSON payload
  → detect payload fields (including nested via dot notation)
  → load field_mappings for this webhook WHERE user_id = webhook.tenant_id
  → validate each custom_field_id belongs to same user_id
  → for each mapped field:
      if ignore → skip
      if standard → apply transformation, prepare for contacts.* columns
      if custom → apply transformation, prepare for contact_custom_field_values
  → unmapped fields → separate list for logging
  → upsertContactFromWebhook (adapted):
      → dedup by external_id > phone (E164) > email, always with user_id
      → create/update contact with standard fields + source + metadata
      → batch upsert custom field values (INSERT ... ON DUPLICATE KEY UPDATE)
      → insert contact_activities with user_id
  → log to incoming_webhook_events with full audit data:
      raw_payload, mapped_standard_fields, mapped_custom_fields,
      unmapped_fields, headers, ip, processing_duration_ms, action
  → return { ok, contact_id, created }
```

---

## 8. Multi-tenant Security

- All `contact_custom_fields` queries filtered by `user_id`
- `contact_custom_field_values` has `user_id` — all queries filter by it
- `webhook_field_mappings` has `user_id` — all queries filter by it
- Before saving a mapping with `custom_field_id`, validate:
  ```sql
  SELECT 1 FROM contact_custom_fields
  WHERE id = ? AND user_id = (SELECT tenant_id FROM incoming_webhooks WHERE id = ?)
  ```
- `user_id` is NEVER accepted from payload — always derived from webhook token
- `incoming_webhook_events` stores `user_id` from webhook's tenant_id
- All webhook processing runs within the tenant context of the token

---

## 9. Frontend Config

- `localStorage` key: `crm_contacts_visible_columns_v1_{user_id}` — unique per user even on same browser

---

## 10. Files to Create / Modify

### New files
- `src/routes/_app/settings/custom-fields.tsx` — Settings page CRUD
- `src/lib/custom-fields.functions.ts` — Server functions for custom fields
- `src/components/contacts/custom-field-input.tsx` — Dynamic field input by type
- `src/components/contacts/column-selector.tsx` — Popover column selector

### Modified files
- `schema_mysql.sql` — New tables: `contact_custom_fields`, `contact_custom_field_values`, `webhook_field_mappings`; updated: `incoming_webhook_events` (full replace), `incoming_webhooks` (drop obsolete cols), `contacts` (+ company, position, notes, status, responsible_user_id), `contact_activities` (+ user_id)
- `scripts/ensure-schema.js` — Migration entries for all new tables and columns
- `src/routes/_app/settings.tsx` (or layout) — Add "Campos personalizados" nav entry
- `src/routes/_app/contacts.index.tsx` — Dynamic form fields + column selector + batch value loading
- `src/routes/_app/contacts.$id.tsx` — Custom fields section in sidebar + user_id filter
- `src/routes/_app/webhooks.tsx` — Field mapping UI + create custom field modal + events table
- `src/lib/webhooks.server.ts` — `upsertContactFromWebhook` adapted for field mapping, custom fields, new dedup order (external_id > phone > email), user_id propagation
- `src/routes/api/public/webhooks/incoming/$token.ts` — Handler updated for field mapping, idempotency, full audit logging
- `src/lib/contacts.functions.ts` — New batch functions for custom field values, user_id filters
