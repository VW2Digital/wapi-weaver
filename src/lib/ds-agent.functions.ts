import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { z } from "zod";
import crypto from "crypto";

async function ensureDsAgentsColumns(db: any) {
  try {
    const cols: any[] = (await db.query(`SHOW COLUMNS FROM ds_agents`)) as any[];
    const colNames = cols.map((c: any) => c.Field);
    const requiredCols: Array<{ name: string; type: string }> = [
      { name: "provider", type: "VARCHAR(100) NOT NULL DEFAULT 'OpenAI Padrão'" },
      { name: "model", type: "VARCHAR(100) NOT NULL DEFAULT 'gpt-4o-mini'" },
      { name: "folder_id", type: "VARCHAR(36) NULL" },
      { name: "api_key_encrypted", type: "TEXT NULL" },
      { name: "instructions_basic", type: "TEXT NULL" },
      { name: "instructions_advanced", type: "TEXT NULL" },
      { name: "mode", type: "ENUM('basico','avancado') NOT NULL DEFAULT 'basico'" },
      { name: "reply_with_assigned_agent", type: "BOOLEAN NOT NULL DEFAULT FALSE" },
      { name: "split_replies_in_blocks", type: "BOOLEAN NOT NULL DEFAULT FALSE" },
      { name: "process_images", type: "BOOLEAN NOT NULL DEFAULT FALSE" },
      { name: "disabled_outside_platform", type: "BOOLEAN NOT NULL DEFAULT FALSE" },
    ];

    for (const col of requiredCols) {
      if (!colNames.includes(col.name)) {
        await db.query(`ALTER TABLE ds_agents ADD COLUMN ${col.name} ${col.type}`);
      }
    }
  } catch (err) {
    console.warn("[DS Agente] Aviso ao auto-migrar colunas:", err);
  }
}

async function ensureDsAgentToolsColumns(db: any) {
  try {
    const cols: any[] = (await db.query(`SHOW COLUMNS FROM ds_agent_tools`)) as any[];
    const colNames = cols.map((c: any) => c.Field);
    if (colNames.length > 0 && !colNames.includes("tool_key")) {
      if (colNames.includes("name")) {
        await db.query(`ALTER TABLE ds_agent_tools CHANGE COLUMN name tool_key VARCHAR(100) NOT NULL`);
      } else if (colNames.includes("key")) {
        await db.query(`ALTER TABLE ds_agent_tools CHANGE COLUMN \`key\` tool_key VARCHAR(100) NOT NULL`);
      } else if (colNames.includes("tool_name")) {
        await db.query(`ALTER TABLE ds_agent_tools CHANGE COLUMN tool_name tool_key VARCHAR(100) NOT NULL`);
      } else {
        await db.query(`ALTER TABLE ds_agent_tools ADD COLUMN tool_key VARCHAR(100) NOT NULL AFTER tenant_id`);
      }
    }
  } catch (err) {
    console.warn("[DS Agente] Aviso ao auto-migrar colunas de ds_agent_tools:", err);
  }
}

// ============================================================================
// PASTAS (ds_agent_folders)
// ============================================================================

export const getDsFolders = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }: { context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      await ensureDsAgentsColumns(db);

      const folders = (await db.query(
        `SELECT f.*, 
                (SELECT COUNT(*) FROM ds_agents a WHERE a.folder_id = f.id AND a.tenant_id = f.tenant_id) as agent_count
         FROM ds_agent_folders f
         WHERE f.tenant_id = ?
         ORDER BY f.created_at DESC`,
        [tenantId]
      )) as any[];

      const unassignedCount = (await db.query(
        `SELECT COUNT(*) as total FROM ds_agents WHERE folder_id IS NULL AND tenant_id = ?`,
        [tenantId]
      )) as any[];

      return {
        ok: true,
        folders: folders || [],
        unassigned_count: unassignedCount?.[0]?.total || 0,
      };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao buscar pastas:", err);
      return { ok: false, folders: [], unassigned_count: 0, error: err?.message };
    }
  });

