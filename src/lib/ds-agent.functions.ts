import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/integrations/mysql/auth-middleware";
import { query as dbQuery } from "@/lib/db";
import { randomUUID } from "crypto";
import { encryptApiKey, decryptApiKey, maskApiKey } from "./ds-crypto";

/** 
 * FOLDERS CRUD 
 */

export const listFolders = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tenantId = context.tenantId;
    const folders: any[] = await dbQuery(
      `SELECT f.*, (SELECT COUNT(*) FROM ds_agents WHERE folder_id = f.id) as agents_count 
       FROM ds_agent_folders f WHERE f.tenant_id = ? ORDER BY f.created_at ASC`,
      [tenantId]
    );
    return folders;
  });

export const createFolder = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const { name } = data as { name: string };
    if (!name) throw new Error("O nome da pasta é obrigatório.");
    const tenantId = context.tenantId;
    const id = randomUUID();
    await dbQuery(
      "INSERT INTO ds_agent_folders (id, tenant_id, name) VALUES (?, ?, ?)",
      [id, tenantId, name]
    );
    return { ok: true, id };
  });

export const updateFolder = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const { id, name } = data as { id: string; name: string };
    const tenantId = context.tenantId;
    await dbQuery(
      "UPDATE ds_agent_folders SET name = ? WHERE id = ? AND tenant_id = ?",
      [name, id, tenantId]
    );
    return { ok: true };
  });

export const deleteFolder = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const { id, deleteAgents } = data as { id: string; deleteAgents: boolean };
    const tenantId = context.tenantId;
    if (deleteAgents) {
      await dbQuery("DELETE FROM ds_agents WHERE folder_id = ? AND tenant_id = ?", [id, tenantId]);
    } else {
      await dbQuery("UPDATE ds_agents SET folder_id = NULL WHERE folder_id = ? AND tenant_id = ?", [id, tenantId]);
    }
    await dbQuery("DELETE FROM ds_agent_folders WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    return { ok: true };
  });

/**
 * AGENTS CRUD
 */

export const listAgents = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const { folder_id } = (data || {}) as { folder_id?: string | null };
    const tenantId = context.tenantId;

    let sql = "SELECT id, name, provider, model, status, folder_id, updated_at FROM ds_agents WHERE tenant_id = ?";
    const params: any[] = [tenantId];

    if (folder_id !== undefined) {
      if (folder_id === null) {
        sql += " AND folder_id IS NULL";
      } else {
        sql += " AND folder_id = ?";
        params.push(folder_id);
      }
    }

    sql += " ORDER BY created_at DESC";
    const agents: any[] = await dbQuery(sql, params);
    return agents;
  });

export const getAgent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const { id } = data as { id: string };
    const tenantId = context.tenantId;

    const rows: any[] = await dbQuery(
      "SELECT * FROM ds_agents WHERE id = ? AND tenant_id = ?",
      [id, tenantId]
    );
    const agent = rows[0];
    if (!agent) throw new Error("Agente não encontrado.");

    if (agent.api_key_encrypted) {
      try {
        agent.api_key_masked = maskApiKey(decryptApiKey(agent.api_key_encrypted));
      } catch {
        agent.api_key_masked = "";
      }
      delete agent.api_key_encrypted;
    }

    return agent;
  });

