import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Grid3X3,
  Hash,
  Instagram,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";
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
  deleteInstagramStorefront,
} from "@/lib/instagram-public-content.functions";
import { InstagramPublicMediaPreview } from "@/components/instagram/InstagramPublicMediaPreview";
import { listMetaAppConnectionsForEmbeddedSignup } from "@/lib/profile.functions";
import { mergeHashtagSearchItems } from "@/lib/instagram-public-preview";

type Source = "recent" | "top";
type DashboardData = Awaited<ReturnType<typeof getInstagramPublicDashboard>>;
type HashtagSearchResult = Awaited<ReturnType<typeof searchInstagramPublicHashtag>>;
type MediaItem = DashboardData["media"][number] | HashtagSearchResult["items"][number];

function mediaTypeLabel(type?: string | null) {
  const value = String(type || "").toUpperCase();
  if (value === "VIDEO" || value === "REELS") return "Vídeo";
  if (value === "CAROUSEL_ALBUM" || value === "CAROUSEL") return "Carrossel";
  return "Imagem";
}

function SearchCaption({ caption }: { caption: string }) {
  const [expanded, setExpanded] = useState(false);
  const long = caption.length > 140;
  return (
    <div className="space-y-1">
      <p className={expanded ? "text-sm text-muted-foreground" : "line-clamp-3 text-sm text-muted-foreground"}>
        {caption}
      </p>
      {long ? (
        <button
          type="button"
          className="text-xs font-medium text-primary hover:underline"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Recolher legenda" : "Ver legenda completa"}
        </button>
      ) : null}
    </div>
  );
}

function statusLabel(status?: string) {
  if (status === "connected") return "Conectado";
  if (status === "permission_pending") return "Aprovação pendente";
  if (status === "reauth_required") return "Reconexão necessária";
  if (status === "error") return "Erro";
  return "Desconectado";
}

function storefrontGalleryClass(layout: "grid" | "masonry", columns: number) {
  if (layout === "masonry") {
    if (columns === 2) return "columns-1 sm:columns-2 gap-4";
    if (columns === 4) return "columns-1 sm:columns-2 lg:columns-4 gap-4";
    return "columns-1 sm:columns-2 lg:columns-3 gap-4";
  }
  if (columns === 2) return "grid grid-cols-1 sm:grid-cols-2 gap-4";
  if (columns === 4) return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4";
  return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4";
}

