export const SITE_NAME = "Bliv";
export const SITE_DEFAULT_DESCRIPTION =
  "Painel de disparo de mensagens via WhatsApp Cloud API oficial da Meta.";
export const SITE_URL = process.env.SITE_URL || "http://localhost:8080";
export const SITE_DEFAULT_OG_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/SgrGDqcOrgQk4XTillSI6aIodcF3/social-images/social-1780147276477-Captura_de_tela_2026-05-30_102104.webp";
export const SITE_LANG = "pt-BR";

export interface SeoProps {
  title?: string;
  description?: string;
  ogImage?: string;
  canonical?: string;
  noindex?: boolean;
  nofollow?: boolean;
  jsonLd?: Record<string, unknown>[];
}

export function jsonLdOrganization() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DEFAULT_DESCRIPTION,
    logo: `${SITE_URL}/favicon.ico`,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer support",
      email: "suporte@bliv.com.br",
    },
    sameAs: [],
  };
}

export function jsonLdWebsite() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DEFAULT_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function jsonLdArticle(headline: string, datePublished: string, author: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline,
    datePublished,
    author: {
      "@type": "Person",
      name: author,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
    },
  };
}

export function jsonLdItemList(itemList: { name: string; url: string; description?: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: itemList.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Product",
        name: item.name,
        url: item.url,
        description: item.description,
      },
    })),
  };
}

export function jsonLdBreadcrumb(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function collectJsonLd(...args: (Record<string, unknown> | undefined)[]): string {
  return JSON.stringify(args.filter(Boolean));
}
