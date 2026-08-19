/**
 * Utilitário de navegação por dot-notation em objetos aninhados.
 * Substitui o `resolveDotPath` de webhooks.server.ts, adicionando suporte
 * a bracket notation: "data[0].email" é normalizado para "data.0.email".
 */

/**
 * Navega um objeto usando dot notation (e bracket notation).
 *
 * @example
 * getNestedValue({ a: { b: [{ c: 1 }] } }, "a.b[0].c") // → 1
 * getNestedValue({ nome: "João" }, "nome")               // → "João"
 * getNestedValue({}, "a.b.c", "fallback")                // → "fallback"
 */
export function getNestedValue<T = unknown>(
  obj: Record<string, unknown> | null | undefined,
  path: string,
  defaultValue?: T,
): T | undefined {
  if (!obj || !path) return defaultValue;

  // Normaliza bracket notation para dot notation: "data[0].email" → "data.0.email"
  const normalizedPath = path.replace(/\[(\d+)\]/g, ".$1");
  const keys = normalizedPath.split(".").filter(Boolean);

  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) return defaultValue;
    if (Array.isArray(current)) {
      const index = Number(key);
      if (Number.isInteger(index) && index >= 0) {
        current = current[index];
        continue;
      }
      return defaultValue;
    }
    if (typeof current !== "object") {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current !== undefined ? (current as T) : defaultValue;
}

// ---------------------------------------------------------------------------
// Mapeamento de campos (De-Para)
// ---------------------------------------------------------------------------

export interface FieldMapping {
  /** Campo de destino no banco (ex: "email", "name", "phone") */
  targetField: string;
  /** Caminho no payload de origem em dot notation (ex: "fields.user_email.value") */
  sourcePath: string;
}

/**
 * Aplica uma lista de mapeamentos a um `rawPayload`, extraindo os valores
 * via dot notation e montando o objeto resultante.
 *
 * @example
 * mapPayloadToStandardFields(
 *   { fields: { user_email: { value: "joao@ex.com" } } },
 *   [{ targetField: "email", sourcePath: "fields.user_email.value" }]
 * )
 * // → { email: "joao@ex.com" }
 */
export function mapPayloadToStandardFields(
  rawPayload: Record<string, unknown>,
  mappings: FieldMapping[],
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const mapping of mappings) {
    const value = getNestedValue(rawPayload, mapping.sourcePath);
    if (value !== undefined && value !== null) {
      result[mapping.targetField] = value;
    }
  }

  return result;
}
