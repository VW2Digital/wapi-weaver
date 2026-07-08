import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  listIncomingWebhooks,
  createIncomingWebhook,
  updateIncomingWebhookStatus,
  regenerateIncomingWebhookToken,
  listIncomingWebhookEvents,
  updateIncomingWebhookFieldLabels,
  listOutgoingWebhooks,
  createOutgoingWebhook,
  updateOutgoingWebhookStatus,
  deleteOutgoingWebhook,
  listOutgoingWebhookLogs,
} from "@/lib/webhooks.functions";
import { listStandardFields, saveWebhookFieldMappings, listCustomFields } from "@/lib/custom-fields.functions";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Webhook,
  Plus,
  Copy,
  RefreshCw,
  AlertTriangle,
  Check,
  Activity,
  Trash2,
  Lock,
  ChevronRight,
  Save,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/_app/webhooks")({ component: WebhooksPage });

function WebhooksPage() {
  const qc = useQueryClient();
  const fetchIncoming = useServerFn(listIncomingWebhooks);
  const createIncoming = useServerFn(createIncomingWebhook);
  const updateIncomingStatus = useServerFn(updateIncomingWebhookStatus);
  const regenerateIncomingToken = useServerFn(regenerateIncomingWebhookToken);
  const fetchOutgoing = useServerFn(listOutgoingWebhooks);
  const createOutgoing = useServerFn(createOutgoingWebhook);
  const updateOutgoingStatus = useServerFn(updateOutgoingWebhookStatus);
  const deleteOutgoing = useServerFn(deleteOutgoingWebhook);
  const fetchLogs = useServerFn(listOutgoingWebhookLogs);

  const [incomingDialogOpen, setIncomingDialogOpen] = useState(false);
  const [incomingName, setIncomingName] = useState("");
  const [createdIncomingUrl, setCreatedIncomingUrl] = useState<string | null>(null);
  const [outgoingDialogOpen, setOutgoingDialogOpen] = useState(false);
  const [outgoingUrl, setOutgoingUrl] = useState("");
  const [outgoingEventType, setOutgoingEventType] = useState("LEAD_CREATED");
  const [outgoingRetryCount, setOutgoingRetryCount] = useState(3);
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [currentLogs, setCurrentLogs] = useState<any[] | null>(null);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [selectedWebhook, setSelectedWebhook] = useState<any | null>(null);
  const [fieldLabels, setFieldLabels] = useState<Record<string, string>>({});
  const [fieldMappings, setFieldMappings] = useState<any[]>([]);

  const fetchEvents = useServerFn(listIncomingWebhookEvents);
  const saveLabelsFn = useServerFn(updateIncomingWebhookFieldLabels);
  const saveMappingsFn = useServerFn(saveWebhookFieldMappings);
  const fetchStandardFields = useServerFn(listStandardFields);
  const fetchCustomFields = useServerFn(listCustomFields);

  const standardFieldsQ = useQuery({
    queryKey: ["standard-fields"],
    queryFn: () => fetchStandardFields(),
    staleTime: Infinity,
  });
  const customFieldsQ = useQuery({
    queryKey: ["custom-fields"],
    queryFn: () => fetchCustomFields(),
    staleTime: 60000,
  });

  const queryEvents = useQuery({
    queryKey: ["webhook-events", selectedWebhook?.id],
    queryFn: () => fetchEvents({ data: { webhook_id: selectedWebhook!.id } }),
    enabled: !!selectedWebhook,
  });

  const saveLabelsMut = useMutation({
    mutationFn: () =>
      saveLabelsFn({ data: { id: selectedWebhook!.id, labels: fieldLabels } }),
    onSuccess: () => {
      toast.success("Rótulos salvos!");
      queryIncoming.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveMappingsMut = useMutation({
    mutationFn: () =>
      saveMappingsFn({
        data: {
          webhook_id: selectedWebhook!.id,
          mappings: fieldMappings,
        },
      }),
    onSuccess: () => {
      toast.success("Mapeamentos salvos!");
      queryIncoming.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const discoveredFields = (queryEvents.data as any)?.discovered_fields ?? [];
  const events = (queryEvents.data as any)?.events ?? [];
  const [newFieldKey, setNewFieldKey] = useState("");
  const allCustomKeys = Array.from(
    new Set([...discoveredFields, ...Object.keys(fieldLabels)]),
  );

  useEffect(() => {
    if (selectedWebhook) {
      const existing = selectedWebhook.field_labels;
      setFieldLabels(
        existing && existing !== "null"
          ? typeof existing === "string"
            ? JSON.parse(existing)
            : existing
          : {},
      );
      const mappings = selectedWebhook.webhook_field_mappings;
      setFieldMappings(mappings && Array.isArray(mappings) ? mappings : []);
    }
  }, [selectedWebhook]);

  const queryIncoming = useQuery({
    queryKey: ["webhooks-incoming"],
    queryFn: () => fetchIncoming(),
  });

  const queryOutgoing = useQuery({
    queryKey: ["webhooks-outgoing"],
    queryFn: () => fetchOutgoing(),
  });

  const createIncomingMut = useMutation({
    mutationFn: () => createIncoming({ data: { name: incomingName } }),
    onSuccess: (r: any) => {
      toast.success("Webhook de entrada criado!");
      setIncomingDialogOpen(false);
      setCreatedIncomingUrl(
        `${window.location.origin}/api/public/webhooks/incoming/${r.token}`,
      );
      setIncomingName("");
      queryIncoming.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createOutgoingMut = useMutation({
    mutationFn: () =>
      createOutgoing({
        data: {
          url: outgoingUrl,
          event_type: outgoingEventType as any,
          retry_count: outgoingRetryCount,
        },
      }),
    onSuccess: () => {
      toast.success("Webhook de saída criado!");
      setOutgoingDialogOpen(false);
      setOutgoingUrl("");
      setOutgoingEventType("LEAD_CREATED");
      setOutgoingRetryCount(3);
      queryOutgoing.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleIncomingMut = useMutation({
    mutationFn: (vars: { id: string; status: "listening" | "paused" }) =>
      updateIncomingStatus({ data: vars }),
    onSuccess: () => queryIncoming.refetch(),
    onError: (e: any) => toast.error(e.message),
  });

  const regenerateMut = useMutation({
    mutationFn: (id: string) => regenerateIncomingToken({ data: { id } }),
    onSuccess: () => {
      toast.success("Novo token gerado!");
      queryIncoming.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleOutgoingMut = useMutation({
    mutationFn: (vars: { id: string; status: "active" | "paused" }) =>
      updateOutgoingStatus({ data: vars }),
    onSuccess: () => queryOutgoing.refetch(),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteOutgoingMut = useMutation({
    mutationFn: (id: string) => deleteOutgoing({ data: { id } }),
    onSuccess: () => {
      toast.success("Webhook removido!");
      queryOutgoing.refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openLogs = async (webhookId: string) => {
    setLoadingLogs(true);
    setLogsDialogOpen(true);
    try {
      const logs = await fetchLogs({ data: { webhook_id: webhookId } });
      setCurrentLogs(logs as any[]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoadingLogs(false);
    }
  };

  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  usePageHeader({ title: "Webhooks", subtitle: "Webhooks de entrada e saída para conectar sistemas externos." });

  const STANDARD_FIELDS_META = [
    { key: "name", label: "Nome completo do contato" },
    { key: "email", label: "E-mail do contato" },
    { key: "phone", label: "Telefone do contato (com código do país)" },
  ];

  function buildExamplePayload() {
    const example: Record<string, any> = {
      name: "João Silva",
      email: "joao@exemplo.com",
      phone: "5511999998888",
    };
    if (allCustomKeys.length > 0) {
      example.custom_fields = Object.fromEntries(
        allCustomKeys.map((key: string) => [
          key,
          fieldLabels[key]
            ? `Valor do campo "${fieldLabels[key]}"`
            : `valor_do_${key}`,
        ]),
      );
    } else {
      example.custom_fields = { sua_chave: "seu_valor" };
    }
    return example;
  }

  return (
    <div className="p-6 space-y-6">

      {/* Incoming Webhooks */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold">
              Webhooks de Entrada
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Receba contatos automaticamente via POST externo com token de
              segurança.
            </p>
          </div>
          <Button size="sm" onClick={() => setIncomingDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo
          </Button>
        </div>
        {queryIncoming.isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Carregando...</p>
        ) : !queryIncoming.data ||
          (queryIncoming.data as any[]).length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Webhook className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Nenhum webhook de entrada configurado.</p>
            <p className="text-xs mt-1">
              Crie um para receber contatos de sistemas externos.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {(queryIncoming.data as any[]).map((wh: any) => (
              <div
                key={wh.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setSelectedWebhook(wh)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {wh.name}
                    </span>
                    <Badge
                      variant={
                        wh.status === "listening" ? "default" : "secondary"
                      }
                    >
                      {wh.status === "listening" ? "Ativo" : "Pausado"}
                    </Badge>
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate">
                    POST {baseUrl}/api/public/webhooks/incoming/
                    {wh.token?.substring(0, 16)}...
                  </p>
                  <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span>{wh.events_count ?? 0} eventos</span>
                    <span>{wh.leads_count ?? 0} leads</span>
                    {wh.last_event_at && (
                      <span>
                        Último:{" "}
                        {new Date(wh.last_event_at).toLocaleString("pt-BR")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Copiar URL"
                    onClick={(e) => {
                      e.stopPropagation();
                      const url = `${baseUrl}/api/public/webhooks/incoming/${wh.token}`;
                      navigator
                        .clipboard
                        .writeText(url)
                        .then(() => toast.success("URL copiada!"));
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={
                      wh.status === "listening" ? "Pausar" : "Ativar"
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleIncomingMut.mutate({
                        id: wh.id,
                        status:
                          wh.status === "listening" ? "paused" : "listening",
                      });
                    }}
                  >
                    {wh.status === "listening" ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Regenerar token"
                    onClick={(e) => {
                      e.stopPropagation();
                      regenerateMut.mutate(wh.id);
                    }}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Outgoing Webhooks */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold">
              Webhooks de Saída
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Dispare eventos (lead criado, deal movido, etc.) para URLs
              externas.
            </p>
          </div>
          <Button size="sm" onClick={() => setOutgoingDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo
          </Button>
        </div>
        {queryOutgoing.isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Carregando...</p>
        ) : !queryOutgoing.data ||
          (queryOutgoing.data as any[]).length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Webhook className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p>Nenhum webhook de saída configurado.</p>
            <p className="text-xs mt-1">
              Crie um para ser notificado sobre eventos do sistema.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {(queryOutgoing.data as any[]).map((wh: any) => (
              <div
                key={wh.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {wh.url}
                    </span>
                    <Badge
                      variant={
                        wh.status === "active" ? "default" : "secondary"
                      }
                    >
                      {wh.status === "active" ? "Ativo" : "Pausado"}
                    </Badge>
                  </div>
                  <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {wh.event_type}
                    </Badge>
                    <span>{wh.retry_count} retentativas</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Ver logs"
                    onClick={() => openLogs(wh.id)}
                  >
                    <Activity className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={wh.status === "active" ? "Pausar" : "Ativar"}
                    onClick={() =>
                      toggleOutgoingMut.mutate({
                        id: wh.id,
                        status:
                          wh.status === "active" ? "paused" : "active",
                      })
                    }
                  >
                    {wh.status === "active" ? (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Excluir"
                    onClick={() => {
                      if (
                        window.confirm("Excluir este webhook de saída?")
                      )
                        deleteOutgoingMut.mutate(wh.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create Incoming Dialog */}
      <Dialog
        open={incomingDialogOpen}
        onOpenChange={(open) => {
          setIncomingDialogOpen(open);
          if (!open) setCreatedIncomingUrl(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Webhook de Entrada</DialogTitle>
            <DialogDescription>
              {createdIncomingUrl
                ? "URL gerada! Copie abaixo e configure no sistema externo."
                : "Crie um endpoint público para receber contatos automaticamente."}
            </DialogDescription>
          </DialogHeader>
          {createdIncomingUrl ? (
            <div className="space-y-3 py-2">
              <Label>URL do Webhook (POST)</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={createdIncomingUrl}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  onClick={() =>
                    navigator
                      .clipboard
                      .writeText(createdIncomingUrl)
                      .then(() => toast.success("URL copiada!"))
                  }
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Guarde esta URL. Para segurança, o token não será exibido
                novamente.
              </p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <Label>Nome do webhook</Label>
              <Input
                placeholder="Ex: Integração RD Station"
                value={incomingName}
                onChange={(e) => setIncomingName(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            {createdIncomingUrl ? (
              <Button onClick={() => setCreatedIncomingUrl(null)}>
                Fechar
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIncomingDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => createIncomingMut.mutate()}
                  disabled={
                    !incomingName.trim() || createIncomingMut.isPending
                  }
                >
                  {createIncomingMut.isPending ? "Criando..." : "Criar"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Outgoing Dialog */}
      <Dialog
        open={outgoingDialogOpen}
        onOpenChange={setOutgoingDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Webhook de Saída</DialogTitle>
            <DialogDescription>
              Dispare eventos do sistema para uma URL externa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>URL de destino</Label>
              <Input
                placeholder="https://exemplo.com/webhook"
                value={outgoingUrl}
                onChange={(e) => setOutgoingUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo de evento</Label>
              <Select
                value={outgoingEventType}
                onValueChange={setOutgoingEventType}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LEAD_CREATED">Lead Criado</SelectItem>
                  <SelectItem value="LEAD_UPDATED">
                    Lead Atualizado
                  </SelectItem>
                  <SelectItem value="DEAL_CREATED">
                    Negócio Criado
                  </SelectItem>
                  <SelectItem value="DEAL_STEP_CHANGED">
                    Etapa Alterada
                  </SelectItem>
                  <SelectItem value="DEAL_WON">Negócio Ganho</SelectItem>
                  <SelectItem value="DEAL_LOST">
                    Negócio Perdido
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Retentativas</Label>
              <Select
                value={String(outgoingRetryCount)}
                onValueChange={(v) => setOutgoingRetryCount(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sem retentativas</SelectItem>
                  <SelectItem value="1">1 tentativa</SelectItem>
                  <SelectItem value="3">3 tentativas</SelectItem>
                  <SelectItem value="5">5 tentativas</SelectItem>
                  <SelectItem value="10">10 tentativas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOutgoingDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => createOutgoingMut.mutate()}
              disabled={!outgoingUrl.trim() || createOutgoingMut.isPending}
            >
              {createOutgoingMut.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Logs Dialog */}
      <Dialog
        open={logsDialogOpen}
        onOpenChange={setLogsDialogOpen}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Logs do Webhook</DialogTitle>
          </DialogHeader>
          {loadingLogs ? (
            <p className="text-sm text-muted-foreground py-4">
              Carregando logs...
            </p>
          ) : !currentLogs || currentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum log encontrado.
            </p>
          ) : (
            <div className="space-y-2">
              {(currentLogs as any[]).map((log: any, i: number) => (
                <div key={i} className="rounded border p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={log.success ? "default" : "destructive"}
                    >
                      {log.success ? "Sucesso" : "Falha"}
                    </Badge>
                    <span className="font-mono text-muted-foreground">
                      Tentativa {log.attempt_number}
                    </span>
                    <span className="text-muted-foreground">
                      {log.created_at &&
                        new Date(log.created_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    <span className="font-medium">Evento:</span>{" "}
                    {log.event_type}
                  </div>
                  {log.response_status && (
                    <div>
                      <span className="font-medium">Status HTTP:</span>{" "}
                      {log.response_status}
                    </div>
                  )}
                  {log.response_body && (
                    <div>
                      <span className="font-medium">Resposta:</span>{" "}
                      <span className="break-all">
                        {log.response_body}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLogsDialogOpen(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhook Details Sheet */}
      <Sheet open={!!selectedWebhook} onOpenChange={(open) => { if (!open) setSelectedWebhook(null); }}>
        <SheetContent
          className="overflow-y-auto"
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('[data-slot="select-content"]') || target.closest('[role="listbox"]')) {
              e.preventDefault();
            }
          }}
        >
          <SheetHeader>
            <div className="flex items-center gap-2 pr-8">
              <SheetTitle className="truncate">{selectedWebhook?.name}</SheetTitle>
              <Badge variant={selectedWebhook?.status === "listening" ? "default" : "secondary"} className="shrink-0">
                {selectedWebhook?.status === "listening" ? "Ativo" : "Pausado"}
              </Badge>
            </div>
          </SheetHeader>

          <div className="px-6 pb-6 space-y-6">
            {/* URL */}
            {selectedWebhook && (
              <section>
                <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  URL de Chamada
                </h4>
                <div className="flex gap-2">
                  <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-[11px] font-mono truncate">
                    POST {baseUrl}/api/public/webhooks/incoming/{selectedWebhook.token}
                  </code>
                  <Button
                    variant="outline" size="icon" className="shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        `${baseUrl}/api/public/webhooks/incoming/${selectedWebhook.token}`,
                      ).then(() => toast.success("URL copiada!"));
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </section>
            )}

            {/* Example Payload */}
            <section>
              <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Exemplo de Payload
              </h4>
              <p className="text-[10px] text-muted-foreground mb-2">
                Copie e adapte este JSON para enviar ao webhook.
              </p>
              <pre className="rounded-lg bg-muted p-3 text-[11px] font-mono overflow-x-auto">
{JSON.stringify(buildExamplePayload(), null, 2)}
              </pre>
            </section>

            {/* Fields */}
            <section>
              <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Campos Recebidos
              </h4>

              <div className="space-y-1 mb-3">
                <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                  Campos padrão (sempre disponíveis)
                </p>
                {STANDARD_FIELDS_META.map((f) => (
                  <div key={f.key} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <code className="text-xs font-mono w-16 shrink-0">{f.key}</code>
                    <span className="text-xs text-muted-foreground flex-1">{f.label}</span>
                    <Lock className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                  </div>
                ))}
              </div>

              {queryEvents.isLoading ? (
                <p className="text-xs text-muted-foreground">Analisando eventos...</p>
              ) : (
                <div className="space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                    Mapeamento de campos
                  </p>
                  <p className="text-[10px] text-muted-foreground mb-2">
                    Mapeie cada campo recebido para um campo do sistema. Use "ignorar" para descartar campos.
                  </p>

                  {allCustomKeys.map((key: string) => {
                    const mapping = fieldMappings.find((m: any) => m.external_field === key);
                    const targetType = mapping?.target_type ?? "ignore";
                    const targetField = mapping?.target_field ?? "";
                    const transform = mapping?.transform ?? "";

                    const setMapping = (partial: Record<string, any>) => {
                      setFieldMappings((prev) => {
                        const filtered = prev.filter((m: any) => m.external_field !== key);
                        if (partial.target_type !== "ignore") {
                          return [...filtered, { external_field: key, ...partial }];
                        }
                        return filtered;
                      });
                    };

                    return (
                      <div key={key} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <code className="text-xs font-mono font-medium">{key}</code>
                          {discoveredFields.includes(key) && (
                            <Badge variant="outline" className="text-[10px]">descoberto</Badge>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Select
                            value={targetType}
                            onValueChange={(v) => setMapping({ target_type: v, target_field: "", transform: "" })}
                          >
                            <SelectTrigger className="h-8 text-xs w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">Padrão</SelectItem>
                              <SelectItem value="custom">Personalizado</SelectItem>
                              <SelectItem value="ignore">Ignorar</SelectItem>
                            </SelectContent>
                          </Select>
                          {targetType === "standard" && (
                            <Select value={targetField} onValueChange={(v) => setMapping({ target_type: "standard", target_field: v, transform })}>
                              <SelectTrigger className="h-8 text-xs flex-1">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {(standardFieldsQ.data as unknown as any[] ?? []).map((sf: any) => (
                                  <SelectItem key={sf.key} value={sf.key}>{sf.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          {targetType === "custom" && (
                            <Select value={targetField} onValueChange={(v) => setMapping({ target_type: "custom", target_field: v, transform })}>
                              <SelectTrigger className="h-8 text-xs flex-1">
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {(customFieldsQ.data as any[] ?? []).filter((f: any) => f.is_active).map((cf: any) => (
                                  <SelectItem key={cf.id} value={cf.id}>{cf.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        {targetType !== "ignore" && (
                          <Select
                            value={transform}
                            onValueChange={(v) => setMapping({ target_type: targetType, target_field: targetField, transform: v })}
                          >
                            <SelectTrigger className="h-8 text-xs w-full">
                              <SelectValue placeholder="Sem transformação" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">Sem transformação</SelectItem>
                              <SelectItem value="normalize_phone">Normalizar telefone</SelectItem>
                              <SelectItem value="lowercase">Minúsculas</SelectItem>
                              <SelectItem value="uppercase">MAIÚSCULAS</SelectItem>
                              <SelectItem value="trim">Remover espaços</SelectItem>
                              <SelectItem value="parse_number">Converter para número</SelectItem>
                              <SelectItem value="parse_date">Converter para data</SelectItem>
                              <SelectItem value="parse_boolean">Converter para booleano</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    );
                  })}

                  <div className="flex gap-2 pt-1">
                    <Input
                      placeholder="Nome do campo externo"
                      value={newFieldKey}
                      onChange={(e) => setNewFieldKey(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ""))}
                      className="flex-1 h-8 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newFieldKey.trim()) {
                          const key = newFieldKey.trim();
                          if (!fieldMappings.some((m: any) => m.external_field === key)) {
                            setFieldMappings((prev) => [...prev, { external_field: key, target_type: "ignore", target_field: "", transform: "" }]);
                          }
                          setNewFieldKey("");
                        }
                      }}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!newFieldKey.trim()}
                      onClick={() => {
                        const key = newFieldKey.trim();
                        if (!fieldMappings.some((m: any) => m.external_field === key)) {
                          setFieldMappings((prev) => [...prev, { external_field: key, target_type: "ignore", target_field: "", transform: "" }]);
                        }
                        setNewFieldKey("");
                      }}
                    >
                      + Adicionar
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {/* Events */}
            <section>
              <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Últimos Eventos
              </h4>
              {queryEvents.isLoading ? (
                <p className="text-xs text-muted-foreground">Carregando...</p>
              ) : events.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhum evento recebido ainda.</p>
              ) : (
                <div className="space-y-1">
                  {events.map((ev: any) => (
                    <div key={ev.id} className="flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
                      {ev.status === "success" ? (
                        <Check className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-muted-foreground">
                          {new Date(ev.created_at).toLocaleString("pt-BR")}
                        </span>
                        <div className="text-muted-foreground/70 truncate">
                          {ev.fields?.filter((f: string) => f !== "custom_fields").join(", ") || "(vazio)"}
                        </div>
                        {ev.error_message && (
                          <div className="text-red-500 text-[10px] mt-0.5">{ev.error_message}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <SheetFooter>
            <Button
              onClick={() => saveMappingsMut.mutate()}
              disabled={saveMappingsMut.isPending}
            >
              <Save className="h-4 w-4 mr-1.5" />
              {saveMappingsMut.isPending ? "Salvando..." : "Salvar Mapeamentos"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
