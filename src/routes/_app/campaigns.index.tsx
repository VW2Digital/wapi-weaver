import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listCampaigns, cancelCampaign, deleteCampaign } from "@/lib/campaigns.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Plus, XCircle, Megaphone, Trash2, MoreVertical, Eye, Pencil } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { useConfirm } from "@/components/confirm-dialog";
import { ListSkeleton } from "@/components/table-skeleton";
import { Badge } from "@/components/ui/badge";
import { CampaignWizard } from "@/components/campaign-wizard";
import { normalizeCampaignTotals } from "@/lib/campaign-totals";

export const Route = createFileRoute("/_app/campaigns/")({ component: CampaignsPage });

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  queued: { label: "Na fila", cls: "bg-warning/15 text-warning-foreground" },
  running: { label: "Enviando", cls: "bg-primary/15 text-primary" },
  done: { label: "Concluída", cls: "bg-success/15 text-success" },
  failed: { label: "Falhou", cls: "bg-destructive/15 text-destructive" },
  cancelled: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
};

function CampaignsPage() {
  const fetchAll = useServerFn(listCampaigns);
  const cancel = useServerFn(cancelCampaign);
  const remove = useServerFn(deleteCampaign);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ["campaigns"], queryFn: () => fetchAll() });
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any | null>(null);

  const filtered = (data ?? []).filter(
    (c: any) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.status.includes(search.toLowerCase()),
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Campanhas"
        subtitle="Crie disparos em massa para suas listas de contatos."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingCampaign(null)}>
                <Plus className="mr-2 h-4 w-4" /> Nova campanha
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <CampaignWizard
                initialCampaign={editingCampaign}
                onDone={() => {
                  setOpen(false);
                  setEditingCampaign(null);
                  qc.invalidateQueries({ queryKey: ["campaigns"] });
                }}
              />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {(data ?? []).length > 0 && (
          <Input
            className="max-w-sm"
            placeholder="Buscar campanha por nome ou status…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
        <Card>
          {isLoading && <ListSkeleton rows={4} />}
          {!isLoading && (data ?? []).length === 0 && (
            <EmptyState
              icon={Megaphone}
              title="Nenhuma campanha ainda"
              description="Crie sua primeira campanha para disparar mensagens em massa para uma lista de contatos."
              action={
                <Button
                  onClick={() => {
                    setEditingCampaign(null);
                    setOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" /> Nova campanha
                </Button>
              }
            />
          )}
          {!isLoading && (data ?? []).length > 0 && filtered.length === 0 && (
            <EmptyState
              icon={Megaphone}
              title="Nenhuma campanha encontrada"
              description="Tente uma busca diferente."
            />
          )}
          <div className="divide-y">
            {filtered.map((c: any) => {
              const t = normalizeCampaignTotals(c.totals);
              const s = STATUS_LABEL[c.status] ?? STATUS_LABEL.draft;
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-muted/30"
                >
                  <Link to="/campaigns/$id" params={{ id: c.id }} className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className="truncate font-medium">{c.name}</p>
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${s.cls}`}>
                        {s.label}
                      </span>
                      {c.template_diagnostic?.status === "invalid" && (
                        <Badge variant="destructive">Template inválido</Badge>
                      )}
                      {c.template_diagnostic?.status === "legacy_unlinked" && (
                        <Badge variant="outline">Campanha antiga</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {c.message_type} · {new Date(c.created_at).toLocaleString("pt-BR")} ·{" "}
                      {t.sent}/{t.total} enviadas · {t.delivered} entregues · {t.read} lidas ·{" "}
                      {t.failed} falharam
                    </p>
                    {c.template_diagnostic?.status === "invalid" && (
                      <p className="mt-1 text-xs text-destructive">
                        {c.template_diagnostic.message}
                      </p>
                    )}
                  </Link>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Ações</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem asChild>
                          <Link
                            to="/campaigns/$id"
                            params={{ id: c.id }}
                            className="flex w-full items-center cursor-pointer"
                          >
                            <Eye className="mr-2 h-4 w-4 text-muted-foreground" />
                            Detalhes
                          </Link>
                        </DropdownMenuItem>

                        {(c.status === "failed" || c.status === "cancelled") && (
                          <DropdownMenuItem
                            onClick={() => {
                              setEditingCampaign(c);
                              setOpen(true);
                            }}
                            className="cursor-pointer"
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Editar e reenviar
                          </DropdownMenuItem>
                        )}

                        {(c.status === "queued" || c.status === "running") && (
                          <DropdownMenuItem
                            onClick={async () => {
                              const ok = await confirm({
                                title: "Cancelar campanha?",
                                description: (
                                  <>
                                    Mensagens pendentes da campanha <strong>{c.name}</strong> não
                                    serão enviadas.
                                  </>
                                ),
                                destructive: true,
                                confirmText: "Cancelar campanha",
                                cancelText: "Voltar",
                              });
                              if (!ok) return;
                              await cancel({ data: { id: c.id } });
                              toast.success("Campanha cancelada");
                              qc.invalidateQueries({ queryKey: ["campaigns"] });
                            }}
                            className="text-warning focus:text-warning cursor-pointer"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancelar
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuItem
                          onClick={async () => {
                            const ok = await confirm({
                              title: "Excluir campanha?",
                              description: (
                                <>
                                  A campanha <strong>{c.name}</strong> e todas as mensagens
                                  associadas serão removidas permanentemente.
                                </>
                              ),
                              destructive: true,
                              confirmText: "Excluir",
                              cancelText: "Cancelar",
                            });
                            if (!ok) return;
                            await remove({ data: { id: c.id } });
                            toast.success("Campanha excluída");
                            qc.invalidateQueries({ queryKey: ["campaigns"] });
                          }}
                          className="text-destructive focus:text-destructive cursor-pointer"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
