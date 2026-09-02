import dns from "dns";
import ipaddr from "ipaddr.js";
import crypto from "crypto";
import type { DbInterface } from "./db.js";
import { setContactFieldValues } from "./services/contact-custom-field.service.js";
import {
  getLeadFieldDefinition,
  getLeadFieldValue,
  isOperatorValidForType,
  setLeadFieldValue,
  type LeadFieldReference,
  type LeadFieldDefinition,
} from "./services/lead-field.service.js";

export interface BotFlowExecutionContext {
  tenantId: string;
  userId: string;
  contact: {
    id?: string;
    phone: string;
    phone_e164?: string | null;
    whatsapp_number?: string | null;
    name?: string;
    email?: string;
    company?: string;
    position?: string;
    notes?: string;
    responsible_user_id?: string | null;
    customFields?: Record<string, unknown>;
  };
  message: {
    text?: string;
    buttonPayload?: string;
    type?: string;
    raw?: any;
  };
  channel: string;
  flowId?: string;
  stepId?: string;
  variables: Record<string, any>;
  httpResponse?: any;
  /** Definições de Lead Fields carregadas para avaliação tipada de condições. */
  leadFieldDefinitions?: Record<string, LeadFieldDefinition>;
}

export interface ConditionRule {
  /** Legado: expressão livre. */
  left?: string;
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "starts_with"
    | "ends_with"
    | "exists"
    | "not_exists"
    | "is_empty"
    | "is_not_empty"
    | "not_empty"
    | "greater_than"
    | "greater_or_equal"
    | "less_than"
    | "less_or_equal"
    | "in"
    | "not_in"
    | "is_true"
    | "is_false"
    | "before"
    | "after";
  /** Legado: expressão livre. */
  right?: string;
  /** Referência tipada a um Lead Field. Quando presente, sobrescreve left/right legados. */
  field?: LeadFieldReference;
  /** Valor literal para comparação tipada. Pode conter templates {{...}}. */
  value?: unknown;
}

export interface ConditionConfig {
  logic?: "AND" | "OR";
  rules?: ConditionRule[];
  trueStepId?: string;
  falseStepId?: string;
}

export interface RandomizerBranch {
  id: string;
  label?: string;
  weight: number;
  nextStepId?: string;
  handleId?: string;
}

export interface RandomizerConfig {
  branches: RandomizerBranch[];
}

export interface SaveVariableConfig {
  scope: "flow" | "contact";
  /** Legado: chave textual. */
  key?: string;
  /** Novo: referência tipada a Lead Field (standard ou custom). */
  field?: LeadFieldReference;
  value: string;
  nextStepId?: string;
}

export interface HttpRequestConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  url: string;
  headers?: Array<{ key: string; value: string }>;
  bodyType?: "none" | "json" | "text" | "form-urlencoded";
  body?: string;
  timeoutMs?: number;
  responseMappings?: Array<{ path: string; variable: string }>;
  successStepId?: string;
  errorStepId?: string;
}

export interface DelayConfig {
  duration: number;
  unit: "seconds" | "minutes" | "hours";
  nextStepId?: string;
}

/**
 * Normaliza e resolve placeholders no formato {{variable_name}}, {{contact.name}}, {{variables.foo}}, etc.
 */
