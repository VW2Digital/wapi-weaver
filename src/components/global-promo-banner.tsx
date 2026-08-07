import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listActiveBanners } from "@/lib/platform-banners.functions";
import { ChevronLeft, ChevronRight, ExternalLink, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GlobalPromoBanner() {
  const fetchBanners = useServerFn(listActiveBanners);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [imageError, setImageError] = useState(false);

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["global-active-banners"],
    queryFn: () => fetchBanners(),
    staleTime: 60_000,
  });

  const visibleBanners = banners.filter((b: any) => !dismissedIds.includes(b.id));

  if (isLoading || visibleBanners.length === 0) {
    return null;
  }

  const currentBanner = visibleBanners[currentIndex % visibleBanners.length];
  if (!currentBanner) return null;

  const handleNext = () => {
    setImageError(false);
    setCurrentIndex((prev) => (prev + 1) % visibleBanners.length);
  };

  const handlePrev = () => {
    setImageError(false);
    setCurrentIndex((prev) => (prev - 1 + visibleBanners.length) % visibleBanners.length);
  };

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => [...prev, id]);
    if (currentIndex >= visibleBanners.length - 1) {
      setCurrentIndex(0);
    }
  };

  const hasCta = currentBanner.cta_label && currentBanner.cta_url;

  return (
    <div className="p-4 sm:p-6 pb-0">
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-[#121215] text-white shadow-xl transition-all max-h-[136px]">
        {/* Close Button */}
        <button
          onClick={() => handleDismiss(currentBanner.id)}
          className="absolute top-3 right-3 z-20 rounded-full bg-black/40 p-1.5 text-zinc-400 backdrop-blur-md transition-colors hover:bg-black/70 hover:text-white"
          title="Fechar anúncio"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-col md:flex-row items-stretch h-[136px] max-h-[136px] overflow-hidden">
          {/* Left / Main Content */}
          <div className="flex-1 p-4 sm:py-4 sm:px-6 flex flex-col justify-center z-10 space-y-2 min-w-0">
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-tight flex items-center gap-2 truncate">
                {currentBanner.title}
              </h2>
              {currentBanner.subtitle && (
                <p className="mt-1 text-xs sm:text-sm text-zinc-300 max-w-2xl leading-normal truncate">
                  {currentBanner.subtitle}
                </p>
              )}
            </div>

            {hasCta && (
              <div className="pt-1">
                <a
                  href={currentBanner.cta_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient text-white px-4 py-2 text-xs font-bold shadow-md shadow-[#F23869]/20 transition-all hover:opacity-95 active:scale-95"
                >
                  <span>{currentBanner.cta_label}</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-90" />
                </a>
              </div>
            )}
          </div>

          {/* Right Visual Section (Flush Image or Bliv Brand Fallback Graphic) */}
          <div className="relative shrink-0 overflow-hidden flex items-center justify-end h-full max-h-[136px] max-w-[50%]">
            {currentBanner.image_path && !imageError ? (
              <img
                src={currentBanner.image_path}
                alt={currentBanner.title}
                onError={() => setImageError(true)}
                className="h-full w-auto max-w-full object-contain object-right p-0 mr-[80px] max-h-[136px]"
              />
            ) : (
              /* Default Bliv Brand decorative graphic when image is missing or broken */
              <div className="relative w-full h-full bg-gradient-to-br from-[#F23869]/20 via-[#BF39B6]/15 to-black/90 flex items-center justify-center p-3 border-t md:border-t-0 md:border-l border-white/10">
                <div
                  className="absolute -inset-1 blur-2xl opacity-40"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(242,56,105,0.4) 0%, rgba(217,59,146,0.3) 50%, rgba(191,57,182,0.4) 100%)",
                  }}
                />
                <div className="relative z-10 flex flex-col items-center justify-center gap-2 py-1.5 text-center">
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-xl transform -rotate-3 hover:rotate-0 transition-transform">
                      <img
                        src="/logo-dark.png"
                        alt="Bliv Logo"
                        className="h-9 w-9 object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                      <Sparkles className="h-6 w-6 text-[#F23869]" />
                    </div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#BF39B6]/20 backdrop-blur-md border border-[#BF39B6]/30 shadow-lg transform rotate-3 hover:rotate-0 transition-transform">
                      <span className="text-sm font-black text-white">BLIV</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Multi-banner Navigation Carousel Dots/Arrows if > 1 banner */}
        {visibleBanners.length > 1 && (
          <div className="absolute bottom-3 right-4 z-20 flex items-center gap-2 rounded-full bg-black/50 px-3 py-1 text-xs text-zinc-300 backdrop-blur-md border border-white/10">
            <button
              onClick={handlePrev}
              className="p-1 hover:text-white transition-colors"
              title="Anúncio anterior"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-[10px] font-mono px-1">
              {currentIndex + 1}/{visibleBanners.length}
            </span>
            <button
              onClick={handleNext}
              className="p-1 hover:text-white transition-colors"
              title="Próximo anúncio"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
