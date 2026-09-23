export type PageHeaderSnapshot = {
  ownerId: string;
  pathname: string;
  title?: string;
  subtitle?: string;
};

export function headerHasContent(entry: Pick<PageHeaderSnapshot, "title" | "subtitle"> | null) {
  return Boolean(entry?.title || entry?.subtitle);
}

export function resolveVisibleHeader(
  entry: PageHeaderSnapshot | null,
  pathname: string,
): PageHeaderSnapshot | null {
  if (!entry) return null;
  if (entry.pathname !== pathname) return null;
  if (!headerHasContent(entry)) return null;
  return entry;
}

export function clearPageHeaderIfOwner(
  current: PageHeaderSnapshot | null,
  ownerId: string,
): PageHeaderSnapshot | null {
  if (!current || current.ownerId !== ownerId) return current;
  return null;
}

export function dropHeaderIfPathChanged(
  current: PageHeaderSnapshot | null,
  pathname: string,
): PageHeaderSnapshot | null {
  if (!current || current.pathname === pathname) return current;
  return null;
}