export function resolveTemplate(template: string, ctx: BotFlowExecutionContext): string {
  if (!template || typeof template !== "string") return "";

  return template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, expression) => {
    const expr = expression.trim();

    if (expr === "contact.name") return ctx.contact.name || "";
    if (expr === "contact.phone") return ctx.contact.phone_e164 || ctx.contact.phone || "";
    if (expr === "contact.phone_e164") return ctx.contact.phone_e164 || ctx.contact.phone || "";
    if (expr === "contact.whatsapp_number") return ctx.contact.whatsapp_number || "";
    if (expr === "contact.email") return ctx.contact.email || "";
    if (expr === "contact.company") return ctx.contact.company || "";
    if (expr === "contact.position") return ctx.contact.position || "";
    if (expr === "contact.notes") return ctx.contact.notes || "";
    if (expr === "contact.responsible_user_id") return ctx.contact.responsible_user_id || "";
    if (expr.startsWith("contact.custom_fields.")) {
      const fieldKey = expr.replace("contact.custom_fields.", "");
      return ctx.contact.customFields?.[fieldKey] != null
        ? String(ctx.contact.customFields[fieldKey])
        : "";
    }
    // Novo: contact.<key> resolve primeiro campos padrão, depois custom fields.
    if (expr.startsWith("contact.")) {
      const fieldKey = expr.replace("contact.", "").trim();
      if (fieldKey) {
        const standard = (ctx.contact as Record<string, unknown>)[fieldKey];
        if (standard != null) return String(standard);
        const custom = ctx.contact.customFields?.[fieldKey];
        if (custom != null) return String(custom);
      }
    }
    // Alias lead.<key> também suportado.
    if (expr.startsWith("lead.")) {
      const fieldKey = expr.replace("lead.", "").trim();
      if (fieldKey) {
        const standard = (ctx.contact as Record<string, unknown>)[fieldKey];
        if (standard != null) return String(standard);
        const custom = ctx.contact.customFields?.[fieldKey];
        if (custom != null) return String(custom);
      }
    }
    // Fallback por chave solta: primeiro variables, depois contact custom fields.
    if (ctx.variables && ctx.variables[expr] === undefined && ctx.contact.customFields?.[expr] != null) {
      return String(ctx.contact.customFields[expr]);
    }

    if (expr === "message.text" || expr === "message.body") return ctx.message.text || "";
    if (expr === "message.type") return ctx.message.type || "";
    if (expr === "channel") return ctx.channel || "";

    if (expr === "http.response" || expr === "http_response") {
      return typeof ctx.httpResponse === "object"
        ? JSON.stringify(ctx.httpResponse)
        : String(ctx.httpResponse ?? "");
    }
    if (expr.startsWith("http.response.") || expr.startsWith("http_response.")) {
      const jsonPath = expr.replace(/^http(\.response|_response)\./, "");
      const val = getNestedValue(ctx.httpResponse, jsonPath);
      return val != null ? (typeof val === "object" ? JSON.stringify(val) : String(val)) : "";
    }

    if (expr.startsWith("variables.")) {
      const varKey = expr.replace("variables.", "");
      const val = getNestedValue(ctx.variables, varKey);
      return val != null ? (typeof val === "object" ? JSON.stringify(val) : String(val)) : "";
    }

    // Fallback: busca direta em variables ou ctx
    if (ctx.variables && ctx.variables[expr] !== undefined) {
      const val = ctx.variables[expr];
      return val != null ? (typeof val === "object" ? JSON.stringify(val) : String(val)) : "";
    }

    return "";
  });
}

function getNestedValue(obj: any, path: string): any {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean);
  let curr = obj;
  for (const part of parts) {
    if (curr == null) return undefined;
    curr = curr[part];
  }
  return curr;
}

