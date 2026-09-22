import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ExternalLink, ImageOff, Instagram, Loader2 } from "lucide-react";
import { InstagramPublicMediaPreview } from "@/components/instagram/InstagramPublicMediaPreview";
import { getPublicInstagramStorefront } from "@/lib/instagram-public-content.functions";

function gridColumns(columns: number) {
  if (columns === 2) return "sm:grid-cols-2";
  if (columns === 4) return "sm:grid-cols-2 lg:grid-cols-4";
  return "sm:grid-cols-2 lg:grid-cols-3";
}

function masonryColumns(columns: number) {
  if (columns === 2) return "sm:columns-2";
  if (columns === 4) return "sm:columns-2 lg:columns-4";
  return "sm:columns-2 lg:columns-3";
}

function InstagramStorefrontPage() {
  const { slug } = Route.useParams();
  const getStorefront = useServerFn(getPublicInstagramStorefront);
  const query = useQuery({
    queryKey: ["public-instagram-storefront", slug],
    queryFn: () => getStorefront({ data: { slug } }),
    staleTime: 15_000,
  });

  const [prefersDark, setPrefersDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setPrefersDark(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  if (query.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" aria-label="Carregando" />
      </main>
    );
  }

  const data = query.data;
  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <ImageOff className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-semibold">Galeria indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Esta vitrine não está publicada ou foi excluída.
          </p>
        </div>
      </main>
    );
  }

  const { store, media } = data;
  const dark = store.theme === "dark" || (store.theme === "auto" && prefersDark);
  const galleryClass =
    store.layout === "masonry"
      ? `columns-1 ${masonryColumns(Number(store.columnsCount))} gap-4`
      : `grid grid-cols-1 ${gridColumns(Number(store.columnsCount))} gap-4`;

  return (
    <main className={dark ? "min-h-screen bg-zinc-950 text-zinc-50" : "min-h-screen bg-muted/30"}>
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mx-auto mb-10 max-w-2xl text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border bg-card shadow-sm">
            <Instagram className="h-5 w-5 text-foreground" />
          </div>
          <p className="mt-4 text-sm font-medium text-muted-foreground">{store.name}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{store.title}</h1>
          {store.subtitle && (
            <p className="mt-3 text-base leading-7 text-muted-foreground">{store.subtitle}</p>
          )}
        </header>

        {media.length ? (
          <section className={galleryClass} aria-label="Galeria do Instagram">
            {media.map((item) => {
              return (
                <article
                  key={item.id}
                  className={`group overflow-hidden rounded-xl border bg-card shadow-sm ${
                    store.layout === "masonry" ? "mb-4 break-inside-avoid" : ""
                  }`}
                >
                  <InstagramPublicMediaPreview
                    item={item}
                    alt="Publicação do Instagram"
                  />
                  {(store.showCaptions || store.showHashtags) && (
                    <div className="space-y-2 p-4">
                      {store.showHashtags && (
                        <p className="text-xs font-medium text-muted-foreground">#{item.hashtag}</p>
                      )}
                      {store.showCaptions && item.caption && (
                        <p className="line-clamp-3 text-sm leading-6">{item.caption}</p>
                      )}
                      <a
                        href={item.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        Ver publicação original <ExternalLink className="ml-1.5 h-3 w-3" />
                      </a>
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        ) : (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center">
            <ImageOff className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhuma publicação está disponível nesta galeria.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

export const Route = createFileRoute("/vitrine/$slug")({
  component: InstagramStorefrontPage,
});
