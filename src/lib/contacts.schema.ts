import { z } from "zod";

/**
 * Canonical channel values for CRM contacts.
 *
 * This is the single source of truth for the `contacts.channel` field
 * used by create/update validators and the CRM UI.
 */
export const CONTACT_CHANNELS = ["whatsapp", "instagram", "messenger", "webchat"] as const;

export const contactChannelSchema = z.enum(CONTACT_CHANNELS);

export type ContactChannel = z.infer<typeof contactChannelSchema>;

const emptyStringToNull = (val: string | null | undefined) => {
  if (val === undefined || val === null) return null;
  const trimmed = String(val).trim();
  return trimmed === "" ? null : trimmed;
};

const sharedContactFields = {
  name: z.string().trim().max(120).nullable().optional(),
  email: z.string().email().max(180).nullable().optional().or(z.literal("")),
  company: z.string().trim().max(255).nullable().optional(),
  position: z.string().trim().max(255).nullable().optional(),
  status: z.string().trim().max(50).nullable().optional(),
  responsible_user_id: z.string().uuid().nullable().optional().or(z.literal("")),
  channel: contactChannelSchema.optional().nullable(),
};

export const contactInput = z
  .object({
    phone: z.string().trim().max(32).nullable().optional(),
    ...sharedContactFields,
    custom_fields: z.record(z.string(), z.any()).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const channel = data.channel ?? "whatsapp";
    const phone = emptyStringToNull(data.phone);
    if (channel !== "webchat" && !phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Telefone é obrigatório para este canal.",
      });
    }
    if (phone && (phone.startsWith("ig_") || phone.startsWith("fb_"))) {
      // Instagram/Messenger handles are valid identifiers.
      return;
    }
    if (phone && !/^\d{8,32}$/.test(phone.replace(/\D/g, ""))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Telefone deve ter pelo menos 8 dígitos.",
      });
    }
  });

export const updateContactInput = z
  .object({
    id: z.string().uuid(),
    phone: z.string().trim().max(32).nullable().optional(),
    ...sharedContactFields,
    source: z.string().trim().max(255).nullable().optional(),
    source_type: z.string().trim().max(50).nullable().optional(),
    source_name: z.string().trim().max(255).nullable().optional(),
    source_id: z.string().uuid().nullable().optional().or(z.literal("")),
    external_id: z.string().trim().max(255).nullable().optional(),
    metadata: z.record(z.string(), z.any()).nullable().optional().nullable(),
    opted_out: z.boolean().optional(),
    external_contact_id: z.string().trim().max(255).nullable().optional(),
    custom_fields: z.record(z.string(), z.any()).nullable().optional().nullable(),
    is_pinned: z.boolean().optional(),
    is_archived: z.boolean().optional(),
    chat_status: z.string().max(50).optional(),
    is_unread: z.boolean().optional(),
    kanban_stage_id: z.string().uuid().nullable().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    const phone = emptyStringToNull(data.phone);
    if (!phone) return; // Empty phone is allowed: service preserves existing value.
    if (phone.startsWith("ig_") || phone.startsWith("fb_")) {
      return;
    }
    if (!/^\d{8,32}$/.test(phone.replace(/\D/g, ""))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phone"],
        message: "Telefone deve ter pelo menos 8 dígitos.",
      });
    }
  });
