import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ScrollText } from "lucide-react";
import { listAuditLogs } from "@/lib/audit.functions";
import { getCurrentUserRoles } from "@/lib/admin.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/audit")({ component: AuditPage });

function actionLabel(a: string) {
  const map: Record<string, string> = {
    "campaign.create": "Criou campanha",
    "campaign.cancel": "Cancelou campanha",
    "campaign.export": "Exportou relatório",
    "platform_settings.update": "Alterou configurações da plataforma",
    "contacts.bulk_delete": "Excluiu contatos em massa",
    "contacts.bulk_optout": "Marcou opt-out em massa",
    "contacts.bulk_add_list": "Adicionou contatos a uma lista",
    "contacts.bulk_add_tag": "Aplicou tag em massa",
  };
  return map[a] ?? a;
}

function AuditPage() {
  const fetchRoles = useServerFn(getCurrentUserRoles);
  const fetchLogs = useServerFn(listAuditLogs);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const { data: roles } = useQuery({ queryKey: ["my-roles"], queryFn: () => fetchRoles() });
  const isAdmin = roles?.isAdmin === true;

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page],
    queryFn: () => fetchLogs({ data: { limit: 20, page } }),
  });

  const logs = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const filtered = (logs ?? []).filter((l: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.action.toLowerCase().includes(s) ||
      (l.actor_email ?? "").toLowerCase().includes(s) ||
      (l.entity_type ?? "").toLowerCase().includes(s) ||
      (l.entity_id ?? "").toLowerCase().includes(s)
    );
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Log de auditoria"
        subtitle={
          isAdmin
            ? "Todas as ações sensíveis da plataforma."
            : "Suas ações sensíveis na plataforma."
        }
      />
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <Card className="p-4">
          <Input
            placeholder="Buscar por ação, e-mail, entidade…"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="max-w-md"
          />
        </Card>

        <Card className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="Nenhum registro"
              description="Ações relevantes (criar/cancelar campanha, alterar configurações, exportar relatório, operações em massa) aparecerão aqui."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Quando</TableHead>
                      <TableHead>Ação</TableHead>
                      {isAdmin && <TableHead>Usuário</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((l: any) => (
                      <TableRow
                        key={l.id}
                        className="cursor-pointer hover:bg-muted/40 transition-colors"
                        onClick={() => setSelectedLog(l)}
                      >
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(l.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{actionLabel(l.action)}</span>
                            <code className="text-[10px] text-muted-foreground">{l.action}</code>
                          </div>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-sm">
                            {l.actor_email ?? <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {total > 0 && (
                <div className="flex items-center justify-between border-t p-4 text-xs md:text-sm text-muted-foreground bg-muted/10">
                  <div>
                    Mostrando {Math.min(total, (page - 1) * 20 + 1)} a {Math.min(total, page * 20)}{" "}
                    de {total} registros
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="h-8 px-2"
                    >
                      Anterior
                    </Button>
                    <span className="text-xs md:text-sm font-medium text-foreground px-2">
                      Página {page} de {Math.max(1, totalPages)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="h-8 px-2"
                    >
                      Próximo
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <Dialog open={selectedLog !== null} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-lg font-semibold">
              Detalhes do Evento de Auditoria
            </DialogTitle>
            <DialogDescription>Informações completas registradas para esta ação.</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="mt-4 space-y-6">
              <div className="grid grid-cols-2 gap-4 border-b pb-4">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Quando
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {new Date(selectedLog.created_at).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Ação
                  </div>
                  <div className="mt-1 flex flex-col">
                    <span className="text-sm font-medium">{actionLabel(selectedLog.action)}</span>
                    <code className="text-[10px] text-muted-foreground mt-0.5">
                      {selectedLog.action}
                    </code>
                  </div>
                </div>
                {isAdmin && (
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Usuário
                    </div>
                    <div className="mt-1 text-sm font-medium">{selectedLog.actor_email ?? "—"}</div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      ID: {selectedLog.user_id ?? "—"}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Entidade
                  </div>
                  <div className="mt-1">
                    {selectedLog.entity_type ? (
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="font-mono w-fit">
                          {selectedLog.entity_type}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          ID: {selectedLog.entity_id ?? "—"}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Metadados / Dados Relacionados
                </div>
                <pre className="overflow-x-auto rounded-xl bg-muted p-4 text-xs text-muted-foreground font-mono max-h-[300px]">
                  {JSON.stringify(selectedLog.metadata ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
