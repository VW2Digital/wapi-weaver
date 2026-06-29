import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  Link,
} from "@tanstack/react-router";
import { HelmetProvider } from "react-helmet-async";
import { useServerFn } from "@tanstack/react-start";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmProvider } from "@/components/confirm-dialog";
import { TrackingTagsInjector } from "@/components/tracking-tags-injector";
import { ErrorBoundary } from "@/components/error-boundary";
import { SeoHead } from "@/components/seo";
import { getSeoSettings } from "@/lib/admin.functions";
import {
  SITE_NAME,
  SITE_DEFAULT_DESCRIPTION,
  SITE_DEFAULT_OG_IMAGE,
  SITE_URL,
  jsonLdOrganization,
  jsonLdWebsite,
} from "@/lib/seo";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Página não encontrada.</p>
        <Link
          to="/"
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Voltar
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error }: { error: Error }) {
  console.error(error);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Bliv" },
      {
        name: "description",
        content: "Painel de disparo de mensagens via WhatsApp Cloud API oficial da Meta.",
      },
      { property: "og:title", content: "Bliv" },
      { name: "twitter:title", content: "Bliv" },
      {
        property: "og:description",
        content: "Painel de disparo de mensagens via WhatsApp Cloud API oficial da Meta.",
      },
      {
        name: "twitter:description",
        content: "Painel de disparo de mensagens via WhatsApp Cloud API oficial da Meta.",
      },
      {
        property: "og:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/SgrGDqcOrgQk4XTillSI6aIodcF3/social-images/social-1780147276477-Captura_de_tela_2026-05-30_102104.webp",
      },
      {
        name: "twitter:image",
        content:
          "https://storage.googleapis.com/gpt-engineer-file-uploads/SgrGDqcOrgQk4XTillSI6aIodcF3/social-images/social-1780147276477-Captura_de_tela_2026-05-30_102104.webp",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Sora:wght@500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootSeoProvider() {
  const fetchSeo = useServerFn(getSeoSettings);
  const { data: seo } = useQuery({
    queryKey: ["seo-settings"],
    queryFn: () => fetchSeo(),
    staleTime: 60_000,
  });
  return (
    <SeoHead
      title={seo?.seo_title || undefined}
      description={seo?.seo_description || undefined}
      jsonLd={[jsonLdOrganization(), jsonLdWebsite()]}
    />
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <ErrorBoundary>
              <ConfirmProvider>
                <RootSeoProvider />
                <Outlet />
                <Toaster richColors position="top-right" />
                <TrackingTagsInjector />
              </ConfirmProvider>
            </ErrorBoundary>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}