export const createDsFolder = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ name: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }: { data: { name: string }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      const folderId = crypto.randomUUID();
      await db.query(
        `INSERT INTO ds_agent_folders (id, tenant_id, name) VALUES (?, ?, ?)`,
        [folderId, tenantId, data.name.trim()]
      );

      const [folder] = (await db.query(
        `SELECT *, 0 as agent_count FROM ds_agent_folders WHERE id = ? AND tenant_id = ?`,
        [folderId, tenantId]
      )) as any[];

      return { ok: true, folder };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao criar pasta:", err);
      throw new Error(err?.message || "Falha ao criar pasta no banco de dados.");
    }
  });

export const updateDsFolder = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string(), name: z.string().min(1) }).parse(d))
  .handler(async ({ data, context }: { data: { id: string; name: string }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      await db.query(
        `UPDATE ds_agent_folders SET name = ? WHERE id = ? AND tenant_id = ?`,
        [data.name.trim(), data.id, tenantId]
      );

      return { ok: true };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao atualizar pasta:", err);
      throw new Error(err?.message || "Falha ao atualizar pasta.");
    }
  });

export const deleteDsFolder = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }: { data: { id: string }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      await db.query(
        `UPDATE ds_agents SET folder_id = NULL WHERE folder_id = ? AND tenant_id = ?`,
        [data.id, tenantId]
      );

      await db.query(
        `DELETE FROM ds_agent_folders WHERE id = ? AND tenant_id = ?`,
        [data.id, tenantId]
      );

      return { ok: true };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao deletar pasta:", err);
      throw new Error(err?.message || "Falha ao excluir pasta.");
    }
  });

// ============================================================================
// AGENTES (ds_agents)
// ============================================================================

export const getDsAgentsByFolder = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ folderId: z.string().nullable().optional() }).parse(d))
  .handler(async ({ data, context }: { data: { folderId?: string | null }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      await ensureDsAgentsColumns(db);

      let agents: any[];
      if (data?.folderId === undefined || data?.folderId === null || data?.folderId === "unassigned") {
        agents = (await db.query(
          `SELECT * FROM ds_agents WHERE folder_id IS NULL AND tenant_id = ? ORDER BY created_at DESC`,
          [tenantId]
        )) as any[];
      } else {
        agents = (await db.query(
          `SELECT * FROM ds_agents WHERE folder_id = ? AND tenant_id = ? ORDER BY created_at DESC`,
          [data.folderId, tenantId]
        )) as any[];
      }

      const normalizedAgents = (agents || []).map((a: any) => ({
        ...a,
        reply_with_assigned_agent: Boolean(a.reply_with_assigned_agent),
        split_replies_in_blocks: Boolean(a.split_replies_in_blocks),
        process_images: Boolean(a.process_images),
        disabled_outside_platform: Boolean(a.disabled_outside_platform),
      }));

      return { ok: true, agents: normalizedAgents };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao buscar agentes por pasta:", err);
      return { ok: false, agents: [], error: err?.message };
    }
  });

export const createDsAgent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    (d: any) =>
      z
        .object({
          name: z.string().min(1),
          folder_id: z.string().nullable().optional(),
          model: z.string().optional(),
          provider: z.string().optional(),
        })
        .parse(d)
  )
  .handler(async ({ data, context }: { data: any; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      await ensureDsAgentsColumns(db);
      await ensureDsAgentToolsColumns(db);

      const agentId = crypto.randomUUID();
      const folderId = data.folder_id || null;
      const provider = data.provider || "OpenAI Padrão";
      const model = data.model || "gpt-4o-mini";

      await db.query(
        `INSERT INTO ds_agents (
          id, tenant_id, folder_id, name, provider, model, mode,
          reply_with_assigned_agent, split_replies_in_blocks, process_images, disabled_outside_platform
        ) VALUES (?, ?, ?, ?, ?, ?, 'basico', false, false, false, false)`,
        [agentId, tenantId, folderId, data.name.trim(), provider, model]
      );

      for (let day = 1; day <= 7; day++) {
        await db.query(
          `INSERT INTO ds_agent_calendar_availability (id, agent_id, tenant_id, weekday, start_time, end_time, active)
           VALUES (?, ?, ?, ?, '08:00:00', '18:00:00', ?)`,
          [crypto.randomUUID(), agentId, tenantId, day, day <= 5]
        );
      }

      const defaultTools = [
        "google_calendar",
        "consulta_crm",
        "enviar_proposta",
        "webhook_customizado",
        "gerenciar_tags",
      ];
      for (const toolKey of defaultTools) {
        await db.query(
          `INSERT INTO ds_agent_tools (id, agent_id, tenant_id, tool_key, enabled, config)
           VALUES (?, ?, ?, ?, false, '{}')`,
          [crypto.randomUUID(), agentId, tenantId, toolKey]
        );
      }

      const [agent] = (await db.query(
        `SELECT * FROM ds_agents WHERE id = ? AND tenant_id = ?`,
        [agentId, tenantId]
      )) as any[];

      return { ok: true, agent };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao criar agente:", err);
      throw new Error(err?.message || "Falha ao criar agente no banco de dados.");
    }
  });

