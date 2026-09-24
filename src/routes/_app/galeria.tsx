import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Download,
  FileText,
  Film,
  Images,
  LayoutGrid,
  Link2,
  List,
  MoreHorizontal,
  Music,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  classifyGalleryKind,
  formatFileSize,
  GALLERY_ACCEPT,
  sanitizeGalleryFileName,
  type GalleryFile,
  type GalleryKind,
} from "@/lib/gallery-media";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/galeria")({ component: GalleryPage });

type Filter = "all" | GalleryKind;
type ViewMode = "grid" | "list";

function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("app-token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function storageFileUrl(filePath: string) {
  const params = new URLSearchParams({ path: filePath });
  const token = typeof window !== "undefined" ? localStorage.getItem("app-token") : null;
  if (token) params.set("token", token);
  return `/api/storage/file?${params.toString()}`;
}

function kindLabel(kind: GalleryKind) {
  if (kind === "image") return "Imagem";
  if (kind === "video") return "Vídeo";
  if (kind === "audio") return "Áudio";
  return "Documento";
}

function KindIcon({ kind, className }: { kind: GalleryKind; className?: string }) {
  if (kind === "image") return <Images className={className} />;
  if (kind === "video") return <Film className={className} />;
  if (kind === "audio") return <Music className={className} />;
  return <FileText className={className} />;
}

async function readError(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (json?.error) return String(json.error);
  if (res.status >= 500) {
    return "O servidor estava ocupado ao processar o arquivo. Tente de novo em instantes.";
  }
  return `Falha (${res.status})`;
}

