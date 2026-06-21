import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/integrations/mysql/auth-middleware";

export const listTags = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.db.from("tags").select("*").order("name");
    if (error) throw error;
    return data ?? [];
  });

export const createTag = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(40),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .default("#25D366"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.db
      .from("tags")
      .insert({ user_id: context.userId, name: data.name, color: data.color })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteTag = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.db.from("tags").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listLists = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.db
      .from("lists")
      .select("*, list_contacts(count)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createList = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        description: z.string().trim().max(280).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.db
      .from("lists")
      .insert({ user_id: context.userId, name: data.name, description: data.description })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

export const deleteList = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.db.from("lists").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const addContactsToList = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z
      .object({
        list_id: z.string().uuid(),
        contact_ids: z.array(z.string().uuid()).min(1).max(20000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const rows = data.contact_ids.map((cid) => ({
      list_id: data.list_id,
      contact_id: cid,
      user_id: context.userId,
    }));
    const { error } = await context.db
      .from("list_contacts")
      .upsert(rows, { onConflict: "list_id,contact_id" });
    if (error) throw error;
    return { added: rows.length };
  });

export const removeContactFromList = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) =>
    z.object({ list_id: z.string().uuid(), contact_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.db
      .from("list_contacts")
      .delete()
      .eq("list_id", data.list_id)
      .eq("contact_id", data.contact_id);
    if (error) throw error;
    return { ok: true };
  });

export const getListContacts = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((d) => z.object({ list_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.db
      .from("list_contacts")
      .select("contact_id, contacts(*)")
      .eq("list_id", data.list_id);
    if (error) throw error;
    return rows ?? [];
  });