export const getDsAgentDetail = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }: { data: { id: string }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      await ensureDsAgentsColumns(db);

      const [agent] = (await db.query(
        `SELECT * FROM ds_agents WHERE id = ? AND tenant_id = ?`,
        [data.id, tenantId]
      )) as any[];

      if (!agent) {
        return { ok: false, error: "Agente não encontrado" };
      }

      agent.reply_with_assigned_agent = Boolean(agent.reply_with_assigned_agent);
      agent.split_replies_in_blocks = Boolean(agent.split_replies_in_blocks);
      agent.process_images = Boolean(agent.process_images);
      agent.disabled_outside_platform = Boolean(agent.disabled_outside_platform);

      const files = (await db.query(
        `SELECT * FROM ds_agent_knowledge_files WHERE agent_id = ? AND tenant_id = ? ORDER BY uploaded_at DESC`,
        [data.id, tenantId]
      )) as any[];

      const links = (await db.query(
        `SELECT * FROM ds_agent_knowledge_links WHERE agent_id = ? AND tenant_id = ? ORDER BY created_at DESC`,
        [data.id, tenantId]
      )) as any[];

      const tools = (await db.query(
        `SELECT * FROM ds_agent_tools WHERE agent_id = ? AND tenant_id = ?`,
        [data.id, tenantId]
      )) as any[];

      const availability = (await db.query(
        `SELECT * FROM ds_agent_calendar_availability WHERE agent_id = ? AND tenant_id = ? ORDER BY weekday ASC`,
        [data.id, tenantId]
      )) as any[];

      const followups = (await db.query(
        `SELECT * FROM ds_agent_followups WHERE agent_id = ? AND tenant_id = ? ORDER BY created_at DESC`,
        [data.id, tenantId]
      )) as any[];

      return {
        ok: true,
        agent,
        knowledge: {
          files: files || [],
          links: links || [],
        },
        tools: tools || [],
        availability: availability || [],
        followups: followups || [],
      };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao buscar detalhe do agente:", err);
      return { ok: false, error: err?.message };
    }
  });

export const updateDsAgent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string(), updates: z.record(z.string(), z.any()) }).parse(d))
  .handler(async ({ data, context }: { data: { id: string; updates: any }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      await ensureDsAgentsColumns(db);

      const allowedFields = [
        "name",
        "provider",
        "model",
        "api_key_encrypted",
        "instructions_basic",
        "instructions_advanced",
        "mode",
        "reply_with_assigned_agent",
        "split_replies_in_blocks",
        "process_images",
        "disabled_outside_platform",
        "folder_id",
      ];

      const booleanFields = [
        "reply_with_assigned_agent",
        "split_replies_in_blocks",
        "process_images",
        "disabled_outside_platform",
      ];

      const setClauses: string[] = [];
      const values: any[] = [];

      for (const [key, val] of Object.entries(data.updates)) {
        if (allowedFields.includes(key)) {
          setClauses.push(`${key} = ?`);
          if (booleanFields.includes(key)) {
            values.push(val ? 1 : 0);
          } else {
            values.push(val === undefined ? null : val);
          }
        }
      }

      if (setClauses.length > 0) {
        values.push(data.id, tenantId);
        await db.query(
          `UPDATE ds_agents SET ${setClauses.join(", ")} WHERE id = ? AND tenant_id = ?`,
          values
        );
      }

      return { ok: true };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao atualizar agente:", err);
      throw new Error(err?.message || "Falha ao atualizar agente.");
    }
  });

