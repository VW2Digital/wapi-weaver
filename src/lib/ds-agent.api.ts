import { Hono } from "hono";
import db from "./db.js";
import crypto from "crypto";

type DSAgentEnv = { Variables: { tenantId: string } };
const dsAgentApi = new Hono<DSAgentEnv>();

// Middleware simulado ou extração de tenant_id dos headers/auth
dsAgentApi.use("*", async (c, next) => {
  const tenantId = c.req.header("x-tenant-id") || "default-tenant";
  c.set("tenantId", tenantId);
  await next();
});

// Pastas
dsAgentApi.get("/folders", async (c) => {
  const tenantId = c.get("tenantId");
  const folders = await db.query(
    `SELECT f.*, (SELECT COUNT(*) FROM ds_agents a WHERE a.folder_id = f.id AND a.tenant_id = f.tenant_id) as agent_count
     FROM ds_agent_folders f WHERE f.tenant_id = ? ORDER BY f.created_at DESC`,
    [tenantId]
  );
  return c.json({ ok: true, folders });
});

dsAgentApi.post("/folders", async (c) => {
  const tenantId = c.get("tenantId");
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await db.query(`INSERT INTO ds_agent_folders (id, tenant_id, name) VALUES (?, ?, ?)`, [
    id,
    tenantId,
    body.name,
  ]);
  const [folder] = await db.query(`SELECT * FROM ds_agent_folders WHERE id = ?`, [id]);
  return c.json({ ok: true, folder }, 201);
});

dsAgentApi.patch("/folders/:id", async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const body = await c.req.json();
  await db.query(`UPDATE ds_agent_folders SET name = ? WHERE id = ? AND tenant_id = ?`, [
    body.name,
    id,
    tenantId,
  ]);
  return c.json({ ok: true });
});

dsAgentApi.delete("/folders/:id", async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  await db.query(`UPDATE ds_agents SET folder_id = NULL WHERE folder_id = ? AND tenant_id = ?`, [
    id,
    tenantId,
  ]);
  await db.query(`DELETE FROM ds_agent_folders WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  return c.json({ ok: true });
});

// Agentes
dsAgentApi.get("/folders/:folderId/agents", async (c) => {
  const tenantId = c.get("tenantId");
  const folderId = c.req.param("folderId");
  const agents = await db.query(
    `SELECT * FROM ds_agents WHERE ${folderId === "unassigned" ? "folder_id IS NULL" : "folder_id = ?"} AND tenant_id = ?`,
    folderId === "unassigned" ? [tenantId] : [folderId, tenantId]
  );
  return c.json({ ok: true, agents });
});

dsAgentApi.post("/", async (c) => {
  const tenantId = c.get("tenantId");
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO ds_agents (id, tenant_id, folder_id, name, provider, model) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, tenantId, body.folder_id || null, body.name, body.provider || "OpenAI Padrão", body.model || "gpt-4o-mini"]
  );
  const [agent] = await db.query(`SELECT * FROM ds_agents WHERE id = ?`, [id]);
  return c.json({ ok: true, agent }, 201);
});

dsAgentApi.get("/:id", async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const [agent] = await db.query(`SELECT * FROM ds_agents WHERE id = ? AND tenant_id = ?`, [
    id,
    tenantId,
  ]);
  if (!agent) return c.json({ ok: false, error: "Agente não encontrado" }, 404);

  const files = await db.query(
    `SELECT f.*,
            CASE
              WHEN k.id IS NOT NULL
               AND k.content IS NOT NULL
               AND TRIM(k.content) != ''
               AND k.status IN ('indexed', 'pending')
              THEN 1 ELSE 0
            END AS indexed,
            CHAR_LENGTH(IFNULL(k.content, '')) AS content_len
     FROM ds_agent_knowledge_files f
     LEFT JOIN ds_agent_knowledge k
       ON k.id = f.id AND k.tenant_id = f.tenant_id AND k.agent_id = f.agent_id
     WHERE f.agent_id = ? AND f.tenant_id = ?
     ORDER BY f.uploaded_at DESC`,
    [id, tenantId],
  );
  const links = await db.query(
    `SELECT l.*,
            CASE
              WHEN k.id IS NOT NULL
               AND k.content IS NOT NULL
               AND TRIM(k.content) != ''
               AND k.status IN ('indexed', 'pending')
              THEN 1 ELSE 0
            END AS indexed
     FROM ds_agent_knowledge_links l
     LEFT JOIN ds_agent_knowledge k
       ON k.id = l.id AND k.tenant_id = l.tenant_id AND k.agent_id = l.agent_id
     WHERE l.agent_id = ? AND l.tenant_id = ?
     ORDER BY l.created_at DESC`,
    [id, tenantId],
  );
  const tools = await db.query(`SELECT * FROM ds_agent_tools WHERE agent_id = ? AND tenant_id = ?`, [
    id,
    tenantId,
  ]);
  const availability = await db.query(
    `SELECT * FROM ds_agent_calendar_availability WHERE agent_id = ? AND tenant_id = ?`,
    [id, tenantId],
  );
  const followups = await db.query(
    `SELECT * FROM ds_agent_followups WHERE agent_id = ? AND tenant_id = ?`,
    [id, tenantId],
  );

  return c.json({ ok: true, agent, knowledge: { files, links }, tools, availability, followups });
});

dsAgentApi.patch("/:id", async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const body = await c.req.json();
  const setClauses: string[] = [];
  const values: any[] = [];

  for (const [k, v] of Object.entries(body)) {
    setClauses.push(`${k} = ?`);
    values.push(v);
  }
  if (setClauses.length > 0) {
    values.push(id, tenantId);
    await db.query(`UPDATE ds_agents SET ${setClauses.join(", ")} WHERE id = ? AND tenant_id = ?`, values);
  }
  return c.json({ ok: true });
});

dsAgentApi.delete("/:id", async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  await db.query(`DELETE FROM ds_agents WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
  return c.json({ ok: true });
});

