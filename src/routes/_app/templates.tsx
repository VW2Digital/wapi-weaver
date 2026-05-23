import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTemplates, syncTemplatesFromMeta, seedSampleTemplates, deleteTemplate } from "@/lib/templates.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WhatsAppPreview } from "@/components/whatsapp-preview";
import { RefreshCw, Sparkles, FileText, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { CardGridSkeleton } from "@/components/table-skeleton";
import { TemplateBuilderDialog } from "@/components/template-builder-dialog";
import { useConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_app/templates")({ component: TemplatesPage });

const statusColors: Record<string, string> = {
  APPROVED: "bg-success/15 text-success",
  PENDING: "bg-warning/15 text-warning-foreground",
  REJECTED: "bg-destructive/15 text-destructive",
  PAUSED: "bg-muted text-muted-foreground",
  DISABLED: "bg-muted text-muted-foreground",
};

function TemplatesPage() {
  const fetch = useServerFn(listTemplates);
  const sync = useServerFn(syncTemplatesFromMeta);
  const seed = useServerFn(seedSampleTemplates);
  const remove = useServerFn(deleteTemplate);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { data, isLoading } = useQuery({ queryKey: ["templates"], queryFn: () => fetch() });
  const [search, setSearch] = useState("");

  const syncMut = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r) => { toast.success(`${r.synced} templates sincronizados`); qc.invalidateQueries({ queryKey: ["templates"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const seedMut = useMutation({
    mutationFn: () => seed(),
    onSuccess: (r) => { toast.success(`${r.inserted} templates de exemplo adicionados`); qc.invalidateQueries({ queryKey: ["templates"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Templates"
        subtitle="Modelos aprovados pela Meta. São obrigatórios para iniciar uma conversa."
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
              <Sparkles className="mr-2 h-4 w-4" /> Carregar exemplos
            </Button>
            <Button variant="outline" onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
              <RefreshCw className="mr-2 h-4 w-4" /> Sincronizar
            </Button>
            <TemplateBuilderDialog
              trigger={<Button><Plus className="mr-2 h-4 w-4" /> Novo template</Button>}
            />
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {isLoading && <CardGridSkeleton count={6} />}
        {!isLoading && (data ?? []).length === 0 && (
          <Card>
            <EmptyState
              icon={FileText}
              title="Nenhum template ainda"
              description="Sincronize seus templates aprovados pela Meta ou carregue exemplos para começar."
              action={
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => seedMut.mutate()} disabled={seedMut.isPending}>
                    <Sparkles className="mr-2 h-4 w-4" /> Carregar exemplos
                  </Button>
                  <Button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Sincronizar
                  </Button>
                </div>
              }
            />
          </Card>
        )}
        {!isLoading && (data ?? []).length > 0 && (
          <Input
            className="max-w-sm"
            placeholder="Buscar template por nome, status ou categoria…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {(data ?? [])
            .filter((t: any) => {
              const s = search.toLowerCase();
              return !s || t.name.toLowerCase().includes(s) || t.status.toLowerCase().includes(s) || (t.category ?? "").toLowerCase().includes(s);
            })
            .map((t: any) => (
              <Card key={t.id} className="overflow-hidden">
                <div className="border-b p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{t.name}</p>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[t.status] ?? "bg-muted"}`}>{t.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t.language} · {t.category ?? "—"}</p>
                </div>
                <div className="p-4">
                  <WhatsAppPreview components={t.components ?? []} />
                </div>
              </Card>
            ))}
        </div>
      </div>
    </div>
  );
}