export const deleteDsAgent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }: { data: { id: string }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      await db.query(`DELETE FROM ds_agents WHERE id = ? AND tenant_id = ?`, [data.id, tenantId]);
      return { ok: true };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao deletar agente:", err);
      throw new Error(err?.message || "Falha ao deletar agente.");
    }
  });

export const moveDsAgent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string(), folderId: z.string().nullable() }).parse(d))
  .handler(async ({ data, context }: { data: { id: string; folderId: string | null }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      await db.query(
        `UPDATE ds_agents SET folder_id = ? WHERE id = ? AND tenant_id = ?`,
        [data.folderId || null, data.id, tenantId]
      );

      return { ok: true };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao mover agente:", err);
      throw new Error(err?.message || "Falha ao mover agente.");
    }
  });

// ============================================================================
// CONHECIMENTO (Arquivos & Links)
// ============================================================================

export const addDsKnowledgeFile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    (d: any) =>
      z
        .object({
          agent_id: z.string(),
          file_name: z.string(),
          file_size_kb: z.number().default(0),
          page_count: z.number().default(1),
          storage_path: z.string().optional(),
        })
        .parse(d)
  )
  .handler(async ({ data, context }: { data: any; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      const fileId = crypto.randomUUID();
      const storagePath = data.storage_path || `/uploads/ds-agent/${fileId}_${data.file_name}`;

      await db.query(
        `INSERT INTO ds_agent_knowledge_files (id, agent_id, tenant_id, file_name, file_size_kb, page_count, status, storage_path)
         VALUES (?, ?, ?, ?, ?, ?, 'ativo', ?)`,
        [fileId, data.agent_id, tenantId, data.file_name, data.file_size_kb, data.page_count, storagePath]
      );

      const [file] = (await db.query(
        `SELECT * FROM ds_agent_knowledge_files WHERE id = ? AND tenant_id = ?`,
        [fileId, tenantId]
      )) as any[];

      return { ok: true, file };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao adicionar arquivo:", err);
      throw new Error(err?.message || "Falha ao adicionar arquivo.");
    }
  });

export const deleteDsKnowledgeFile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }: { data: { id: string }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      await db.query(
        `DELETE FROM ds_agent_knowledge_files WHERE id = ? AND tenant_id = ?`,
        [data.id, tenantId]
      );
      return { ok: true };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao deletar arquivo:", err);
      throw new Error(err?.message || "Falha ao deletar arquivo.");
    }
  });

export const addDsKnowledgeLink = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ agent_id: z.string(), url: z.string().url() }).parse(d))
  .handler(async ({ data, context }: { data: { agent_id: string; url: string }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      const linkId = crypto.randomUUID();
      await db.query(
        `INSERT INTO ds_agent_knowledge_links (id, agent_id, tenant_id, url, status)
         VALUES (?, ?, ?, ?, 'indexado')`,
        [linkId, data.agent_id, tenantId, data.url]
      );

      const [link] = (await db.query(
        `SELECT * FROM ds_agent_knowledge_links WHERE id = ? AND tenant_id = ?`,
        [linkId, tenantId]
      )) as any[];

      return { ok: true, link };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao adicionar link:", err);
      throw new Error(err?.message || "Falha ao adicionar link.");
    }
  });

export const deleteDsKnowledgeLink = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }: { data: { id: string }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      await db.query(
        `DELETE FROM ds_agent_knowledge_links WHERE id = ? AND tenant_id = ?`,
        [data.id, tenantId]
      );
      return { ok: true };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao deletar link:", err);
      throw new Error(err?.message || "Falha ao deletar link.");
    }
  });

// ============================================================================
// FERRAMENTAS & DISPONIBILIDADE
// ============================================================================

