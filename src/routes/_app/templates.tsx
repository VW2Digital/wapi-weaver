import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTemplates, syncTemplatesFromMeta } from "@/lib/templates.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

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
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["templates"], queryFn: () => fetch() });

  const syncMut = useMutation({
    mutationFn: () => sync(),
    onSuccess: (r) => { toast.success(`${r.synced} templates sincronizados`); qc.invalidateQueries({ queryKey: ["templates"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Templates"
        subtitle="Modelos aprovados pela Meta. São obrigatórios para iniciar uma conversa."
        action={<Button onClick={() => syncMut.mutate()} disabled={syncMut.isPending}><RefreshCw className="mr-2 h-4 w-4" /> Sincronizar com Meta</Button>}
      />
      <div className="p-6">
        <Card>
          <div className="grid grid-cols-1 divide-y md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="divide-y">
              {isLoading && <p className="p-6 text-muted-foreground">Carregando…</p>}
              {!isLoading && (data ?? []).length === 0 && (
                <p className="p-6 text-sm text-muted-foreground">Nenhum template. Clique em <strong>Sincronizar</strong> para buscar os modelos aprovados na Meta.</p>
              )}
              {(data ?? []).map((t: any) => (
                <div key={t.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{t.name}</p>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColors[t.status] ?? "bg-muted"}`}>{t.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t.language} · {t.category ?? "—"}</p>
                  <div className="mt-2 space-y-1 text-xs">
                    {(t.components ?? []).map((c: any, i: number) => (
                      <div key={i} className="rounded bg-muted/50 p-2">
                        <span className="font-mono text-[10px] uppercase text-muted-foreground">{c.type}</span>
                        <p className="mt-0.5">{c.text ?? c.format ?? JSON.stringify(c).slice(0, 200)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden p-6 md:block">
              <h3 className="font-display text-base font-semibold">Variáveis dinâmicas</h3>
              <p className="mt-2 text-sm text-muted-foreground">Templates podem ter placeholders <code>{`{{1}}`}</code>, <code>{`{{2}}`}</code> etc no corpo. Na criação de campanha, você define o valor de cada variável.</p>
              <p className="mt-3 text-sm text-muted-foreground">Use <code>{`{{name}}`}</code> nos seus textos para usar o nome do contato, ou <code>{`{{empresa}}`}</code> para qualquer campo custom.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