async function readResponseTextCapped(response: Response, maxBytes: number): Promise<string> {
  const reader = (response.body as any)?.getReader?.();
  if (!reader) {
    const buf = await response.arrayBuffer();
    if (buf.byteLength > maxBytes) {
      throw new Error("Corpo da resposta HTTP excedeu o limite seguro de 1MB.");
    }
    return Buffer.from(buf).toString("utf-8");
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) {
      throw new Error("Corpo da resposta HTTP excedeu o limite seguro de 1MB.");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
}

function compareText(left: string, right: string, op: string): boolean {
  const l = left.toLowerCase();
  const r = right.toLowerCase();
  switch (op) {
    case "equals":
      return l === r;
    case "not_equals":
      return l !== r;
    case "contains":
      return l.includes(r);
    case "not_contains":
      return !l.includes(r);
    case "starts_with":
      return l.startsWith(r);
    case "ends_with":
      return l.endsWith(r);
    case "is_empty":
    case "not_exists":
      return left.trim().length === 0;
    case "is_not_empty":
    case "exists":
    case "not_empty":
      return left.trim().length > 0;
    default:
      return false;
  }
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return isNaN(value) ? null : value;
  if (typeof value === "string") {
    const cleaned = value.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }
  return null;
}

function compareNumbers(left: number, right: number, op: string): boolean {
  switch (op) {
    case "equals":
      return left === right;
    case "not_equals":
      return left !== right;
    case "greater_than":
      return left > right;
    case "greater_or_equal":
      return left >= right;
    case "less_than":
      return left < right;
    case "less_or_equal":
      return left <= right;
    default:
      return false;
  }
}

function compareDates(left: Date, right: Date, op: string): boolean {
  const l = left.getTime();
  const r = right.getTime();
  switch (op) {
    case "equals":
    case "not_equals":
      return op === "equals" ? l === r : l !== r;
    case "before":
      return l < r;
    case "after":
      return l > r;
    default:
      return false;
  }
}

function coerceRightValue(value: unknown, type: string): unknown {
  if (value === null || value === undefined) return null;
  const s = typeof value === "string" ? value.trim() : String(value);
  if (s === "" || s.toLowerCase() === "null") return null;
  switch (type) {
    case "number":
    case "currency":
      return parseNumber(s);
    case "boolean": {
      const lower = s.toLowerCase();
      if (lower === "true" || lower === "1" || lower === "sim") return true;
      if (lower === "false" || lower === "0" || lower === "nao" || lower === "não") return false;
      return null;
    }
    case "date":
    case "datetime": {
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d;
    }
    case "multi_select": {
      try {
        const parsed = JSON.parse(s);
        return Array.isArray(parsed) ? parsed : [s];
      } catch {
        return [s];
      }
    }
    default:
      return s;
  }
}

async function evaluateTypedCondition(
  rule: ConditionRule,
  ctx: BotFlowExecutionContext,
): Promise<boolean> {
  if (!rule.field || !ctx.contact.id) return false;

  const def =
    ctx.leadFieldDefinitions?.[`${rule.field.kind}:${rule.field.field}`] ??
    (await getLeadFieldDefinition(ctx.tenantId, rule.field));
  if (!def) {
    throw new Error(`LEAD_FIELD_UNAVAILABLE: Campo não encontrado (${rule.field.kind}:${rule.field.field})`);
  }

  if (!isOperatorValidForType(def.type, rule.operator)) {
    throw new Error(
      `LEAD_FIELD_INVALID_OPERATOR: Operador '${rule.operator}' inválido para o tipo '${def.type}'`,
    );
  }

  const rawLeft = await getLeadFieldValue(ctx.tenantId, ctx.contact.id, rule.field);

  if (rule.operator === "is_empty" || rule.operator === "is_not_empty") {
    return rule.operator === "is_empty" ? isEmptyValue(rawLeft) : !isEmptyValue(rawLeft);
  }

  let rawRight: unknown = rule.value;
  if (typeof rawRight === "string") {
    rawRight = resolveTemplate(rawRight, ctx);
  }
  if ((rawRight === undefined || rawRight === null || rawRight === "") && rule.right) {
    rawRight = resolveTemplate(rule.right, ctx);
  }

  const right = coerceRightValue(rawRight, def.type);

  switch (def.type) {
    case "text":
    case "textarea":
    case "email":
    case "phone":
    case "url":
    case "select": {
      const left = String(rawLeft ?? "");
      const rightStr = String(right ?? "");
      return compareText(left, rightStr, rule.operator);
    }
    case "number":
    case "currency": {
      const leftNum = parseNumber(rawLeft);
      const rightNum = typeof right === "number" ? right : parseNumber(right);
      if (leftNum === null || rightNum === null) {
        return ["is_empty", "not_exists"].includes(rule.operator) || rule.operator === "not_equals";
      }
      return compareNumbers(leftNum, rightNum, rule.operator);
    }
    case "boolean": {
      const leftBool = rawLeft === true || rawLeft === "true" || rawLeft === 1 || rawLeft === "1";
      const rightBool = right === true;
      if (rule.operator === "is_true") return leftBool;
      if (rule.operator === "is_false") return !leftBool;
      return false;
    }
    case "multi_select": {
      const leftArr = Array.isArray(rawLeft) ? rawLeft : rawLeft ? [String(rawLeft)] : [];
      const rightArr = Array.isArray(right) ? right : right ? [String(right)] : [];
      const has = rightArr.some((r) =>
        leftArr.some((l) => String(l).toLowerCase() === String(r).toLowerCase()),
      );
      return rule.operator === "contains" ? has : !has;
    }
    case "date":
    case "datetime": {
      const leftDate = rawLeft instanceof Date ? rawLeft : new Date(String(rawLeft));
      const rightDate = right instanceof Date ? right : new Date(String(right));
      if (isNaN(leftDate.getTime()) || isNaN(rightDate.getTime())) return false;
      return compareDates(leftDate, rightDate, rule.operator);
    }
    default:
      return compareText(String(rawLeft ?? ""), String(right ?? ""), rule.operator);
  }
}

/**
 * Avalia regras de condição do bloco condition.
 * Suporta regras legadas (left/right strings) e regras tipadas (field/value).
 */
export async function evaluateCondition(
  config: ConditionConfig,
  ctx: BotFlowExecutionContext,
): Promise<boolean> {
  const rules = config?.rules || [];
  if (rules.length === 0) return true;

  const logic = (config.logic || "AND").toUpperCase();

  const results: boolean[] = [];
  for (const rule of rules) {
    if (rule.field) {
      results.push(await evaluateTypedCondition(rule, ctx));
    } else {
      const leftVal = resolveTemplate(rule.left || "", ctx);
      const rightVal = resolveTemplate(rule.right || "", ctx);
      const op = rule.operator;

      switch (op) {
        case "equals":
          results.push(leftVal.toLowerCase() === rightVal.toLowerCase());
          break;
        case "not_equals":
          results.push(leftVal.toLowerCase() !== rightVal.toLowerCase());
          break;
        case "contains":
          results.push(leftVal.toLowerCase().includes(rightVal.toLowerCase()));
          break;
        case "not_contains":
          results.push(!leftVal.toLowerCase().includes(rightVal.toLowerCase()));
          break;
        case "starts_with":
          results.push(leftVal.toLowerCase().startsWith(rightVal.toLowerCase()));
          break;
        case "ends_with":
          results.push(leftVal.toLowerCase().endsWith(rightVal.toLowerCase()));
          break;
        case "exists":
        case "not_empty":
        case "is_not_empty":
          results.push(leftVal.trim().length > 0);
          break;
        case "not_exists":
        case "is_empty":
          results.push(leftVal.trim().length === 0);
          break;
        case "greater_than": {
          const nL = parseFloat(leftVal);
          const nR = parseFloat(rightVal);
          results.push(!isNaN(nL) && !isNaN(nR) && nL > nR);
          break;
        }
        case "greater_or_equal": {
          const nL = parseFloat(leftVal);
          const nR = parseFloat(rightVal);
          results.push(!isNaN(nL) && !isNaN(nR) && nL >= nR);
          break;
        }
        case "less_than": {
          const nL = parseFloat(leftVal);
          const nR = parseFloat(rightVal);
          results.push(!isNaN(nL) && !isNaN(nR) && nL < nR);
          break;
        }
        case "less_or_equal": {
          const nL = parseFloat(leftVal);
          const nR = parseFloat(rightVal);
          results.push(!isNaN(nL) && !isNaN(nR) && nL <= nR);
          break;
        }
        case "in": {
          const items = rightVal
            .split(/[,;\n]/)
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
          results.push(items.includes(leftVal.toLowerCase()));
          break;
        }
        case "not_in": {
          const items = rightVal
            .split(/[,;\n]/)
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean);
          results.push(!items.includes(leftVal.toLowerCase()));
          break;
        }
        default:
          results.push(false);
      }
    }
  }

  if (logic === "OR") {
    return results.some(Boolean);
  }
  return results.every(Boolean);
}