function GalleryPage() {
  usePageHeader({
    title: "Galeria",
    subtitle: "Visualize, envie, compartilhe e exclua as mídias da sua conta.",
  });

  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewer, setViewer] = useState<GalleryFile | null>(null);
  const [dragging, setDragging] = useState(false);

  const listQuery = useQuery({
    queryKey: ["gallery-files"],
    queryFn: async () => {
      const res = await fetch("/api/storage/list", {
        headers: authHeaders(),
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Não foi possível carregar a galeria.");
      return (json.files || []) as GalleryFile[];
    },
  });

  const files = listQuery.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return files.filter((file) => {
      const kind = file.kind || classifyGalleryKind(file.name);
      if (filter !== "all" && kind !== filter) return false;
      if (!q) return true;
      return file.name.toLowerCase().includes(q);
    });
  }, [files, filter, search]);

  const counts = useMemo(() => {
    const next = { all: files.length, image: 0, video: 0, audio: 0, document: 0 };
    for (const file of files) {
      const kind = file.kind || classifyGalleryKind(file.name);
      next[kind] += 1;
    }
    return next;
  }, [files]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["gallery-files"] });

  const uploadMutation = useMutation({
    mutationFn: async (fileList: File[]) => {
      if (!fileList.length) return 0;
      let ok = 0;
      for (const file of fileList) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} passa de 20 MB.`);
          continue;
        }
        const form = new FormData();
        form.append("path", `gallery/${Date.now()}-${sanitizeGalleryFileName(file.name)}`);
        form.append("file", file);
        const res = await fetch("/api/storage/upload", {
          method: "POST",
          headers: authHeaders(),
          credentials: "include",
          body: form,
        });
        if (!res.ok) {
          toast.error(`${file.name}: ${await readError(res)}`);
          continue;
        }
        ok += 1;
      }
      return ok;
    },
    onSuccess: (count) => {
      if (count) {
        toast.success(count === 1 ? "1 arquivo enviado." : `${count} arquivos enviados.`);
        invalidate();
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (paths: string[]) => {
      const res = await fetch("/api/storage/remove", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ paths }),
      });
      if (!res.ok) throw new Error(await readError(res));
    },
    onSuccess: () => {
      toast.success("Arquivo(s) excluído(s).");
      setSelected(new Set());
      setViewer(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const shareMutation = useMutation({
    mutationFn: async (filePath: string) => {
      const res = await fetch("/api/storage/share", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ path: filePath }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.url) throw new Error(json?.error || "Não foi possível gerar o link.");
      await navigator.clipboard.writeText(json.url);
      return json.url as string;
    },
    onSuccess: () => toast.success("Link de compartilhamento copiado (válido por 7 dias)."),
    onError: (error: Error) => toast.error(error.message),
  });

  const onFiles = useCallback(
    (list: FileList | File[] | null) => {
      if (!list) return;
      uploadMutation.mutate(Array.from(list));
    },
    [uploadMutation],
  );

  const toggleSelected = (path: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const removeFiles = async (paths: string[]) => {
    if (!paths.length) return;
    const ok = await confirm({
      title: paths.length === 1 ? "Excluir este arquivo?" : `Excluir ${paths.length} arquivos?`,
      description: "A mídia sai da galeria e deixa de ficar disponível para templates e envios.",
      confirmText: "Excluir",
      destructive: true,
    });
    if (ok) removeMutation.mutate(paths);
  };

  const downloadFile = async (file: GalleryFile) => {
    try {
      const res = await fetch(storageFileUrl(file.path), { credentials: "include" });
      if (!res.ok) throw new Error("Não foi possível baixar o arquivo.");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(href);
    } catch (error: any) {
      toast.error(error?.message || "Falha no download.");
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
    <div
      className="relative flex-1 overflow-y-auto p-4 sm:p-6 pb-10 space-y-5"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        onFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={GALLERY_ACCEPT}
        className="hidden"
        onChange={(event) => {
          onFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />

      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10">
          <p className="text-sm font-medium text-primary">Solte os arquivos para enviar</p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(
          [
            { key: "all", label: "Arquivos", value: counts.all, icon: Images },
            { key: "image", label: "Imagens", value: counts.image, icon: Images },
            { key: "video", label: "Vídeos", value: counts.video, icon: Film },
            { key: "document", label: "Docs e áudios", value: counts.document + counts.audio, icon: FileText },
          ] as const
        ).map((item) => (
          <Card key={item.key} className="border-border/70">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <item.icon className="size-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-semibold tabular-nums">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList className="h-auto min-h-9 w-full flex-wrap justify-start overflow-hidden sm:w-fit">
            <TabsTrigger value="all" className="h-8 flex-none px-3">
              Tudo
            </TabsTrigger>
            <TabsTrigger value="image" className="h-8 flex-none px-3">
              Imagens
            </TabsTrigger>
            <TabsTrigger value="video" className="h-8 flex-none px-3">
              Vídeos
            </TabsTrigger>
            <TabsTrigger value="audio" className="h-8 flex-none px-3">
              Áudios
            </TabsTrigger>
            <TabsTrigger value="document" className="h-8 flex-none px-3">
              Documentos
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar arquivo"
              className="pl-8"
            />
          </div>
          <div className="flex rounded-xl border border-border p-0.5">
            <Button
              type="button"
              size="icon"
              variant={view === "grid" ? "secondary" : "ghost"}
              className="size-8"
              onClick={() => setView("grid")}
              aria-label="Grade"
            >
              <LayoutGrid className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={view === "list" ? "secondary" : "ghost"}
              className="size-8"
              onClick={() => setView("list")}
              aria-label="Lista"
            >
              <List className="size-4" />
            </Button>
          </div>
          <Button type="button" onClick={() => inputRef.current?.click()} disabled={uploadMutation.isPending}>
            <Upload className="size-4" />
            {uploadMutation.isPending ? "Enviando..." : "Enviar mídia"}
          </Button>
        </div>
      </div>

      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-2">
          <p className="text-sm font-medium">{selected.size} selecionado(s)</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set())}>
              Limpar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => removeFiles([...selected])}
            >
              <Trash2 className="size-4" />
              Excluir
            </Button>
          </div>
        </div>
      ) : null}

      {listQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="aspect-square rounded-2xl" />
          ))}
        </div>
      ) : listQuery.isError ? (
        <EmptyState
          icon={Images}
          title="Não foi possível abrir a galeria"
          description={listQuery.error instanceof Error ? listQuery.error.message : "Tente de novo em instantes."}
          action={
            <Button type="button" variant="outline" onClick={() => listQuery.refetch()}>
              Recarregar
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Images}
          title={files.length === 0 ? "Sua galeria está vazia" : "Nenhum arquivo neste filtro"}
          description="Envie imagens, vídeos, áudios ou documentos. Você também pode arrastar os arquivos para esta tela."
          action={
            <Button type="button" onClick={() => inputRef.current?.click()}>
              <Upload className="size-4" />
              Enviar mídia
            </Button>
          }
        />
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((file) => {
            const kind = file.kind || classifyGalleryKind(file.name);
            const checked = selected.has(file.path);
            return (
              <Card
                key={file.path}
                className={cn(
                  "group overflow-hidden border-border/70 transition-shadow hover:shadow-md",
                  checked && "ring-2 ring-primary",
                )}
              >
                <button
                  type="button"
                  className="relative block aspect-square w-full bg-muted"
                  onClick={() => setViewer(file)}
                >
                  {kind === "image" ? (
                    <img
                      src={storageFileUrl(file.path)}
                      alt={file.name}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
                      <KindIcon kind={kind} className="size-8" />
                      <span className="px-2 text-xs uppercase">{fileExtensionLabel(file.name)}</span>
                    </div>
                  )}
                  <Badge className="absolute left-2 top-2" variant="secondary">
                    {kindLabel(kind)}
                  </Badge>
                </button>
                <div className="flex items-start gap-2 p-3">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleSelected(file.path)}
                    aria-label={`Selecionar ${file.name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                  <FileMenu
                    onOpen={() => setViewer(file)}
                    onShare={() => shareMutation.mutate(file.path)}
                    onDownload={() => downloadFile(file)}
                    onDelete={() => removeFiles([file.path])}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border">
          {filtered.map((file) => {
            const kind = file.kind || classifyGalleryKind(file.name);
            const checked = selected.has(file.path);
            return (
              <div
                key={file.path}
                className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-b-0"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleSelected(file.path)}
                  aria-label={`Selecionar ${file.name}`}
                />
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => setViewer(file)}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {kind === "image" ? (
                      <img src={storageFileUrl(file.path)} alt="" className="size-full object-cover" />
                    ) : (
                      <KindIcon kind={kind} className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {kindLabel(kind)} · {formatFileSize(file.size)}
                    </p>
                  </div>
                </button>
                <FileMenu
                  onOpen={() => setViewer(file)}
                  onShare={() => shareMutation.mutate(file.path)}
                  onDownload={() => downloadFile(file)}
                  onDelete={() => removeFiles([file.path])}
                />
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={Boolean(viewer)} onOpenChange={(open) => !open && setViewer(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">{viewer?.name}</DialogTitle>
            <DialogDescription>
              {viewer ? `${kindLabel(viewer.kind || classifyGalleryKind(viewer.name))} · ${formatFileSize(viewer.size)}` : ""}
            </DialogDescription>
          </DialogHeader>
          {viewer ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl bg-muted">
                {(viewer.kind || classifyGalleryKind(viewer.name)) === "image" ? (
                  <img src={storageFileUrl(viewer.path)} alt={viewer.name} className="mx-auto max-h-[60vh] object-contain" />
                ) : (viewer.kind || classifyGalleryKind(viewer.name)) === "video" ? (
                  <video src={storageFileUrl(viewer.path)} controls className="mx-auto max-h-[60vh] w-full" />
                ) : (viewer.kind || classifyGalleryKind(viewer.name)) === "audio" ? (
                  <div className="p-8">
                    <audio src={storageFileUrl(viewer.path)} controls className="w-full" />
                  </div>
                ) : fileExtensionLabel(viewer.name) === "PDF" ? (
                  <iframe title={viewer.name} src={storageFileUrl(viewer.path)} className="h-[60vh] w-full bg-background" />
                ) : (
                  <div className="flex flex-col items-center gap-3 p-10 text-muted-foreground">
                    <FileText className="size-10" />
                    <p className="text-sm">Pré-visualização indisponível para este tipo.</p>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => shareMutation.mutate(viewer.path)}>
                  <Link2 className="size-4" />
                  Compartilhar
                </Button>
                <Button type="button" variant="outline" onClick={() => downloadFile(viewer)}>
                  <Download className="size-4" />
                  Baixar
                </Button>
                <Button type="button" variant="destructive" onClick={() => removeFiles([viewer.path])}>
                  <Trash2 className="size-4" />
                  Excluir
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
}

function fileExtensionLabel(name: string) {
  const ext = name.split(".").pop();
  return ext ? ext.toUpperCase() : "ARQ";
}

function FileMenu({
  onOpen,
  onShare,
  onDownload,
  onDelete,
}: {
  onOpen: () => void;
  onShare: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" size="icon" variant="ghost" className="size-8 shrink-0" aria-label="Ações">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onOpen}>Abrir</DropdownMenuItem>
        <DropdownMenuItem onClick={onShare}>
          <Link2 className="size-4" />
          Copiar link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDownload}>
          <Download className="size-4" />
          Baixar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4" />
          Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
