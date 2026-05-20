import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function NativeSelect({
  className,
  children,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div
      data-slot="native-select-wrapper"
      className={cn(
        "relative inline-flex w-full items-center",
        "[&>select]:appearance-none [&>select]:pr-8",
      )}
    >
      <select
        data-slot="native-select"
        className={cn(
          "border-input bg-background dark:bg-input/30 text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-3 size-4 opacity-50" />
    </div>
  );
}

export { NativeSelect };
