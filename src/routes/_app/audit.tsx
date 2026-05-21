import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { ScrollText } from "lucide-react";
import { listAuditLogs } from "@/lib/audit.functions";
import { getCurrentUserRoles } from "@/lib/admin.functions";

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

  const { data: roles } = useQuery({ queryKey: ["my-roles"], queryFn: () => fetchRoles() });
  const isAdmin = roles?.isAdmin === true;

  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => fetchLogs({ data: { limit: 200 } }),
  });

  const filtered = (logs ?? []).filter((l) => {
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
        subtitle={isAdmin ? "Todas as ações sensíveis da plataforma." : "Suas ações sensíveis na plataforma."}
      />
      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <Card className="p-4">
          <Input
            placeholder="Buscar por ação, e-mail, entidade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Quando</TableHead>
                    <TableHead>Ação</TableHead>
                    {isAdmin && <TableHead>Usuário</TableHead>}
                    <TableHead>Entidade</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((l) => (
                    <TableRow key={l.id}>
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
                        <TableCell className="text-sm">{l.actor_email ?? <span className="text-muted-foreground">—</span>}</TableCell>
                      )}
                      <TableCell className="text-xs">
                        {l.entity_type ? (
                          <Badge variant="outline" className="font-mono">
                            {l.entity_type}{l.entity_id ? `:${String(l.entity_id).slice(0, 8)}` : ""}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[400px]">
                        <pre className="overflow-x-auto rounded bg-muted/40 p-2 text-[11px] text-muted-foreground">
                          {JSON.stringify(l.metadata ?? {}, null, 0)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