dsAgentApi.patch("/:id/move", async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const body = await c.req.json();
  await db.query(`UPDATE ds_agents SET folder_id = ? WHERE id = ? AND tenant_id = ?`, [
    body.folderId || null,
    id,
    tenantId,
  ]);
  return c.json({ ok: true });
});

// Conhecimento
dsAgentApi.post("/:id/knowledge/files", async (c) => {
  const tenantId = c.get("tenantId");
  const agentId = c.req.param("id");
  const body = await c.req.json();
  const {
    extractTextFromUpload,
    upsertKnowledgeDocument,
  } = await import("./ds-agent-knowledge.server");
  const fs = await import("fs");
  const path = await import("path");

  const fileId = crypto.randomUUID();
  let extractedText = String(body.content_text || "").trim();
  let pageCount = Number(body.page_count) || 1;
  let knowledgeType: "text" | "pdf" = "text";
  let fileBuffer: Buffer | null = null;

  if (!extractedText && body.content_base64) {
    fileBuffer = Buffer.from(String(body.content_base64), "base64");
    const extracted = extractTextFromUpload(body.file_name || "documento.pdf", fileBuffer);
    if (!extracted.ok) {
      return c.json({ ok: false, error: extracted.error || "Falha ao extrair texto" }, 400);
    }
    extractedText = extracted.text;
    pageCount = extracted.pageCount;
    knowledgeType = extracted.type === "pdf" ? "pdf" : "text";
  } else if (extractedText) {
    fileBuffer = Buffer.from(extractedText, "utf8");
  }

  if (!extractedText || extractedText.trim().length < 20) {
    return c.json(
      {
        ok: false,
        error:
          "Envie content_text ou content_base64. Sem texto indexado a IA não consegue usar o documento.",
      },
      400,
    );
  }

  await upsertKnowledgeDocument({
    id: fileId,
    tenantId,
    agentId,
    title: body.file_name || "Documento",
    type: knowledgeType,
    content: extractedText,
    status: "indexed",
  });

  const safeName = String(body.file_name || "documento")
    .replace(/[^\w.\- ()\u00C0-\u00FF]+/g, "_")
    .slice(0, 180);
  const relativeDir = path.join("public", "uploads", tenantId, "ds-agent");
  const absoluteDir = path.resolve(process.cwd(), relativeDir);
  const storagePath = `/${relativeDir.replace(/\\/g, "/")}/${fileId}_${safeName}`;
  try {
    if (!fs.existsSync(absoluteDir)) fs.mkdirSync(absoluteDir, { recursive: true });
    if (fileBuffer) fs.writeFileSync(path.join(absoluteDir, `${fileId}_${safeName}`), fileBuffer);
  } catch (err) {
    console.warn("[DS Agente API] persistência em disco falhou:", err);
  }

  await db.query(
    `INSERT INTO ds_agent_knowledge_files (id, agent_id, tenant_id, file_name, file_size_kb, page_count, status, storage_path)
     VALUES (?, ?, ?, ?, ?, ?, 'ativo', ?)`,
    [
      fileId,
      agentId,
      tenantId,
      body.file_name || "documento",
      body.file_size_kb || Math.max(1, Math.ceil(Buffer.byteLength(extractedText) / 1024)),
      pageCount,
      storagePath,
    ],
  );
  const [file] = await db.query(
    `SELECT * FROM ds_agent_knowledge_files WHERE id = ? AND tenant_id = ?`,
    [fileId, tenantId],
  );
  return c.json({ ok: true, file: { ...file, indexed: true }, indexed: true }, 201);
});