export const createAgent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const payload = data as any;
    if (!payload?.name) throw new Error("Nome do agente é obrigatório.");
    const tenantId = context.tenantId;
    const id = randomUUID();
    const encryptedKey = payload.api_key ? encryptApiKey(payload.api_key) : null;

    await dbQuery(
      `INSERT INTO ds_agents (
        id, tenant_id, folder_id, name, provider, api_key_encrypted, model, status, system_prompt,
        answer_only_assigned, chunk_responses, process_images, process_audio,
        disable_outside_hours, pause_on_human, wait_time_seconds,
        max_messages_per_interaction, temperature, max_tokens
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, tenantId,
        payload.folder_id || null,
        payload.name,
        payload.provider || "openai",
        encryptedKey,
        payload.model || "gpt-4o-mini",
        payload.status || "inactive",
        payload.system_prompt || null,
        payload.answer_only_assigned ? 1 : 0,
        payload.chunk_responses ? 1 : 0,
        payload.process_images ? 1 : 0,
        payload.process_audio ? 1 : 0,
        payload.disable_outside_hours ? 1 : 0,
        payload.pause_on_human !== false ? 1 : 0,
        payload.wait_time_seconds || 0,
        payload.max_messages_per_interaction || 5,
        payload.temperature || 0.7,
        payload.max_tokens || 1000,
      ]
    );

    return { ok: true, id };
  });

export const updateAgent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const payload = data as any;
    const tenantId = context.tenantId;

    const allowed = [
      "name", "provider", "model", "status", "folder_id", "system_prompt",
      "answer_only_assigned", "chunk_responses", "process_images",
      "process_audio", "disable_outside_hours", "pause_on_human",
      "wait_time_seconds", "max_messages_per_interaction",
      "temperature", "max_tokens"
    ];

    const boolFields = ["answer_only_assigned","chunk_responses","process_images","process_audio","disable_outside_hours","pause_on_human"];
    const setParts: string[] = [];
    const params: any[] = [];

    for (const key of allowed) {
      if (payload[key] !== undefined) {
        setParts.push(`${key} = ?`);
        params.push(boolFields.includes(key) ? (payload[key] ? 1 : 0) : payload[key]);
      }
    }

    if (payload.api_key) {
      setParts.push("api_key_encrypted = ?");
      params.push(encryptApiKey(payload.api_key));
    }

    if (!setParts.length) return { ok: true };

    params.push(payload.id, tenantId);
    await dbQuery(
      `UPDATE ds_agents SET ${setParts.join(", ")} WHERE id = ? AND tenant_id = ?`,
      params
    );
    return { ok: true };
  });

export const deleteAgent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const { id } = data as { id: string };
    const tenantId = context.tenantId;
    await dbQuery("DELETE FROM ds_agents WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    return { ok: true };
  });

export const duplicateAgent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const { id } = data as { id: string };
    const tenantId = context.tenantId;

    // 1. Fetch original agent
    const rows: any[] = await dbQuery(
      "SELECT * FROM ds_agents WHERE id = ? AND tenant_id = ?",
      [id, tenantId]
    );
    const original = rows[0];
    if (!original) throw new Error("Agente não encontrado.");

    // 2. Create the copy
    const newId = randomUUID();
    await dbQuery(
      `INSERT INTO ds_agents (
        id, tenant_id, folder_id, name, provider, api_key_encrypted, model, status, system_prompt,
        answer_only_assigned, chunk_responses, process_images, process_audio,
        disable_outside_hours, pause_on_human, wait_time_seconds,
        max_messages_per_interaction, temperature, max_tokens
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId, tenantId,
        original.folder_id,
        `${original.name} (cópia)`,
        original.provider,
        original.api_key_encrypted,
        original.model,
        "inactive",
        original.system_prompt,
        original.answer_only_assigned,
        original.chunk_responses,
        original.process_images,
        original.process_audio,
        original.disable_outside_hours,
        original.pause_on_human,
        original.wait_time_seconds,
        original.max_messages_per_interaction,
        original.temperature,
        original.max_tokens,
      ]
    );

    // 3. Copy knowledge items
    const knowledgeItems: any[] = await dbQuery(
      "SELECT * FROM ds_agent_knowledge WHERE agent_id = ? AND tenant_id = ?",
      [id, tenantId]
    );
    for (const item of knowledgeItems) {
      await dbQuery(
        "INSERT INTO ds_agent_knowledge (id, tenant_id, agent_id, title, type, content, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [randomUUID(), tenantId, newId, item.title, item.type, item.content, item.status]
      );
    }

    // 4. Copy tools
    const tools: any[] = await dbQuery(
      "SELECT * FROM ds_agent_tools WHERE agent_id = ? AND tenant_id = ?",
      [id, tenantId]
    );
    for (const tool of tools) {
      await dbQuery(
        "INSERT INTO ds_agent_tools (id, tenant_id, agent_id, name, description, permissions, require_confirmation, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [randomUUID(), tenantId, newId, tool.name, tool.description, tool.permissions, tool.require_confirmation, tool.is_active]
      );
    }

    return { ok: true, id: newId };
  });

