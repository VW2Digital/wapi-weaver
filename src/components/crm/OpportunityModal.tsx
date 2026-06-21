import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  getOpportunity,
  updateOpportunity,
  deleteOpportunity,
  listActivities,
  createActivity,
  updateActivity,
  deleteActivity,
  listNotes,
  createNote,
  updateNote,
  deleteNote,
  getOpportunityTimeline,
  listLostReasons,
  markOpportunityWon,
  markOpportunityLost,
  reopenOpportunity,
} from "@/lib/crm.functions";
import { listContacts } from "@/lib/contacts.functions";
import {
  Trash2,
  Plus,
  Calendar,
  Clock,
  Pin,
  Check,
  UserPlus,
  MessageCircle,
  FileText,
  Activity,
  User,
  Tags,
  AlertTriangle,
  History,
  Briefcase,
  Smile,
  XCircle,
} from "lucide-react";

interface OpportunityModalProps {
  opportunityId: string | null;
  funnels: any[];
  stages: any[];
  owners: any[];
  onClose: () => void;
}

export function OpportunityModal({
  opportunityId,
  funnels,
  stages,
  owners,
  onClose,
}: OpportunityModalProps) {
  if (!opportunityId) return null;

  const qc = useQueryClient();

  // API wrappers
  const fetchOpp = useServerFn(getOpportunity);
  const updateOpp = useServerFn(updateOpportunity);
  const removeOpp = useServerFn(deleteOpportunity);
  const fetchActs = useServerFn(listActivities);
  const addAct = useServerFn(createActivity);
  const editAct = useServerFn(updateActivity);
  const removeAct = useServerFn(deleteActivity);
  const fetchNotes = useServerFn(listNotes);
  const addNoteFn = useServerFn(createNote);
  const editNoteFn = useServerFn(updateNote);
  const removeNoteFn = useServerFn(deleteNote);
  const fetchTimeline = useServerFn(getOpportunityTimeline);
  const fetchLostReasons = useServerFn(listLostReasons);
  const fetchContacts = useServerFn(listContacts);

  const markWon = useServerFn(markOpportunityWon);
  const markLost = useServerFn(markOpportunityLost);
  const reopenOpp = useServerFn(reopenOpportunity);

  // Queries
  const { data: opportunity, isLoading: loadingOpp, refetch: refetchOppData } = useQuery({
    queryKey: ["opportunity", opportunityId],
    queryFn: () => fetchOpp({ data: { id: opportunityId } }),
    enabled: !!opportunityId,
  });

  const { data: activities, refetch: refetchActsData } = useQuery({
    queryKey: ["opportunity-activities", opportunityId],
    queryFn: () => fetchActs({ data: { opportunity_id: opportunityId } }),
    enabled: !!opportunityId,
  });

  const { data: notes, refetch: refetchNotesData } = useQuery({
    queryKey: ["opportunity-notes", opportunityId],
    queryFn: () => fetchNotes({ data: { opportunity_id: opportunityId } }),
    enabled: !!opportunityId,
  });

  const { data: timeline, refetch: refetchTimelineData } = useQuery({
    queryKey: ["opportunity-timeline", opportunityId],
    queryFn: () => fetchTimeline({ data: { opportunity_id: opportunityId } }),
    enabled: !!opportunityId,
  });

  const { data: lostReasons } = useQuery({
    queryKey: ["lost-reasons"],
    queryFn: () => fetchLostReasons(),
  });

  const { data: allContacts } = useQuery({
    queryKey: ["contacts-list"],
    queryFn: () => fetchContacts(),
  });

  // Local Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [funnelId, setFunnelId] = useState("");
  const [stageId, setStageId] = useState("");
  const [primaryContactId, setPrimaryContactId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [value, setValue] = useState(0);
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [source, setSource] = useState("");
  const [temperature, setTemperature] = useState<"cold" | "warm" | "hot">("cold");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [tagsStr, setTagsStr] = useState("");

  // Notes state
  const [newNoteBody, setNewNoteBody] = useState("");

  // Activities state
  const [actTitle, setActTitle] = useState("");
  const [actDesc, setActDesc] = useState("");
  const [actType, setActType] = useState<"call" | "email" | "meeting" | "task" | "note" | "whatsapp" | "proposal" | "follow_up" | "other">("task");
  const [actDue, setActDue] = useState("");

  // Secondary contact association state
  const [selectedAddContactId, setSelectedAddContactId] = useState("");
  const [addContactRole, setAddContactRole] = useState("");
  const [additionalContacts, setAdditionalContacts] = useState<any[]>([]);

  // Lost modal state
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [selectedLostReasonId, setSelectedLostReasonId] = useState("");
  const [lostReasonText, setLostReasonText] = useState("");

  useEffect(() => {
    if (opportunity) {
      setTitle(opportunity.title || "");
      setDescription(opportunity.description || "");
      setFunnelId(opportunity.funnel_id || "");
      setStageId(opportunity.stage_id || "");
      setPrimaryContactId(opportunity.primary_contact_id || "");
      setCompanyName(opportunity.company_name || "");
      setOwnerUserId(opportunity.owner_user_id || "");
      setValue(Number(opportunity.value) || 0);
      setExpectedCloseDate(
        opportunity.expected_close_date
          ? new Date(opportunity.expected_close_date).toISOString().split("T")[0]
          : ""
      );
      setSource(opportunity.source || "");
      setTemperature(opportunity.temperature || "cold");
      setPriority(opportunity.priority || "medium");
      setTagsStr((opportunity.tags || []).map((t: any) => t.name).join(", "));
      setAdditionalContacts(opportunity.additional_contacts || []);
    }
  }, [opportunity]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const tagsList = tagsStr
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const payload = {
        title,
        description: description || null,
        funnel_id: funnelId,
        stage_id: stageId,
        primary_contact_id: primaryContactId || null,
        company_name: companyName || null,
        owner_user_id: ownerUserId || null,
        value,
        currency: "BRL",
        expected_close_date: expectedCloseDate || null,
        source: source || null,
        temperature: temperature || null,
        priority,
        tags: tagsList,
        additional_contacts: additionalContacts.map((c) => ({
          contact_id: c.contact_id,
          role: c.role,
        })),
      };

      return updateOpp({ data: { id: opportunityId, data: payload } });
    },
    onSuccess: () => {
      toast.success("Oportunidade salva com sucesso");
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      refetchOppData();
      refetchTimelineData();
    },
    onError: (err: any) => {
      toast.error(err.message || "Falha ao salvar oportunidade");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => removeOpp({ data: { id: opportunityId } }),
    onSuccess: () => {
      toast.success("Oportunidade arquivada");
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      onClose();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao arquivar"),
  });

  // Action mutations
  const winMutation = useMutation({
    mutationFn: () => markWon({ data: { id: opportunityId } }),
    onSuccess: () => {
      toast.success("Oportunidade ganha! 🏆");
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      refetchOppData();
      refetchTimelineData();
    },
  });

  const lostMutation = useMutation({
    mutationFn: () =>
      markLost({
        data: {
          id: opportunityId,
          lost_reason_id: selectedLostReasonId,
          lost_reason_text: lostReasonText,
        },
      }),
    onSuccess: () => {
      toast.success("Oportunidade perdida");
      setLostDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      refetchOppData();
      refetchTimelineData();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const reopenMutation = useMutation({
    mutationFn: () => reopenOpp({ data: { id: opportunityId, target_stage_id: stages[0]?.id } }),
    onSuccess: () => {
      toast.success("Oportunidade reaberta");
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      refetchOppData();
      refetchTimelineData();
    },
  });

  // Notes mutation
  const noteMutation = useMutation({
    mutationFn: () => addNoteFn({ data: { opportunity_id: opportunityId, body: newNoteBody } }),
    onSuccess: () => {
      setNewNoteBody("");
      refetchNotesData();
      refetchTimelineData();
    },
  });

  // Activities mutation
  const activityMutation = useMutation({
    mutationFn: () =>
      addAct({
        data: {
          opportunity_id: opportunityId,
          title: actTitle,
          description: actDesc || null,
          type: actType,
          due_at: actDue ? new Date(actDue).toISOString() : null,
          status: "pending",
        },
      }),
    onSuccess: () => {
      setActTitle("");
      setActDesc("");
      setActDue("");
      refetchActsData();
      refetchTimelineData();
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const completeActMutation = useMutation({
    mutationFn: (act: any) =>
      editAct({
        data: {
          id: act.id,
          data: {
            ...act,
            status: "done",
            completed_at: new Date().toISOString(),
          },
        },
      }),
    onSuccess: () => {
      refetchActsData();
      refetchTimelineData();
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
  });

  // Add additional contact
  const handleAddSecondaryContact = () => {
    if (!selectedAddContactId) return;
    const contact = (allContacts ?? []).find((c: any) => c.id === selectedAddContactId);
    if (!contact) return;

    if (additionalContacts.some((c) => c.contact_id === selectedAddContactId)) {
      toast.warning("Contato já adicionado");
      return;
    }

    setAdditionalContacts([
      ...additionalContacts,
      {
        contact_id: selectedAddContactId,
        name: contact.name,
        email: contact.email,
        phone_e164: contact.phone_e164,
        role: addContactRole || "Influenciador",
      },
    ]);
    setSelectedAddContactId("");
    setAddContactRole("");
  };

  const handleRemoveSecondaryContact = (cid: string) => {
    setAdditionalContacts(additionalContacts.filter((c) => c.contact_id !== cid));
  };

  if (loadingOpp) {
    return (
      <Dialog open={!!opportunityId} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl h-[85vh] flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Carregando dados da oportunidade...</span>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={!!opportunityId} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 overflow-hidden bg-card border border-muted-foreground/15 rounded-2xl shadow-xl">
        <DialogHeader className="p-6 border-b border-muted-foreground/10 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <Briefcase className="w-5 h-5 text-primary" />
            <div>
              <DialogTitle className="text-lg font-bold tracking-tight">
                {opportunity?.title || "Detalhes da Oportunidade"}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">Status:</span>
                {opportunity?.status === "open" && (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">Aberto</Badge>
                )}
                {opportunity?.status === "won" && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">Ganho</Badge>
                )}
                {opportunity?.status === "lost" && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20">Perdido</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {opportunity?.status === "open" && (
              <>
                <Button size="sm" variant="outline" className="text-green-500 hover:text-green-600 hover:bg-green-500/10 border-green-500/30" onClick={() => winMutation.mutate()}>
                  Marcar como Ganho
                </Button>
                <Button size="sm" variant="outline" className="text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30" onClick={() => setLostDialogOpen(true)}>
                  Marcar como Perdido
                </Button>
              </>
            )}
            {opportunity?.status !== "open" && (
              <Button size="sm" variant="outline" onClick={() => reopenMutation.mutate()}>
                Reabrir Oportunidade
              </Button>
            )}
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 flex flex-col min-h-0">
          <div className="px-6 border-b border-muted-foreground/10 bg-muted/20">
            <TabsList className="bg-transparent border-none p-0 flex gap-4 h-12">
              <TabsTrigger value="details" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Dados Gerais</TabsTrigger>
              <TabsTrigger value="contacts" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Contatos</TabsTrigger>
              <TabsTrigger value="activities" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Atividades</TabsTrigger>
              <TabsTrigger value="notes" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1">Notas</TabsTrigger>
              <TabsTrigger value="timeline" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 flex items-center gap-1">
                <History className="w-3.5 h-3.5" /> Histórico / Timeline
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {/* TABS CONTENT: DETAILS */}
            <TabsContent value="details" className="space-y-4 m-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Título da Oportunidade</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor do Negócio (BRL)</Label>
                  <Input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Funil de Vendas</Label>
                  <Select value={funnelId} onValueChange={setFunnelId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {funnels.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Etapa Atual</Label>
                  <Select value={stageId} onValueChange={setStageId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.filter((s) => s.funnel_id === funnelId).map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Contato Principal</Label>
                  <Select value={primaryContactId} onValueChange={setPrimaryContactId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um contato" />
                    </SelectTrigger>
                    <SelectContent>
                      {(allContacts ?? []).map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name} ({c.phone_e164})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Nome da Empresa (se houver)</Label>
                  <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex: VW2Digital" />
                </div>
                <div className="space-y-1.5">
                  <Label>Responsável (Dono)</Label>
                  <Select value={ownerUserId} onValueChange={setOwnerUserId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {owners.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.display_name || o.full_name || o.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Previsão de Fechamento</Label>
                  <Input type="date" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Origem (Lead Source)</Label>
                  <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Ex: Instagram, Indicação, etc." />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <Label>Temperatura</Label>
                    <Select value={temperature || "cold"} onValueChange={(v: any) => setTemperature(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cold">Frio</SelectItem>
                        <SelectItem value="warm">Morno</SelectItem>
                        <SelectItem value="hot">Quente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Prioridade</Label>
                    <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Tags (separadas por vírgula)</Label>
                <Input value={tagsStr} onChange={(e) => setTagsStr(e.target.value)} placeholder="Tags..." />
              </div>

              <div className="space-y-1.5">
                <Label>Descrição da Oportunidade / Observações</Label>
                <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva os detalhes comerciais deste deal..." />
              </div>
            </TabsContent>

            {/* TABS CONTENT: CONTACTS */}
            <TabsContent value="contacts" className="space-y-4 m-0">
              <div className="bg-muted/10 border border-muted-foreground/10 rounded-xl p-4">
                <h3 className="font-semibold text-sm mb-3">Associar Outros Contatos</h3>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Select value={selectedAddContactId} onValueChange={setSelectedAddContactId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um contato secundário" />
                      </SelectTrigger>
                      <SelectContent>
                        {(allContacts ?? []).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-[180px]">
                    <Input value={addContactRole} onChange={(e) => setAddContactRole(e.target.value)} placeholder="Papel (ex: Decisor)" />
                  </div>
                  <Button type="button" onClick={handleAddSecondaryContact}>
                    <UserPlus className="w-4 h-4 mr-2" /> Adicionar
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Contatos Associados</h4>
                {opportunity?.primary_contact_id && (
                  <div className="flex items-center justify-between p-3 bg-muted/40 border border-muted-foreground/10 rounded-xl">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      <span className="font-medium text-sm">{opportunity.primary_contact_name}</span>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Contato Principal</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{opportunity.primary_contact_phone}</span>
                  </div>
                )}

                {additionalContacts.map((c) => (
                  <div key={c.contact_id} className="flex items-center justify-between p-3 bg-card border border-muted-foreground/10 rounded-xl hover:bg-muted/10 transition-colors">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{c.name}</span>
                      <Badge variant="outline" className="font-normal">{c.role || "Secundário"}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{c.phone_e164}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveSecondaryContact(c.contact_id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {!opportunity?.primary_contact_id && additionalContacts.length === 0 && (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    Nenhum contato associado.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TABS CONTENT: ACTIVITIES */}
            <TabsContent value="activities" className="space-y-4 m-0">
              <div className="bg-muted/15 border border-muted-foreground/10 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-sm">Criar Nova Atividade</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <Input value={actTitle} onChange={(e) => setActTitle(e.target.value)} placeholder="Título da atividade/tarefa..." />
                  </div>
                  <div>
                    <Select value={actType} onValueChange={(v: any) => setActType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="call">Telefonema 📞</SelectItem>
                        <SelectItem value="whatsapp">Mensagem WhatsApp 💬</SelectItem>
                        <SelectItem value="meeting">Reunião 🤝</SelectItem>
                        <SelectItem value="email">E-mail ✉️</SelectItem>
                        <SelectItem value="proposal">Proposta comercial 📂</SelectItem>
                        <SelectItem value="follow_up">Follow-up ⏳</SelectItem>
                        <SelectItem value="task">Tarefa geral 📋</SelectItem>
                        <SelectItem value="other">Outro ⚙️</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 items-end">
                  <div className="col-span-2">
                    <Input value={actDesc} onChange={(e) => setActDesc(e.target.value)} placeholder="Descrição curta (opcional)..." />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input type="datetime-local" value={actDue} onChange={(e) => setActDue(e.target.value)} />
                    </div>
                    <Button type="button" onClick={() => activityMutation.mutate()} disabled={!actTitle.trim()}>
                      Criar
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Atividades Recentes</h4>
                {(activities ?? []).map((act: any) => (
                  <div key={act.id} className="flex items-center justify-between p-3 border border-muted-foreground/10 rounded-xl hover:bg-muted/5 transition-colors">
                    <div className="flex items-center gap-3">
                      {act.status === "pending" ? (
                        <Button variant="outline" size="icon" className="h-6 w-6 rounded-full hover:bg-success/20" onClick={() => completeActMutation.mutate(act)}>
                          <Check className="w-3.5 h-3.5 text-success opacity-0 hover:opacity-100" />
                        </Button>
                      ) : (
                        <Check className="w-5 h-5 text-success bg-success/10 p-1 rounded-full shrink-0" />
                      )}
                      <div>
                        <p className={`text-sm font-medium ${act.status === "done" ? 'line-through text-muted-foreground' : ''}`}>{act.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Tipo: {act.type} {act.due_at && `· Vence em: ${new Date(act.due_at).toLocaleString("pt-BR")}`}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeAct({ data: { id: act.id, opportunity_id: opportunityId } })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                {(activities ?? []).length === 0 && (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    Nenhuma atividade cadastrada.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TABS CONTENT: NOTES */}
            <TabsContent value="notes" className="space-y-4 m-0">
              <div className="space-y-2">
                <Label>Escrever Nota Rápida</Label>
                <div className="flex gap-2">
                  <Textarea value={newNoteBody} onChange={(e) => setNewNoteBody(e.target.value)} placeholder="Escreva observações ou resumos de reuniões..." />
                  <Button className="h-auto shrink-0" onClick={() => noteMutation.mutate()} disabled={!newNoteBody.trim()}>
                    Salvar Nota
                  </Button>
                </div>
              </div>

              <div className="space-y-3 mt-4">
                <h4 className="font-semibold text-sm">Notas Salvas</h4>
                {(notes ?? []).map((n: any) => (
                  <div key={n.id} className="p-4 bg-muted/20 border border-muted-foreground/10 rounded-xl relative group">
                    <p className="text-sm whitespace-pre-wrap text-foreground">{n.body}</p>
                    <div className="flex items-center justify-between mt-3 text-[11px] text-muted-foreground">
                      <span>Criado por: {n.creator_email || "Sistema"} em {new Date(n.created_at).toLocaleString("pt-BR")}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeNoteFn({ data: { id: n.id } })}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {(notes ?? []).length === 0 && (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    Nenhuma nota adicionada ainda.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TABS CONTENT: TIMELINE */}
            <TabsContent value="timeline" className="space-y-4 m-0">
              <div className="relative border-l-2 border-muted-foreground/10 pl-6 ml-3 space-y-6">
                {(timeline ?? []).map((evt: any, idx: number) => {
                  let icon = <Activity className="w-4 h-4" />;
                  let titleStr = "";
                  let bodyStr = "";

                  if (evt.event_type === "stage_history") {
                    icon = <History className="w-4 h-4 text-blue-500" />;
                    titleStr = `Mapeamento de Etapa`;
                    bodyStr = `Movido de "${evt.from_stage_name || 'Início'}" para "${evt.to_stage_name}" por ${evt.actor_email || 'Sistema'}`;
                    if (evt.reason) bodyStr += ` · Motivo: ${evt.reason}`;
                  } else if (evt.event_type === "note") {
                    icon = <FileText className="w-4 h-4 text-amber-500" />;
                    titleStr = `Nova Nota Comercial`;
                    bodyStr = evt.body;
                  } else if (evt.event_type === "activity") {
                    icon = <Check className="w-4 h-4 text-green-500" />;
                    titleStr = `Atividade: ${evt.title}`;
                    bodyStr = `Tipo: ${evt.type} · Status: ${evt.status === 'done' ? 'Concluída' : 'Pendente'}`;
                    if (evt.description) bodyStr += ` · Descrição: ${evt.description}`;
                  }

                  return (
                    <div key={idx} className="relative">
                      {/* Left timeline dot */}
                      <span className="absolute -left-[35px] top-1 flex h-7 w-7 items-center justify-center rounded-full bg-card border border-muted-foreground/10 shadow-sm">
                        {icon}
                      </span>
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          {new Date(evt.event_date).toLocaleString("pt-BR")}
                        </span>
                        <h4 className="text-sm font-semibold text-foreground mt-0.5">{titleStr}</h4>
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{bodyStr}</p>
                      </div>
                    </div>
                  );
                })}

                {(timeline ?? []).length === 0 && (
                  <div className="py-8 text-center text-muted-foreground text-xs">
                    Nenhum registro histórico encontrado.
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="p-4 border-t border-muted-foreground/10 flex items-center justify-between bg-muted/20">
          <Button variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => deleteMutation.mutate()}>
            Excluir Oportunidade
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>Salvar Alterações</Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Lost Reason Dialog */}
      <Dialog open={lostDialogOpen} onOpenChange={setLostDialogOpen}>
        <DialogContent className="max-w-md bg-card border border-muted-foreground/15 rounded-xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="w-5 h-5" /> Informar Motivo da Perda
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 my-4">
            <div className="space-y-1.5">
              <Label>Selecione o Motivo</Label>
              <Select value={selectedLostReasonId} onValueChange={setSelectedLostReasonId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {(lostReasons ?? []).map((r: any) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Detalhes adicionais (opcional)</Label>
              <Textarea rows={3} value={lostReasonText} onChange={(e) => setLostReasonText(e.target.value)} placeholder="Descreva por que o negócio foi perdido..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostDialogOpen(false)}>Voltar</Button>
            <Button variant="destructive" onClick={() => lostMutation.mutate()} disabled={!selectedLostReasonId}>
              Confirmar Perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
