import {
  ExternalLink,
  Phone,
  Reply,
  FileText,
  Video,
  Copy,
  ShoppingBag,
  LayoutGrid,
  Zap,
  KeyRound,
  PhoneCall,
  MapPin,
} from "lucide-react";

type Button = {
  type: string;
  text?: string;
  url?: string;
  phone_number?: string;
  example?: string[];
  otp_type?: string;
};

type Component = {
  type: string;
  format?: string;
  text?: string;
  example?: { header_handle?: string[]; header_text?: string[] };
  buttons?: Button[];
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
        return (
          <span key={i} className="font-medium">
            {value}
          </span>
        );
      }
      return (
        <span key={i} className="rounded bg-primary/15 px-1 text-primary">
          {p}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export function WhatsAppPreview({
  components,
  variables,
  headerMediaUrl,
}: {
  components: Component[];
  variables?: Record<string, string>;
  headerMediaUrl?: string;
}) {
  const header = components.find((c) => c.type === "HEADER");
  const body = components.find((c) => c.type === "BODY");
  const footer = components.find((c) => c.type === "FOOTER");
  const buttonsBlock = components.find((c) => c.type === "BUTTONS");
  const buttons = buttonsBlock?.buttons ?? [];

  const headerImage =
    header?.format === "IMAGE" ? headerMediaUrl || header.example?.header_handle?.[0] : undefined;

  return (
    <div className="flex flex-col rounded-3xl border border-neutral-200 bg-[#efeae2] dark:bg-[#0b141a] overflow-hidden shadow-lg w-full max-w-[340px] mx-auto select-none font-sans">
      {/* WhatsApp Simulado Header */}
      <div className="flex items-center justify-between bg-[#008069] dark:bg-[#202c33] px-3.5 py-3 text-white">
        <div className="flex items-center gap-2">
          {/* Mock Avatar */}
          <div className="relative h-9 w-9 rounded-full bg-white/20 flex items-center justify-center font-semibold text-sm">
            C
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-[#008069] dark:border-[#202c33]" />
          </div>
          <div>
            <h4 className="text-xs font-semibold leading-tight">Cliente de Teste</h4>
            <span className="text-[10px] text-white/80 leading-none block">online</span>
          </div>
        </div>
        <div className="flex items-center gap-3.5 text-white/90">
          <Video className="h-4.5 w-4.5 cursor-pointer hover:text-white" />
          <Phone className="h-4 w-4 cursor-pointer hover:text-white" />
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 p-3.5 min-h-[280px] flex flex-col justify-end bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat bg-[size:340px]">
        {/* Message Bubble Container */}
        <div className="relative ml-auto max-w-[280px] flex flex-col items-end">
          {/* Main Bubble Card */}
          <div className="relative rounded-2xl rounded-tr-none bg-[#d9fdd3] dark:bg-[#005c4b] p-2.5 text-neutral-900 dark:text-neutral-50 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]">
            {/* Bubble Tail SVG */}
            <div className="absolute top-0 -right-2 text-[#d9fdd3] dark:text-[#005c4b]">
              <svg width="8" height="13" viewBox="0 0 8 13">
                <path
                  d="M1.533 3.568L8 0v13H0S.186 5.86 1.533 3.568z"
                  fill="currentColor"
                />
              </svg>
            </div>

            {headerImage && (
              <img src={headerImage} alt="" className="mb-2 h-32 w-full rounded-lg object-cover shadow-xs" />
            )}
            {header?.format === "VIDEO" && (
              <div className="mb-2 flex h-32 w-full items-center justify-center rounded-lg bg-neutral-200/50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
                {headerMediaUrl ? (
                  <video
                    src={headerMediaUrl}
                    className="h-full w-full rounded-lg object-cover"
                    controls
                  />
                ) : (
                  <Video className="h-8 w-8" />
                )}
              </div>
            )}
            {header?.format === "DOCUMENT" && (
              <div className="mb-2 flex items-center gap-2.5 rounded-lg bg-black/5 dark:bg-white/5 p-2 text-xs text-neutral-700 dark:text-neutral-300">
                <FileText className="h-4.5 w-4.5 text-red-500" />
                <span className="font-medium truncate">Documento Anexado.pdf</span>
              </div>
            )}
            {header?.format === "LOCATION" && (
              <div className="mb-2 flex h-24 w-full items-center justify-center rounded-lg bg-neutral-200/50 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400">
                <MapPin className="h-6 w-6 text-red-500" />
              </div>
            )}
            {header?.format === "TEXT" && header.text && (
              <p className="mb-1 text-sm font-bold text-neutral-900 dark:text-white">
                {renderText(header.text, variables)}
              </p>
            )}
            {body?.text && (
              <p className="whitespace-pre-wrap text-sm leading-snug text-neutral-900 dark:text-neutral-100">
                {renderText(body.text, variables)}
              </p>
            )}
            {footer?.text && (
              <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">{renderText(footer.text, variables)}</p>
            )}

            {/* Time & Double Checkmark */}
            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-neutral-500 dark:text-neutral-400">
              <span>12:34</span>
              <svg viewBox="0 0 16 11" width="16" height="11" className="fill-[#53bdeb] shrink-0">
                <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.057L8.666 9.886 5.434 6.654a.365.365 0 0 0-.516 0l-.391.391a.365.365 0 0 0 0 .516l3.89 3.89a.365.365 0 0 0 .531-.019l6.101-7.608a.365.365 0 0 0-.039-.508zM.201 6.849a.365.365 0 0 0-.057.51l3.89 4.855a.365.365 0 0 0 .571.027l.192-.24a.365.365 0 0 0-.05-.515L1.134 8.213l2.871-2.871a.365.365 0 0 0 0-.516l-.391-.391a.365.365 0 0 0-.516 0L.201 6.849z" />
              </svg>
            </div>
          </div>

          {/* Action Buttons under the bubble (standard WhatsApp format) */}
          {buttons.length > 0 && (
            <div className="w-full mt-1.5 space-y-1.5">
              {buttons.map((b, i) => {
                const label =
                  b.type === "OTP"
                    ? b.text || (b.otp_type === "COPY_CODE" ? "Copiar código" : "Verificar")
                    : b.type === "COPY_CODE"
                      ? `Copiar código${b.example?.[0] ? ` (${b.example[0]})` : ""}`
                      : b.type === "CATALOG"
                        ? b.text || "Ver catálogo"
                        : b.type === "MPM"
                          ? b.text || "Ver produtos"
                          : b.text;
                return (
                  <div
                    key={i}
                    className="flex items-center justify-center gap-2 rounded-xl bg-white dark:bg-[#202c33] py-2.5 px-4 text-xs font-semibold text-[#00a5f4] dark:text-[#53bdeb] shadow-sm cursor-pointer hover:bg-neutral-50 dark:hover:bg-[#2c3943] transition-colors border-t border-neutral-100/50 dark:border-neutral-700/50 w-full"
                  >
                    {b.type === "URL" && <ExternalLink className="h-3.5 w-3.5" />}
                    {b.type === "PHONE_NUMBER" && <Phone className="h-3.5 w-3.5" />}
                    {b.type === "QUICK_REPLY" && <Reply className="h-3.5 w-3.5" />}
                    {b.type === "COPY_CODE" && <Copy className="h-3.5 w-3.5" />}
                    {b.type === "CATALOG" && <ShoppingBag className="h-3.5 w-3.5" />}
                    {b.type === "MPM" && <LayoutGrid className="h-3.5 w-3.5" />}
                    {b.type === "FLOW" && <Zap className="h-3.5 w-3.5" />}
                    {b.type === "OTP" && <KeyRound className="h-3.5 w-3.5" />}
                    {b.type === "VOICE_CALL" && <PhoneCall className="h-3.5 w-3.5" />}
                    <span className="truncate">{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
