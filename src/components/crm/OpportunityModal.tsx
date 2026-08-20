import { useState, useEffect, useMemo } from "react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { listCustomFields, getCustomFieldValuesBatch } from "@/lib/custom-fields.functions";
import {
  Trash2,
  Plus,
  Calendar,
  Clock,
  Pin,
  Check,
  CheckCircle2,
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
  Bell,
  MessageSquare,
  Phone,
  X,
  Search,
  Filter,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Zap,
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
  const {
    data: opportunity,
    isLoading: loadingOpp,
    refetch: refetchOppData,
  } = useQuery({
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

  const fetchCustomFields = useServerFn(listCustomFields);
  const fetchCFValues = useServerFn(getCustomFieldValuesBatch);

  const { data: customFields } = useQuery({
    queryKey: ["custom-fields"],
    queryFn: () => fetchCustomFields(),
  });

  const { data: cfValues } = useQuery({
    queryKey: ["custom-field-values", opportunity?.primary_contact_id],
    queryFn: () => fetchCFValues({ data: { contact_ids: [opportunity.primary_contact_id] } }),
    enabled: !!opportunity?.primary_contact_id,
  });

  const cfValueMap = useMemo(() => {
    const map: Record<string, any> = {};
    if (opportunity?.primary_contact_custom_fields) {
      const pcf = opportunity.primary_contact_custom_fields;
      (customFields as any[] ?? []).forEach((f: any) => {
        if (pcf[f.key] !== undefined) {
          map[f.id] = pcf[f.key];
        }
      });
    }
    (cfValues as any[] ?? []).forEach((v: any) => {
      map[v.custom_field_id] = v.value_json ?? v.value;
    });
    return map;
  }, [cfValues, customFields, opportunity?.primary_contact_custom_fields]);

  // Local Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [funnelId, setFunnelId] = useState("");
  const [stageId, setStageId] = useState("");
  const [primaryContactId, setPrimaryContactId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [ownerUserId, setOwnerUserId] = useState("");
  const [value, setValue] = useState(0);
  const [probabilityPercent, setProbabilityPercent] = useState<number | null>(null);
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
  const [actType, setActType] = useState<
    "call" | "email" | "meeting" | "task" | "note" | "whatsapp" | "proposal" | "follow_up" | "other"
  >("task");
  const [actDue, setActDue] = useState("");
  const [actDuration, setActDuration] = useState(30);

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
      setProbabilityPercent(
        opportunity.probability_percent != null ? Number(opportunity.probability_percent) : null,
      );
      setExpectedCloseDate(
        opportunity.expected_close_date
          ? new Date(opportunity.expected_close_date).toISOString().split("T")[0]
          : "",
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
        probability_percent: probabilityPercent,
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
      toast.success("Oportunidade marcada como ganha");
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
      toast.success("Oportunidade marcada como perdida");
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
      toast.success("Nota salva com sucesso");
      setNewNoteBody("");
      refetchNotesData();
      refetchTimelineData();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao salvar nota"),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => removeNoteFn({ data: { id: noteId } }),
    onSuccess: () => {
      toast.success("Nota removida");
      refetchNotesData();
      refetchTimelineData();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao remover nota"),
  });

  const defaultTitlesByType: Record<string, string> = {
    whatsapp: "Mensagem no WhatsApp",
    call: "Ligação Comercial",
    meeting: "Reunião de Alinhamento",
    task: "Tarefa Comercial",
    follow_up: "Follow-up Comercial",
    email: "Envio de E-mail",
    note: "Anotação Comercial",
    proposal: "Apresentação de Proposta",
    other: "Atividade Comercial",
  };

  // Activities mutation
  const activityMutation = useMutation({
    mutationFn: () => {
      const finalTitle = actTitle.trim() || defaultTitlesByType[actType] || "Atividade Comercial";
      return addAct({
        data: {
          opportunity_id: opportunityId,
          title: finalTitle,
          description: actDesc.trim() || null,
          type: actType,
          due_at: actDue ? new Date(actDue).toISOString().slice(0, 19).replace("T", " ") : null,
          status: "pending",
        },
      });
    },
    onSuccess: () => {
      toast.success("Atividade registrada");
      setActTitle("");
      setActDesc("");
      setActDue("");
      refetchActsData();
      refetchTimelineData();
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar atividade"),
  });

  const completeActMutation = useMutation({
    mutationFn: (act: any) =>
      editAct({
        data: {
          id: act.id || act.activity_id,
          data: {
            ...act,
            status: "done",
            completed_at: new Date().toISOString(),
          },
        },
      }),
    onSuccess: () => {
      toast.success("Atividade concluída");
      refetchActsData();
      refetchTimelineData();
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao concluir atividade"),
  });

  const deleteActMutation = useMutation({
    mutationFn: (actId: string) => removeAct({ data: { id: actId, opportunity_id: opportunityId } }),
    onSuccess: () => {
      toast.success("Atividade removida");
      refetchActsData();
      refetchTimelineData();
      qc.invalidateQueries({ queryKey: ["opportunities"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao remover atividade"),
  });

  // Timeline filters and search state
  const [timelineFilter, setTimelineFilter] = useState<
    "all" | "messages" | "activities" | "notes" | "stages"
  >("all");
  const [timelineSearch, setTimelineSearch] = useState("");

  const timelineCounts = useMemo(() => {
    const list = (timeline as any[]) || [];
    return {
      all: list.length,
      messages: list.filter((i) => i.event_type === "message").length,
      activities: list.filter((i) => i.event_type === "activity").length,
      notes: list.filter((i) => i.event_type === "note").length,
      stages: list.filter(
        (i) =>
          i.event_type === "stage_history" ||
          i.event_type === "contact_activity" ||
          i.event_type === "lead_created" ||
          i.event_type === "opp_created",
      ).length,
    };
  }, [timeline]);

  const filteredTimeline = useMemo(() => {
    const list = (timeline as any[]) || [];
    let res = list;

    if (timelineFilter === "messages") {
      res = res.filter((i) => i.event_type === "message");
    } else if (timelineFilter === "activities") {
      res = res.filter((i) => i.event_type === "activity");
    } else if (timelineFilter === "notes") {
      res = res.filter((i) => i.event_type === "note");
    } else if (timelineFilter === "stages") {
      res = res.filter(
        (i) =>
          i.event_type === "stage_history" ||
          i.event_type === "contact_activity" ||
          i.event_type === "lead_created" ||
          i.event_type === "opp_created",
      );
    }

    if (timelineSearch.trim()) {
      const q = timelineSearch.toLowerCase().trim();
      res = res.filter((i) => {
        const t = (i.title || "").toLowerCase();
        const d = (i.description || "").toLowerCase();
        const b = (i.body || "").toLowerCase();
        const a = (i.actor_name || i.actor_email || "").toLowerCase();
        const r = (i.reason || "").toLowerCase();
        const f = (i.from_stage_name || "").toLowerCase();
        const to = (i.to_stage_name || "").toLowerCase();
        const s = (i.sender_name || "").toLowerCase();
        return (
          t.includes(q) ||
          d.includes(q) ||
          b.includes(q) ||
          a.includes(q) ||
          r.includes(q) ||
          f.includes(q) ||
          to.includes(q) ||
          s.includes(q)
        );
      });
    }

    return res;
  }, [timeline, timelineFilter, timelineSearch]);

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
      <Sheet open={!!opportunityId} onOpenChange={onClose}>
        <SheetContent className="w-full data-[side=right]:sm:max-w-5xl h-full flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Carregando dados da oportunidade...</span>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Sheet open={!!opportunityId} onOpenChange={onClose}>
      <SheetContent
        showCloseButton={false}
        onInteractOutside={(e) => e.preventDefault()}
        className="w-full data-[side=right]:sm:max-w-[1100px] h-full flex flex-col p-0 overflow-hidden bg-background border-l border-muted-foreground/15 gap-0"
      >
        <SheetHeader className="px-8 pt-8 pb-4 flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            {(() => {
              const name = opportunity?.primary_contact_name || "S";
              const contact = (allContacts ?? []).find((c: any) => c.id === opportunity?.primary_contact_id);
              const cf = contact?.custom_fields;
              const avatarUrl = (cf && typeof cf === "object") ? (cf.avatar_url || cf.photo_url || cf.photo || cf.picture || cf.image_url || cf.image || "") : "";
              
              const hash = name.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
              const hue = hash % 360;
              const avatarBg = `hsl(${hue}, 60%, 45%)`;
              return (
                <Avatar className="w-12 h-12 shrink-0 border border-muted-foreground/10 ring-2 ring-background">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={name} className="object-cover" />}
                  <AvatarFallback 
                    className="text-lg text-white font-semibold"
                    style={{ backgroundColor: avatarBg }}
                  >
                    {name.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              );
            })()}
            
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <SheetTitle className="text-xl font-semibold tracking-tight">
                  {opportunity?.primary_contact_name || opportunity?.title || "Sem Contato"}
                </SheetTitle>
                {opportunity?.status === "won" && (
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 font-medium">Ganho</Badge>
                )}
                {opportunity?.status === "lost" && (
                  <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 font-medium">Perdido</Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-0.5">
                Último contato: {opportunity?.last_activity_at ? new Date(opportunity.last_activity_at).toLocaleDateString("pt-BR") : "Desconhecido"}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {opportunity?.status === "open" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-500 hover:text-green-600 hover:bg-green-500/10 border-green-500/30"
                  onClick={() => winMutation.mutate()}
                >
                  <Check className="w-4 h-4 mr-1.5" /> Ganho
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/30"
                  onClick={() => setLostDialogOpen(true)}
                >
                  <XCircle className="w-4 h-4 mr-1.5" /> Perdido
                </Button>
              </>
            )}
            {opportunity?.status !== "open" && (
              <Button size="sm" variant="outline" onClick={() => reopenMutation.mutate()}>
                Reabrir Oportunidade
              </Button>
            )}
            
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground shrink-0 ml-1 focus:outline-none"
                onClick={onClose}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        <Tabs defaultValue="activities" className="flex-1 flex flex-col min-h-0">
          <div className="px-8 border-b border-muted-foreground/10">
            <TabsList className="bg-transparent border-none p-0 flex gap-8 h-12 justify-start">
              <TabsTrigger
                value="details"
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 font-medium text-muted-foreground data-[state=active]:text-foreground"
              >
                Negócios
              </TabsTrigger>
              <TabsTrigger
                value="activities"
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 font-medium text-muted-foreground data-[state=active]:text-foreground"
              >
                Atividades
              </TabsTrigger>
              <TabsTrigger
                value="timeline"
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 font-medium text-muted-foreground data-[state=active]:text-foreground"
              >
                Histórico
              </TabsTrigger>
              <TabsTrigger
                value="contacts"
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 font-medium text-muted-foreground data-[state=active]:text-foreground"
              >
                Contato
              </TabsTrigger>
              <TabsTrigger
                value="notes"
                className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-1 font-medium text-muted-foreground data-[state=active]:text-foreground"
              >
                Notas
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {/* TABS CONTENT: DETAILS */}
            <TabsContent value="details" className="space-y-6 m-0">
              <div className="bg-card border border-muted-foreground/10 rounded-xl p-6 shadow-sm space-y-6">
                <h3 className="font-semibold text-lg tracking-tight mb-2">Informações Gerais</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Título da Oportunidade</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-muted/10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Valor do Negócio (BRL)</Label>
                    <Input
                      type="number"
                      value={value}
                      onChange={(e) => setValue(Number(e.target.value))}
                      className="bg-muted/10 h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Probabilidade (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={probabilityPercent ?? ""}
                      onChange={(e) =>
                        setProbabilityPercent(
                          e.target.value ? Math.min(100, Math.max(0, Number(e.target.value))) : null,
                        )
                      }
                      className="bg-muted/10 h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Funil de Vendas</Label>
                    <Select value={funnelId} onValueChange={setFunnelId}>
                      <SelectTrigger className="bg-muted/10 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {funnels.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Etapa Atual</Label>
                    <Select value={stageId} onValueChange={setStageId}>
                      <SelectTrigger className="bg-muted/10 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {stages
                          .filter((s) => s.funnel_id === funnelId)
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contato Principal</Label>
                    <Select value={primaryContactId} onValueChange={setPrimaryContactId}>
                      <SelectTrigger className="bg-muted/10 h-10">
                        <SelectValue placeholder="Selecione um contato" />
                      </SelectTrigger>
                      <SelectContent>
                        {(allContacts ?? []).map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.phone_e164})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nome da Empresa (se houver)</Label>
                    <Input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="Ex: VW2Digital"
                      className="bg-muted/10 h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Responsável (Dono)</Label>
                    <Select value={ownerUserId} onValueChange={setOwnerUserId}>
                      <SelectTrigger className="bg-muted/10 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {owners.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.display_name || o.full_name || o.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Previsão de Fechamento</Label>
                    <Input
                      type="date"
                      value={expectedCloseDate}
                      onChange={(e) => setExpectedCloseDate(e.target.value)}
                      className="bg-muted/10 h-10"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Origem (Lead Source)</Label>
                    <Input
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      placeholder="Ex: Instagram, Indicação, etc."
                      className="bg-muted/10 h-10"
                    />
                  </div>
                  
                  {/* Status Indicators */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Temperatura</Label>
                    <Select
                      value={temperature || "cold"}
                      onValueChange={(v: any) => setTemperature(v)}
                    >
                      <SelectTrigger className="bg-muted/10 h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cold">Frio</SelectItem>
                        <SelectItem value="warm">Morno</SelectItem>
                        <SelectItem value="hot">Quente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Prioridade</Label>
                    <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                      <SelectTrigger className="bg-muted/10 h-10">
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
                  
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags (separadas por vírgula)</Label>
                    <Input
                      value={tagsStr}
                      onChange={(e) => setTagsStr(e.target.value)}
                      placeholder="Ex: Novo Cliente, VIP"
                      className="bg-muted/10 h-10"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Descrição / Observações</Label>
                    <Textarea
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Descreva os detalhes comerciais deste deal..."
                      className="bg-muted/10"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TABS CONTENT: CONTACTS */}
            <TabsContent value="contacts" className="space-y-6 m-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg tracking-tight">Contatos Associados</h3>
                  
                  <div className="space-y-3">
                    {opportunity?.primary_contact_id && (
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl relative overflow-hidden space-y-4">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                              <User className="w-5 h-5" />
                            </div>
                            <div>
                              <span className="font-medium text-sm text-foreground block">
                                {opportunity.primary_contact_name}
                              </span>
                              <span className="text-xs text-muted-foreground block font-mono">
                                +{opportunity.primary_contact_phone}
                              </span>
                              {opportunity.primary_contact_email && (
                                <span className="text-xs text-muted-foreground block truncate max-w-[200px]">
                                  {opportunity.primary_contact_email}
                                </span>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant="outline"
                            className="bg-primary/10 text-primary border-primary/20 self-start"
                          >
                            Principal
                          </Badge>
                        </div>

                        {/* Custom Fields */}
                        {(customFields as any[] ?? []).filter((f: any) => f.show_on_details && f.is_active).length > 0 && (
                          <div className="pt-3 border-t border-primary/10 space-y-2">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                              Dados Personalizados
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                              {(customFields as any[] ?? []).filter((f: any) => f.show_on_details && f.is_active).map((f: any) => {
                                const val = cfValueMap[f.id];
                                let display = "—";
                                if (val !== null && val !== undefined && val !== "") {
                                  display = String(val);
                                  if (f.type === "boolean") display = val === "true" || val === true ? "Sim" : "Não";
                                  if (f.type === "multi_select" && Array.isArray(val)) display = val.join(", ");
                                  if (f.type === "currency") display = `R$ ${val}`;
                                }
                                return (
                                  <div key={f.id} className="text-xs">
                                    <span className="text-muted-foreground block font-medium">{f.label}</span>
                                    <span className="font-semibold text-foreground">{display}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {additionalContacts.map((c) => (
                      <div
                        key={c.contact_id}
                        className="flex items-center justify-between p-4 bg-card border border-muted-foreground/10 rounded-xl hover:border-muted-foreground/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-muted/20 flex items-center justify-center text-muted-foreground">
                            <User className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-sm font-medium text-foreground block">{c.name}</span>
                            <span className="text-xs text-muted-foreground">{c.phone_e164}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-normal bg-muted/10">
                            {c.role || "Secundário"}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleRemoveSecondaryContact(c.contact_id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {!opportunity?.primary_contact_id && additionalContacts.length === 0 && (
                      <div className="py-8 text-center text-muted-foreground text-sm italic border border-dashed border-muted-foreground/20 rounded-xl">
                        Nenhum contato associado.
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Add Contact */}
                <div>
                  <div className="bg-card border border-muted-foreground/10 rounded-xl p-5 shadow-sm space-y-4 sticky top-0">
                    <h3 className="font-semibold text-base mb-1">Adicionar Contato</h3>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contato Existente</Label>
                        <Select value={selectedAddContactId} onValueChange={setSelectedAddContactId}>
                          <SelectTrigger className="bg-muted/10 h-10">
                            <SelectValue placeholder="Selecione um contato" />
                          </SelectTrigger>
                          <SelectContent>
                            {(allContacts ?? []).map((c: any) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Papel na Oportunidade</Label>
                        <Input
                          value={addContactRole}
                          onChange={(e) => setAddContactRole(e.target.value)}
                          placeholder="Ex: Decisor, Influenciador"
                          className="bg-muted/10 h-10"
                        />
                      </div>
                      <Button type="button" onClick={handleAddSecondaryContact} className="w-full h-10">
                        <UserPlus className="w-4 h-4 mr-2" /> Associar Contato
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TABS CONTENT: ACTIVITIES */}
            <TabsContent value="activities" className="space-y-4 m-0">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Histórico Completo do Contato & Atividades (7 cols) */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-base tracking-tight text-foreground">
                        Histórico do Contato & Atividades
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Mensagens de WhatsApp, tarefas, anotações e movimentações integradas.
                      </p>
                    </div>
                    {opportunity?.primary_contact_phone && (
                      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/40 border border-border/40 text-[11px] text-muted-foreground font-mono">
                        <MessageSquare className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span>+{opportunity.primary_contact_phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Search and Category Filters */}
                  <div className="space-y-2.5">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        value={timelineSearch}
                        onChange={(e) => setTimelineSearch(e.target.value)}
                        placeholder="Buscar no histórico (mensagens, tarefas, notas)..."
                        className="pl-9 h-9 text-xs bg-muted/10 border-border/40 rounded-lg"
                      />
                      {timelineSearch && (
                        <button
                          type="button"
                          onClick={() => setTimelineSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                      <Button
                        type="button"
                        size="sm"
                        variant={timelineFilter === "all" ? "default" : "outline"}
                        onClick={() => setTimelineFilter("all")}
                        className="h-7 text-xs px-2.5 rounded-lg shrink-0"
                      >
                        Todos ({timelineCounts.all})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={timelineFilter === "messages" ? "default" : "outline"}
                        onClick={() => setTimelineFilter("messages")}
                        className="h-7 text-xs px-2.5 rounded-lg shrink-0 gap-1.5"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Mensagens ({timelineCounts.messages})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={timelineFilter === "activities" ? "default" : "outline"}
                        onClick={() => setTimelineFilter("activities")}
                        className="h-7 text-xs px-2.5 rounded-lg shrink-0 gap-1.5"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Tarefas ({timelineCounts.activities})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={timelineFilter === "notes" ? "default" : "outline"}
                        onClick={() => setTimelineFilter("notes")}
                        className="h-7 text-xs px-2.5 rounded-lg shrink-0 gap-1.5"
                      >
                        <FileText className="w-3 h-3" />
                        Notas ({timelineCounts.notes})
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={timelineFilter === "stages" ? "default" : "outline"}
                        onClick={() => setTimelineFilter("stages")}
                        className="h-7 text-xs px-2.5 rounded-lg shrink-0 gap-1.5"
                      >
                        <History className="w-3 h-3" />
                        Funil ({timelineCounts.stages})
                      </Button>
                    </div>
                  </div>

                  {/* Timeline Stream */}
                  <div className="relative border-l-2 border-muted-foreground/10 pl-6 ml-3 space-y-5 pt-1">
                    {filteredTimeline.map((evt: any, idx: number) => {
                      if (evt.event_type === "message") {
                        const isIncoming = evt.direction === "incoming";
                        const statusLabels: Record<string, string> = {
                          sent: "Enviada",
                          delivered: "Entregue",
                          read: "Lida",
                          failed: "Falhou",
                        };
                        return (
                          <div key={evt.id || idx} className="relative group">
                            <span
                              className={`absolute -left-[35px] top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background shadow-xs ${
                                isIncoming
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20"
                                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20"
                              }`}
                            >
                              {isIncoming ? (
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                              ) : (
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              )}
                            </span>
                            <div
                              className={`border rounded-xl p-4 transition-all duration-150 shadow-xs ${
                                isIncoming
                                  ? "bg-muted/15 border-border/40 hover:bg-muted/25"
                                  : "bg-primary/[0.03] border-primary/15 hover:bg-primary/[0.06]"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                      isIncoming
                                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                    }`}
                                  >
                                    <MessageSquare className="w-2.5 h-2.5" />
                                    {isIncoming ? "Mensagem Recebida" : "Mensagem Enviada"}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded font-mono">
                                    {evt.channel || "whatsapp"}
                                  </span>
                                  {evt.status && !isIncoming && (
                                    <span className="text-[10px] text-muted-foreground">
                                      • {statusLabels[evt.status] || evt.status}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                                  {new Date(evt.event_date).toLocaleString("pt-BR")}
                                </span>
                              </div>

                              <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed break-words bg-background/50 rounded-lg p-3 border border-border/30">
                                {evt.body || <span className="italic text-muted-foreground">Mídia ou anexo recebido</span>}
                              </div>

                              {evt.sender_name && (
                                <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
                                  <User className="w-3 h-3 text-muted-foreground/70" />
                                  <span>{evt.sender_name}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }

                      if (evt.event_type === "activity") {
                        const isDone = evt.status === "done";
                        const typeIcons: Record<string, any> = {
                          whatsapp: MessageSquare,
                          call: Phone,
                          meeting: Calendar,
                          task: Bell,
                          follow_up: Clock,
                          email: MessageSquare,
                          other: Activity,
                        };
                        const TypeIcon = typeIcons[evt.type] || Activity;
                        const typeLabels: Record<string, string> = {
                          whatsapp: "WhatsApp",
                          call: "Ligação",
                          meeting: "Reunião",
                          task: "Lembrete",
                          follow_up: "Agendamento",
                          email: "E-mail",
                          note: "Nota",
                          proposal: "Proposta",
                          other: "Atividade",
                        };

                        return (
                          <div key={evt.id || evt.activity_id || idx} className="relative group">
                            <span
                              className={`absolute -left-[35px] top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background shadow-xs ${
                                isDone
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20"
                              }`}
                            >
                              {isDone ? <Check className="w-3.5 h-3.5" /> : <TypeIcon className="w-3.5 h-3.5" />}
                            </span>

                            <div className="bg-muted/10 border border-muted-foreground/10 rounded-xl p-4 transition-all duration-150 hover:bg-muted/20 shadow-xs">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/40 border border-border/40 text-muted-foreground">
                                      {typeLabels[evt.type] || evt.type}
                                    </span>
                                    <span
                                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                        isDone
                                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                      }`}
                                    >
                                      {isDone ? "Concluída" : "Pendente"}
                                    </span>
                                  </div>
                                  <p
                                    className={`font-medium text-sm leading-snug ${
                                      isDone ? "line-through text-muted-foreground" : "text-foreground"
                                    }`}
                                  >
                                    {evt.title}
                                  </p>
                                  {evt.description && (
                                    <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed pt-0.5">
                                      {evt.description}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {!isDone && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 font-medium"
                                      onClick={() => completeActMutation.mutate(evt)}
                                    >
                                      <Check className="w-3 h-3 mr-1" /> Concluir
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => deleteActMutation.mutate(evt.id || evt.activity_id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>

                              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-muted-foreground/10 text-[11px] text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3 h-3 text-muted-foreground/70" />
                                  <span>
                                    {evt.due_at ? `Prazo: ${new Date(evt.due_at).toLocaleString("pt-BR")}` : "Sem prazo definido"}
                                  </span>
                                </div>
                                {(evt.assigned_to_name || evt.actor_name || evt.actor_email) && (
                                  <span className="text-[10px] text-muted-foreground/80">
                                    Resp: {evt.assigned_to_name || evt.actor_name || evt.actor_email}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (evt.event_type === "note") {
                        return (
                          <div key={evt.id || evt.note_id || idx} className="relative group">
                            <span className="absolute -left-[35px] top-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border-2 border-background ring-1 ring-amber-500/20 shadow-xs">
                              <FileText className="w-3.5 h-3.5" />
                            </span>

                            <div className="bg-amber-500/[0.03] border border-amber-500/20 rounded-xl p-4 transition-all duration-150 hover:bg-amber-500/[0.06] shadow-xs">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                    Anotação Comercial
                                  </span>
                                  {(evt.actor_name || evt.actor_email) && (
                                    <span className="text-[11px] text-muted-foreground">
                                      Por {evt.actor_name || evt.actor_email}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[11px] text-muted-foreground tabular-nums">
                                    {new Date(evt.event_date).toLocaleString("pt-BR")}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => deleteNoteMutation.mutate(evt.id || evt.note_id)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </div>

                              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                                {evt.body}
                              </p>
                            </div>
                          </div>
                        );
                      }

                      if (evt.event_type === "stage_history") {
                        return (
                          <div key={evt.id || idx} className="relative group">
                            <span className="absolute -left-[35px] top-1 flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border-2 border-background ring-1 ring-sky-500/20 shadow-xs">
                              <History className="w-3.5 h-3.5" />
                            </span>

                            <div className="bg-sky-500/[0.03] border border-sky-500/15 rounded-xl p-4 transition-all duration-150 hover:bg-sky-500/[0.06] shadow-xs">
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                                  Movimentação no Funil
                                </span>
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                  {new Date(evt.event_date).toLocaleString("pt-BR")}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap font-medium text-xs my-2">
                                <span className="px-2.5 py-1 rounded-md bg-muted/60 text-muted-foreground border border-border/40">
                                  {evt.from_stage_name || "Início do Funil"}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                                <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 font-semibold">
                                  {evt.to_stage_name}
                                </span>
                              </div>

                              <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1">
                                <span>Movido por {evt.actor_name || evt.actor_email || "Sistema"}</span>
                                {evt.reason && <span className="italic">Motivo: {evt.reason}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      }

                      if (evt.event_type === "contact_activity") {
                        return (
                          <div key={evt.id || idx} className="relative group">
                            <span className="absolute -left-[35px] top-1 flex h-7 w-7 items-center justify-center rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border-2 border-background ring-1 ring-purple-500/20 shadow-xs">
                              <Zap className="w-3.5 h-3.5" />
                            </span>

                            <div className="bg-purple-500/[0.03] border border-purple-500/15 rounded-xl p-4 transition-all duration-150 hover:bg-purple-500/[0.06] shadow-xs">
                              <div className="flex items-center justify-between gap-2 mb-1.5">
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
                                  Evento do Contato
                                </span>
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                  {new Date(evt.event_date).toLocaleString("pt-BR")}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-foreground">{evt.title}</p>
                              {evt.description && (
                                <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                                  {evt.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      }

                      if (evt.event_type === "lead_created") {
                        return (
                          <div key={evt.id || idx} className="relative group">
                            <span className="absolute -left-[35px] top-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-background ring-1 ring-emerald-500/20 shadow-xs">
                              <UserPlus className="w-3.5 h-3.5" />
                            </span>

                            <div className="bg-emerald-500/[0.03] border border-emerald-500/20 rounded-xl p-3.5 shadow-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-foreground">{evt.title}</span>
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                  {new Date(evt.event_date).toLocaleString("pt-BR")}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{evt.description}</p>
                            </div>
                          </div>
                        );
                      }

                      if (evt.event_type === "opp_created") {
                        return (
                          <div key={evt.id || idx} className="relative group">
                            <span className="absolute -left-[35px] top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary border-2 border-background ring-1 ring-primary/20 shadow-xs">
                              <Briefcase className="w-3.5 h-3.5" />
                            </span>

                            <div className="bg-primary/[0.03] border border-primary/15 rounded-xl p-3.5 shadow-xs">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-foreground">{evt.title}</span>
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                  {new Date(evt.event_date).toLocaleString("pt-BR")}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">{evt.description}</p>
                            </div>
                          </div>
                        );
                      }

                      return null;
                    })}

                    {filteredTimeline.length === 0 && (
                      <div className="py-12 text-center text-muted-foreground text-xs italic border border-dashed border-border/40 rounded-xl bg-muted/[0.03] space-y-1">
                        <p className="font-medium text-foreground/80 text-sm not-italic">
                          Nenhum registro histórico encontrado
                        </p>
                        <p>
                          {timelineSearch
                            ? "Tente buscar com outros termos."
                            : "Mensagens, notas e atividades criadas aparecerão automaticamente aqui."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Criar Atividade (5 cols) */}
                <div className="lg:col-span-5">
                  <div className="bg-card border border-border/40 rounded-xl p-5 shadow-xs space-y-4 sticky top-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-foreground">Criar Nova Atividade</h3>
                      <span className="text-[10px] text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">
                        Agendamento & Tarefas
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      {/* Tipo */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Tipo de Atividade
                        </Label>
                        <Select value={actType} onValueChange={(v: any) => setActType(v)}>
                          <SelectTrigger className="h-9 border-border/40 rounded-lg text-xs bg-muted/10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl shadow-lg border-border/40">
                            <SelectItem value="whatsapp">
                              <div className="flex items-center gap-2 text-xs">
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
                              </div>
                            </SelectItem>
                            <SelectItem value="call">
                              <div className="flex items-center gap-2 text-xs">
                                <Phone className="w-3.5 h-3.5 text-blue-600" /> Ligação
                              </div>
                            </SelectItem>
                            <SelectItem value="meeting">
                              <div className="flex items-center gap-2 text-xs">
                                <Calendar className="w-3.5 h-3.5 text-purple-600" /> Reunião
                              </div>
                            </SelectItem>
                            <SelectItem value="task">
                              <div className="flex items-center gap-2 text-xs">
                                <Bell className="w-3.5 h-3.5 text-amber-600" /> Lembrete / Tarefa
                              </div>
                            </SelectItem>
                            <SelectItem value="follow_up">
                              <div className="flex items-center gap-2 text-xs">
                                <Clock className="w-3.5 h-3.5 text-sky-600" /> Follow-up Comercial
                              </div>
                            </SelectItem>
                            <SelectItem value="email">
                              <div className="flex items-center gap-2 text-xs">
                                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" /> E-mail
                              </div>
                            </SelectItem>
                            <SelectItem value="other">
                              <div className="flex items-center gap-2 text-xs">
                                <Activity className="w-3.5 h-3.5 text-muted-foreground" /> Outro
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Responsável */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Responsável
                        </Label>
                        <Select value={ownerUserId} onValueChange={setOwnerUserId}>
                          <SelectTrigger className="h-9 border-border/40 rounded-lg text-xs bg-muted/10 text-muted-foreground">
                            <SelectValue placeholder="Selecione o responsável" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl shadow-lg border-border/40">
                            {owners.map((o) => (
                              <SelectItem key={o.id} value={o.id} className="text-xs">
                                {o.display_name || o.full_name || o.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Assunto */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Assunto
                        </Label>
                        <Input
                          value={actTitle}
                          onChange={(e) => setActTitle(e.target.value)}
                          placeholder={defaultTitlesByType[actType] || "Ex: Ligação de alinhamento"}
                          className="h-9 border-border/40 rounded-lg text-xs bg-muted/10 placeholder:text-muted-foreground/60"
                        />
                      </div>

                      {/* Agendar para & Duração */}
                      <div className="grid grid-cols-[3fr_2fr] gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Agendar para
                          </Label>
                          <Input
                            type="datetime-local"
                            value={actDue}
                            onChange={(e) => setActDue(e.target.value)}
                            className="h-9 border-border/40 rounded-lg text-xs bg-muted/10 text-muted-foreground"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Duração (min)
                          </Label>
                          <Input
                            type="number"
                            value={actDuration}
                            onChange={(e) => setActDuration(Number(e.target.value))}
                            className="h-9 border-border/40 rounded-lg text-xs bg-muted/10"
                          />
                        </div>
                      </div>

                      {/* Descrição */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Descrição / Detalhes
                        </Label>
                        <Textarea
                          value={actDesc}
                          onChange={(e) => setActDesc(e.target.value)}
                          placeholder="Descreva os pontos a serem tratados nesta atividade..."
                          className="min-h-[85px] border-border/40 rounded-lg bg-muted/10 text-xs placeholder:text-muted-foreground/60 resize-none"
                        />
                      </div>

                      <div className="pt-2">
                        <Button
                          type="button"
                          className="w-full h-10 font-medium rounded-lg text-xs transition-colors"
                          onClick={() => activityMutation.mutate()}
                          disabled={activityMutation.isPending}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1.5" /> Criar Atividade
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TABS CONTENT: NOTES */}
            <TabsContent value="notes" className="space-y-6 m-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg tracking-tight">Anotações</h3>
                  <div className="space-y-4">
                    {(notes ?? []).map((n: any) => (
                      <div
                        key={n.id}
                        className="p-4 bg-muted/10 border border-muted-foreground/10 rounded-xl relative group hover:border-muted-foreground/20 transition-colors"
                      >
                        <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed">{n.body}</p>
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-muted-foreground/10 text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3" />
                            <span>{n.creator_name || n.creator_email || "Sistema"}</span>
                            <span className="px-1.5">•</span>
                            <Clock className="w-3 h-3" />
                            <span>{new Date(n.created_at).toLocaleString("pt-BR")}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-destructive hover:bg-destructive/10"
                            onClick={() => deleteNoteMutation.mutate(n.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {(notes ?? []).length === 0 && (
                      <div className="py-8 text-center text-muted-foreground text-sm italic border border-dashed border-muted-foreground/20 rounded-xl">
                        Nenhuma nota registrada.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="bg-card border border-muted-foreground/10 rounded-xl p-5 shadow-sm space-y-4 sticky top-0">
                    <h3 className="font-semibold text-base mb-1">Adicionar Nova Nota</h3>
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conteúdo</Label>
                        <Textarea
                          value={newNoteBody}
                          onChange={(e) => setNewNoteBody(e.target.value)}
                          placeholder="Escreva observações ou resumos de reuniões..."
                          className="bg-muted/10 min-h-[120px]"
                        />
                      </div>
                      <Button
                        className="w-full h-10 font-medium"
                        onClick={() => noteMutation.mutate()}
                        disabled={!newNoteBody.trim() || noteMutation.isPending}
                      >
                        Salvar Nota
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* TABS CONTENT: TIMELINE */}
            <TabsContent value="timeline" className="space-y-6 m-0">
              <div className="max-w-3xl space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-base tracking-tight text-foreground">
                      Linha do Tempo Completa
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Visão cronológica de todas as interações e alterações comerciais.
                    </p>
                  </div>
                </div>

                {/* Search and Filters */}
                <div className="space-y-2.5">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      value={timelineSearch}
                      onChange={(e) => setTimelineSearch(e.target.value)}
                      placeholder="Buscar no histórico..."
                      className="pl-9 h-9 text-xs bg-muted/10 border-border/40 rounded-lg"
                    />
                    {timelineSearch && (
                      <button
                        type="button"
                        onClick={() => setTimelineSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    <Button
                      type="button"
                      size="sm"
                      variant={timelineFilter === "all" ? "default" : "outline"}
                      onClick={() => setTimelineFilter("all")}
                      className="h-7 text-xs px-2.5 rounded-lg shrink-0"
                    >
                      Todos ({timelineCounts.all})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={timelineFilter === "messages" ? "default" : "outline"}
                      onClick={() => setTimelineFilter("messages")}
                      className="h-7 text-xs px-2.5 rounded-lg shrink-0 gap-1.5"
                    >
                      <MessageSquare className="w-3 h-3" />
                      Mensagens ({timelineCounts.messages})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={timelineFilter === "activities" ? "default" : "outline"}
                      onClick={() => setTimelineFilter("activities")}
                      className="h-7 text-xs px-2.5 rounded-lg shrink-0 gap-1.5"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Tarefas ({timelineCounts.activities})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={timelineFilter === "notes" ? "default" : "outline"}
                      onClick={() => setTimelineFilter("notes")}
                      className="h-7 text-xs px-2.5 rounded-lg shrink-0 gap-1.5"
                    >
                      <FileText className="w-3 h-3" />
                      Notas ({timelineCounts.notes})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={timelineFilter === "stages" ? "default" : "outline"}
                      onClick={() => setTimelineFilter("stages")}
                      className="h-7 text-xs px-2.5 rounded-lg shrink-0 gap-1.5"
                    >
                      <History className="w-3 h-3" />
                      Funil ({timelineCounts.stages})
                    </Button>
                  </div>
                </div>

                {/* Timeline Stream */}
                <div className="relative border-l-2 border-muted-foreground/10 pl-6 ml-3 space-y-5 pt-1">
                  {filteredTimeline.map((evt: any, idx: number) => {
                    if (evt.event_type === "message") {
                      const isIncoming = evt.direction === "incoming";
                      const statusLabels: Record<string, string> = {
                        sent: "Enviada",
                        delivered: "Entregue",
                        read: "Lida",
                        failed: "Falhou",
                      };
                      return (
                        <div key={evt.id || idx} className="relative group">
                          <span
                            className={`absolute -left-[35px] top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background shadow-xs ${
                              isIncoming
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20"
                            }`}
                          >
                            {isIncoming ? (
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            )}
                          </span>
                          <div
                            className={`border rounded-xl p-4 transition-all duration-150 shadow-xs ${
                              isIncoming
                                ? "bg-muted/15 border-border/40 hover:bg-muted/25"
                                : "bg-primary/[0.03] border-primary/15 hover:bg-primary/[0.06]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                                    isIncoming
                                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                  }`}
                                >
                                  <MessageSquare className="w-2.5 h-2.5" />
                                  {isIncoming ? "Mensagem Recebida" : "Mensagem Enviada"}
                                </span>
                                <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded font-mono">
                                  {evt.channel || "whatsapp"}
                                </span>
                                {evt.status && !isIncoming && (
                                  <span className="text-[10px] text-muted-foreground">
                                    • {statusLabels[evt.status] || evt.status}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                                {new Date(evt.event_date).toLocaleString("pt-BR")}
                              </span>
                            </div>

                            <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed break-words bg-background/50 rounded-lg p-3 border border-border/30">
                              {evt.body || <span className="italic text-muted-foreground">Mídia ou anexo recebido</span>}
                            </div>

                            {evt.sender_name && (
                              <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
                                <User className="w-3 h-3 text-muted-foreground/70" />
                                <span>{evt.sender_name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (evt.event_type === "activity") {
                      const isDone = evt.status === "done";
                      const typeIcons: Record<string, any> = {
                        whatsapp: MessageSquare,
                        call: Phone,
                        meeting: Calendar,
                        task: Bell,
                        follow_up: Clock,
                        email: MessageSquare,
                        other: Activity,
                      };
                      const TypeIcon = typeIcons[evt.type] || Activity;
                      const typeLabels: Record<string, string> = {
                        whatsapp: "WhatsApp",
                        call: "Ligação",
                        meeting: "Reunião",
                        task: "Lembrete",
                        follow_up: "Agendamento",
                        email: "E-mail",
                        note: "Nota",
                        proposal: "Proposta",
                        other: "Atividade",
                      };

                      return (
                        <div key={evt.id || evt.activity_id || idx} className="relative group">
                          <span
                            className={`absolute -left-[35px] top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background shadow-xs ${
                              isDone
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20"
                            }`}
                          >
                            {isDone ? <Check className="w-3.5 h-3.5" /> : <TypeIcon className="w-3.5 h-3.5" />}
                          </span>

                          <div className="bg-muted/10 border border-muted-foreground/10 rounded-xl p-4 transition-all duration-150 hover:bg-muted/20 shadow-xs">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/40 border border-border/40 text-muted-foreground">
                                    {typeLabels[evt.type] || evt.type}
                                  </span>
                                  <span
                                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                      isDone
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                    }`}
                                  >
                                    {isDone ? "Concluída" : "Pendente"}
                                  </span>
                                </div>
                                <p
                                  className={`font-medium text-sm leading-snug ${
                                    isDone ? "line-through text-muted-foreground" : "text-foreground"
                                  }`}
                                >
                                  {evt.title}
                                </p>
                                {evt.description && (
                                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed pt-0.5">
                                    {evt.description}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {!isDone && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 font-medium"
                                    onClick={() => completeActMutation.mutate(evt)}
                                  >
                                    <Check className="w-3 h-3 mr-1" /> Concluir
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => deleteActMutation.mutate(evt.id || evt.activity_id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-muted-foreground/10 text-[11px] text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3 text-muted-foreground/70" />
                                <span>
                                  {evt.due_at ? `Prazo: ${new Date(evt.due_at).toLocaleString("pt-BR")}` : "Sem prazo definido"}
                                </span>
                              </div>
                              {(evt.assigned_to_name || evt.actor_name || evt.actor_email) && (
                                <span className="text-[10px] text-muted-foreground/80">
                                  Resp: {evt.assigned_to_name || evt.actor_name || evt.actor_email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (evt.event_type === "note") {
                      return (
                        <div key={evt.id || evt.note_id || idx} className="relative group">
                          <span className="absolute -left-[35px] top-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border-2 border-background ring-1 ring-amber-500/20 shadow-xs">
                            <FileText className="w-3.5 h-3.5" />
                          </span>

                          <div className="bg-amber-500/[0.03] border border-amber-500/20 rounded-xl p-4 transition-all duration-150 hover:bg-amber-500/[0.06] shadow-xs">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                  Anotação Comercial
                                </span>
                                {(evt.actor_name || evt.actor_email) && (
                                  <span className="text-[11px] text-muted-foreground">
                                    Por {evt.actor_name || evt.actor_email}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                  {new Date(evt.event_date).toLocaleString("pt-BR")}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => deleteNoteMutation.mutate(evt.id || evt.note_id)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </div>

                            <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                              {evt.body}
                            </p>
                          </div>
                        </div>
                      );
                    }

                    if (evt.event_type === "stage_history") {
                      return (
                        <div key={evt.id || idx} className="relative group">
                          <span className="absolute -left-[35px] top-1 flex h-7 w-7 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border-2 border-background ring-1 ring-sky-500/20 shadow-xs">
                            <History className="w-3.5 h-3.5" />
                          </span>

                          <div className="bg-sky-500/[0.03] border border-sky-500/15 rounded-xl p-4 transition-all duration-150 hover:bg-sky-500/[0.06] shadow-xs">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-400 border border-sky-500/20">
                                Movimentação no Funil
                              </span>
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                {new Date(evt.event_date).toLocaleString("pt-BR")}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap font-medium text-xs my-2">
                              <span className="px-2.5 py-1 rounded-md bg-muted/60 text-muted-foreground border border-border/40">
                                {evt.from_stage_name || "Início do Funil"}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                              <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 font-semibold">
                                {evt.to_stage_name}
                              </span>
                            </div>

                            <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1">
                              <span>Movido por {evt.actor_name || evt.actor_email || "Sistema"}</span>
                              {evt.reason && <span className="italic">Motivo: {evt.reason}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    if (evt.event_type === "contact_activity") {
                      return (
                        <div key={evt.id || idx} className="relative group">
                          <span className="absolute -left-[35px] top-1 flex h-7 w-7 items-center justify-center rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border-2 border-background ring-1 ring-purple-500/20 shadow-xs">
                            <Zap className="w-3.5 h-3.5" />
                          </span>

                          <div className="bg-purple-500/[0.03] border border-purple-500/15 rounded-xl p-4 transition-all duration-150 hover:bg-purple-500/[0.06] shadow-xs">
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
                                Evento do Contato
                              </span>
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                {new Date(evt.event_date).toLocaleString("pt-BR")}
                              </span>
                            </div>
                            <p className="text-sm font-semibold text-foreground">{evt.title}</p>
                            {evt.description && (
                              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap leading-relaxed">
                                {evt.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    }

                    if (evt.event_type === "lead_created") {
                      return (
                        <div key={evt.id || idx} className="relative group">
                          <span className="absolute -left-[35px] top-1 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-2 border-background ring-1 ring-emerald-500/20 shadow-xs">
                            <UserPlus className="w-3.5 h-3.5" />
                          </span>

                          <div className="bg-emerald-500/[0.03] border border-emerald-500/20 rounded-xl p-3.5 shadow-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-foreground">{evt.title}</span>
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                {new Date(evt.event_date).toLocaleString("pt-BR")}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{evt.description}</p>
                          </div>
                        </div>
                      );
                    }

                    if (evt.event_type === "opp_created") {
                      return (
                        <div key={evt.id || idx} className="relative group">
                          <span className="absolute -left-[35px] top-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary border-2 border-background ring-1 ring-primary/20 shadow-xs">
                            <Briefcase className="w-3.5 h-3.5" />
                          </span>

                          <div className="bg-primary/[0.03] border border-primary/15 rounded-xl p-3.5 shadow-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-foreground">{evt.title}</span>
                              <span className="text-[11px] text-muted-foreground tabular-nums">
                                {new Date(evt.event_date).toLocaleString("pt-BR")}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{evt.description}</p>
                          </div>
                        </div>
                      );
                    }

                    return null;
                  })}

                  {filteredTimeline.length === 0 && (
                    <div className="py-12 text-center text-muted-foreground text-xs italic border border-dashed border-border/40 rounded-xl bg-muted/[0.03] space-y-1">
                      <p className="font-medium text-foreground/80 text-sm not-italic">
                        Nenhum registro histórico encontrado
                      </p>
                      <p>
                        {timelineSearch
                          ? "Tente buscar com outros termos."
                          : "Interações e alterações comerciais aparecerão automaticamente aqui."}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="p-4 border-t border-muted-foreground/10 flex items-center justify-between bg-muted/20 shrink-0">
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => deleteMutation.mutate()}
          >
            Excluir Oportunidade
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              Salvar Alterações
            </Button>
          </div>
        </div>
      </SheetContent>

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
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Detalhes adicionais (opcional)</Label>
              <Textarea
                rows={3}
                value={lostReasonText}
                onChange={(e) => setLostReasonText(e.target.value)}
                placeholder="Descreva por que o negócio foi perdido..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostDialogOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              onClick={() => lostMutation.mutate()}
              disabled={!selectedLostReasonId}
            >
              Confirmar Perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  );
}
