import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getContactDetail, addContactNote, updateContactProfilePhoto } from "@/lib/contacts.functions";
import { listCustomFields, getCustomFieldValuesBatch } from "@/lib/custom-fields.functions";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  MessageSquare,
  Phone,
  Mail,
  Globe,
  Tag,
  MessageCircle,
  TrendingUp,
  Target,
  DollarSign,
  CheckCircle2,
  Clock,
  Calendar,
  Activity,
  Plus,
  FileText,
  Camera,
  Loader2,
} from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { db } from "@/integrations/mysql/client";
import { listAllAgents } from "@/lib/assignment.functions";
import { updateChatStatus } from "@/lib/chat-actions.functions";

export const Route = createFileRoute("/_app/contacts/$id")({ component: ContactDetailPage });

const TYPE_LABEL: Record<string, string> = {
  text: "Texto",
  image: "Imagem",
  audio: "Áudio",
  video: "Vídeo",
  document: "Documento",
  location: "Localização",
  contacts: "Contato",
  reaction: "Reação",
  button: "Botão",
  interactive: "Interativo",
  order: "Pedido",
  system: "Sistema",
};

const DIR_LABEL: Record<string, string> = {
  incoming: "Recebida",
  outgoing: "Enviada",
};

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function ContactDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetch = useServerFn(getContactDetail);
  const addNoteFn = useServerFn(addContactNote);
  const fetchCustomFields = useServerFn(listCustomFields);
  const fetchAgents = useServerFn(listAllAgents);
  const openChat = useServerFn(updateChatStatus);
  const [tab, setTab] = useState<"trajetoria" | "notas" | "metricas" | "historico">("trajetoria");
  const [sidebarTab, setSidebarTab] = useState<"info" | "atividades">("info");
  const [uploading, setUploading] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [notePinned, setNotePinned] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addNoteMut = useMutation({
    mutationFn: (body: string) =>
      addNoteFn({ data: { contact_id: id, body, is_pinned: notePinned } }),
    onSuccess: () => {
      toast.success("Nota adicionada");
      setNoteBody("");
      setNotePinned(false);
      qc.invalidateQueries({ queryKey: ["contact-detail", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openChatMut = useMutation({
    mutationFn: async (contactId: string) =>
      openChat({ data: { contactId, status: "aberto" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      const phone = String(contact.phone_e164 ?? "").replace(/\D/g, "");
      window.location.assign(
        `/chat?contactId=${encodeURIComponent(contact.id)}&phone=${encodeURIComponent(phone)}`,
      );
    },
    onError: (error: any) => toast.error(error.message || "NÃ£o foi possÃ­vel abrir a conversa."),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["contact-detail", id],
    queryFn: () => fetch({ data: { id } }),
  });

  const customFields = useQuery({
    queryKey: ["custom-fields"],
    queryFn: () => fetchCustomFields(),
    staleTime: 60000,
  });
  const agents = useQuery({
    queryKey: ["agents"],
    queryFn: () => fetchAgents(),
    staleTime: 60000,
  });
  const cfValues = useQuery({
    queryKey: ["custom-field-values", id],
    queryFn: () => getCustomFieldValuesBatch({ data: { contact_ids: [id] } }),
    enabled: !!data,
  });
  const cfValueMap: Record<string, any> = {};
  (cfValues.data as any[] ?? []).forEach((v: any) => { cfValueMap[v.custom_field_id] = v.value_json ?? v.value; });

  const contact = data?.contact;

  usePageHeader({
    title: contact ? (contact.name || `+${contact.phone_e164}`) : "Carregando...",
    subtitle: "Detalhes do contato",
    action: contact ? (
      <Button variant="outline" size="sm" asChild>
        <Link to="/contacts">
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Link>
      </Button>
    ) : undefined,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground">Contato não encontrado.</p>
        <Button variant="outline" asChild>
          <Link to="/contacts">
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para contatos
          </Link>
        </Button>
      </div>
    );
  }

  const { messages, opportunities, notes, activities, metrics } = data;

  const avatarUrl =
    (contact.custom_fields as any)?.avatar_url || (contact.custom_fields as any)?.photo_url || null;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 20MB)");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("O arquivo precisa ser uma imagem");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `contacts/${contact.id}/avatar-${Date.now()}.${ext}`;
      const { data: upRes, error: upErr } = await db.storage.from("avatars").upload(path, file);
      if (upErr) throw upErr;
      const uploadedPath = upRes?.path || path;
      const { data: pub } = db.storage.from("avatars").getPublicUrl(uploadedPath);
      const url = pub.publicUrl;
      await updateContactProfilePhoto({ data: { id: contact.id, avatar_url: url } });
      qc.invalidateQueries({ queryKey: ["contact-detail", id] });
      toast.success("Foto do contato atualizada");
    } catch (err: any) {
      toast.error(err.message ?? "Falha ao enviar imagem");
    } finally {
      setUploading(false);
    }
  };

  const tabs = [
    { key: "metricas" as const, label: "Negócios & Métricas", icon: TrendingUp },
    { key: "trajetoria" as const, label: "Histórico de Mensagens", icon: Activity },
    { key: "notas" as const, label: "Notas", icon: MessageCircle },
    { key: "historico" as const, label: "Atividades", icon: Clock },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* COLUNA ESQUERDA (Sidebar fixa do contato) */}
        <aside className="w-full lg:w-80 shrink-0 border-r border-border/40 flex flex-col bg-card/10 overflow-y-auto">
          <div className="p-5 flex flex-col items-center gap-4">
            <div 
              className="group relative cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              title="Clique para alterar a foto do contato"
            >
              {uploading ? (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-full z-10">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full z-10">
                  <Camera className="h-6 w-6 text-white" />
                </div>
              )}
              <Avatar className="h-24 w-24 border-2 border-border/60 shadow-md">
                <AvatarImage src={avatarUrl} alt={contact.name || ""} />
                <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                  {contact.name ? getInitials(contact.name) : "?"}
                </AvatarFallback>
              </Avatar>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleUpload}
              accept="image/*"
              className="hidden"
            />
            <div className="text-center space-y-1">
              <h2 className="text-lg font-semibold truncate max-w-[220px] text-foreground">
                {contact.name || "Sem nome"}
              </h2>
              <p className="text-xs text-muted-foreground font-mono">+{contact.phone_e164}</p>
            </div>
          </div>

          {/* Botões de Ação Rápida */}
          <div className="flex gap-2 px-4 pb-4">
            <Button
              type="button"
              variant="outline" 
              size="sm" 
              className="flex-1 bg-primary/10 hover:bg-primary/20 border-primary/20 text-primary gap-1.5 h-9"
              onClick={() => openChatMut.mutate(contact.id)}
              disabled={openChatMut.isPending}
            >
              {openChatMut.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}
              <span>Mensagem</span>
            </Button>
            {contact.phone_e164 && (
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-500 gap-1.5 h-9" 
                asChild
              >
                <a href={`tel:+${contact.phone_e164}`}>
                  <Phone className="h-4 w-4" />
                  <span>Ligar</span>
                </a>
              </Button>
            )}
          </div>

          {/* Última atividade */}
          <div className="flex items-center justify-center gap-1.5 px-4 pb-5 text-xs text-muted-foreground border-b border-border/40">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="truncate">
              Atividades: {
                activities?.[0]?.created_at 
                  ? new Date(activities[0].created_at).toLocaleDateString("pt-BR")
                  : contact.created_at
                    ? new Date(contact.created_at).toLocaleDateString("pt-BR")
                    : "—"
              }
            </span>
          </div>

          {/* Abas da Sidebar */}
          <div className="flex border-b border-border/40 bg-card/25 text-[10px]">
            <button
              onClick={() => setSidebarTab("info")}
              className={`flex-1 text-center py-2.5 font-bold uppercase tracking-wider border-b-2 transition-colors ${
                sidebarTab === "info"
                  ? "border-primary text-foreground bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Info do Contato
            </button>
            <button
              onClick={() => setSidebarTab("atividades")}
              className={`flex-1 text-center py-2.5 font-bold uppercase tracking-wider border-b-2 transition-colors ${
                sidebarTab === "atividades"
                  ? "border-primary text-foreground bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Atividades Recentes
            </button>
          </div>

          {/* Conteúdo da Aba da Sidebar */}
          <div className="flex-1 overflow-y-auto">
            {sidebarTab === "info" ? (
              <div className="space-y-4 p-4">
                {contact.email && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">E-mail</span>
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{contact.email}</span>
                    </div>
                  </div>
                )}
                {contact.channel && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Canal</span>
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="capitalize">{contact.channel}</span>
                    </div>
                  </div>
                )}
                {contact.kanban_stage_name && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Funil / Estágio</span>
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="flex items-center gap-1.5 font-medium">
                        {contact.kanban_stage_color && (
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: contact.kanban_stage_color }}
                          />
                        )}
                        {contact.kanban_stage_name}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 pt-2">
                  {contact.opted_out ? (
                    <Badge variant="destructive" className="text-[10px]">
                      Opt-out
                    </Badge>
                  ) : null}
                  {contact.is_pinned ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Fixado
                    </Badge>
                  ) : null}
                  {contact.is_archived ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Arquivado
                    </Badge>
                  ) : null}
                </div>

                {(customFields.data as any[] ?? []).filter((f: any) => f.show_on_details && f.is_active).length > 0 && (
                  <div className="pt-3 border-t border-border/40 space-y-3">
                    <h4 className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      <FileText className="h-3.5 w-3.5" />
                      Dados personalizados
                    </h4>
                    <div className="space-y-2.5">
                      {(customFields.data as any[] ?? []).filter((f: any) => f.show_on_details && f.is_active).map((f: any) => {
                        const val = cfValueMap[f.id];
                        let display = "—";
                        if (val !== null && val !== undefined && val !== "") {
                          display = String(val);
                          if (f.type === "boolean") display = val === "true" || val === true ? "Sim" : "Não";
                          if (f.type === "multi_select" && Array.isArray(val)) display = val.join(", ");
                          if (f.type === "currency") display = `R$ ${val}`;
                        }
                        return (
                          <div key={f.id} className="text-sm bg-card/20 p-2 rounded-lg border border-border/40">
                            <span className="text-muted-foreground text-[10px] font-semibold block uppercase tracking-wide">{f.label}</span>
                            <span className="font-medium text-foreground">{display}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {activities.slice(0, 5).length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atividade recente.</p>
                ) : (
                  activities.slice(0, 5).map((act: any) => (
                    <div key={act.id} className="relative pl-5 pb-3 border-l border-border/40 last:border-0 last:pb-0 text-xs">
                      <span className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-primary/30 flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="font-semibold text-foreground truncate max-w-[120px]">{act.title || act.type}</span>
                          <span>
                            {new Date(act.created_at).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                        {act.description && <p className="text-muted-foreground line-clamp-2 leading-relaxed">{act.description}</p>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Rodapé da Sidebar: Resumo do Lead */}
          <div className="p-4 border-t border-border/40 bg-card/15 space-y-3">
            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Resumo do Lead</h4>
            <div className="space-y-2 text-xs">
              {contact.channel && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Canal:</span>
                  <span className="font-semibold capitalize text-foreground">{contact.channel}</span>
                </div>
              )}
              {contact.source && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Origem:</span>
                  <span className="font-semibold capitalize text-foreground">{contact.source}</span>
                </div>
              )}
              {contact.kanban_stage_name && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Estágio Atual:</span>
                  <span className="font-semibold flex items-center gap-1 text-foreground">
                    {contact.kanban_stage_color && (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: contact.kanban_stage_color }} />
                    )}
                    {contact.kanban_stage_name}
                  </span>
                </div>
              )}
              {metrics?.totalValue !== undefined && (
                <div className="flex justify-between pt-2 border-t border-border/20 font-medium">
                  <span className="text-muted-foreground font-semibold">Valor Estimado:</span>
                  <span className="text-emerald-500 font-bold">
                    {metrics.totalValue.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* COLUNA DIREITA (Conteúdo principal) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {/* Header da Coluna Direita */}
          <div className="p-6 border-b border-border/40 bg-card/5 space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/contacts" className="hover:text-foreground transition-colors flex items-center gap-1 font-medium">
                Contatos
              </Link>
              <span>/</span>
              <span className="truncate max-w-[200px] text-foreground font-medium">{contact.name || "Sem nome"}</span>
            </div>

            {/* Título Principal (Estágio Kanban ou Status do Lead) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {contact.kanban_stage_name || contact.status || "Sem funil"}
              </h1>
              
              {/* Metadados Inline */}
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <div>
                  Criado em: <span className="font-semibold text-foreground">{new Date(contact.created_at).toLocaleDateString("pt-BR", { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                {contact.responsible_user_id && (() => {
                  const agent = (agents.data as any[] ?? []).find((a: any) => a.id === contact.responsible_user_id);
                  const agentName = agent ? (agent.full_name || agent.display_name || agent.email) : contact.responsible_user_id;
                  return (
                    <div className="flex items-center gap-1.5 border-l border-border/40 pl-4">
                      <span>Responsável:</span>
                      <Badge variant="outline" className="bg-card/40 px-2 py-0.5 rounded-full text-foreground font-medium text-[10px]">
                        {agentName}
                      </Badge>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Abas Horizontais do Conteúdo */}
          <div className="flex border-b border-border/40 bg-card/20 px-4 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Corpo Principal (Conteúdo da Aba Ativa) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {tab === "metricas" && (
              <div className="space-y-6">
                {/* Cards de Resumo */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="p-4 flex flex-col items-center gap-1 bg-card/35 border-border/40 shadow-sm">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{metrics.msgCount}</span>
                    <span className="text-xs text-muted-foreground">Mensagens</span>
                  </Card>
                  <Card className="p-4 flex flex-col items-center gap-1 bg-card/35 border-border/40 shadow-sm">
                    <Target className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{metrics.openOpps}</span>
                    <span className="text-xs text-muted-foreground">Oportunidades abertas</span>
                  </Card>
                  <Card className="p-4 flex flex-col items-center gap-1 bg-card/35 border-border/40 shadow-sm">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span className="text-2xl font-bold">{metrics.wonOpps}</span>
                    <span className="text-xs text-muted-foreground">Conquistadas</span>
                  </Card>
                  <Card className="p-4 flex flex-col items-center gap-1 bg-card/35 border-border/40 shadow-sm">
                    <DollarSign className="h-5 w-5 text-emerald-500" />
                    <span className="text-2xl font-bold">
                      {metrics.totalValue.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                    <span className="text-xs text-muted-foreground">Valor total</span>
                  </Card>
                </div>

                {opportunities.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                      <Target className="h-4 w-4 text-muted-foreground" />
                      Oportunidades
                    </h3>
                    <div className="grid gap-3">
                      {opportunities.map((opp: any) => (
                        <Card key={opp.id} className="p-4 flex items-center justify-between bg-card/25 border-border/40 shadow-sm hover:border-border/60 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{opp.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {opp.stage_color && (
                                <span
                                  className="inline-block w-2 h-2 rounded-full"
                                  style={{ backgroundColor: opp.stage_color }}
                                />
                              )}
                              <span className="text-xs text-muted-foreground">
                                {opp.stage_name}
                              </span>
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                {opp.status}
                              </Badge>
                            </div>
                          </div>
                          <span className="text-sm font-bold text-foreground shrink-0 ml-3">
                            {Number(opp.value || 0).toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === "trajetoria" && (
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma mensagem encontrada.
                  </p>
                ) : (
                  messages.map((msg: any) => (
                    <Card key={msg.id} className="p-3.5 bg-card/25 border-border/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Badge
                              variant={msg.direction === "incoming" ? "default" : "secondary"}
                              className="text-[9px] px-1.5 py-0"
                            >
                              {DIR_LABEL[msg.direction] || msg.direction}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {TYPE_LABEL[msg.type] || msg.type}
                            </span>
                          </div>
                          <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                            {msg.body || "—"}
                          </p>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(msg.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}

            {tab === "notas" && (
              <div className="space-y-4">
                <Card className="p-4 space-y-3 bg-card/20 border-border/40">
                  <Textarea
                    placeholder="Escreva uma nota sobre este contato..."
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    rows={3}
                    className="resize-none bg-background/50"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notePinned}
                        onChange={(e) => setNotePinned(e.target.checked)}
                        className="rounded border-border bg-background"
                      />
                      <span className="text-xs text-muted-foreground select-none">Fixar nota</span>
                    </label>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!noteBody.trim()) return;
                        addNoteMut.mutate(noteBody.trim());
                      }}
                      disabled={addNoteMut.isPending || !noteBody.trim()}
                    >
                      <Plus className="mr-1 h-4 w-4" /> Adicionar
                    </Button>
                  </div>
                </Card>

                {notes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma nota encontrada.
                  </p>
                ) : (
                  notes.map((note: any) => {
                    const opp = opportunities.find((o: any) => o.id === note.opportunity_id);
                    return (
                      <Card key={note.id} className="p-4 bg-card/25 border-border/40 relative">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {note.is_pinned && (
                              <svg
                                className="h-3.5 w-3.5 text-amber-500 shrink-0"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2Z" />
                              </svg>
                            )}
                            <span className="text-xs font-semibold text-foreground truncate">
                              {opp ? opp.title : "Nota"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {note.creator_name && (
                              <span className="text-[10px] text-muted-foreground font-medium">
                                {note.creator_name}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(note.created_at).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">{note.body}</p>
                      </Card>
                    );
                  })
                )}
              </div>
            )}

            {tab === "historico" && (
              <div className="space-y-3">
                {activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma atividade registrada.
                  </p>
                ) : (
                  activities.map((act: any) => (
                    <Card key={act.id} className="p-3.5 bg-card/25 border-border/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Badge
                              variant={act.type === "webhook_created" ? "default" : "secondary"}
                              className="text-[9px] px-1.5 py-0"
                            >
                              {act.type === "webhook_created"
                                ? "Webhook"
                                : act.type === "webhook_updated"
                                  ? "Atualizado"
                                  : act.title || act.type}
                            </Badge>
                            {act.source_type && (
                              <span className="text-[10px] text-muted-foreground">
                                {act.source_type}
                              </span>
                            )}
                          </div>
                          {act.description && (
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap break-words line-clamp-3 leading-relaxed">
                              {act.description}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(act.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
