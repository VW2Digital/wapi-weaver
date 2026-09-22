import { normalizeNavigationOrder } from "./navigation-registry";

type Query = <T = unknown>(sql: string, params?: unknown[]) => Promise<T>;

export type SidebarOrderSnapshot = {
  order: string[];
  version: number;
  updatedAt: string | null;
};

export class SidebarOrderConflictError extends Error {
  constructor() {
    super(
      "Conflito de edição: outro administrador alterou a ordem. Recarregue os dados antes de salvar novamente.",
    );
    this.name = "SidebarOrderConflictError";
  }
}

function decodeSidebarOrder(value: string | null | undefined) {
  if (!value) return { order: normalizeNavigationOrder(null), version: 0 };
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "order" in parsed &&
      "version" in parsed &&
      typeof (parsed as { version?: unknown }).version === "number"
    ) {
      return {
        order: normalizeNavigationOrder((parsed as { order: unknown }).order),
        version: (parsed as { version: number }).version,
      };
    }
  } catch {
    // Legacy values are normalized below.
  }
  return { order: normalizeNavigationOrder(value), version: 0 };
}

export async function readGlobalSidebarOrder(query: Query): Promise<SidebarOrderSnapshot> {
  const rows = await query<
    Array<{
      sidebar_order: string | null;
      updated_at: string;
    }>
  >(
    `SELECT sidebar_order, updated_at
     FROM platform_settings
     WHERE id = 1
     LIMIT 1`,
  );
  const row = rows[0];
  const decoded = decodeSidebarOrder(row?.sidebar_order);
  return {
    order: decoded.order,
    version: decoded.version,
    updatedAt: row?.updated_at || null,
  };
}

export async function persistGlobalSidebarOrder(
  query: Query,
  options: {
    order: string[];
    expectedVersion: number;
    updatedBy: string;
  },
): Promise<SidebarOrderSnapshot> {
  const rows = await query<Array<{ sidebar_order: string | null }>>(
    "SELECT sidebar_order FROM platform_settings WHERE id = 1 LIMIT 1",
  );
  const currentRaw = rows[0]?.sidebar_order ?? null;
  const current = decodeSidebarOrder(currentRaw);
  if (current.version !== options.expectedVersion) throw new SidebarOrderConflictError();

  const nextVersion = current.version + 1;
  const encoded = JSON.stringify({ version: nextVersion, order: options.order });
  const result = await query<{ affectedRows?: number }>(
    `UPDATE platform_settings
     SET sidebar_order = ?,
         updated_at = NOW(),
         updated_by = ?
     WHERE id = 1 AND sidebar_order <=> ?`,
    [encoded, options.updatedBy, currentRaw],
  );
  if (result.affectedRows !== 1) throw new SidebarOrderConflictError();
  return {
    order: options.order,
    version: nextVersion,
    updatedAt: new Date().toISOString(),
  };
}
