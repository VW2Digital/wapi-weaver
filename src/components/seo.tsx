import { Helmet } from "react-helmet-async";
import {
  SeoProps,
  SITE_NAME,
  SITE_DEFAULT_DESCRIPTION,
  SITE_URL,
  SITE_DEFAULT_OG_IMAGE,
  SITE_LANG,
  collectJsonLd,
} from "@/lib/seo";

export function SeoHead({
  title,
  description,
  ogImage,
  canonical,
  noindex,
  nofollow,
  jsonLd,
}: SeoProps) {
  const pageTitle = title ? `${title} — ${SITE_NAME}` : SITE_NAME;
  const pageDescription = description || SITE_DEFAULT_DESCRIPTION;
  const pageOgImage = ogImage || SITE_DEFAULT_OG_IMAGE;
  const pageCanonical = canonical || (typeof window !== "undefined" ? window.location.href : SITE_URL);

  const robots: string[] = [];
  if (noindex) robots.push("noindex");
  if (nofollow) robots.push("nofollow");
  const robotsContent = robots.length > 0 ? robots.join(", ") : undefined;

  const jsonLdScript = jsonLd ? collectJsonLd(...jsonLd) : undefined;

  return (
    <Helmet>
      <html lang={SITE_LANG} />
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <link rel="canonical" href={pageCanonical} />

      {robotsContent && <meta name="robots" content={robotsContent} />}

      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:image" content={pageOgImage} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={pageCanonical} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={SITE_LANG} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={pageOgImage} />

      {jsonLdScript && (
        <script type="application/ld+json">{jsonLdScript}</script>
      )}
    </Helmet>
  );
}
