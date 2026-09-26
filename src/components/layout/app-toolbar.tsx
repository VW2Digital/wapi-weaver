import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/** Barra de ações compartilhada: filtros à esquerda, primárias à direita. */
export function AppToolbar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="app-toolbar"
      className={cn("flex w-full min-w-0 flex-wrap items-center gap-2", className)}
    >
      {children}
    </div>
  );
}

export function ToolbarGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="toolbar-group"
      className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}
    >
      {children}
    </div>
  );
}

export function ToolbarPrimary({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="toolbar-primary"
      className={cn("ms-auto flex shrink-0 flex-wrap items-center justify-end gap-2", className)}
    >
      {children}
    </div>
  );
}

export function ToolbarSearch({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <Input
      data-slot="toolbar-search"
      className={cn("h-9 w-full min-w-40 max-w-sm", className)}
      {...props}
    />
  );
}

export function PageTabs({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="page-tabs"
      role="tablist"
      className={cn(
        "inline-flex w-full max-w-lg items-center rounded-2xl bg-muted p-[3px] text-muted-foreground sm:w-fit",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageTab({
  active,
  children,
  className,
  ...props
}: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-slot="page-tab"
      className={cn(
        "h-8 flex-1 rounded-xl px-3 text-xs font-medium whitespace-nowrap transition-colors sm:flex-none",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20 outline-none",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
