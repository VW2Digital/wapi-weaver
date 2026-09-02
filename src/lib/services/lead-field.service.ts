"use server";

import db from "../db.js";
import { normalizeToE164 } from "../phone.js";
import {
  CustomFieldDefinition,
  getContactFieldValues,
  getFieldDefinitions,
  setContactFieldValues,
} from "./contact-custom-field.service.js";

export type StandardLeadField =
  | "name"
  | "email"
  | "phone"
  | "company"
  | "position"
  | "notes"
  | "responsible_user_id";

export const STANDARD_LEAD_FIELDS: StandardLeadField[] = [
  "name",
  "email",
  "phone",
  "company",
  "position",
  "notes",
  "responsible_user_id",
];

const STANDARD_LEAD_FIELD_DEFS: Record<
  StandardLeadField,
  { label: string; type: string; column: string }
> = {
  name: { label: "Nome", type: "text", column: "name" },
  email: { label: "E-mail", type: "email", column: "email" },
  phone: { label: "Telefone", type: "phone", column: "phone_e164" },
  company: { label: "Empresa", type: "text", column: "company" },
  position: { label: "Cargo", type: "text", column: "position" },
  notes: { label: "Observações", type: "textarea", column: "notes" },
  responsible_user_id: { label: "Responsável", type: "user", column: "responsible_user_id" },
};

export interface LeadFieldReference {
  kind: "standard" | "custom";
  field: string;
}

export interface LeadFieldDefinition {
  kind: "standard" | "custom";
  id: string;
  key: string;
  label: string;
  type: string;
  options?: string[];
  required?: boolean;
}

export class LeadFieldError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "LeadFieldError";
  }
}

function isStandardLeadField(value: string): value is StandardLeadField {
  return (STANDARD_LEAD_FIELDS as string[]).includes(value);
}

function sanitizeEmail(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const s = String(value).trim();
  if (!s) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(s)) throw new LeadFieldError("LEAD_FIELD_INVALID_VALUE", "E-mail inválido");
  return s;
}