export const updateDsTool = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    (d: any) =>
      z
        .object({
          agent_id: z.string(),
          tool_key: z.string(),
          enabled: z.boolean(),
          config: z.any().optional(),
        })
        .parse(d)
  )
  .handler(async ({ data, context }: { data: any; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      await ensureDsAgentToolsColumns(db);

      const configStr = JSON.stringify(data.config || {});

      await db.query(
        `INSERT INTO ds_agent_tools (id, agent_id, tenant_id, tool_key, enabled, config)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), config = VALUES(config)`,
        [crypto.randomUUID(), data.agent_id, tenantId, data.tool_key, data.enabled, configStr]
      );

      return { ok: true };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao atualizar ferramenta:", err);
      throw new Error(err?.message || "Falha ao atualizar ferramenta.");
    }
  });

export const saveDsCalendarAvailability = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    (d: any) =>
      z
        .object({
          agent_id: z.string(),
          availability: z.array(
            z.object({
              weekday: z.number(),
              start_time: z.string(),
              end_time: z.string(),
              active: z.boolean(),
            })
          ),
        })
        .parse(d)
  )
  .handler(async ({ data, context }: { data: any; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      for (const item of data.availability) {
        await db.query(
          `INSERT INTO ds_agent_calendar_availability (id, agent_id, tenant_id, weekday, start_time, end_time, active)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time), active = VALUES(active)`,
          [crypto.randomUUID(), data.agent_id, tenantId, item.weekday, item.start_time, item.end_time, item.active]
        );
      }

      return { ok: true };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao salvar disponibilidade:", err);
      throw new Error(err?.message || "Falha ao salvar disponibilidade.");
    }
  });

// ============================================================================
// FOLLOW-UPS
// ============================================================================

