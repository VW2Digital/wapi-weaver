import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { extractHttpUrls } from "@/lib/chat-linkify";
import type { LinkPreviewPayload } from "@/lib/chat-linkify";
import { cn } from "@/lib/utils";

function PreviewCard({ url }: { url: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["chat-link-preview", url],
    queryFn: async () => {
      const res = await fetch(`/api/chat/link-preview?url=${encodeURIComponent(url)}`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.preview) throw new Error(json?.error || "preview_failed");
      return json.preview as LinkPreviewPayload;
    },
    staleTime: 30 * 60 * 1000,
    retry: 0,
  });

  if (isLoading) {
    return (
      <div className="mt-2 overflow-hidden rounded-xl border border-[color:var(--bubble-divider)] bg-[var(--bubble-surface)]">
        <div className="h-24 animate-pulse bg-[var(--bubble-control)]" />
        <div className="space-y-1.5 p-2.5">
          <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--bubble-control)]" />
          <div className="h-2.5 w-full animate-pulse rounded bg-[var(--bubble-control)]" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "mt-2 block overflow-hidden rounded-xl border border-[color:var(--bubble-divider)] bg-[var(--bubble-surface)] no-underline",
        "hover:bg-[var(--bubble-control)]/60 transition-colors",
      )}
    >
      {data.image ? (
        <img
          src={data.image}
          alt=""
          className="h-32 w-full object-cover bg-[var(--bubble-control)]"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : null}
      <div className="p-2.5 space-y-0.5">
        <p className="text-[10px] uppercase tracking-wide text-[color:var(--bubble-muted-ink,var(--muted-foreground))] truncate">
          {data.siteName}
        </p>
        <p className="text-[13px] font-semibold leading-snug line-clamp-2 text-current">{data.title}</p>
        {data.description ? (
          <p className="text-[11px] leading-snug line-clamp-2 text-[color:var(--bubble-muted-ink,var(--muted-foreground))]">
            {data.description}
          </p>
        ) : null}
        <p className="flex items-center gap-1 pt-0.5 text-[10px] font-medium text-[color:var(--bubble-action)]">
          <ExternalLink className="h-3 w-3" />
          Abrir link
        </p>
      </div>
    </a>
  );
}

export function MessageLinkPreviews({ text }: { text: string }) {
  const urls = extractHttpUrls(text, 3);
  if (!urls.length) return null;
  return (
    <div className="px-1">
      {urls.map((url) => (
        <PreviewCard key={url} url={url} />
      ))}
    </div>
  );
}
