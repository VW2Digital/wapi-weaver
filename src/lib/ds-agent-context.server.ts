/** Contexto de conversa do DS Agente: histórico, conhecimento relevante e memória. */

export const DS_AGENT_HISTORY_LIMIT = 20;
export const DS_AGENT_KNOWLEDGE_SCAN = 80;
export const DS_AGENT_KNOWLEDGE_PICK = 12;

export type HistoryMessage = {
  direction?: string;
  body?: string | null;
  type?: string | null;
  created_at?: string | Date;
};

export function takeLastHistory<T>(rows: T[], limit = DS_AGENT_HISTORY_LIMIT): T[] {
  if (!Array.isArray(rows) || rows.length <= limit) return Array.isArray(rows) ? [...rows] : [];
  return rows.slice(-limit);
}

export function formatHistoryMessage(message: HistoryMessage): string {
  const who = message.direction === "incoming" ? "Cliente" : "Agente";
  const body =
    message.type && message.type !== "text" && !message.body
      ? `[${message.type}]`
      : String(message.body || "").trim();
  return `${who}: ${body}`;
}

export function formatHistoryText(rows: HistoryMessage[]): string {
  return takeLastHistory(rows)
    .map(formatHistoryMessage)
    .filter((line) => !/^Cliente: $|Agente: $/.test(line))
    .join("\n");
}

export function tokenizeKnowledgeQuery(text: string): string[] {
  const stop = new Set([
    "para",
    "pelo",
    "pela",
    "isso",
    "como",
    "uma",
    "uns",
    "umas",
    "que",
    "com",
    "por",
    "nao",
    "não",
    "sim",
    "the",
    "and",
    "você",
    "voce",
    "ola",
    "olá",
    "bom",
    "dia",
    "boa",
    "tarde",
    "noite",
  ]);
  const raw = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]{3,}/g);
  if (!raw) return [];
  return [...new Set(raw.filter((token) => !stop.has(token)))];
}

export function scoreKnowledgeDoc(query: string, title: string, content: string): number {
  const tokens = tokenizeKnowledgeQuery(`${query}`);
  if (!tokens.length) return 0;
  const hay = `${title || ""}\n${content || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let score = 0;
  for (const token of tokens) {
    if (!hay.includes(token)) continue;
    score += hay.includes(String(title || "").toLowerCase()) && String(title || "").toLowerCase().includes(token) ? 4 : 1;
    const hits = hay.split(token).length - 1;
    score += Math.min(hits, 8);
  }
  return score;
}

export function selectRelevantKnowledge<T extends { title?: string; content?: string }>(
  docs: T[],
  query: string,
  maxDocs = DS_AGENT_KNOWLEDGE_PICK,
): T[] {
  if (!docs?.length) return [];
  const scored = docs.map((doc, index) => ({
    doc,
    index,
    score: scoreKnowledgeDoc(query, String(doc.title || ""), String(doc.content || "")),
  }));
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  const picked = (scored.some((item) => item.score > 0) ? scored.filter((item) => item.score > 0) : scored)
    .slice(0, maxDocs)
    .map((item) => item.doc);
  return picked;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?55)?\s?\(?\d{2}\)?\s?9?\d{4,5}-?\d{4}/g;

export function extractContactFacts(historyText: string): string[] {
  const text = String(historyText || "");
  const facts = new Set<string>();
  for (const email of text.match(EMAIL_RE) || []) facts.add(`email: ${email.toLowerCase()}`);
  for (const phone of text.match(PHONE_RE) || []) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length >= 10) facts.add(`telefone mencionado: ${digits}`);
  }
  const clientLines = text
    .split("\n")
    .filter((line) => line.startsWith("Cliente:"))
    .map((line) => line.replace(/^Cliente:\s*/, "").trim())
    .filter((line) => line.length >= 8 && line.length <= 240);
  for (const line of clientLines.slice(-6)) {
    facts.add(`cliente disse: ${line}`);
  }
  return [...facts].slice(0, 16);
}

export function mergeContactFacts(existing: string, incoming: string[]): string {
  const old = String(existing || "")
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  const merged = [...incoming, ...old];
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const fact of merged) {
    const key = fact.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(fact);
    if (unique.length >= 24) break;
  }
  return unique.map((fact) => `- ${fact}`).join("\n");
}

export function summarizeRecentHistory(historyText: string): string {
  const lines = String(historyText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return takeLastHistory(lines, DS_AGENT_HISTORY_LIMIT).join("\n").slice(0, 4000);
}