function normalizePhoneValue(value: unknown): { e164: string | null; display: string | null } {
  if (value === null || value === undefined || value === "") return { e164: null, display: null };
  const s = String(value).trim();
  if (!s) return { e164: null, display: null };
  if (s.startsWith("ig_") || s.startsWith("fb_") || s.startsWith("wc_")) {
    return { e164: s, display: null };
  }
  const digits = normalizeToE164(s);
  if (!digits) throw new LeadFieldError("LEAD_FIELD_INVALID_VALUE", "Telefone inválido");
  return { e164: digits, display: digits };
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function parseOptions(def: CustomFieldDefinition): string[] | undefined {
  if (!def.options) return undefined;
  if (Array.isArray(def.options)) return def.options.map(String);
  try {
    const parsed = JSON.parse(String(def.options));
    return Array.isArray(parsed) ? parsed.map(String) : undefined;
  } catch {
    return undefined;
  }
}

export async function listLeadFields(tenantId: string): Promise<LeadFieldDefinition[]> {
  const standard: LeadFieldDefinition[] = STANDARD_LEAD_FIELDS.map((key) => ({
    kind: "standard" as const,
    id: key,
    key,
    label: STANDARD_LEAD_FIELD_DEFS[key].label,
    type: STANDARD_LEAD_FIELD_DEFS[key].type,
  }));

  const customDefs = await getFieldDefinitions(tenantId);
  const custom: LeadFieldDefinition[] = customDefs
    .filter((d) => d.is_active)
    .map((d) => ({
      kind: "custom" as const,
      id: d.id,
      key: d.key,
      label: d.label,
      type: d.type,
      options: parseOptions(d) ?? undefined,
      required: Boolean(d.required),
    }));

  return [...standard, ...custom];
}

async function getCustomFieldDefinition(
  tenantId: string,
  ref: LeadFieldReference,
): Promise<CustomFieldDefinition | null> {
  const defs = await getFieldDefinitions(tenantId);
  if (ref.kind !== "custom") return null;
  const idOrKey = ref.field.trim();
  return (
    defs.find((d) => (isValidUuid(idOrKey) && d.id === idOrKey) || d.key === idOrKey) || null
  );
}

export async function getLeadFieldDefinition(
  tenantId: string,
  ref: LeadFieldReference,
): Promise<LeadFieldDefinition | null> {
  if (ref.kind === "standard") {
    if (!isStandardLeadField(ref.field)) return null;
    const def = STANDARD_LEAD_FIELD_DEFS[ref.field];
    return {
      kind: "standard",
      id: ref.field,
      key: ref.field,
      label: def.label,
      type: def.type,
    };
  }
  const custom = await getCustomFieldDefinition(tenantId, ref);
  if (!custom || !custom.is_active) return null;
  return {
    kind: "custom",
    id: custom.id,
    key: custom.key,
    label: custom.label,
    type: custom.type,
    options: parseOptions(custom) ?? undefined,
    required: Boolean(custom.required),
  };
}

export async function getLeadFieldValue(
  tenantId: string,
  contactId: string,
  ref: LeadFieldReference,
): Promise<unknown> {
  if (ref.kind === "standard") {
    if (!isStandardLeadField(ref.field)) {
      throw new LeadFieldError("LEAD_FIELD_NOT_FOUND", `Campo padrão inválido: ${ref.field}`);
    }
    const column = STANDARD_LEAD_FIELD_DEFS[ref.field].column;
    const rows = (await db.query(
      `SELECT ${column} as v FROM contacts WHERE id = ? AND (user_id = ? OR tenant_id = ?) LIMIT 1`,
      [contactId, tenantId, tenantId],
    )) as Array<{ v: unknown }>;
    return rows?.[0]?.v ?? null;
  }

  const custom = await getCustomFieldDefinition(tenantId, ref);
  if (!custom) {
    throw new LeadFieldError("LEAD_FIELD_NOT_FOUND", "Definição de campo personalizado não encontrada");
  }
  if (!custom.is_active) {
    throw new LeadFieldError("LEAD_FIELD_UNAVAILABLE", "Campo personalizado inativo");
  }

  const values = await getContactFieldValues(tenantId, contactId);
  const value = values[custom.key];
  return value ?? null;
}

export async function setLeadFieldValue(
  tenantId: string,
  contactId: string,
  ref: LeadFieldReference,
  value: unknown,
): Promise<Record<string, unknown>> {
  if (ref.kind === "standard") {
    if (!isStandardLeadField(ref.field)) {
      throw new LeadFieldError("LEAD_FIELD_NOT_FOUND", `Campo padrão inválido: ${ref.field}`);
    }
    return setStandardLeadFieldValue(tenantId, contactId, ref.field, value);
  }

  const custom = await getCustomFieldDefinition(tenantId, ref);
  if (!custom) {
    throw new LeadFieldError("LEAD_FIELD_NOT_FOUND", "Definição de campo personalizado não encontrada");
  }
  if (!custom.is_active) {
    throw new LeadFieldError("LEAD_FIELD_UNAVAILABLE", "Campo personalizado inativo");
  }
  if (custom.user_id !== tenantId && custom.tenant_id !== tenantId) {
    throw new LeadFieldError("LEAD_FIELD_FORBIDDEN", "Campo não pertence ao tenant");
  }

  const merged = await setContactFieldValues(tenantId, contactId, [
    { custom_field_id: custom.id, value },
  ]);
  return merged;
}

async function setStandardLeadFieldValue(
  tenantId: string,
  contactId: string,
  field: StandardLeadField,
  value: unknown,
): Promise<Record<string, unknown>> {
  const existingRows = (await db.query(
    "SELECT channel, phone_e164, whatsapp_number FROM contacts WHERE id = ? AND (user_id = ? OR tenant_id = ?) LIMIT 1 FOR UPDATE",
    [contactId, tenantId, tenantId],
  )) as Array<{ channel?: string | null; phone_e164?: string | null; whatsapp_number?: string | null }>;
  const existing = existingRows?.[0];
  if (!existing) throw new LeadFieldError("LEAD_FIELD_NOT_FOUND", "Contato não encontrado");

  switch (field) {
    case "name":
    case "company":
    case "position":
    case "notes": {
      const sanitized = value === null || value === undefined ? null : String(value).trim() || null;
      const column = STANDARD_LEAD_FIELD_DEFS[field].column;
      await db.query(
        `UPDATE contacts SET ${column} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (user_id = ? OR tenant_id = ?)`,
        [sanitized, contactId, tenantId, tenantId],
      );
      return { [field]: sanitized };
    }
    case "email": {
      const sanitized = sanitizeEmail(value);
      await db.query(
        "UPDATE contacts SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (user_id = ? OR tenant_id = ?)",
        [sanitized, contactId, tenantId, tenantId],
      );
      return { email: sanitized };
    }
    case "phone": {
      const { e164, display } = normalizePhoneValue(value);
      const channel = existing.channel ?? "whatsapp";
      // Para webchat, preservamos phone_e164 existente (normalmente null) e
      // atualizamos whatsapp_number com o telefone informado, mantendo provider.
      if (channel === "webchat") {
        await db.query(
          `UPDATE contacts
           SET whatsapp_number = ?,
               normalized_phone = ?,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ? AND (user_id = ? OR tenant_id = ?)`,
          [display ?? e164, e164 ? e164.replace(/\D/g, "") : null, contactId, tenantId, tenantId],
        );
        return { phone: display ?? e164, phone_e164: existing.phone_e164 ?? null, whatsapp_number: display ?? e164 };
      }
      await db.query(
        `UPDATE contacts
         SET phone_e164 = ?,
             whatsapp_number = ?,
             normalized_phone = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND (user_id = ? OR tenant_id = ?)`,
        [e164, display, e164 ? e164.replace(/\D/g, "") : null, contactId, tenantId, tenantId],
      );
      return { phone: e164, phone_e164: e164, whatsapp_number: display };
    }
    case "responsible_user_id": {
      const raw = value === null || value === undefined || value === "" ? null : String(value).trim();
      if (raw) {
        const [user] = (await db.query(
          "SELECT id FROM users WHERE id = ? AND (id = ? OR tenant_id = ?) LIMIT 1",
          [raw, tenantId, tenantId],
        )) as Array<{ id: string }>;
        if (!user) {
          throw new LeadFieldError("LEAD_FIELD_INVALID_VALUE", "Responsável inválido");
        }
      }
      await db.query(
        "UPDATE contacts SET responsible_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (user_id = ? OR tenant_id = ?)",
        [raw, contactId, tenantId, tenantId],
      );
      return { responsible_user_id: raw };
    }
    default:
      throw new LeadFieldError("LEAD_FIELD_NOT_FOUND", `Campo padrão não suportado: ${field}`);
  }
}

export function getOperatorsForFieldType(type: string): string[] {
  switch (type) {
    case "text":
    case "textarea":
    case "email":
    case "phone":
    case "url":
      return ["equals", "not_equals", "contains", "not_contains", "starts_with", "ends_with", "is_empty", "is_not_empty"];
    case "number":
    case "currency":
      return ["equals", "not_equals", "greater_than", "greater_or_equal", "less_than", "less_or_equal", "is_empty", "is_not_empty"];
    case "select":
      return ["equals", "not_equals", "is_empty", "is_not_empty"];
    case "multi_select":
      return ["contains", "not_contains", "is_empty", "is_not_empty"];
    case "boolean":
      return ["is_true", "is_false"];
    case "date":
    case "datetime":
      return ["equals", "not_equals", "before", "after", "is_empty", "is_not_empty"];
    default:
      return ["equals", "not_equals", "is_empty", "is_not_empty"];
  }
}

export function isOperatorValidForType(type: string, operator: string): boolean {
  return getOperatorsForFieldType(type).includes(operator);
}
