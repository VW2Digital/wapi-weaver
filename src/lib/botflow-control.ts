import dns from "dns";
import ipaddr from "ipaddr.js";
import crypto from "crypto";

export interface BotFlowExecutionContext {
  tenantId: string;
  userId: string;
  contact: {
    id?: string;
    phone: string;
    name?: string;
    email?: string;
    company?: string;
    notes?: string;
    customFields?: Record<string, any>;
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
}

export interface ConditionRule {
  left: string;
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
    | "not_empty"
    | "greater_than"
    | "greater_or_equal"
    | "less_than"
    | "less_or_equal"
    | "in"
    | "not_in";
  right?: string;
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
  key: string;
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
    if (expr === "contact.phone" || expr === "contact.phone_e164") return ctx.contact.phone || "";
    if (expr === "contact.email") return ctx.contact.email || "";
    if (expr === "contact.company") return ctx.contact.company || "";
    if (expr === "contact.notes") return ctx.contact.notes || "";
    if (expr.startsWith("contact.custom_fields.")) {
      const fieldKey = expr.replace("contact.custom_fields.", "");
      return ctx.contact.customFields?.[fieldKey] != null
        ? String(ctx.contact.customFields[fieldKey])
        : "";
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
  const parts = path.split(".").map((p) => p.trim()).filter(Boolean);
  let curr = obj;
  for (const part of parts) {
    if (curr == null) return undefined;
    curr = curr[part];
  }
  return curr;
}

/**
 * Avalia regras de condição do bloco condition
 */
export function evaluateCondition(config: ConditionConfig, ctx: BotFlowExecutionContext): boolean {
  const rules = config?.rules || [];
  if (rules.length === 0) return true;

  const logic = (config.logic || "AND").toUpperCase();

  const results = rules.map((rule) => {
    const leftVal = resolveTemplate(rule.left || "", ctx);
    const rightVal = resolveTemplate(rule.right || "", ctx);
    const op = rule.operator;

    switch (op) {
      case "equals":
        return leftVal.toLowerCase() === rightVal.toLowerCase();
      case "not_equals":
        return leftVal.toLowerCase() !== rightVal.toLowerCase();
      case "contains":
        return leftVal.toLowerCase().includes(rightVal.toLowerCase());
      case "not_contains":
        return !leftVal.toLowerCase().includes(rightVal.toLowerCase());
      case "starts_with":
        return leftVal.toLowerCase().startsWith(rightVal.toLowerCase());
      case "ends_with":
        return leftVal.toLowerCase().endsWith(rightVal.toLowerCase());
      case "exists":
        return leftVal.trim().length > 0;
      case "not_exists":
        return leftVal.trim().length === 0;
      case "is_empty":
        return leftVal.trim().length === 0;
      case "not_empty":
        return leftVal.trim().length > 0;
      case "greater_than": {
        const nL = parseFloat(leftVal);
        const nR = parseFloat(rightVal);
        return !isNaN(nL) && !isNaN(nR) && nL > nR;
      }
      case "greater_or_equal": {
        const nL = parseFloat(leftVal);
        const nR = parseFloat(rightVal);
        return !isNaN(nL) && !isNaN(nR) && nL >= nR;
      }
      case "less_than": {
        const nL = parseFloat(leftVal);
        const nR = parseFloat(rightVal);
        return !isNaN(nL) && !isNaN(nR) && nL < nR;
      }
      case "less_or_equal": {
        const nL = parseFloat(leftVal);
        const nR = parseFloat(rightVal);
        return !isNaN(nL) && !isNaN(nR) && nL <= nR;
      }
      case "in": {
        const items = rightVal.split(/[,;\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
        return items.includes(leftVal.toLowerCase());
      }
      case "not_in": {
        const items = rightVal.split(/[,;\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean);
        return !items.includes(leftVal.toLowerCase());
      }
      default:
        return false;
    }
  });

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

  return { branchId: branches[branches.length - 1].id, nextStepId: branches[branches.length - 1].nextStepId };
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
    hostname === "::1" ||
    hostname === "169.254.169.254" || // Metadata AWS / GCP
    hostname === "metadata.google.internal"
  ) {
    throw new Error(`Acesso proibido a endereços locais ou de metadados: ${hostname}`);
  }

  // Resolve DNS e valida faixas de IP privadas
  try {
    const lookupResults = await dns.promises.lookup(hostname, { all: true });
    for (const record of lookupResults) {
      const parsedIp = ipaddr.parse(record.address);
      const range = parsedIp.range();
      if (
        range === "private" ||
        range === "loopback" ||
        range === "linkLocal" ||
        range === "uniqueLocal" ||
        range === "reserved" ||
        range === "broadcast" ||
        range === "carrierGradeNat"
      ) {
        throw new Error(`O endereço resolvido (${record.address}) pertence à faixa privada/restrita.`);
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
          headers[h.key.trim()] = resolveTemplate(h.value || "", ctx);
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
        requestBody = resolvedBodyStr;
        if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
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
    const response = await fetch(safeUrl, {
      method,
      headers,
      body: ["GET", "HEAD"].includes(method) ? undefined : requestBody,
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timer);

    const contentType = response.headers.get("content-type") || "";
    let responseData: any = null;

    // Limite de 1MB no corpo de resposta
    const textBuffer = await response.text();
    if (textBuffer.length > 1024 * 1024) {
      throw new Error("Corpo da resposta HTTP excedeu o limite seguro de 1MB.");
    }

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
    const errorMessage = err.name === "AbortError" ? "Timeout de requisição HTTP excedido" : err.message;
    return {
      success: false,
      nextStepId: config.errorStepId || undefined,
      error: errorMessage,
    };
  }
}

/**
 * Salva variável em escopo de fluxo (context.variables) ou contato (contacts)
 */
export async function executeSaveVariable(
  config: SaveVariableConfig,
  ctx: BotFlowExecutionContext,
  db: any,
): Promise<{ nextStepId?: string }> {
  if (!config?.key) return { nextStepId: config?.nextStepId };

  const key = config.key.trim();
  const value = resolveTemplate(config.value || "", ctx);

  if (config.scope === "contact") {
    // Escopo de Contato: atualiza campos permitidos ou custom_fields
    const contactId = ctx.contact.id;
    const standardFields = ["name", "email", "company", "notes"];

    if (contactId && standardFields.includes(key)) {
      await db.query(
        `UPDATE contacts SET ${key} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (tenant_id = ? OR user_id = ?)`,
        [value, contactId, ctx.tenantId, ctx.tenantId],
      );
      (ctx.contact as any)[key] = value;
    } else if (contactId) {
      // Salva dentro do JSON custom_fields
      const rows = (await db.query(
        `SELECT custom_fields FROM contacts WHERE id = ? AND (tenant_id = ? OR user_id = ?) LIMIT 1`,
        [contactId, ctx.tenantId, ctx.tenantId],
      )) as any[];
      let customFields: Record<string, any> = {};
      try {
        const raw = rows[0]?.custom_fields;
        customFields = typeof raw === "string" ? JSON.parse(raw) : raw || {};
      } catch {
        customFields = {};
      }
      customFields[key] = value;
      await db.query(
        `UPDATE contacts SET custom_fields = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (tenant_id = ? OR user_id = ?)`,
        [JSON.stringify(customFields), contactId, ctx.tenantId, ctx.tenantId],
      );
      ctx.contact.customFields = customFields;
    }
  }

  // Também persiste nas variáveis de execução / fluxo
  ctx.variables[key] = value;

  return { nextStepId: config.nextStepId };
}
