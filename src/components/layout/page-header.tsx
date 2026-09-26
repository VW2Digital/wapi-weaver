import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header
      data-slot="page-header"
      className="sticky top-0 z-10 shrink-0 border-b border-border bg-card/90 backdrop-blur-md"
    >
      <div className="flex w-full min-w-0 flex-col gap-3 px-4 py-3 sm:px-6 sm:py-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
        {(title || subtitle) && (
          <div className="min-w-0 flex-1">
            {title && (
              <h1 className="font-display text-xl font-semibold tracking-tight truncate sm:text-2xl">
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
            )}
          </div>
        )}
        {action && (
          <div className="flex w-full min-w-0 lg:w-auto lg:max-w-xl lg:justify-end">
            {action}
          </div>
        )}
      </div>
    </header>
  );
}