dsAgentApi.delete("/:id/knowledge/files/:fileId", async (c) => {
  const tenantId = c.get("tenantId");
  const fileId = c.req.param("fileId");
  await db.query(`DELETE FROM ds_agent_knowledge_files WHERE id = ? AND tenant_id = ?`, [
    fileId,
    tenantId,
  ]);
  const { deleteKnowledgeDocument } = await import("./ds-agent-knowledge.server");
  await deleteKnowledgeDocument(fileId, tenantId);
  return c.json({ ok: true });
});

dsAgentApi.post("/:id/knowledge/links", async (c) => {
  const tenantId = c.get("tenantId");
  const agentId = c.req.param("id");
  const body = await c.req.json();
  const {
    fetchUrlAsKnowledgeText,
    upsertKnowledgeDocument,
  } = await import("./ds-agent-knowledge.server");
  const linkId = crypto.randomUUID();
  const fetched = await fetchUrlAsKnowledgeText(String(body.url || ""));
  const status = fetched.ok ? "indexado" : "erro";
  await db.query(
    `INSERT INTO ds_agent_knowledge_links (id, agent_id, tenant_id, url, status) VALUES (?, ?, ?, ?, ?)`,
    [linkId, agentId, tenantId, body.url, status],
  );
  await upsertKnowledgeDocument({
    id: linkId,
    tenantId,
    agentId,
    title: String(body.url || "").slice(0, 250),
    type: "url",
    content: fetched.ok ? fetched.text : "",
    status: fetched.ok ? "indexed" : "error",
  });
  const [link] = await db.query(
    `SELECT * FROM ds_agent_knowledge_links WHERE id = ? AND tenant_id = ?`,
    [linkId, tenantId],
  );
  return c.json({ ok: true, link, indexed: fetched.ok }, 201);
});

dsAgentApi.delete("/:id/knowledge/links/:linkId", async (c) => {
  const tenantId = c.get("tenantId");
  const linkId = c.req.param("linkId");
  await db.query(`DELETE FROM ds_agent_knowledge_links WHERE id = ? AND tenant_id = ?`, [
    linkId,
    tenantId,
  ]);
  const { deleteKnowledgeDocument } = await import("./ds-agent-knowledge.server");
  await deleteKnowledgeDocument(linkId, tenantId);
  return c.json({ ok: true });
});

