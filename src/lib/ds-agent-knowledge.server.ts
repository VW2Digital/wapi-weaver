import * as cheerio from "cheerio";

const MAX_CONTENT_CHARS = 80_000;

export type KnowledgeDocType = "text" | "faq" | "url" | "pdf";

function truncate(text: string, max = MAX_CONTENT_CHARS): string {
  const normalized = String(text || "")
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max)}\n\n[...conteúdo truncado...]`;
}

/** Extrator leve de texto de PDF (sem dependência externa). */
function extractPdfText(buffer: Buffer): string {
  const raw = buffer.toString("latin1");
  const chunks: string[] = [];

  const btRe = /BT\s([\s\S]*?)\sET/g;
  let m: RegExpExecArray | null;
  while ((m = btRe.exec(raw)) !== null) {
    const block = m[1];
    const strRe = /\(((?:\\.|[^\\)])*)\)\s*Tj/g;
    let sm: RegExpExecArray | null;
    while ((sm = strRe.exec(block)) !== null) {
      const decoded = sm[1]
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "")
        .replace(/\\t/g, "\t")
        .replace(/\\\(/g, "(")
        .replace(/\\\)/g, ")")
        .replace(/\\\\/g, "\\");
      if (decoded.trim()) chunks.push(decoded);
    }

    const arrRe = /\[(.*?)\]\s*TJ/gs;
    let am: RegExpExecArray | null;
    while ((am = arrRe.exec(block)) !== null) {
      const parts = am[1].match(/\(((?:\\.|[^\\)])*)\)/g) || [];
      for (const p of parts) {
        const inner = p.slice(1, -1).replace(/\\n/g, "\n").replace(/\\\(/g, "(").replace(/\\\)/g, ")");
        if (inner.trim()) chunks.push(inner);
      }
    }
  }

  if (chunks.length === 0) {
    // Fallback: strings imprimíveis longas
    const printable = raw.match(/[\x20-\x7E\u00C0-\u00FF]{5,}/g) || [];
    return truncate(printable.join(" ").replace(/\s+/g, " "));
  }

  return truncate(chunks.join(" "));
}

function estimatePages(text: string): number {
  const len = text.length;
  if (len <= 0) return 1;
  return Math.max(1, Math.ceil(len / 1800));
}

export function extractTextFromUpload(
  fileName: string,
  buffer: Buffer,
): { text: string; type: KnowledgeDocType; pageCount: number; ok: boolean; error?: string } {
  const ext = fileName.includes(".")
    ? fileName.slice(fileName.lastIndexOf(".")).toLowerCase()
    : "";

  if (ext === ".txt" || ext === ".csv" || ext === ".md") {
    const text = truncate(buffer.toString("utf8"));
    if (!text) {
      return { text: "", type: "text", pageCount: 1, ok: false, error: "Arquivo vazio." };
    }
    return { text, type: "text", pageCount: estimatePages(text), ok: true };
  }

  if (ext === ".pdf") {
    const text = extractPdfText(buffer);
    if (!text || text.length < 20) {
      return {
        text: "",
        type: "pdf",
        pageCount: 1,
        ok: false,
        error: "Não foi possível extrair texto deste PDF. Tente um PDF com texto selecionável ou envie TXT/CSV.",
      };
    }
    return { text, type: "pdf", pageCount: estimatePages(text), ok: true };
  }

  if (ext === ".docx") {
    return {
      text: "",
      type: "text",
      pageCount: 1,
      ok: false,
      error: "DOCX ainda não é suportado para extração. Converta para TXT, CSV ou PDF com texto.",
    };
  }

  return {
    text: "",
    type: "text",
    pageCount: 1,
    ok: false,
    error: `Formato não suportado: ${ext || "desconhecido"}`,
  };
}

export async function fetchUrlAsKnowledgeText(url: string): Promise<{ text: string; ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "BlivCRM-DSAgent/1.0 (+knowledge-indexer)",
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { text: "", ok: false, error: `HTTP ${res.status} ao buscar URL` };
    }

    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    const body = await res.text();

    if (contentType.includes("text/plain") || contentType.includes("csv")) {
      const text = truncate(body);
      return text ? { text, ok: true } : { text: "", ok: false, error: "URL sem conteúdo de texto." };
    }

    const $ = cheerio.load(body);
    $("script, style, noscript, iframe, svg, nav, footer, header").remove();
    const title = $("title").first().text().trim();
    const main =
      $("main").text() ||
      $("article").text() ||
      $("body").text() ||
      "";
    const text = truncate([title ? `# ${title}` : "", main].filter(Boolean).join("\n\n"));
    if (!text || text.length < 40) {
      return { text: "", ok: false, error: "Não foi possível extrair texto útil da página." };
    }
    return { text, ok: true };
  } catch (err: any) {
    return { text: "", ok: false, error: err?.message || "Falha ao indexar URL" };
  }
}

export async function upsertKnowledgeDocument(params: {
  id: string;
  tenantId: string;
  agentId: string;
  title: string;
  type: KnowledgeDocType;
  content: string;
  status?: "pending" | "indexed" | "error";
}): Promise<void> {
  const { default: db } = await import("./db");
  const status = params.status || (params.content ? "indexed" : "error");
  const existing = (await db.query(
    `SELECT id FROM ds_agent_knowledge WHERE id = ? AND tenant_id = ? LIMIT 1`,
    [params.id, params.tenantId],
  )) as Array<{ id: string }>;

  if (existing?.[0]?.id) {
    await db.query(
      `UPDATE ds_agent_knowledge
       SET title = ?, type = ?, content = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND tenant_id = ?`,
      [params.title, params.type, params.content, status, params.id, params.tenantId],
    );
    return;
  }

  await db.query(
    `INSERT INTO ds_agent_knowledge (id, tenant_id, agent_id, title, type, content, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [params.id, params.tenantId, params.agentId, params.title, params.type, params.content, status],
  );
}

export async function deleteKnowledgeDocument(id: string, tenantId: string): Promise<void> {
  const { default: db } = await import("./db");
  await db.query(`DELETE FROM ds_agent_knowledge WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
}