/**
 * SUBAGENTS CRUD
 */
export const listSubagents = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const { agent_id } = data as { agent_id: string };
    const tenantId = context.tenantId;
    const rows: any[] = await dbQuery(
      "SELECT * FROM ds_agent_subagents WHERE agent_id = ? AND tenant_id = ? ORDER BY exec_order ASC",
      [agent_id, tenantId]
    );
    return rows;
  });

export const saveSubagent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const p = data as any;
    const tenantId = context.tenantId;
    if (p.id) {
      await dbQuery(
        "UPDATE ds_agent_subagents SET name=?, role=?, instructions=?, exec_order=?, model=?, status=? WHERE id=? AND tenant_id=?",
        [p.name, p.role, p.instructions, p.exec_order || 0, p.model, p.status || "active", p.id, tenantId]
      );
      return { ok: true, id: p.id };
    } else {
      const id = randomUUID();
      await dbQuery(
        "INSERT INTO ds_agent_subagents (id, tenant_id, agent_id, name, role, instructions, exec_order, model, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [id, tenantId, p.agent_id, p.name, p.role, p.instructions, p.exec_order || 0, p.model, p.status || "active"]
      );
      return { ok: true, id };
    }
  });

export const deleteSubagent = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const { id } = data as { id: string };
    const tenantId = context.tenantId;
    await dbQuery("DELETE FROM ds_agent_subagents WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    return { ok: true };
  });

/**
 * KNOWLEDGE CRUD
 */
export const listKnowledge = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const { agent_id } = data as { agent_id: string };
    const tenantId = context.tenantId;
    const rows: any[] = await dbQuery(
      "SELECT * FROM ds_agent_knowledge WHERE agent_id = ? AND tenant_id = ? ORDER BY created_at DESC",
      [agent_id, tenantId]
    );
    return rows;
  });

export const saveKnowledge = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const p = data as any;
    const tenantId = context.tenantId;
    if (p.id) {
      await dbQuery(
        "UPDATE ds_agent_knowledge SET title=?, type=?, content=?, status=? WHERE id=? AND tenant_id=?",
        [p.title, p.type, p.content, p.status || "pending", p.id, tenantId]
      );
      return { ok: true, id: p.id };
    } else {
      const id = randomUUID();
      await dbQuery(
        "INSERT INTO ds_agent_knowledge (id, tenant_id, agent_id, title, type, content, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, tenantId, p.agent_id, p.title, p.type, p.content, p.status || "pending"]
      );
      return { ok: true, id };
    }
  });

export const deleteKnowledge = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const { id } = data as { id: string };
    const tenantId = context.tenantId;
    await dbQuery("DELETE FROM ds_agent_knowledge WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    return { ok: true };
  });

/**
 * TOOLS CRUD
 */
export const listTools = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const { agent_id } = data as { agent_id: string };
    const tenantId = context.tenantId;
    const rows: any[] = await dbQuery(
      "SELECT * FROM ds_agent_tools WHERE agent_id = ? AND tenant_id = ? ORDER BY name ASC",
      [agent_id, tenantId]
    );
    return rows;
  });

export const saveTool = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const p = data as any;
    const tenantId = context.tenantId;
    const perms = p.permissions ? JSON.stringify(p.permissions) : null;
    if (p.id) {
      await dbQuery(
        "UPDATE ds_agent_tools SET name=?, description=?, permissions=?, require_confirmation=?, is_active=? WHERE id=? AND tenant_id=?",
        [p.name, p.description, perms, p.require_confirmation ? 1 : 0, p.is_active ? 1 : 0, p.id, tenantId]
      );
      return { ok: true, id: p.id };
    } else {
      const id = randomUUID();
      await dbQuery(
        "INSERT INTO ds_agent_tools (id, tenant_id, agent_id, name, description, permissions, require_confirmation, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [id, tenantId, p.agent_id, p.name, p.description, perms, p.require_confirmation ? 1 : 0, p.is_active ? 1 : 0]
      );
      return { ok: true, id };
    }
  });

