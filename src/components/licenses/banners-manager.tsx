import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  toggleBannerActive,
} from "@/lib/platform-banners.functions";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Megaphone,
  Upload,
  ExternalLink,
  ImageIcon,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useConfirm } from "@/components/confirm-dialog";
import { useRoles } from "@/hooks/use-roles";
import { hasMasterRole } from "@/lib/roles";

export function BannersManager() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBanners = useServerFn(listAllBanners);
  const createMutFn = useServerFn(createBanner);
  const updateMutFn = useServerFn(updateBanner);
  const deleteMutFn = useServerFn(deleteBanner);
  const toggleMutFn = useServerFn(toggleBannerActive);

  const { roles, loading: roleLoading } = useRoles();
  const isAdminMasterUser = hasMasterRole(roles);

  // Dialog state
  const [isOpen, setIsOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["all-platform-banners"],
    queryFn: () => fetchBanners(),
    enabled: isAdminMasterUser,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) => createMutFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-platform-banners"] });
      queryClient.invalidateQueries({ queryKey: ["global-active-banners"] });
      setIsOpen(false);
      resetForm();
      toast.success("Banner promocional criado com sucesso!");
    },
    onError: (err: any) => toast.error(err.message || "Falha ao criar banner."),
  });

  const updateMutation = useMutation({
    mutationFn: (payload: any) => updateMutFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-platform-banners"] });
      queryClient.invalidateQueries({ queryKey: ["global-active-banners"] });
      setIsOpen(false);
      resetForm();
      toast.success("Banner promocional atualizado com sucesso!");
    },
    onError: (err: any) => toast.error(err.message || "Falha ao atualizar banner."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMutFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-platform-banners"] });
      queryClient.invalidateQueries({ queryKey: ["global-active-banners"] });
      toast.success("Banner removido com sucesso!");
    },
    onError: (err: any) => toast.error(err.message || "Falha ao remover banner."),
  });

  const toggleMutation = useMutation({
    mutationFn: (payload: { id: string; is_active: boolean }) => toggleMutFn({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-platform-banners"] });
      queryClient.invalidateQueries({ queryKey: ["global-active-banners"] });
      toast.success("Status do banner alterado com sucesso!");
    },
    onError: (err: any) => toast.error(err.message || "Falha ao alterar status."),
  });

  function resetForm() {
    setEditingBanner(null);
    setTitle("");
    setSubtitle("");
    setCtaLabel("");
    setCtaUrl("");
    setImagePath("");
    setDisplayOrder(0);
    setIsActive(true);
  }

  function openCreateModal() {
    resetForm();
    setIsOpen(true);
  }

  function openEditModal(b: any) {
    setEditingBanner(b);
    setTitle(b.title || "");
    setSubtitle(b.subtitle || "");
    setCtaLabel(b.cta_label || "");
    setCtaUrl(b.cta_url || "");
    setImagePath(b.image_path || "");
    setDisplayOrder(b.display_order || 0);
    setIsActive(b.is_active ?? true);
    setIsOpen(true);
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("app-token") ||
            localStorage.getItem("sb-token") ||
            document.cookie.match(/(?:sb-access-token|wapi_token|app-token|token)=([^;]+)/)?.[1]
          : null;

      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch("/api/storage/global-upload", {
        method: "POST",
        headers,
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro no upload da imagem");
      }

      setImagePath(data.url || data.path);
      toast.success("Imagem enviada com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Falha no envio da imagem.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("O título do banner é obrigatório.");
      return;
    }

    const payload = {
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      cta_label: ctaLabel.trim() || null,
      cta_url: ctaUrl.trim() || null,
      image_path: imagePath.trim() || null,
      display_order: Number(displayOrder) || 0,
      is_active: isActive,
    };

    if (editingBanner) {
      updateMutation.mutate({ id: editingBanner.id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = async (b: any) => {
    const ok = await confirm({
      title: "Excluir Banner Promocional",
      description: `Tem certeza de que deseja excluir o banner "${b.title}"?`,
      confirmText: "Excluir",
      destructive: true,
    });
    if (ok) {
      deleteMutation.mutate(b.id);
    }
  };

  if (roleLoading || !isAdminMasterUser) {
    return null;
  }

  return (
    <Card className="shadow-sm mt-8">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="h-5 w-5 text-primary" /> Banners Promocionais Globais
          </CardTitle>
          <CardDescription className="mt-1">
            Gerencie avisos e banners promocionais exibidos no painel de todas as empresas (clientes).
          </CardDescription>
        </div>
        <Button onClick={openCreateModal} className="gap-2">
          <Plus className="h-4 w-4" /> Criar Banner
        </Button>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando banners...
          </div>
        ) : banners.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground space-y-2">
            <Megaphone className="h-8 w-8 mx-auto opacity-40" />
            <p className="text-sm font-medium">Nenhum banner global cadastrado.</p>
            <p className="text-xs">Clique em "Criar Banner" para publicar o primeiro anúncio.</p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Imagem</TableHead>
                  <TableHead>Título / Subtítulo</TableHead>
                  <TableHead>Call To Action (CTA)</TableHead>
                  <TableHead className="w-[100px]">Ordem</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[120px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banners.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      {b.image_path ? (
                        <img
                          src={b.image_path}
                          alt={b.title}
                          className="h-10 w-14 object-contain rounded bg-muted/50 p-1 border"
                        />
                      ) : (
                        <div className="h-10 w-14 rounded bg-muted/40 flex items-center justify-center border text-muted-foreground">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="font-semibold text-sm text-foreground">{b.title}</div>
                      {b.subtitle && (
                        <div className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">
                          {b.subtitle}
                        </div>
                      )}
                    </TableCell>

                    <TableCell>
                      {b.cta_label ? (
                        <div className="text-xs space-y-0.5">
                          <div className="font-medium text-foreground">{b.cta_label}</div>
                          {b.cta_url && (
                            <a
                              href={b.cta_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-primary hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" /> Link
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {b.display_order}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={b.is_active}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: b.id, is_active: checked })
                          }
                          disabled={toggleMutation.isPending}
                        />
                        <span className="text-xs text-muted-foreground">
                          {b.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(b)}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(b)}
                          className="text-destructive hover:bg-destructive/10"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Modal Criar / Editar Banner */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingBanner ? "Editar Banner Promocional" : "Criar Banner Promocional Global"}
              </DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="b-title">Título do Banner *</Label>
                <Input
                  id="b-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ex: Gerar um token de API"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="b-subtitle">Subtítulo / Descrição</Label>
                <Textarea
                  id="b-subtitle"
                  rows={2}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="ex: Gere um token de API para integrar ferramentas externas..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="b-cta-label">Texto do Botão (CTA)</Label>
                  <Input
                    id="b-cta-label"
                    value={ctaLabel}
                    onChange={(e) => setCtaLabel(e.target.value)}
                    placeholder="ex: Gerar token de API"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="b-cta-url">URL de Destino (CTA)</Label>
                  <Input
                    id="b-cta-url"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="ex: https://site.com/token"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Imagem / Ícone do Banner</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    value={imagePath}
                    onChange={(e) => setImagePath(e.target.value)}
                    placeholder="URL ou path da imagem (ex: global/banners/...)"
                    className="flex-1"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="gap-1 shrink-0"
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Upload
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 items-center pt-2">
                <div className="grid gap-2">
                  <Label htmlFor="b-order">Ordem de Exibição</Label>
                  <Input
                    id="b-order"
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value))}
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch id="b-active" checked={isActive} onCheckedChange={setIsActive} />
                  <Label htmlFor="b-active" className="cursor-pointer">
                    Banner Ativo
                  </Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending || isUploading}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salvar Banner
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
