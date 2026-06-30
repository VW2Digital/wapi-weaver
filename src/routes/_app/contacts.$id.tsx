import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getContactDetail, addContactNote } from "@/lib/contacts.functions";
import { PageHeader } from "@/components/layout/page-header";
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
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
  const [tab, setTab] = useState<"trajetoria" | "notas" | "metricas">("trajetoria");
  const [noteBody, setNoteBody] = useState("");
  const [notePinned, setNotePinned] = useState(false);

  const addNoteMut = useMutation({
    mutationFn: (body: string) => addNoteFn({ data: { contact_id: id, body, is_pinned: notePinned } }),
    onSuccess: () => {
      toast.success("Nota adicionada");
      setNoteBody("");
      setNotePinned(false);
      qc.invalidateQueries({ queryKey: ["contact-detail", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["contact-detail", id],
    queryFn: () => fetch({ data: { id } }),
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
          <Link to="/contacts"><ArrowLeft className="mr-2 h-4 w-4" /> Voltar para contatos</Link>
        </Button>
      </div>
    );
  }

  const { contact, messages, opportunities, notes, metrics } = data;

  const avatarUrl =
    (contact.custom_fields as any)?.avatar_url ||
    (contact.custom_fields as any)?.photo_url ||
    null;

  const tabs = [
    { key: "trajetoria" as const, label: "Trajetória", icon: Activity },
    { key: "notas" as const, label: "Notas", icon: MessageCircle },
    { key: "metricas" as const, label: "Métricas", icon: TrendingUp },
  ];

  return (
    <div className="h-full flex flex-col">
      <PageHeader
        title={contact.name || `+${contact.phone_e164}`}
        subtitle="Detalhes do contato"
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/chat" search={{ phone: contact.phone_e164 } as any}>
                <MessageSquare className="mr-2 h-4 w-4" /> Enviar mensagem
              </Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link to="/contacts">
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
              </Link>
            </Button>
          </div>
        }
      />

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-72 shrink-0 border-r border-border/40 p-4 space-y-4 overflow-y-auto">
          <div className="flex flex-col items-center gap-3">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl} alt={contact.name || ""} />
              <AvatarFallback className="text-lg">
                {contact.name ? getInitials(contact.name) : "?"}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h2 className="text-lg font-semibold truncate max-w-[200px]">
                {contact.name || "Sem nome"}
              </h2>
              <p className="text-sm text-muted-foreground font-mono">+{contact.phone_e164}</p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/40">
            {contact.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
            {contact.source && (
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>{contact.source}</span>
              </div>
            )}
            {contact.channel && (
              <div className="flex items-center gap-2 text-sm">
                <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="capitalize">{contact.channel}</span>
              </div>
            )}
            {contact.kanban_stage_name && (
              <div className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex items-center gap-1.5">
                  {contact.kanban_stage_color && (
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: contact.kanban_stage_color }}
                    />
                  )}
                  {contact.kanban_stage_name}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/40">
            {contact.opted_out ? (
              <Badge variant="destructive" className="text-[10px]">Opt-out</Badge>
            ) : null}
            {contact.is_pinned ? <Badge variant="secondary" className="text-[10px]">Fixado</Badge> : null}
            {contact.is_archived ? <Badge variant="secondary" className="text-[10px]">Arquivado</Badge> : null}
          </div>
        </aside>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex border-b border-border/40 bg-card/50">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
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

          <div className="flex-1 overflow-y-auto p-4">
            {tab === "trajetoria" && (
              <div className="space-y-3">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma mensagem encontrada.
                  </p>
                ) : (
                  messages.map((msg: any) => (
                    <Card key={msg.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant={msg.direction === "incoming" ? "default" : "secondary"}
                              className="text-[10px]"
                            >
                              {DIR_LABEL[msg.direction] || msg.direction}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {TYPE_LABEL[msg.type] || msg.type}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap break-words line-clamp-3">
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
                <Card className="p-3 space-y-3">
                  <Textarea
                    placeholder="Escreva uma nota sobre este contato..."
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notePinned}
                        onChange={(e) => setNotePinned(e.target.checked)}
                        className="rounded border-border"
                      />
                      <span className="text-xs text-muted-foreground">Fixar nota</span>
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
                      <Card key={note.id} className="p-3">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            {note.is_pinned && (
                              <svg className="h-3 w-3 text-amber-500 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2Z" />
                              </svg>
                            )}
                            <span className="text-xs font-medium truncate">
                              {opp ? opp.title : "Nota"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {note.creator_name && (
                              <span className="text-[10px] text-muted-foreground">{note.creator_name}</span>
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
                        <p className="text-sm whitespace-pre-wrap break-words">{note.body}</p>
                      </Card>
                    );
                  })
                )}
              </div>
            )}

            {tab === "metricas" && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card className="p-4 flex flex-col items-center gap-1">
                    <MessageCircle className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{metrics.msgCount}</span>
                    <span className="text-xs text-muted-foreground">Mensagens</span>
                  </Card>
                  <Card className="p-4 flex flex-col items-center gap-1">
                    <Target className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-bold">{metrics.openOpps}</span>
                    <span className="text-xs text-muted-foreground">Oportunidades abertas</span>
                  </Card>
                  <Card className="p-4 flex flex-col items-center gap-1">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <span className="text-2xl font-bold">{metrics.wonOpps}</span>
                    <span className="text-xs text-muted-foreground">Conquistadas</span>
                  </Card>
                  <Card className="p-4 flex flex-col items-center gap-1">
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
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Oportunidades
                    </h3>
                    <div className="space-y-2">
                      {opportunities.map((opp: any) => (
                        <Card key={opp.id} className="p-3 flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{opp.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {opp.stage_color && (
                                <span
                                  className="inline-block w-2 h-2 rounded-full"
                                  style={{ backgroundColor: opp.stage_color }}
                                />
                              )}
                              <span className="text-xs text-muted-foreground">{opp.stage_name}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {opp.status}
                              </Badge>
                            </div>
                          </div>
                          <span className="text-sm font-semibold shrink-0 ml-3">
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
          </div>
        </div>
      </div>
    </div>
  );
}
