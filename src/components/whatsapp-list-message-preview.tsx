import { useState } from "react";
import { List } from "lucide-react";

export type WhatsAppListSection = {
  title?: string;
  rows?: Array<{ title?: string; description?: string }>;
};

function listActionLabel(isOpen: boolean, buttonText: string) {
  const trimmed = (buttonText || "").trim() || "Ver opções";
  if (!isOpen) return trimmed;
  const verMatch = trimmed.match(/^ver\s+(.+)$/i);
  if (verMatch) return `Ocultar ${verMatch[1]}`;
  return "Ocultar opções";
}

export function WhatsAppListMessagePreview({
  buttonText,
  sections = [],
}: {
  buttonText?: string;
  sections?: WhatsAppListSection[];
}) {
  const [open, setOpen] = useState(false);
  const label = listActionLabel(open, buttonText || "Ver Recursos");
  const hasRows = sections.some((sec) => (sec.rows || []).length > 0);

  return (
    <div className="nodrag nopan nowheel w-full text-[color:var(--bubble-ink,var(--foreground))]">
      <button
        type="button"
        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold outline-none border-t border-[color:var(--bubble-divider)] text-[color:var(--bubble-action)] hover:bg-[var(--bubble-control)] focus-visible:ring-2 focus-visible:ring-[color:var(--bubble-action)] focus-visible:ring-inset"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <List className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </button>
      {open && (
        <div className="px-2.5 pb-2.5 pt-1.5 space-y-2.5 border-t border-[color:var(--bubble-divider)]">
          {sections.map((section, sectionIndex) => (
            <div key={sectionIndex} className="space-y-1.5">
              {section.title ? (
                <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--bubble-muted-ink,var(--muted-foreground))]">
                  {section.title}
                </p>
              ) : null}
              {(section.rows || []).map((row, rowIndex) => (
                <div
                  key={rowIndex}
                  className="rounded-lg px-2.5 py-2 bg-[var(--bubble-surface)] text-[color:var(--bubble-ink,var(--foreground))] border border-[color:var(--bubble-divider)]"
                >
                  <p className="text-[13px] font-medium leading-tight">
                    {row.title || `Opção ${rowIndex + 1}`}
                  </p>
                  {row.description ? (
                    <p className="mt-0.5 text-[11px] leading-snug text-[color:var(--bubble-muted-ink,var(--muted-foreground))]">
                      {row.description}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ))}
          {!hasRows && (
            <p className="text-[11px] italic px-0.5 text-[color:var(--bubble-muted-ink,var(--muted-foreground))]">
              Sem itens configurados...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