export const deleteTool = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const { id } = data as { id: string };
    const tenantId = context.tenantId;
    await dbQuery("DELETE FROM ds_agent_tools WHERE id = ? AND tenant_id = ?", [id, tenantId]);
    return { ok: true };
  });

/**
 * INTEGRATIONS / ASSIGNMENTS
 */
export const getIntegrationOptions = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const tenantId = context.tenantId;

    // Try multiple table/column patterns to find WhatsApp sessions
    let connections: any[] = [];
    const sessionQueries = [
      "SELECT id, session_name as name, status FROM wapi_sessions WHERE user_id = ?",
      "SELECT id, name, status FROM wapi_sessions WHERE user_id = ?",
      "SELECT id, session_name as name, status FROM wapi_sessions WHERE tenant_id = ?",
      "SELECT id, name, status FROM whatsapp_sessions WHERE user_id = ?",
      "SELECT id, name, status FROM whatsapp_instances WHERE user_id = ?",
    ];

    for (const sql of sessionQueries) {
      try {
        connections = await dbQuery(sql, [tenantId]);
        break; // Found a working query
      } catch {
        continue;
      }
    }

    let funnels: any[] = [];
    try {
      funnels = await dbQuery(
        "SELECT id, name FROM sales_funnels WHERE user_id = ?",
        [tenantId]
      );
    } catch { funnels = []; }

    let stages: any[] = [];
    try {
      stages = await dbQuery(
        "SELECT id, name, funnel_id FROM sales_stages WHERE user_id = ?",
        [tenantId]
      );
    } catch { stages = []; }

    return { connections, funnels, stages };
  });

export const getAgentAssignments = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const { agent_id } = data as { agent_id: string };
    const tenantId = context.tenantId;
    const rows: any[] = await dbQuery(
      "SELECT * FROM ds_agent_assignments WHERE agent_id = ? AND tenant_id = ? LIMIT 1",
      [agent_id, tenantId]
    );
    return rows[0] || null;
  });

export const saveAgentAssignments = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const { agent_id, whatsapp_session_id, funnel_stage_id } = data as {
      agent_id: string;
      whatsapp_session_id: string | null;
      funnel_stage_id: string | null;
    };
    const tenantId = context.tenantId;

    const existing: any[] = await dbQuery(
      "SELECT id FROM ds_agent_assignments WHERE agent_id = ? AND tenant_id = ? LIMIT 1",
      [agent_id, tenantId]
    );

    if (existing.length > 0) {
      await dbQuery(
        "UPDATE ds_agent_assignments SET whatsapp_session_id = ?, funnel_stage_id = ? WHERE agent_id = ? AND tenant_id = ?",
        [whatsapp_session_id || null, funnel_stage_id || null, agent_id, tenantId]
      );
    } else {
      const id = randomUUID();
      await dbQuery(
        "INSERT INTO ds_agent_assignments (id, tenant_id, agent_id, whatsapp_session_id, funnel_stage_id) VALUES (?, ?, ?, ?, ?)",
        [id, tenantId, agent_id, whatsapp_session_id || null, funnel_stage_id || null]
      );
    }

    return { ok: true };
  });