/**
 * Avalia o bloco randomizer com hashing determinístico para idempotência em retries
 */
export function evaluateRandomizer(
  config: RandomizerConfig,
  ctx: BotFlowExecutionContext,
): { branchId?: string; nextStepId?: string } {
  const branches = config?.branches || [];
  if (branches.length === 0) return {};

  // Normaliza pesos
  let totalWeight = 0;
  for (const b of branches) {
    totalWeight += Math.max(0, Number(b.weight) || 0);
  }
  if (totalWeight === 0) {
    return { branchId: branches[0].id, nextStepId: branches[0].nextStepId };
  }

  // Hash determinístico: hash(tenantId + phone + flowId + stepId)
  const hashSeed = `${ctx.tenantId || ""}:${ctx.contact.phone || ""}:${ctx.flowId || ""}:${ctx.stepId || ""}`;
  const md5Hash = crypto.createHash("md5").update(hashSeed).digest("hex");
  const numValue = parseInt(md5Hash.slice(0, 8), 16);
  const pickedValue = numValue % totalWeight; // 0 .. totalWeight - 1

  let cumulative = 0;
  for (const branch of branches) {
    cumulative += Math.max(0, Number(branch.weight) || 0);
    if (pickedValue < cumulative) {
      return { branchId: branch.id, nextStepId: branch.nextStepId };
    }
  }

  return {
    branchId: branches[branches.length - 1].id,
    nextStepId: branches[branches.length - 1].nextStepId,
  };
}

