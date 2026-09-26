import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

export function SettingsNavSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-1.5 px-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h4>
      <div className="flex flex-col gap-0.5">{children}</div>
    </section>
  );
}

export function SettingsNavItem({
  onClick,
  icon: Icon,
  iconWrapperClassName,
  title,
  description,
  badge,
  active,
}: {
  onClick: () => void;
  icon: ComponentType<{ className?: string }>;
  iconWrapperClassName?: string;
  title: string;
  description: string;
  badge?: ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left transition-colors",
        "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20",
        active && "bg-muted",
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary",
            iconWrapperClassName,
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h5 className="text-sm font-semibold text-foreground">{title}</h5>
            {badge}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