function InstagramPublicContentPage() {
  usePageHeader({
    title: "Conteúdo público do Instagram",
    subtitle: "Pesquise hashtags oficiais da Meta e publique uma galeria na vitrine da sua loja.",
  });

  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const getDashboard = useServerFn(getInstagramPublicDashboard);
  const listMetaApps = useServerFn(listMetaAppConnectionsForEmbeddedSignup);
  const connect = useServerFn(connectInstagramPublicContent);
  const disconnect = useServerFn(disconnectInstagramPublicContent);
  const reuseConnection = useServerFn(reuseInstagramDirectConnection);
  const searchHashtag = useServerFn(searchInstagramPublicHashtag);
  const setSelection = useServerFn(setInstagramPublicMediaSelection);
  const saveStorefront = useServerFn(updateInstagramStorefront);
  const removeStorefront = useServerFn(deleteInstagramStorefront);

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
    if (!storefront) {
      setStoreForm({
        enabled: false,
        title: "Instagram",
        subtitle: "",
        layout: "grid",
        columnsCount: 3,
        showCaptions: true,
        showHashtags: true,
        maxItems: 12,
        theme: "auto",
      });
      return;
    }
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
    onMutate: (after) => {
      if (!after) setSearchResult(null);
    },
    onSuccess: (result, after) => {
      setSearchResult((current) => {
        if (result.notFound || !after || !current || current.notFound) return result;
        if (current.hashtag !== result.hashtag || current.source !== result.source) return result;
        return {
          ...result,
          items: mergeHashtagSearchItems(current.items, result.items, true),
        };
      });
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

  const invalidateStorefrontViews = (slug?: string | null) => {
    queryClient.invalidateQueries({ queryKey: ["instagram-public-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["public-instagram-storefront"] });
    if (slug) {
      queryClient.invalidateQueries({ queryKey: ["public-instagram-storefront", slug] });
    }
  };

  const storefrontMutation = useMutation({
    mutationFn: () => {
      const title = storeForm.title.trim();
      if (!title) {
        throw new Error("Informe o título da vitrine.");
      }
      return saveStorefront({
        data: {
          ...storeForm,
          title,
          subtitle: storeForm.subtitle.trim() || null,
        },
      });
    },
    onSuccess: (result) => {
      toast.success("Vitrine do Instagram atualizada.");
      invalidateStorefrontViews(result.slug);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteStorefrontMutation = useMutation({
    mutationFn: () => removeStorefront(),
    onSuccess: (result) => {
      toast.success("Vitrine excluída. O endereço público deixou de estar disponível.");
      invalidateStorefrontViews(result.previousSlug);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const searchItems = searchResult && !searchResult.notFound ? searchResult.items : [];

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

          {searchMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Falha na pesquisa</AlertTitle>
              <AlertDescription>
                {searchMutation.error instanceof Error
                  ? searchMutation.error.message
                  : "Não foi possível consultar a Graph API agora."}
              </AlertDescription>
            </Alert>
          )}

          {connection?.appReviewStatus === "required" && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              A pesquisa de hashtags fica disponível após a Meta aprovar o Instagram Public Content Access.
            </div>
          )}

          {searchResult?.notFound && (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              A Meta não encontrou a hashtag #{searchResult.hashtag}.
            </div>
          )}

          {searchResult && !searchResult.notFound && searchItems.length === 0 && !searchMutation.isPending && (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhuma publicação pública foi disponibilizada pela Meta para #{searchResult.hashtag}
              {searchResult.source === "recent" ? " nas últimas 24 horas." : "."}
            </div>
          )}

          {searchMutation.isPending && searchItems.length === 0 && (
            <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="w-full max-w-[22rem] animate-pulse overflow-hidden rounded-xl border bg-card"
                >
                  <div className="aspect-square bg-muted" />
                  <div className="space-y-2 p-4">
                    <div className="h-4 w-24 rounded bg-muted" />
                    <div className="h-10 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {searchItems.length > 0 && (
            <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {searchItems.map((item: MediaItem) => (
                  <article
                    key={item.id}
                    className="flex w-full max-w-[22rem] flex-col overflow-hidden rounded-xl border bg-card shadow-sm"
                  >
                    <InstagramPublicMediaPreview
                      item={item}
                      alt={item.caption ? `Publicação do Instagram` : "Publicação do Instagram"}
                    />
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary">{mediaTypeLabel(item.media_type)}</Badge>
                        {item.username ? (
                          <span className="truncate text-xs text-muted-foreground">@{item.username}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Autoria não informada pela Meta</span>
                        )}
                      </div>
                      {item.caption ? <SearchCaption caption={item.caption} /> : null}
                      <a
                        href={item.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        Ver publicação original <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
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
                        className="mt-auto w-full"
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
              ))}
            </div>
          )}

          {searchResult?.paging?.hasNext && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => searchMutation.mutate(searchResult.paging?.after || undefined)}
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
            Uma vitrine por loja. Salvar atualiza a configuração persistida; excluir despublica o endereço.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!storefront ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhuma vitrine ativa. As publicações autorizadas na galeria continuam disponíveis.
              </p>
              <Button
                className="mt-4"
                onClick={() => storefrontMutation.mutate()}
                disabled={storefrontMutation.isPending}
              >
                {storefrontMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar nova vitrine
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={storeForm.enabled ? "default" : "secondary"}>
                      {storeForm.enabled ? "Publicada" : "Desativada"}
                    </Badge>
                    <span className="truncate text-xs text-muted-foreground">
                      /vitrine/{storefront.slug}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Endereço público desta loja. Após excluir, este caminho deixa de responder.
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <a href={`/vitrine/${storefront.slug}`} target="_blank" rel="noreferrer">
                    Visualizar vitrine <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </div>

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
                    maxLength={160}
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
                  <Label>Máximo de publicações</Label>
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
                <div className="space-y-2">
                  <Label>Tema</Label>
                  <Select
                    value={storeForm.theme}
                    onValueChange={(theme: "auto" | "light" | "dark") =>
                      setStoreForm((form) => ({ ...form, theme }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automático</SelectItem>
                      <SelectItem value="light">Claro</SelectItem>
                      <SelectItem value="dark">Escuro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col justify-end gap-3 rounded-lg border p-3">
                  <label className="flex items-center justify-between gap-3 text-sm">
                    Exibir legendas
                    <Switch
                      checked={storeForm.showCaptions}
                      onCheckedChange={(showCaptions) =>
                        setStoreForm((form) => ({ ...form, showCaptions }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 text-sm">
                    Exibir hashtags
                    <Switch
                      checked={storeForm.showHashtags}
                      onCheckedChange={(showHashtags) =>
                        setStoreForm((form) => ({ ...form, showHashtags }))
                      }
                    />
                  </label>
                </div>
              </div>

              <div
                className={`rounded-xl border p-4 ${
                  storeForm.theme === "dark" ? "bg-zinc-950 text-zinc-50" : "bg-muted/30"
                }`}
              >
                <p className="mb-3 text-xs font-medium text-muted-foreground">Pré-visualização</p>
                <h3 className="text-lg font-semibold tracking-tight">{storeForm.title || "Instagram"}</h3>
                {storeForm.subtitle ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{storeForm.subtitle}</p>
                ) : null}
                <div
                  className={`mt-4 ${storefrontGalleryClass(storeForm.layout, storeForm.columnsCount)}`}
                >
                  {(dashboard?.media || [])
                    .filter((item) => item.selected)
                    .slice(0, storeForm.maxItems)
                    .map((item) => (
                      <article
                        key={item.id}
                        className={`overflow-hidden rounded-xl border bg-card ${
                          storeForm.layout === "masonry" ? "mb-4 break-inside-avoid" : ""
                        }`}
                      >
                        <InstagramPublicMediaPreview item={item} alt="Publicação do Instagram" />
                        {(storeForm.showCaptions || storeForm.showHashtags) && (
                          <div className="space-y-1 p-3">
                            {storeForm.showHashtags && item.hashtag ? (
                              <p className="text-[11px] text-muted-foreground">#{item.hashtag}</p>
                            ) : null}
                            {storeForm.showCaptions && item.caption ? (
                              <p className="line-clamp-2 text-xs">{item.caption}</p>
                            ) : null}
                          </div>
                        )}
                      </article>
                    ))}
                </div>
                {(dashboard?.media || []).filter((item) => item.selected).length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Nenhuma publicação autorizada na galeria ainda.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleteStorefrontMutation.isPending || storefrontMutation.isPending}
                  onClick={async () => {
                    const confirmed = await confirm({
                      title: "Excluir vitrine?",
                      description:
                        "A vitrine deixará de estar disponível publicamente. A conexão com o Instagram Direct, as publicações originais e os dados do CRM são preservados.",
                      confirmText: "Excluir vitrine",
                      destructive: true,
                    });
                    if (confirmed) deleteStorefrontMutation.mutate();
                  }}
                >
                  {deleteStorefrontMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Excluir vitrine
                </Button>
                <Button
                  onClick={() => storefrontMutation.mutate()}
                  disabled={storefrontMutation.isPending || !storeForm.title.trim()}
                  className="sm:min-w-44"
                >
                  {storefrontMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar vitrine
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export const Route = createFileRoute("/_app/instagram-content")({
  component: InstagramPublicContentPage,
});
