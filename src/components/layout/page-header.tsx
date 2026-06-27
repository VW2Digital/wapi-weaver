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
    <div className="flex flex-col gap-2 md:gap-4 border-b border-border/40 bg-card/85 backdrop-blur-md px-6 py-4 md:py-5 md:flex-row md:items-center md:justify-between shrink-0 sticky top-0 z-10">
      <div className="flex items-center justify-between gap-4 w-full md:w-auto min-w-0">
        {(title || subtitle) && (
          <div className="min-w-0">
            {title && <h1 className="font-display text-xl md:text-2xl font-semibold tracking-tight truncate">{title}</h1>}
            {subtitle && <p className="mt-1 text-xs md:text-sm text-muted-foreground hidden md:block">{subtitle}</p>}
          </div>
        )}
        {/* Mobile Action Trigger */}
        {action && <div className="flex md:hidden shrink-0 items-center gap-2">{action}</div>}
      </div>
      {subtitle && <p className="text-xs text-muted-foreground block md:hidden mt-0">{subtitle}</p>}
      {/* Desktop Actions Wrapper */}
      {action && <div className="hidden md:flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