/**
 * Proteção SSRF: Valida URL e endereços IP resolvidos
 */
export async function validateSafeUrlForSSRF(rawUrl: string): Promise<string> {
  const urlObj = new URL(rawUrl);
  if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
    throw new Error(`Protocolo inseguro ou inválido: ${urlObj.protocol}`);
  }

  const hostname = urlObj.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::" ||
    hostname === "::1" ||
    hostname === "169.254.169.254" || // Metadata AWS / GCP
    hostname === "metadata.google.internal"
  ) {
    throw new Error(`Acesso proibido a endereços locais ou de metadados: ${hostname}`);
  }

  // Resolve DNS e valida faixas de IP privadas ou reservadas
  try {
    const lookupResults = await dns.promises.lookup(hostname, { all: true });
    for (const record of lookupResults) {
      const parsedIp = ipaddr.parse(record.address);
      const range = parsedIp.range();
      const blockedRanges = new Set([
        "private",
        "loopback",
        "linkLocal",
        "uniqueLocal",
        "reserved",
        "broadcast",
        "carrierGradeNat",
        "unspecified",
        "multicast",
        "benchmark",
        "testNet",
        "documentation",
      ]);
      if (blockedRanges.has(range)) {
        throw new Error(
          `O endereço resolvido (${record.address}) pertence à faixa privada/restrita.`,
        );
      }
    }
  } catch (err: any) {
    if (err.message.includes("restrita") || err.message.includes("Acesso proibido")) {
      throw err;
    }
    // Erro de resolução DNS
    throw new Error(`Falha na resolução de DNS para ${hostname}: ${err.message}`);
  }

  return urlObj.toString();
}

/**
 * Executa requisição HTTP externa com proteção SSRF, limite de tamanho e mapeamento de variáveis
 */
