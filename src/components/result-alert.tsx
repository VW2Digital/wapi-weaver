import { useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import { toFriendlyError, type FriendlyError } from "@/lib/meta-errors";
import { cn } from "@/lib/utils";

type Props = {
  ok: boolean;
  // Para sucesso
  successContent?: React.ReactNode;
  // Para erro
  error?: unknown;
  details?: unknown;
  fallback?: string;
};

export function ResultAlert({ ok, successContent, error, details, fallback }: Props) {
  const [open, setOpen] = useState(false);

  if (ok) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-sm">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        <div className="min-w-0 flex-1">{successContent}</div>
      </div>
    );
  }

  const friendly: FriendlyError = toFriendlyError(details ?? error, fallback);
  const hasTech = Boolean(details) || friendly.code || friendly.trace;

  return (
    <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="font-medium text-destructive">{friendly.title}</div>
          <p className="text-foreground/80">{friendly.message}</p>
          {friendly.hint && (
            <p className="text-xs text-muted-foreground">💡 {friendly.hint}</p>
          )}
          {(friendly.code || friendly.type) && (
            <div className="flex flex-wrap gap-1.5 pt-1 text-[10px]">
              {friendly.code !== undefined && (
                <span className="rounded bg-destructive/15 px-1.5 py-0.5 font-mono text-destructive">
                  código {String(friendly.code)}
                </span>
              )}
              {friendly.type && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">
                  {friendly.type}
                </span>
              )}
            </div>
          )}
          {hasTech && Boolean(details) && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Detalhes técnicos
            </button>
          )}
          {open && Boolean(details) && (
            <pre className={cn("mt-1 max-h-48 overflow-auto rounded bg-background/60 p-2 text-[11px] leading-relaxed")}>
              {JSON.stringify(details, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