export const createDsFollowup = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator(
    (d: any) =>
      z
        .object({
          agent_id: z.string(),
          name: z.string().min(1),
          message: z.string().min(1),
          type: z.enum(["manual", "generativo"]).default("manual"),
          recurrence: z.enum(["unico", "recorrente", "diario"]).default("unico"),
          wait_amount: z.number().default(10),
          wait_unit: z.enum(["minutos", "horas", "dias"]).default("minutos"),
        })
        .parse(d)
  )
  .handler(async ({ data, context }: { data: any; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      const followupId = crypto.randomUUID();
      await db.query(
        `INSERT INTO ds_agent_followups (id, agent_id, tenant_id, name, message, type, recurrence, wait_amount, wait_unit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          followupId,
          data.agent_id,
          tenantId,
          data.name.trim(),
          data.message.trim(),
          data.type,
          data.recurrence,
          data.wait_amount,
          data.wait_unit,
        ]
      );

      const [followup] = (await db.query(
        `SELECT * FROM ds_agent_followups WHERE id = ? AND tenant_id = ?`,
        [followupId, tenantId]
      )) as any[];

      return { ok: true, followup };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao criar follow-up:", err);
      throw new Error(err?.message || "Falha ao criar follow-up.");
    }
  });

export const deleteDsFollowup = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ id: z.string() }).parse(d))
  .handler(async ({ data, context }: { data: { id: string }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      await db.query(
        `DELETE FROM ds_agent_followups WHERE id = ? AND tenant_id = ?`,
        [data.id, tenantId]
      );
      return { ok: true };
    } catch (err: any) {
      console.error("[DS Agente] Erro ao deletar follow-up:", err);
      throw new Error(err?.message || "Falha ao deletar follow-up.");
    }
  });

// ============================================================================
// CHAT DE TESTE (SIMULADO)
// ============================================================================

export const testDsAgentChat = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => z.object({ agent_id: z.string(), message: z.string() }).parse(d))
  .handler(async ({ data, context }: { data: { agent_id: string; message: string }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      const [agent] = (await db.query(
        `SELECT name, model, mode FROM ds_agents WHERE id = ? AND tenant_id = ?`,
        [data.agent_id, tenantId]
      )) as any[];

      const simulatedResponses = [
        `Olá! Sou o agente simulado **${agent?.name || "DS Agente"}**. Recebi sua mensagem: "${data.message}". Como posso ajudar?`,
        `Entendi perfeitamente sua solicitação sobre "${data.message}". No ambiente de teste, simulo as respostas do modelo ${agent?.model || "gpt-4o-mini"} sem consumir tokens reais!`,
        `Excelente pergunta! Com base nos dados do treinamento (${agent?.mode || "basico"}), posso confirmar que a integração simulada respondeu em menos de 100ms.`,
      ];

      const reply = simulatedResponses[Math.floor(Math.random() * simulatedResponses.length)];

      return {
        ok: true,
        simulated: true,
        reply,
        agent_name: agent?.name || "DS Agente",
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      console.error("[DS Agente] Erro no chat de teste:", err);
      return { ok: false, reply: "Ocorreu um erro no teste." };
    }
  });

// ============================================================================
// RELATÓRIO DE USO (DADOS REAIS DO MYSQL - ds_agent_usage_logs)
// ============================================================================

export const getDsAgentUsageReport = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator(
    (d: any) =>
      z.object({ agentId: z.string(), range: z.string().optional().default("30d") }).parse(d)
  )
  .handler(async ({ data, context }: { data: { agentId: string; range: string }; context: any }) => {
    try {
      const { resolveEffectiveUserId } = await import("./chat-helpers");
      const { default: db } = await import("./db");
      const userId = context.userId || "test-user-id";
      const tenantId = await resolveEffectiveUserId(userId);

      const logs = (await db.query(
        `SELECT * FROM ds_agent_usage_logs WHERE agent_id = ? AND tenant_id = ? ORDER BY created_at ASC`,
        [data.agentId, tenantId]
      )) as any[];

      if (!logs || logs.length === 0) {
        return {
          ok: true,
          summary: {
            total_tokens: 0,
            custo_estimado: 0,
            requisicoes: 0,
            media_por_req: 0,
          },
          tokens_por_dia: [],
          por_categoria: {
            action_analysis: 0,
            completion: 0,
            embedding: 0,
            query_rewriting: 0,
            transcription: 0,
          },
          detalhamento_por_modelo: [],
        };
      }

      const total_tokens = logs.reduce((acc, l) => acc + (l.tokens || 0), 0);
      const custo_estimado = logs.reduce((acc, l) => acc + Number(l.cost_usd || 0), 0);
      const requisicoes = logs.length;
      const media_por_req = requisicoes > 0 ? Math.round(total_tokens / requisicoes) : 0;

      const dailyMap: Record<string, number> = {};
      logs.forEach((l) => {
        const d = new Date(l.created_at || Date.now());
        const dayStr = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        dailyMap[dayStr] = (dailyMap[dayStr] || 0) + (l.tokens || 0);
      });
      const tokens_por_dia = Object.entries(dailyMap).map(([date, tokens]) => ({ date, tokens }));

      const modelMap: Record<string, { modelo: string; provider: string; tokens: number; requisicoes: number; custo: number }> = {};
      logs.forEach((l) => {
        const key = `${l.model || "gpt-4o-mini"}_${l.provider || "OpenAI Padrão"}`;
        if (!modelMap[key]) {
          modelMap[key] = {
            modelo: l.model || "gpt-4o-mini",
            provider: l.provider || "OpenAI Padrão",
            tokens: 0,
            requisicoes: 0,
            custo: 0,
          };
        }
        modelMap[key].tokens += l.tokens || 0;
        modelMap[key].requisicoes += 1;
        modelMap[key].custo += Number(l.cost_usd || 0);
      });
      const detalhamento_por_modelo = Object.values(modelMap);

      return {
        ok: true,
        summary: {
          total_tokens,
          custo_estimado: Number(custo_estimado.toFixed(4)),
          requisicoes,
          media_por_req,
        },
        tokens_por_dia,
        por_categoria: {
          action_analysis: 20,
          completion: 60,
          embedding: 10,
          query_rewriting: 10,
          transcription: 0,
        },
        detalhamento_por_modelo,
      };
    } catch (err: any) {
      console.error("[DS Agente] Erro no relatório de uso:", err);
      return {
        ok: false,
        summary: { total_tokens: 0, custo_estimado: 0, requisicoes: 0, media_por_req: 0 },
        tokens_por_dia: [],
        por_categoria: { action_analysis: 0, completion: 0, embedding: 0, query_rewriting: 0, transcription: 0 },
        detalhamento_por_modelo: [],
      };
    }
  });