export async function executeHttpRequest(
  config: HttpRequestConfig,
  ctx: BotFlowExecutionContext,
): Promise<{
  success: boolean;
  nextStepId?: string;
  status?: number;
  data?: any;
  error?: string;
}> {
  try {
    const resolvedUrl = resolveTemplate(config.url || "", ctx).trim();
    if (!resolvedUrl) throw new Error("URL da requisição HTTP não informada.");

    const safeUrl = await validateSafeUrlForSSRF(resolvedUrl);

    const headers: Record<string, string> = {
      "User-Agent": "Bliv-BotFlow/1.0",
    };

    if (Array.isArray(config.headers)) {
      for (const h of config.headers) {
        if (h.key && h.key.trim()) {
          const key = h.key.trim().replace(/[\r\n\0]/g, "");
          const rawValue = resolveTemplate(h.value || "", ctx);
          const value = rawValue.replace(/[\r\n\0]/g, "");
          if (key) headers[key] = value;
        }
      }
    }

    let requestBody: any = undefined;
    const bodyType = config.bodyType || "none";
    if (bodyType === "json" && config.body) {
      const resolvedBodyStr = resolveTemplate(config.body, ctx);
      try {
        requestBody = JSON.stringify(JSON.parse(resolvedBodyStr));
        if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
      } catch {
        throw new Error("Corpo JSON inválido após resolução de templates.");
      }
    } else if (bodyType === "form-urlencoded" && config.body) {
      requestBody = resolveTemplate(config.body, ctx);
      if (!headers["Content-Type"]) headers["Content-Type"] = "application/x-www-form-urlencoded";
    } else if (bodyType === "text" && config.body) {
      requestBody = resolveTemplate(config.body, ctx);
      if (!headers["Content-Type"]) headers["Content-Type"] = "text/plain";
    }

    const timeout = Math.min(Math.max(1000, Number(config.timeoutMs) || 10000), 30000);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const method = (config.method || "GET").toUpperCase();

    // Segue redirecionamentos manualmente, re-validando cada destino
    let currentUrl = safeUrl;
    let redirectCount = 0;
    const MAX_REDIRECTS = 5;
    let response: Response;
    while (true) {
      response = await fetch(currentUrl, {
        method,
        headers,
        body: ["GET", "HEAD"].includes(method) ? undefined : requestBody,
        signal: controller.signal,
        redirect: "manual",
      });
      if (response.status < 300 || response.status >= 400) break;
      if (++redirectCount > MAX_REDIRECTS) {
        throw new Error("Limite de redirecionamentos excedido.");
      }
      const location = response.headers.get("Location");
      if (!location) {
        throw new Error("Redirecionamento sem header Location.");
      }
      currentUrl = await validateSafeUrlForSSRF(new URL(location, currentUrl).toString());
    }

    clearTimeout(timer);

    const contentType = response.headers.get("content-type") || "";
    let responseData: any = null;

    // Limite de 1MB no corpo de resposta, lendo via stream para evitar buffer gigante
    const MAX_BODY = 1024 * 1024;
    const textBuffer = await readResponseTextCapped(response, MAX_BODY);

    if (contentType.includes("application/json")) {
      try {
        responseData = JSON.parse(textBuffer);
      } catch {
        responseData = textBuffer;
      }
    } else {
      responseData = textBuffer;
    }

    // Salva na resposta do contexto
    ctx.httpResponse = responseData;

    // Executa responseMappings se houver
    if (Array.isArray(config.responseMappings)) {
      for (const mapping of config.responseMappings) {
        if (mapping.variable && mapping.path) {
          const varKey = mapping.variable.trim();
          const mappedValue = getNestedValue(responseData, mapping.path.trim());
          if (varKey && mappedValue !== undefined) {
            ctx.variables[varKey] = mappedValue;
          }
        }
      }
    }

    const isSuccess = response.status >= 200 && response.status < 300;
    const nextStepId = isSuccess ? config.successStepId : config.errorStepId;

    return {
      success: isSuccess,
      nextStepId: nextStepId || undefined,
      status: response.status,
      data: responseData,
    };
  } catch (err: any) {
    const errorMessage =
      err.name === "AbortError" ? "Timeout de requisição HTTP excedido" : err.message;
    return {
      success: false,
      nextStepId: config.errorStepId || undefined,
      error: errorMessage,
    };
  }
}

