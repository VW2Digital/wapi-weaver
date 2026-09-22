import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, ImageOff, Layers, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  isInstagramVideoType,
  resolveInstagramPublicPreview,
  type InstagramPublicMediaChild,
} from "@/lib/instagram-public-preview";
import { cn } from "@/lib/utils";

export type InstagramPublicMediaPreviewItem = {
  media_type: string;
  media_url?: string | null;
  thumbnail_url?: string | null;
  permalink: string;
  caption?: string | null;
  children_json?: InstagramPublicMediaChild[] | null;
};

export function InstagramPublicMediaPreview({
  item,
  alt,
  className,
}: {
  item: InstagramPublicMediaPreviewItem;
  alt: string;
  className?: string;
}) {
  const preview = useMemo(() => resolveInstagramPublicPreview(item), [item]);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [index, setIndex] = useState(0);
  const [playerOpen, setPlayerOpen] = useState(false);

  const child = preview.children[index];
  const active = child
    ? resolveInstagramPublicPreview({
        media_type: child.media_type || item.media_type,
        media_url: child.media_url,
        thumbnail_url: child.thumbnail_url,
        children_json: [],
      })
    : preview;
  const coverUrl = failed ? null : active.previewUrl || preview.previewUrl;
  const videoUrl = active.videoUrl || preview.videoUrl;
  const shortAlt = alt.replace(/\s+/g, " ").trim().slice(0, 80) || "Publicação do Instagram";

  return (
    <>
      <div
        className={cn(
          "relative aspect-square w-full overflow-hidden bg-muted",
          className,
        )}
      >
        {coverUrl ? (
          <>
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando mídia" />
              </div>
            )}
            <img
              src={coverUrl}
              alt={shortAlt}
              className="h-full w-full object-cover"
              loading="lazy"
              onLoad={() => setLoaded(true)}
              onError={() => {
                setFailed(true);
                setLoaded(true);
              }}
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
            <ImageOff className="h-7 w-7 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Mídia indisponível</p>
            <a
              href={item.permalink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center text-xs font-medium text-primary hover:underline"
            >
              Abrir no Instagram <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </div>
        )}

        {preview.kind === "video" || isInstagramVideoType(child?.media_type) ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-black/65 p-2.5 text-white shadow-sm">
              <Play className="h-5 w-5 fill-current" />
            </span>
          </div>
        ) : null}

        {preview.kind === "carousel" ? (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
            <Layers className="h-3 w-3" />
            {preview.childCount}
          </span>
        ) : null}

        {coverUrl && (videoUrl || item.permalink) ? (
          <button
            type="button"
            className="absolute inset-0"
            aria-label={videoUrl ? "Reproduzir publicação" : "Abrir publicação original"}
            onClick={() => {
              if (videoUrl) setPlayerOpen(true);
              else window.open(item.permalink, "_blank", "noopener,noreferrer");
            }}
          />
        ) : null}

        {preview.kind === "carousel" && preview.children.length > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-1 text-white"
              aria-label="Mídia anterior"
              onClick={(event) => {
                event.stopPropagation();
                setFailed(false);
                setLoaded(false);
                setIndex((current) => (current === 0 ? preview.children.length - 1 : current - 1));
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/55 p-1 text-white"
              aria-label="Próxima mídia"
              onClick={(event) => {
                event.stopPropagation();
                setFailed(false);
                setLoaded(false);
                setIndex((current) => (current + 1) % preview.children.length);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        ) : null}
      </div>

      <Dialog open={playerOpen} onOpenChange={setPlayerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Publicação do Instagram</DialogTitle>
            <DialogDescription>Reprodução da mídia disponibilizada pela Meta.</DialogDescription>
          </DialogHeader>
          {videoUrl ? (
            <video
              src={videoUrl}
              poster={coverUrl || undefined}
              controls
              autoPlay
              className="max-h-[70vh] w-full rounded-lg bg-black"
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              A Meta não disponibilizou um arquivo de vídeo reproduzível.
            </p>
          )}
          <Button variant="outline" asChild>
            <a href={item.permalink} target="_blank" rel="noreferrer">
              Abrir no Instagram
            </a>
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