export const sendTestMessage = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const { agent_id, message, history = [] } = data as {
      agent_id: string;
      message: string;
      history: { role: "user" | "model"; content: string }[];
    };
    const tenantId = context.tenantId;

    const rows: any[] = await dbQuery(
      "SELECT * FROM ds_agents WHERE id = ? AND tenant_id = ? LIMIT 1",
      [agent_id, tenantId]
    );
    const agent = rows[0];
    if (!agent) throw new Error("Agente não encontrado.");

    const provider = agent.provider || "openai";
    const model = agent.model || "gpt-4o-mini";
    const systemPrompt = agent.system_prompt || "Você é um assistente útil.";

    let apiKey = "";
    if (agent.api_key_encrypted) {
      try {
        apiKey = decryptApiKey(agent.api_key_encrypted);
      } catch {}
    }

    const knowledgeDocs: any[] = await dbQuery(
      "SELECT title, content FROM ds_agent_knowledge WHERE agent_id = ? AND tenant_id = ?",
      [agent_id, tenantId]
    );

    let kbContext = "";
    if (knowledgeDocs.length > 0) {
      kbContext = "\n\nBase de Conhecimento disponível:\n" + knowledgeDocs.map(doc => `--- DOCUMENTO: ${doc.title} ---\n${doc.content}`).join("\n\n");
    }

    const fullSystemPrompt = systemPrompt + kbContext;

    if (!apiKey) {
      return {
        role: "model",
        content: `🤖 [SIMULAÇÃO DE IA - Configure sua API Key para testar respostas reais]\n\nRecebi sua mensagem: "${message}"\n\nMinhas instruções dizem para agir de acordo com o seguinte System Prompt:\n"${systemPrompt.substring(0, 200)}..."`
      };
    }

    try {
      if (provider === "gemini") {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                ...history.map(h => ({
                  role: h.role === "model" ? "model" : "user",
                  parts: [{ text: h.content }]
                })),
                { role: "user", parts: [{ text: message }] }
              ],
              systemInstruction: { parts: [{ text: fullSystemPrompt }] }
            })
          }
        );
        const json = await response.json();
        const responseText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) throw new Error(json?.error?.message || "Sem resposta do Gemini");
        return { role: "model", content: responseText };
      } else if (provider === "openai" || provider === "deepseek") {
        const url = provider === "deepseek" ? "https://api.deepseek.com/chat/completions" : "https://api.openai.com/v1/chat/completions";
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: fullSystemPrompt },
              ...history.map(h => ({
                role: h.role === "model" ? "assistant" : "user",
                content: h.content
              })),
              { role: "user", content: message }
            ]
          })
        });
        const json = await response.json();
        const responseText = json?.choices?.[0]?.message?.content;
        if (!responseText) throw new Error(json?.error?.message || "Sem resposta da API");
        return { role: "model", content: responseText };
      } else if (provider === "anthropic") {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: model,
            system: fullSystemPrompt,
            messages: [
              ...history.map(h => ({
                role: h.role === "model" ? "assistant" : "user",
                content: h.content
              })),
              { role: "user", content: message }
            ],
            max_tokens: 1024
          })
        });
        const json = await response.json();
        const responseText = json?.content?.[0]?.text;
        if (!responseText) throw new Error(json?.error?.message || "Sem resposta do Claude");
        return { role: "model", content: responseText };
      }
    } catch (err: any) {
      return {
        role: "model",
        content: `⚠️ Erro ao se conectar com o provedor ${provider}: ${err.message}`
      };
    }

    return { role: "model", content: "Provedor não configurado ou desconhecido." };
  });

export const getAgentUsageStats = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: any) => d)
  .handler(async ({ context, data }) => {
    const { agent_id } = data as { agent_id: string };
    const tenantId = context.tenantId;

    const [stats]: any = await dbQuery(
      `SELECT 
        COUNT(*) as total_calls,
        SUM(prompt_tokens) as prompt_tokens,
        SUM(completion_tokens) as completion_tokens,
        SUM(total_tokens) as total_tokens,
        AVG(response_time_ms) as avg_response_time
       FROM ds_agent_usage 
       WHERE agent_id = ? AND tenant_id = ?`,
      [agent_id, tenantId]
    );

    const logs: any[] = await dbQuery(
      `SELECT level, message, created_at 
       FROM ds_agent_logs 
       WHERE agent_id = ? AND tenant_id = ? 
       ORDER BY created_at DESC LIMIT 20`,
      [agent_id, tenantId]
    );

    return {
      total_calls: stats?.total_calls || 0,
      prompt_tokens: stats?.prompt_tokens || 0,
      completion_tokens: stats?.completion_tokens || 0,
      total_tokens: stats?.total_tokens || 0,
      avg_response_time: Math.round(stats?.avg_response_time || 0),
      logs
    };
  });



