export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b bg-card px-6 py-5 lg:flex-row lg:items-center lg:justify-between shrink-0">
      {(title || subtitle) && (
        <div className="min-w-0">
          {title && <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>}
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
