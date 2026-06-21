import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listChatContacts, getChatMessages, sendDirectMessage } from "@/lib/chat.functions";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Send,
  Image as ImageIcon,
  Reply,
  Smile,
  Search,
  Phone,
  ArrowLeft,
  Check,
  CheckCheck,
  Loader2,
  X,
  MessageCircle,
  Link as LinkIcon,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/chat")({
  component: ChatPage,
});

function ChatPage() {
  const fetchContacts = useServerFn(listChatContacts);
  const fetchMessages = useServerFn(getChatMessages);
  const sendMessage = useServerFn(sendDirectMessage);
  const qc = useQueryClient();

  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typedMessage, setTypedMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState(false);
  const [metaImageId, setMetaImageId] = useState("");
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Queries
  const contactsQuery = useQuery({
    queryKey: ["chat-contacts"],
    queryFn: () => fetchContacts(),
  });

  // Auto-select contact based on "phone" query parameter
  useEffect(() => {
    if (typeof window !== "undefined" && contactsQuery.data && !selectedContact) {
      const searchParams = new URLSearchParams(window.location.search);
      const searchPhone = searchParams.get("phone");
      if (searchPhone) {
        const cleanedSearchPhone = searchPhone.replace(/\D/g, "");
        const found = contactsQuery.data.find(
          (c: any) => c.phone_e164.replace(/\D/g, "") === cleanedSearchPhone
        );
        if (found) {
          setSelectedContact(found);
        }
      }
    }
  }, [contactsQuery.data, selectedContact]);

  const selectedPhone = selectedContact?.phone_e164;

  const messagesQuery = useQuery({
    queryKey: ["chat-messages", selectedPhone],
    queryFn: () => fetchMessages({ data: { phone: selectedPhone } }),
    enabled: !!selectedPhone,
  });

  // Polling de mensagens a cada 5 segundos
  useEffect(() => {
    if (!selectedPhone) return;

    messagesQuery.refetch();

    const interval = setInterval(() => {
      messagesQuery.refetch();
    }, 5000);

    return () => clearInterval(interval);
  }, [selectedPhone]);

  // Scroll ao fim ao carregar novas mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data?.length]);

  // Contatos filtrados
  const filteredContacts = (contactsQuery.data ?? []).filter((c: any) => {
    const term = searchQuery.toLowerCase().trim();
    if (!term) return true;
    return (c.name ?? "").toLowerCase().includes(term) || (c.phone_e164 ?? "").includes(term);
  });

  // Mutation para envio de mensagens
  const sendMutation = useMutation({
    mutationFn: async (payload: {
      type: "text" | "reaction" | "image";
      text?: { body: string; preview_url: boolean };
      reaction?: { message_id: string; emoji: string };
      image?: { id: string };
      reply_to_message_id?: string;
    }) => {
      if (!selectedPhone) throw new Error("Nenhum contato selecionado");
      const res = await sendMessage({
        data: {
          to: selectedPhone,
          type: payload.type,
          text: payload.text,
          reaction: payload.reaction,
          image: payload.image,
          reply_to_message_id: payload.reply_to_message_id,
        },
      });
      if (!res.ok) {
        throw new Error(res.error || "Falha ao enviar mensagem");
      }
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-messages", selectedPhone] });
      setTypedMessage("");
      setReplyingTo(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao enviar mensagem");
    },
  });

  const handleSendText = () => {
    if (!typedMessage.trim()) return;
    sendMutation.mutate({
      type: "text",
      text: {
        body: typedMessage,
        preview_url: previewUrl,
      },
      reply_to_message_id: replyingTo?.id,
    });
  };

  const handleSendReaction = (messageId: string, emoji: string) => {
    sendMutation.mutate({
      type: "reaction",
      reaction: {
        message_id: messageId,
        emoji,
      },
    });
    toast.success(`Reação ${emoji} enviada`);
  };

  const handleSendImage = () => {
    if (!metaImageId.trim()) return;
    sendMutation.mutate({
      type: "image",
      image: {
        id: metaImageId.trim(),
      },
      reply_to_message_id: replyingTo?.id,
    });
    setMetaImageId("");
    setIsImageModalOpen(false);
  };

  // Processa reações e monta árvore de mensagens
  const rawMessages = messagesQuery.data ?? [];
  const normalMessages = rawMessages.filter((m: any) => m.type !== "reaction");
  const reactions = rawMessages.filter((m: any) => m.type === "reaction");

  const messageMap = new Map<string, any>();
  normalMessages.forEach((m: any) => {
    messageMap.set(m.id, { ...m, reactions: [] });
  });

  reactions.forEach((r: any) => {
    const targetId = r.context?.message_id;
    if (targetId && messageMap.has(targetId)) {
      const msg = messageMap.get(targetId);
      // Evita duplicar reação igual do mesmo remetente
      const exists = msg.reactions.some(
        (rx: any) => rx.emoji === r.body && rx.direction === r.direction,
      );
      if (!exists) {
        msg.reactions.push({
          emoji: r.body,
          direction: r.direction,
        });
      }
    }
  });

  const displayMessages = Array.from(messageMap.values());

  const scrollToMessage = (id: string) => {
    const el = document.getElementById(`msg-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.classList.add("bg-primary/20");
    setTimeout(() => {
      el?.classList.remove("bg-primary/20");
    }, 1500);
  };

  // Emojis de reação padrão
  const DEFAULT_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  const renderStatus = (status: string) => {
    switch (status) {
      case "sent":
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "read":
        return <CheckCheck className="h-3 w-3 text-primary" />;
      case "failed":
        return <span className="text-destructive text-xs font-bold font-mono">!</span>;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background">
      <PageHeader
        title="Chat Direto"
        subtitle="Converse diretamente com seus contatos cadastrados."
      />

      <div className="flex-1 min-h-0 flex border-t">
        {/* Sidebar de Contatos */}
        <div
          className={cn(
            "w-full md:w-80 lg:w-96 border-r flex flex-col h-full bg-card shrink-0",
            selectedContact ? "hidden md:flex" : "flex",
          )}
        >
          <div className="p-3 border-b flex flex-col gap-2">
            <Label className="sr-only">Buscar Contatos</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y">
            {contactsQuery.isLoading ? (
              <div className="p-4 text-center text-muted-foreground flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span>Carregando contatos...</span>
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                Nenhum contato encontrado.
              </div>
            ) : (
              filteredContacts.map((c: any) => {
                const isSelected = selectedContact?.id === c.id;
                // Gera uma cor de avatar baseada no nome do contato
                const hash = (c.name ?? "")
                  .split("")
                  .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                const hue = hash % 360;
                const avatarBg = `hsl(${hue}, 70%, 40%)`;

                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedContact(c);
                      setReplyingTo(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-muted/40",
                      isSelected && "bg-muted",
                    )}
                  >
                    <div
                      className="h-10 w-10 rounded-full flex items-center justify-center text-white font-semibold text-sm shrink-0 shadow-inner"
                      style={{ backgroundColor: avatarBg }}
                    >
                      {(c.name ?? "C").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <span className="font-semibold text-sm truncate text-foreground">
                          {c.name || "Sem Nome"}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        +{c.phone_e164}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Janela de Mensagens */}
        <div
          className={cn(
            "flex-1 flex flex-col h-full bg-background relative",
            selectedContact ? "flex" : "hidden md:flex",
          )}
        >
          {selectedContact ? (
            <>
              {/* Header do Chat */}
              <div className="p-3 border-b flex items-center justify-between bg-card">
                <div className="flex items-center gap-3">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="md:hidden"
                    onClick={() => setSelectedContact(null)}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>

                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                    {(selectedContact.name ?? "C").slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm truncate text-foreground leading-tight">
                      {selectedContact.name || "Sem Nome"}
                    </h3>
                    <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                      <Phone className="h-3 w-3 shrink-0" />+{selectedContact.phone_e164}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5"
                    onClick={() => messagesQuery.refetch()}
                    disabled={messagesQuery.isFetching}
                  >
                    {messagesQuery.isFetching ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Atualizar"
                    )}
                  </Button>
                </div>
              </div>

              {/* Corpo / Lista de Balões */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10 relative">
                {messagesQuery.isLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span>Carregando conversa...</span>
                    </div>
                  </div>
                ) : displayMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center p-6 gap-2">
                    <MessageCircle className="h-10 w-10 text-muted-foreground/50 animate-bounce" />
                    <p className="font-semibold">Nenhuma mensagem neste chat</p>
                    <p className="text-xs max-w-xs">
                      Envie uma mensagem abaixo para iniciar a conversa direta oficial do WhatsApp.
                    </p>
                  </div>
                ) : (
                  displayMessages.map((msg: any) => {
                    const isOutgoing = msg.direction === "outgoing";
                    const replyMsgId = msg.context?.message_id;
                    const replyMessage =
                      replyMsgId && displayMessages.find((m: any) => m.id === replyMsgId);

                    return (
                      <div
                        key={msg.id}
                        id={`msg-${msg.id}`}
                        className={cn(
                          "flex w-full flex-col group transition-all duration-300 rounded-lg p-1",
                          isOutgoing ? "items-end" : "items-start",
                        )}
                      >
                        {/* Container do Balão + Ações */}
                        <div className="flex items-start gap-2 max-w-[85%] md:max-w-[70%]">
                          {/* Ações Rápidas (Lado esquerdo para outgoing, lado direito para incoming) */}
                          {!isOutgoing && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded-full"
                                >
                                  <Smile className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="p-1 min-w-[120px] flex gap-1">
                                {DEFAULT_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleSendReaction(msg.id, emoji)}
                                    className="hover:bg-muted p-1.5 rounded text-lg transition-transform hover:scale-125"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}

                          {/* Balão em si */}
                          <div className="flex flex-col relative">
                            {/* Bloco de Resposta */}
                            {replyMessage && (
                              <button
                                onClick={() => scrollToMessage(replyMessage.id)}
                                className={cn(
                                  "text-left text-xs p-2 rounded-t-xl border-l-4 mb-[-4px] opacity-90 transition-all hover:opacity-100",
                                  isOutgoing
                                    ? "bg-primary-foreground/30 border-primary-foreground/75 text-primary-foreground"
                                    : "bg-muted border-primary text-muted-foreground",
                                )}
                              >
                                <div className="font-bold mb-0.5">
                                  {replyMessage.direction === "incoming" ? "Contato" : "Você"}
                                </div>
                                <div className="truncate font-mono">
                                  {replyMessage.type === "image" ? "📷 Imagem" : replyMessage.body}
                                </div>
                              </button>
                            )}

                            {/* Conteúdo Principal */}
                            <div
                              className={cn(
                                "p-3 rounded-2xl shadow-sm relative transition-all duration-200",
                                isOutgoing
                                  ? "bg-primary text-primary-foreground rounded-tr-none"
                                  : "bg-card border text-card-foreground rounded-tl-none",
                                replyMessage && "rounded-t-none",
                              )}
                            >
                              {msg.type === "image" ? (
                                <div className="rounded-lg overflow-hidden border border-muted-foreground/20 bg-background/10 p-2 flex flex-col gap-2">
                                  <div className="aspect-video w-full rounded-md bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 flex flex-col items-center justify-center border border-dashed border-muted-foreground/30 relative">
                                    <ImageIcon className="h-8 w-8 text-muted-foreground animate-pulse" />
                                    <span className="text-[10px] font-mono mt-2 opacity-80">
                                      ID: {msg.body}
                                    </span>
                                  </div>
                                  <span className="text-[10px] opacity-75 text-center font-medium">
                                    Imagem Meta Graph API
                                  </span>
                                </div>
                              ) : (
                                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed select-text">
                                  {msg.body}
                                </p>
                              )}

                              {/* Horário + Status */}
                              <div
                                className={cn(
                                  "flex items-center justify-end gap-1 mt-1 text-[10px] opacity-70",
                                  isOutgoing ? "text-primary-foreground" : "text-muted-foreground",
                                )}
                              >
                                <span>
                                  {new Date(msg.timestamp).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                {isOutgoing && renderStatus(msg.status)}
                              </div>
                            </div>

                            {/* Emojis de Reação Flutuantes */}
                            {msg.reactions && msg.reactions.length > 0 && (
                              <div
                                className={cn(
                                  "absolute bottom-[-10px] flex gap-0.5 bg-background shadow border rounded-full px-1.5 py-0.5 text-xs select-none",
                                  isOutgoing ? "left-2" : "right-2",
                                )}
                              >
                                {msg.reactions.map((rx: any, idx: number) => (
                                  <span
                                    key={idx}
                                    title={rx.direction === "outgoing" ? "Você" : "Contato"}
                                    className="transition-transform hover:scale-110"
                                  >
                                    {rx.emoji}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Ações para Outgoing */}
                          {isOutgoing && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded-full"
                                >
                                  <Smile className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="p-1 min-w-[120px] flex gap-1">
                                {DEFAULT_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    onClick={() => handleSendReaction(msg.id, emoji)}
                                    className="hover:bg-muted p-1.5 rounded text-lg transition-transform hover:scale-125"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}

                          {/* Botão de Responder (Reply) */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded-full"
                            onClick={() => setReplyingTo(msg)}
                          >
                            <Reply className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Caixa de Texto de Envio */}
              <div className="border-t bg-card flex flex-col">
                {/* Banner de Resposta */}
                {replyingTo && (
                  <div className="flex items-center justify-between bg-muted/60 px-4 py-2 border-b text-xs transition-all duration-300">
                    <div className="flex-1 min-w-0 border-l-4 border-primary pl-2">
                      <div className="font-semibold text-primary">
                        Respondendo a {replyingTo.direction === "incoming" ? "Contato" : "Você"}
                      </div>
                      <div className="text-muted-foreground truncate font-mono">
                        {replyingTo.type === "image" ? "📷 Imagem" : replyingTo.body}
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0 rounded-full"
                      onClick={() => setReplyingTo(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Área do Input de Texto */}
                <div className="p-3 flex items-end gap-2">
                  <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
                    <DialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="outline"
                        title="Enviar imagem por ID do objeto"
                        className="shrink-0 h-10 w-10 rounded-full"
                      >
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Enviar Imagem da Meta</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-2">
                        <div className="space-y-2">
                          <Label htmlFor="meta-image-id">ID do Objeto de Imagem na Meta</Label>
                          <Input
                            id="meta-image-id"
                            placeholder="Insira o Meta Object ID (ex: 285938592058)"
                            value={metaImageId}
                            onChange={(e) => setMetaImageId(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            A API oficial do WhatsApp requer que imagens sejam carregadas
                            previamente na Meta para obter um ID de objeto de mídia.
                          </p>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsImageModalOpen(false)}>
                          Cancelar
                        </Button>
                        <Button
                          onClick={handleSendImage}
                          disabled={!metaImageId.trim() || sendMutation.isPending}
                        >
                          Enviar Imagem
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Button
                    size="icon"
                    variant={previewUrl ? "default" : "outline"}
                    title={previewUrl ? "Preview de link ATIVADO" : "Habilitar preview de link"}
                    onClick={() => setPreviewUrl(!previewUrl)}
                    className="shrink-0 h-10 w-10 rounded-full"
                  >
                    <LinkIcon className="h-5 w-5" />
                  </Button>

                  <div className="flex-1 relative">
                    <Label className="sr-only">Mensagem</Label>
                    <Textarea
                      placeholder="Digite sua mensagem..."
                      className="min-h-[40px] max-h-[120px] py-2 px-3 resize-none rounded-xl pr-10"
                      rows={1}
                      value={typedMessage}
                      onChange={(e) => setTypedMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendText();
                        }
                      }}
                    />
                  </div>

                  <Button
                    size="icon"
                    className="shrink-0 h-10 w-10 rounded-full"
                    disabled={!typedMessage.trim() || sendMutation.isPending}
                    onClick={handleSendText}
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 gap-4 bg-muted/5">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center shadow-inner">
                <MessageCircle className="h-8 w-8 text-muted-foreground/60" />
              </div>
              <div className="text-center max-w-sm space-y-1">
                <p className="font-semibold text-foreground">ZapDispatch Chat Direto</p>
                <p className="text-xs">
                  Selecione um contato na lista à esquerda para carregar o histórico de conversas
                  diretas e enviar novas mensagens.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