// Ferramentas
dsAgentApi.patch("/:id/tools/:toolKey", async (c) => {
  const tenantId = c.get("tenantId");
  const agentId = c.req.param("id");
  const toolKey = c.req.param("toolKey");
  const body = await c.req.json();
  await db.query(
    `INSERT INTO ds_agent_tools (id, agent_id, tenant_id, name, tool_key, enabled, config) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), config = VALUES(config)`,
    [
      crypto.randomUUID(),
      agentId,
      tenantId,
      toolKey,
      toolKey,
      body.enabled,
      JSON.stringify(body.config || {}),
    ]
  );
  return c.json({ ok: true });
});

dsAgentApi.post("/:id/tools/google-calendar/connect", async (c) => {
  return c.json({ ok: true, connected: true, account: "usuario@empresa.com" });
});

dsAgentApi.patch("/:id/availability", async (c) => {
  const tenantId = c.get("tenantId");
  const agentId = c.req.param("id");
  const body = await c.req.json();
  for (const item of body.availability || []) {
    await db.query(
      `INSERT INTO ds_agent_calendar_availability (id, agent_id, tenant_id, weekday, start_time, end_time, active) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE start_time = VALUES(start_time), end_time = VALUES(end_time), active = VALUES(active)`,
      [crypto.randomUUID(), agentId, tenantId, item.weekday, item.start_time, item.end_time, item.active]
    );
  }
  return c.json({ ok: true });
});

// Followup
dsAgentApi.post("/:id/followups", async (c) => {
  const tenantId = c.get("tenantId");
  const agentId = c.req.param("id");
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await db.query(
    `INSERT INTO ds_agent_followups (id, agent_id, tenant_id, name, message, type, recurrence, wait_amount, wait_unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, agentId, tenantId, body.name, body.message, body.type || "manual", body.recurrence || "unico", body.wait_amount || 10, body.wait_unit || "minutos"]
  );
  const [followup] = await db.query(`SELECT * FROM ds_agent_followups WHERE id = ?`, [id]);
  return c.json({ ok: true, followup }, 201);
});

dsAgentApi.get("/:id/followups", async (c) => {
  const agentId = c.req.param("id");
  const followups = await db.query(`SELECT * FROM ds_agent_followups WHERE agent_id = ?`, [agentId]);
  return c.json({ ok: true, followups });
});

dsAgentApi.delete("/:id/followups/:followupId", async (c) => {
  const followupId = c.req.param("followupId");
  await db.query(`DELETE FROM ds_agent_followups WHERE id = ?`, [followupId]);
  return c.json({ ok: true });
});

// Test Chat
dsAgentApi.post("/:id/test-chat", async (c) => {
  const body = await c.req.json();
  return c.json({
    ok: true,
    simulated: true,
    reply: `[Simulação] Resposta fictícia do agente para: "${body.message}".`,
    timestamp: new Date().toISOString(),
  });
});

// Usage
dsAgentApi.get("/:id/usage", async (c) => {
  return c.json({
    ok: true,
    total_tokens: 45200,
    custo_estimado: 0.0904,
    requisicoes: 38,
    media_por_req: 1189,
    tokens_por_dia: [
      { date: "18/07", tokens: 2500 },
      { date: "19/07", tokens: 3800 },
      { date: "20/07", tokens: 4100 },
      { date: "21/07", tokens: 3200 },
      { date: "22/07", tokens: 5100 },
      { date: "23/07", tokens: 4900 },
      { date: "24/07", tokens: 3000 },
      { date: "25/07", tokens: 2800 },
      { date: "26/07", tokens: 4200 },
      { date: "27/07", tokens: 3900 },
      { date: "28/07", tokens: 2100 },
      { date: "29/07", tokens: 1900 },
      { date: "30/07", tokens: 3700 },
    ],
    por_categoria: {
      action_analysis: 20,
      completion: 55,
      embedding: 10,
      query_rewriting: 10,
      transcription: 5,
    },
    detalhamento_por_modelo: [
      { modelo: "gpt-4o-mini", provider: "OpenAI Padrão", tokens: 33900, requisicoes: 28, custo: 0.0508 },
      { modelo: "gpt-4o", provider: "OpenAI Padrão", tokens: 11300, requisicoes: 10, custo: 0.0396 },
    ],
  });
});

export default dsAgentApi;
