import { useState } from "react";
import { ExternalLink, Instagram, Video } from "lucide-react";
import {
  isInstagramPostOrReelUrl,
  isPlayableVideoSrc,
} from "@/lib/chat-instagram-share";
import { cn } from "@/lib/utils";

export function ChatInstagramShareCard({
  url,
  caption,
}: {
  url?: string | null;
  caption?: string | null;
}) {
  return (
    <div className="flex min-w-[14rem] max-w-xs flex-col gap-2 rounded-2xl bg-black/20 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Instagram className="h-4 w-4 shrink-0" />
        Publicação compartilhada
      </div>
      {caption ? <p className="line-clamp-3 text-xs text-muted-foreground">{caption}</p> : null}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center text-xs font-medium text-primary hover:underline"
        >
          Abrir no Instagram <ExternalLink className="ml-1 h-3 w-3" />
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">A Meta não enviou um link reproduzível desta publicação.</p>
      )}
    </div>
  );
}

export function ChatVideoBubble({
  src,
  shareUrl,
  isInstagram,
  caption,
  className,
}: {
  src?: string | null;
  shareUrl?: string | null;
  isInstagram?: boolean;
  caption?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const permalink = shareUrl || (isInstagramPostOrReelUrl(src) ? src : null);
  const canPlay = Boolean(src) && isPlayableVideoSrc(src) && !failed && !isInstagramPostOrReelUrl(src);

  if (!canPlay) {
    if (isInstagram || permalink) {
      return <ChatInstagramShareCard url={permalink || null} caption={caption} />;
    }
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-muted">
        <Video className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <video
      src={src || undefined}
      controls
      preload="metadata"
      className={cn("w-full max-h-72 rounded-2xl object-cover", className)}
      onError={() => setFailed(true)}
    />
  );
}