/**
 * Salva variável em escopo de fluxo (context.variables) ou contato (contacts).
 *
 * Suporta:
 * - Novo contrato tipado `config.field` (LeadFieldReference)
 * - Legado `config.key` (string) preservado para flows antigos
 */
export async function executeSaveVariable(
  config: SaveVariableConfig,
  ctx: BotFlowExecutionContext,
  db: DbInterface,
): Promise<{ nextStepId?: string }> {
  const value = resolveTemplate(config.value || "", ctx);
  const variableKey = config.key ? config.key.trim() : config.field ? config.field.field : "";

  if (!config?.key && !config?.field) return { nextStepId: config?.nextStepId };

  if (config.scope === "contact" && ctx.contact.id) {
    if (config.field) {
      // Novo contrato tipado: Lead Field Service (standard ou custom).
      const merged = await setLeadFieldValue(ctx.tenantId, ctx.contact.id, config.field, value);
      for (const [k, v] of Object.entries(merged)) {
        if (v !== undefined && v !== null) {
          (ctx.contact as Record<string, unknown>)[k] = v;
          if (ctx.contact.customFields && !(k in ctx.contact)) {
            ctx.contact.customFields[k] = v;
          }
        }
      }
    } else if (config.key) {
      const key = config.key.trim();
      // Legado: mantém comportamento da Fase 3B.
      const standardFields = ["name", "email", "company", "notes"];

      if (standardFields.includes(key)) {
        await db.query(
          `UPDATE contacts SET ${key} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?`,
          [value, ctx.contact.id, ctx.tenantId],
        );
        (ctx.contact as Record<string, unknown>)[key] = value;
      } else {
        try {
          const merged = await setContactFieldValues(ctx.tenantId, ctx.contact.id, [{ key, value }]);
          ctx.contact.customFields = { ...ctx.contact.customFields, ...merged };
        } catch (err: unknown) {
          const message = (err as Error).message || "";
          if (!message.includes("não encontrada")) {
            throw err;
          }

          const contactRows = (await db.query(
            "SELECT custom_fields FROM contacts WHERE id = ? AND tenant_id = ? LIMIT 1",
            [ctx.contact.id, ctx.tenantId],
          )) as Array<{ custom_fields: string | Record<string, unknown> | null }>;

          const contact = contactRows?.[0];
          const json =
            contact && typeof contact.custom_fields === "string"
              ? JSON.parse(contact.custom_fields)
              : contact?.custom_fields || {};

          if (json[key] === undefined) {
            throw new Error(
              `Chave de variável inválida: '${key}'. Crie uma definição de campo customizado ou use uma variável de fluxo.`,
            );
          }

          console.warn(
            `[LEGACY_COMPATIBILITY_ONLY] Bot escreveu chave desconhecida '${key}' no contato ${ctx.contact.id}.`,
          );

          const payload = JSON.stringify({ [key]: value });
          await db.query(
            `UPDATE contacts
             SET custom_fields = JSON_MERGE_PATCH(COALESCE(custom_fields, '{}'), CAST(? AS JSON)),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND tenant_id = ?`,
            [payload, ctx.contact.id, ctx.tenantId],
          );
          const customFields = ctx.contact.customFields || {};
          customFields[key] = value;
          ctx.contact.customFields = customFields;
        }
      }
    }
  }

  if (variableKey) {
    ctx.variables[variableKey] = value;
  }

  return { nextStepId: config.nextStepId };
}
