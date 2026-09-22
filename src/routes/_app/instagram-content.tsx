import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Grid3X3,
  Hash,
  Image as ImageIcon,
  Instagram,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  connectInstagramPublicContent,
  disconnectInstagramPublicContent,
  getInstagramPublicDashboard,
  reuseInstagramDirectConnection,
  searchInstagramPublicHashtag,
  setInstagramPublicMediaSelection,
  updateInstagramStorefront,
} from "@/lib/instagram-public-content.functions";
import { listMetaAppConnectionsForEmbeddedSignup } from "@/lib/profile.functions";

type Source = "recent" | "top";
type DashboardData = Awaited<ReturnType<typeof getInstagramPublicDashboard>>;
type HashtagSearchResult = Awaited<ReturnType<typeof searchInstagramPublicHashtag>>;
type MediaItem = DashboardData["media"][number] | HashtagSearchResult["items"][number];

function statusLabel(status?: string) {
  if (status === "connected") return "Conectado";
  if (status === "permission_pending") return "Aprovação pendente";
  if (status === "reauth_required") return "Reconexão necessária";
  if (status === "error") return "Erro";
  return "Desconectado";
}

function InstagramPublicContentPage() {
  usePageHeader({
    title: "Conteúdo público do Instagram",
    subtitle: "Pesquise hashtags oficiais da Meta e publique uma galeria na vitrine da sua loja.",
  });

  const queryClient = useQueryClient();
  const getDashboard = useServerFn(getInstagramPublicDashboard);
  const listMetaApps = useServerFn(listMetaAppConnectionsForEmbeddedSignup);
  const connect = useServerFn(connectInstagramPublicContent);
  const disconnect = useServerFn(disconnectInstagramPublicContent);
  const reuseConnection = useServerFn(reuseInstagramDirectConnection);
  const searchHashtag = useServerFn(searchInstagramPublicHashtag);
  const setSelection = useServerFn(setInstagramPublicMediaSelection);
  const saveStorefront = useServerFn(updateInstagramStorefront);

  const dashboardQuery = useQuery({
    queryKey: ["instagram-public-dashboard"],
    queryFn: () => getDashboard(),
  });
  const metaAppsQuery = useQuery({
    queryKey: ["meta-app-connections", "instagram-public"],
    queryFn: () => listMetaApps(),
  });
  const dashboard = dashboardQuery.data;
  const connection = dashboard?.connection;
  const reusableConnection = dashboard?.reusableConnection;
  const storefront = dashboard?.storefront;

  const [hashtag, setHashtag] = useState("");
  const [source, setSource] = useState<Source>("recent");
  const [searchResult, setSearchResult] = useState<HashtagSearchResult | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState<Record<string, boolean>>({});
  const [storeForm, setStoreForm] = useState({
    enabled: false,
    title: "Instagram",
    subtitle: "",
    layout: "grid" as "grid" | "masonry",
    columnsCount: 3,
    showCaptions: true,
    showHashtags: true,
    maxItems: 12,
    theme: "auto" as "auto" | "light" | "dark",
  });

  useEffect(() => {
    if (!storefront) return;
    setStoreForm({
      enabled: Boolean(storefront.enabled),
      title: storefront.title || "Instagram",
      subtitle: storefront.subtitle || "",
      layout: storefront.layout || "grid",
      columnsCount: Number(storefront.columnsCount || 3),
      showCaptions: Boolean(storefront.showCaptions),
      showHashtags: Boolean(storefront.showHashtags),
      maxItems: Number(storefront.maxItems || 12),
      theme: storefront.theme || "auto",
    });
  }, [storefront]);

  const connectMutation = useMutation({
    mutationFn: (payload: { code: string; redirectUri: string; metaAppConnectionId?: string }) =>
      connect({ data: payload }),
    onSuccess: (result) => {
      if (result.appReviewStatus === "api_available") {
        toast.success(`Instagram @${result.username || "profissional"} conectado.`);
      } else {
        toast.warning(
          result.message ||
            "Conta conectada, mas a aprovação Instagram Public Content Access está pendente.",
        );
      }
      queryClient.invalidateQueries({ queryKey: ["instagram-public-dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message || "Falha ao conectar o Instagram."),
  });

  useEffect(() => {
    if (typeof window === "undefined" || !metaAppsQuery.data?.length) return;
    const code = sessionStorage.getItem("bliv_meta_oauth_code");
    const state = sessionStorage.getItem("bliv_meta_oauth_state") || "";
    const redirectUri = sessionStorage.getItem("bliv_meta_oauth_redirect_uri");
    const expectedState = sessionStorage.getItem("bliv_instagram_public_oauth_state");
    const metaAppConnectionId = sessionStorage.getItem("bliv_instagram_public_meta_connection");
    if (!code || !state.startsWith("instagram-public:")) return;
    sessionStorage.removeItem("bliv_meta_oauth_code");
    sessionStorage.removeItem("bliv_meta_oauth_state");
    sessionStorage.removeItem("bliv_meta_oauth_redirect_uri");
    sessionStorage.removeItem("bliv_instagram_public_oauth_state");
    sessionStorage.removeItem("bliv_instagram_public_meta_connection");
    if (!expectedState || expectedState !== state) {
      toast.error("O estado da autenticação não confere. Inicie a conexão novamente.");
      return;
    }
    connectMutation.mutate({
      code,
      redirectUri: redirectUri || `${window.location.origin}/api/public/meta/oauth/callback`,
      metaAppConnectionId: metaAppConnectionId || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaAppsQuery.data]);

  const startFacebookLogin = () => {
    const apps = metaAppsQuery.data || [];
    const selected = apps[0];
    if (!selected?.appId) {
      toast.error("A Meta App master ainda não está configurada.");
      return;
    }
    const redirectUri = `${window.location.origin}/api/public/meta/oauth/callback`;
    const state = `instagram-public:${crypto.randomUUID()}`;
    sessionStorage.setItem("bliv_instagram_public_oauth_state", state);
    sessionStorage.setItem("bliv_instagram_public_meta_connection", selected.id);
    const url = new URL("https://www.facebook.com/v26.0/dialog/oauth");
    url.searchParams.set("client_id", selected.appId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "instagram_basic,pages_show_list");
    url.searchParams.set("state", state);
    window.location.assign(url.toString());
  };

  const disconnectMutation = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      toast.success("Integração desconectada e tokens removidos.");
      setSearchResult(null);
      queryClient.invalidateQueries({ queryKey: ["instagram-public-dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reuseMutation = useMutation({
    mutationFn: () => reuseConnection(),
    onSuccess: (result) => {
      if (result.appReviewStatus === "api_available") {
        toast.success(`Conexão existente de @${result.username || "Instagram"} reutilizada.`);
      } else {
        toast.warning(
          result.message ||
            "A conexão foi reutilizada, mas o Public Content Access ainda depende da Meta.",
        );
      }
      queryClient.invalidateQueries({ queryKey: ["instagram-public-dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const searchMutation = useMutation({
    mutationFn: (after?: string) =>
      searchHashtag({
        data: { hashtag, source, after },
      }),
    onSuccess: (result) => {
      setSearchResult(result);
      if (result.notFound) toast.info("A Meta não encontrou essa hashtag.");
      queryClient.invalidateQueries({ queryKey: ["instagram-public-dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message || "Falha ao pesquisar a hashtag."),
  });

  const selectionMutation = useMutation({
    mutationFn: (payload: { mediaId: string; selected: boolean; rightsConfirmed: boolean }) =>
      setSelection({ data: payload }),
    onSuccess: (_, variables) => {
      toast.success("Seleção da galeria atualizada.");
      queryClient.invalidateQueries({ queryKey: ["instagram-public-dashboard"] });
      setSearchResult((current) =>
        current && !current.notFound
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === variables.mediaId ? { ...item, selected: variables.selected } : item,
              ),
            }
          : current,
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const storefrontMutation = useMutation({
    mutationFn: () =>
      saveStorefront({
        data: {
          ...storeForm,
          subtitle: storeForm.subtitle.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Vitrine do Instagram atualizada.");
      queryClient.invalidateQueries({ queryKey: ["instagram-public-dashboard"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const media = useMemo(
    () => (searchResult?.items?.length ? searchResult.items : dashboard?.media || []),
    [dashboard?.media, searchResult],
  );

  if (dashboardQuery.isLoading) {
    return (
      <div className="flex min-h-105 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando" />
      </div>
    );
  }

  if (dashboardQuery.isError) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Não foi possível carregar o conteúdo público do Instagram</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            {dashboardQuery.error instanceof Error
              ? dashboardQuery.error.message
              : "O servidor não respondeu à consulta da integração."}
          </p>
          <Button variant="outline" size="sm" onClick={() => dashboardQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="min-w-0 space-y-4 p-4 pb-10 sm:space-y-6 sm:p-6 sm:pb-10">
      <Card className="min-w-0 overflow-hidden border-border/60 shadow-sm">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Instagram className="h-5 w-5" />
              Conta profissional
            </CardTitle>
            <CardDescription className="mt-1.5">
              Facebook Login com apenas instagram_basic e pages_show_list.
            </CardDescription>
          </div>
          {connection ? (
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Desconectar
            </Button>
          ) : reusableConnection?.hasReusableAuthorization ? (
            <Button
              className="w-full sm:w-auto"
              onClick={() => reuseMutation.mutate()}
              disabled={reuseMutation.isPending}
            >
              {reuseMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Instagram className="mr-2 h-4 w-4" />
              )}
              Usar conexão existente
            </Button>
          ) : reusableConnection ? (
            <Button className="w-full sm:w-auto" asChild>
              <Link to="/settings" search={{ s: "instagram" }}>
                Atualizar autorização única
              </Link>
            </Button>
          ) : (
            <Button
              className="w-full sm:w-auto"
              onClick={startFacebookLogin}
              disabled={connectMutation.isPending || metaAppsQuery.isLoading}
            >
              {connectMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Instagram className="mr-2 h-4 w-4" />
              )}
              Conectar com Facebook
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {metaAppsQuery.isError && !connection && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Credenciais da plataforma indisponíveis</AlertTitle>
              <AlertDescription>
                Não foi possível consultar a configuração Meta necessária para iniciar a conexão.
              </AlertDescription>
            </Alert>
          )}
          {connection ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Conta
                </p>
                <p className="mt-1 font-medium">@{connection.username || connection.igUserId}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Conexão
                </p>
                <Badge
                  variant={connection.status === "connected" ? "default" : "secondary"}
                  className="mt-1"
                >
                  {statusLabel(connection.status)}
                </Badge>
              </div>
              <div className="rounded-lg border bg-muted/20 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Public Content Access
                </p>
                <Badge
                  variant={connection.appReviewStatus === "api_available" ? "default" : "outline"}
                  className="mt-1"
                >
                  {connection.appReviewStatus === "api_available" ? "API disponível" : "Pendente"}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-5 text-center sm:p-8">
              <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 font-medium">
                {reusableConnection
                  ? `Conta @${reusableConnection.username || "Instagram"} já conectada`
                  : "Nenhuma conta conectada"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {reusableConnection
                  ? reusableConnection.hasReusableAuthorization
                    ? "Use a autorização existente para ativar o conteúdo público sem fazer outro Facebook Login."
                    : "Esta conexão é anterior ao compartilhamento seguro. Atualize a autorização uma única vez em Configurações."
                  : "É necessária uma Página do Facebook ligada a uma conta Instagram Business ou Creator."}
              </p>
            </div>
          )}
          {connection?.lastError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Ação necessária</AlertTitle>
              <AlertDescription>{connection.lastError}</AlertDescription>
            </Alert>
          )}
          {connection?.appReviewStatus === "api_available" && (
            <Alert className="mt-4">
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Chamada técnica validada</AlertTitle>
              <AlertDescription>
                A API respondeu para este usuário. Isso não comprova a aprovação do recurso no App
                Review; confirme o status no painel oficial da Meta antes da produção.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Hash className="h-5 w-5" />
            Pesquisa de hashtags
          </CardTitle>
          <CardDescription>
            {dashboard?.hashtagUsage?.used || 0} de {dashboard?.hashtagUsage?.limit || 30} hashtags
            únicas usadas na janela móvel de sete dias.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              searchMutation.mutate(undefined);
            }}
          >
            <div className="relative flex-1">
              <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={hashtag}
                onChange={(event) => setHashtag(event.target.value)}
                placeholder="minhamarca"
                className="pl-9"
                aria-label="Hashtag"
              />
            </div>
            <Select value={source} onValueChange={(value: Source) => setSource(value)}>
              <SelectTrigger className="w-full sm:w-44" aria-label="Ordenação">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Recentes</SelectItem>
                <SelectItem value="top">Populares</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="submit"
              disabled={
                !hashtag.trim() ||
                searchMutation.isPending ||
                connection?.appReviewStatus !== "api_available"
              }
            >
              {searchMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Pesquisar
            </Button>
          </form>

          {searchResult?.notFound && (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhuma publicação foi disponibilizada pela Meta para #{searchResult.hashtag}.
            </div>
          )}

          {media.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {media.map((item: MediaItem) => {
                const preview = item.thumbnail_url || item.media_url;
                return (
                  <article key={item.id} className="overflow-hidden rounded-xl border bg-card">
                    <div className="aspect-square bg-muted">
                      {preview ? (
                        <img
                          src={preview}
                          alt={item.caption || `Publicação de @${item.username || "Instagram"}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary">{item.media_type}</Badge>
                        <a
                          href={item.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
                        >
                          Ver original <ExternalLink className="ml-1 h-3 w-3" />
                        </a>
                      </div>
                      {item.caption && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">{item.caption}</p>
                      )}
                      {!item.selected && (
                        <label className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Checkbox
                            checked={Boolean(rightsConfirmed[item.id])}
                            onCheckedChange={(checked) =>
                              setRightsConfirmed((current) => ({
                                ...current,
                                [item.id]: checked === true,
                              }))
                            }
                            aria-label="Confirmar direitos de uso"
                          />
                          Confirmo autorização para exibir esta publicação na vitrine.
                        </label>
                      )}
                      <Button
                        variant={item.selected ? "outline" : "default"}
                        className="w-full"
                        disabled={
                          selectionMutation.isPending ||
                          (!item.selected && !rightsConfirmed[item.id])
                        }
                        onClick={() =>
                          selectionMutation.mutate({
                            mediaId: item.id,
                            selected: !item.selected,
                            rightsConfirmed: item.selected
                              ? false
                              : Boolean(rightsConfirmed[item.id]),
                          })
                        }
                      >
                        {item.selected ? (
                          <>
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Remover da galeria
                          </>
                        ) : (
                          <>
                            <Grid3X3 className="mr-2 h-4 w-4" />
                            Adicionar à galeria
                          </>
                        )}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {searchResult?.paging?.hasNext && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => searchMutation.mutate(searchResult.paging.after || undefined)}
                disabled={searchMutation.isPending}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Carregar mais
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Grid3X3 className="h-5 w-5" />
            Vitrine pública
          </CardTitle>
          <CardDescription>
            A publicação só é exibida depois da confirmação dos direitos de uso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col items-start gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Label htmlFor="storefront-enabled" className="font-medium">
                Exibir galeria na vitrine
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Controle independente para esta loja.
              </p>
            </div>
            <Switch
              className="shrink-0"
              id="storefront-enabled"
              checked={storeForm.enabled}
              onCheckedChange={(enabled) => setStoreForm((form) => ({ ...form, enabled }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="storefront-title">Título</Label>
              <Input
                id="storefront-title"
                value={storeForm.title}
                onChange={(event) =>
                  setStoreForm((form) => ({ ...form, title: event.target.value }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Layout</Label>
              <Select
                value={storeForm.layout}
                onValueChange={(layout: "grid" | "masonry") =>
                  setStoreForm((form) => ({ ...form, layout }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">Grade</SelectItem>
                  <SelectItem value="masonry">Mosaico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="storefront-subtitle">Descrição</Label>
              <Textarea
                id="storefront-subtitle"
                value={storeForm.subtitle}
                onChange={(event) =>
                  setStoreForm((form) => ({ ...form, subtitle: event.target.value }))
                }
                maxLength={320}
              />
            </div>
            <div className="space-y-2">
              <Label>Colunas</Label>
              <Select
                value={String(storeForm.columnsCount)}
                onValueChange={(value) =>
                  setStoreForm((form) => ({ ...form, columnsCount: Number(value) }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 colunas</SelectItem>
                  <SelectItem value="3">3 colunas</SelectItem>
                  <SelectItem value="4">4 colunas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Máximo de itens</Label>
              <Input
                type="number"
                min={1}
                max={30}
                value={storeForm.maxItems}
                onChange={(event) =>
                  setStoreForm((form) => ({
                    ...form,
                    maxItems: Math.max(1, Math.min(30, Number(event.target.value) || 1)),
                  }))
                }
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {storefront?.slug && (
              <Button variant="ghost" asChild>
                <a href={`/vitrine/${storefront.slug}`} target="_blank" rel="noreferrer">
                  Visualizar vitrine <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            )}
            <Button
              onClick={() => storefrontMutation.mutate()}
              disabled={storefrontMutation.isPending}
              className="w-full sm:ml-auto sm:w-auto"
            >
              {storefrontMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar vitrine
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_app/instagram-content")({
  component: InstagramPublicContentPage,
});
