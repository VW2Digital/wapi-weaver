import { ExternalLink, Phone, Reply, FileText, Video } from "lucide-react";

type Component = {
  type: string;
  format?: string;
  text?: string;
  example?: { header_handle?: string[] };
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
};

function renderText(s?: string, vars?: Record<string, string>) {
  if (!s) return null;
  const parts = s.split(/(\{\{[^}]+\}\})/g);
  return parts.map((p, i) => {
    const m = p.match(/^\{\{([^}]+)\}\}$/);
    if (m) {
      const key = m[1].trim();
      const value = vars?.[key];
      if (value) {
        return <span key={i} className="font-medium">{value}</span>;
      }
      return <span key={i} className="rounded bg-primary/15 px-1 text-primary">{p}</span>;
    }
    return <span key={i}>{p}</span>;
  });
}

export function WhatsAppPreview({
  components,
  variables,
}: {
  components: Component[];
  variables?: Record<string, string>;
}) {
  const header = components.find((c) => c.type === "HEADER");
  const body = components.find((c) => c.type === "BODY");
  const footer = components.find((c) => c.type === "FOOTER");
  const buttonsBlock = components.find((c) => c.type === "BUTTONS");
  const buttons = buttonsBlock?.buttons ?? [];

  const headerImage =
    header?.format === "IMAGE" ? header.example?.header_handle?.[0] : undefined;

  return (
    <div className="rounded-2xl bg-[#e5ddd5] p-4">
      <div className="relative ml-auto max-w-[300px] rounded-lg rounded-tr-none bg-white p-2 shadow-sm">
        {headerImage && (
          <img
            src={headerImage}
            alt=""
            className="mb-2 h-32 w-full rounded-md object-cover"
          />
        )}
        {header?.format === "VIDEO" && (
          <div className="mb-2 flex h-32 w-full items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Video className="h-8 w-8" />
          </div>
        )}
        {header?.format === "DOCUMENT" && (
          <div className="mb-2 flex items-center gap-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">
            <FileText className="h-4 w-4" /> Documento anexado
          </div>
        )}
        {header?.format === "TEXT" && header.text && (
          <p className="mb-1 text-sm font-semibold text-foreground">
            {renderText(header.text)}
          </p>
        )}
        {body?.text && (
          <p className="whitespace-pre-wrap text-sm leading-snug text-foreground">
            {renderText(body.text)}
          </p>
        )}
        {footer?.text && (
          <p className="mt-1 text-[11px] text-muted-foreground">{renderText(footer.text)}</p>
        )}
        <p className="mt-1 text-right text-[10px] text-muted-foreground">12:34</p>
      </div>

      {buttons.length > 0 && (
        <div className="ml-auto mt-1 max-w-[300px] space-y-1">
          {buttons.map((b, i) => (
            <div
              key={i}
              className="flex items-center justify-center gap-2 rounded-lg bg-white py-2 text-sm font-medium text-[#00a5f4] shadow-sm"
            >
              {b.type === "URL" && <ExternalLink className="h-3.5 w-3.5" />}
              {b.type === "PHONE_NUMBER" && <Phone className="h-3.5 w-3.5" />}
              {b.type === "QUICK_REPLY" && <Reply className="h-3.5 w-3.5" />}
              <span>{b.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
