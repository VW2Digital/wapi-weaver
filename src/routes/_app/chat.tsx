import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listChatContacts,
  getChatContactDetails,
  getChatMessages,
  sendDirectMessage,
  markMessagesAsRead,
} from "@/lib/chat.functions";
import { updateContactProfilePhoto, createContact } from "@/lib/contacts.functions";
import { getProfile } from "@/lib/profile.functions";
import {
  listTeams,
  listTeamMembers,
  listAllAgents,
  assignConversation,
  autoAssignConversation,
} from "@/lib/assignment.functions";
import { uploadMetaMediaViaApi } from "@/lib/meta-media-upload";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  User,
  Mail,
  Tag,
  Star,
  Heart,
  AlertCircle,
  Zap,
  Bookmark,
  Flag,
  Briefcase,
  ShoppingCart,
  Activity,
  Shield,
  Info,
  ChevronRight,
  ExternalLink,
  Paperclip,
  MapPin,
  Users,
  Video,
  Volume2,
  FileText,
  Trash2,
  Camera,
  Filter,
  ArrowUpDown,
  SlidersHorizontal,
  FolderPlus,
  Archive,
  MoreVertical,
  MessageSquare,
  Menu,
  ClipboardList,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { db } from "@/integrations/mysql/client";

export const Route = createFileRoute("/_app/chat")({
  component: ChatPage,
});

/** Extrai a URL de foto de perfil dos custom_fields do contato, seguindo o mesmo padrão do CRM */
function getContactAvatarUrl(contact: any): string {
  const cf = contact?.custom_fields;
  if (!cf || typeof cf !== "object") return "";
  return cf.avatar_url || cf.photo_url || cf.photo || cf.picture || cf.image_url || cf.image || "";
}

/** Gera uma cor HSL consistente baseada no nome do contato */
function getAvatarColor(name: string): string {
  const hash = (name || "")
    .split("")
    .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
  return `hsl(${hash % 360}, 70%, 40%)`;
}

const TAG_ICONS: Record<string, any> = {
  Tag,
  Star,
  Heart,
  AlertCircle,
  Zap,
  Bookmark,
  Flag,
  Briefcase,
  ShoppingCart,
  Activity,
  Shield,
};

function TagBadge({
  tag,
  className,
  showName = true,
}: {
  tag: any;
  className?: string;
  showName?: boolean;
}) {
  if (!tag) return null;
  const Icon = TAG_ICONS[tag.icon] || Tag;
  const color = tag.color || "#8B5CF6";
  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-0.5 border text-[10px] font-medium tracking-wide leading-none",
        className,
      )}
      style={{ backgroundColor: `${color}20`, color: color, borderColor: `${color}40` }}
      title={tag.name}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {showName && <span className="truncate max-w-[120px]">{tag.name}</span>}
    </div>
  );
}

function ChatPage() {
  const fetchContacts = useServerFn(listChatContacts);
  const fetchContactDetails = useServerFn(getChatContactDetails);
  const fetchMessages = useServerFn(getChatMessages);
  const sendMessage = useServerFn(sendDirectMessage);
  const saveContactProfilePhoto = useServerFn(updateContactProfilePhoto);
  const qc = useQueryClient();

  const [selectedContact, setSelectedContact] = useState<any>(null);

  // Atribuição de Atendimentos e Equipes
  const fetchTeamsFn = useServerFn(listTeams);
  const fetchTeamMembersFn = useServerFn(listTeamMembers);
  const fetchAgentsFn = useServerFn(listAllAgents);

  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: () => fetchTeamsFn(),
  });

  const agentsQuery = useQuery({
    queryKey: ["agents"],
    queryFn: () => fetchAgentsFn(),
  });

  const teamMembersQuery = useQuery({
    queryKey: ["team-members", selectedTeamId],
    queryFn: () => fetchTeamMembersFn({ data: { teamId: selectedTeamId } }),
    enabled: !!selectedTeamId,
  });

  const assignMutation = useMutation({
    mutationFn: async (payload: { teamId: string | null; agentId: string | null }) => {
      if (!selectedPhone) throw new Error("Nenhum contato selecionado");
      return assignConversation({
        data: {
          contactPhone: selectedPhone,
          teamId: payload.teamId,
          agentId: payload.agentId,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      toast.success("Atendimento atribuído com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao atribuir: " + err.message);
    },
  });

  const autoAssignMutation = useMutation({
    mutationFn: async (teamId: string) => {
      if (!selectedPhone) throw new Error("Nenhum contato selecionado");
      return autoAssignConversation({
        data: {
          contactPhone: selectedPhone,
          teamId,
        },
      });
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      if (res.agentId) {
        toast.success("Auto-atribuição concluída!");
      } else {
        toast.warning("Nenhum agente disponível. O chat ficou na fila da equipe.");
      }
    },
    onError: (err: any) => {
      toast.error("Erro ao auto-atribuir: " + err.message);
    },
  });

  useEffect(() => {
    if (selectedContact) {
      setSelectedTeamId(selectedContact.active_team_id || "");
      setSelectedAgentId(selectedContact.active_agent_id || "");
    } else {
      setSelectedTeamId("");
      setSelectedAgentId("");
    }
  }, [selectedContact]);
  const [searchQuery, setSearchQuery] = useState("");
  const [typedMessage, setTypedMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState(false);
  const [metaImageId, setMetaImageId] = useState("");
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [contactInfoOpen, setContactInfoOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const contactPhotoInputRef = useRef<HTMLInputElement>(null);

  const [sessionToken, setSessionToken] = useState("");
  const [pendingMediaType, setPendingMediaType] = useState<
    "image" | "audio" | "video" | "document" | "sticker" | null
  >(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [uploadingContactPhoto, setUploadingContactPhoto] = useState(false);

  // States for Location Modal
  const [locLat, setLocLat] = useState("");
  const [locLng, setLocLng] = useState("");
  const [locName, setLocName] = useState("");
  const [locAddress, setLocAddress] = useState("");

  // States for Contact Modal
  const [contactNameState, setContactNameState] = useState("");
  const [contactPhoneState, setContactPhoneState] = useState("");

  // Fetch session JWT token on mount
  useEffect(() => {
    db.auth.getSession().then(({ data }: any) => {
      setSessionToken(data.session?.access_token || "");
    });
  }, []);

  const fetchLocalProfile = useServerFn(getProfile);
  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchLocalProfile(),
  });
  const profile = profileQuery.data;

  // Novos estados para organização da barra lateral conforme o mockup
  const fetchMarkAsRead = useServerFn(markMessagesAsRead);
  const [activeTab, setActiveTab] = useState<"novos" | "meus" | "outros">("novos");
  const [showTagFilters, setShowTagFilters] = useState(false);
  const [countryCode, setCountryCode] = useState("+55");
  const [newChatPhone, setNewChatPhone] = useState("");

  // Mutation para iniciar novo chat/criar contato manual no rodapé
  const addContactMutation = useMutation({
    mutationFn: async (phone: string) => {
      // Limpa a formatação e junta com o DDI selecionado
      const digits = phone.replace(/\D/g, "");
      const fullPhone = countryCode.replace("+", "") + digits;
      const res = await createContact({ data: { phone: fullPhone, name: `Contato +${fullPhone}` } });
      return res;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      setSelectedContact(data);
      setNewChatPhone("");
      toast.success("Nova conversa iniciada!");
    },
    onError: (err: any) => {
      toast.error("Erro ao iniciar conversa: " + err.message);
    }
  });

  const handleStartNewChat = () => {
    if (!newChatPhone.trim()) return;
    addContactMutation.mutate(newChatPhone);
  };

  // States for Tags
  const [selectedFilterTagIds, setSelectedFilterTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState("#6366f1");
  const [isManageTagsOpen, setIsManageTagsOpen] = useState(false);
  const [selectedIconName, setSelectedIconName] = useState("Tag");

  const PREDEFINED_COLORS = [
    "#6366f1",
    "#ef4444",
    "#f59e0b",
    "#22c55e",
    "#3b82f6",
    "#ec4899",
    "#8b5cf6",
    "#14b8a6",
  ];

  // Persistent cache for conversation tags
  const [cachedConvTags, setCachedConvTags] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const val = localStorage.getItem("tags:conv");
        return val ? JSON.parse(val) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  // Queries for Tags
  const tagsQuery = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await db.from("tags").select("*").order("name", { ascending: true });
      if (error) throw new Error(error.message);
      return data || [];
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const conversationTagsQuery = useQuery({
    queryKey: ["conversation-tags"],
    queryFn: async () => {
      const { data, error } = await db.from("conversation_tags").select("*, tags(*)");
      if (error) throw new Error(error.message);
      return data || [];
    },
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  // Sync cache and localstorage when query finishes
  useEffect(() => {
    if (conversationTagsQuery.data) {
      setCachedConvTags(conversationTagsQuery.data);
      try {
        localStorage.setItem("tags:conv", JSON.stringify(conversationTagsQuery.data));
      } catch (e) {}
    }
  }, [conversationTagsQuery.data]);

  // Realtime channel subscription
  useEffect(() => {
    const channel = db
      .channel("conversation-tags-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_tags" }, () => {
        qc.invalidateQueries({ queryKey: ["conversation-tags"] });
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [qc]);

  // Tag Handlers
  const handleCreateTag = async (name: string, color: string, icon: string = "Tag") => {
    const nameTrim = name.trim();
    if (!nameTrim) return null;
    if (nameTrim.length > 20) {
      toast.error("O nome da tag deve ter até 20 caracteres.");
      return null;
    }

    const existing = (tagsQuery.data ?? []).find(
      (t: any) => t.name.toLowerCase() === nameTrim.toLowerCase(),
    );
    if (existing) {
      toast.error("Tag já existe com esse nome.");
      return null;
    }

    const { data, error } = await db.from("tags").insert({
      id: crypto.randomUUID(),
      name: nameTrim,
      color: color,
      icon: icon,
    });

    if (error) {
      if (error.message.includes("Duplicate") || error.message.includes("uq_user_tag")) {
        toast.error("Tag já existe com esse nome.");
      } else {
        toast.error("Erro ao criar tag: " + error.message);
      }
      return null;
    }

    toast.success("Tag criada com sucesso");
    qc.invalidateQueries({ queryKey: ["tags"] });
    return data;
  };

  const handleDeleteTag = async (tagId: string) => {
    const { error } = await db.from("tags").delete().eq("id", tagId);
    if (error) {
      toast.error("Erro ao excluir tag: " + error.message);
    } else {
      toast.success("Tag excluída com sucesso");
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["conversation-tags"] });
      qc.invalidateQueries({ queryKey: ["message-tags"] });
    }
  };

  const handleToggleConversationTag = async (phone: string, tagId: string, isApplied: boolean) => {
    if (isApplied) {
      const { error } = await db
        .from("conversation_tags")
        .delete()
        .eq("contact_number", phone)
        .eq("tag_id", tagId);
      if (error) {
        toast.error("Erro ao remover tag da conversa: " + error.message);
      } else {
        qc.invalidateQueries({ queryKey: ["conversation-tags"] });
      }
    } else {
      const { error } = await db.from("conversation_tags").insert({
        contact_number: phone,
        tag_id: tagId,
      });
      if (error) {
        toast.error("Erro ao adicionar tag à conversa: " + error.message);
      } else {
        qc.invalidateQueries({ queryKey: ["conversation-tags"] });
      }
    }
  };

  const handleClearConversationTags = async (phone: string) => {
    const { error } = await db.from("conversation_tags").delete().eq("contact_number", phone);
    if (error) {
      toast.error("Erro ao limpar tags da conversa: " + error.message);
    } else {
      toast.success("Tags da conversa removidas");
      qc.invalidateQueries({ queryKey: ["conversation-tags"] });
    }
  };

  const handleToggleMessageTag = async (msgId: string, tagId: string, isApplied: boolean) => {
    if (isApplied) {
      const { error } = await db
        .from("message_tags")
        .delete()
        .eq("message_id", msgId)
        .eq("tag_id", tagId);
      if (error) {
        toast.error("Erro ao remover tag da mensagem: " + error.message);
      } else {
        qc.invalidateQueries({ queryKey: ["message-tags"] });
      }
    } else {
      const { error } = await db.from("message_tags").insert({
        message_id: msgId,
        tag_id: tagId,
      });
      if (error) {
        toast.error("Erro ao adicionar tag à mensagem: " + error.message);
      } else {
        qc.invalidateQueries({ queryKey: ["message-tags"] });
      }
    }
  };

  const handleClearMessageTags = async (msgId: string) => {
    const { error } = await db.from("message_tags").delete().eq("message_id", msgId);
    if (error) {
      toast.error("Erro ao limpar tags da mensagem: " + error.message);
    } else {
      toast.success("Tags da mensagem removidas");
      qc.invalidateQueries({ queryKey: ["message-tags"] });
    }
  };

  const renderMessageTagDropdown = (msg: any) => {
    const msgTags = (messageTagsQuery.data ?? []).filter((mt: any) => mt.message_id === msg.id);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded-full"
            title="Etiquetas da mensagem"
          >
            <Tag className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="p-2 min-w-[220px]" align="start">
          {msgTags.length > 0 && (
            <div className="border-b pb-1.5 mb-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-7 px-2 font-medium"
                onClick={() => handleClearMessageTags(msg.id)}
              >
                <X className="h-3 w-3 mr-1.5" /> Limpar tags ({msgTags.length})
              </Button>
            </div>
          )}

          <div className="max-h-44 overflow-y-auto space-y-1">
            {(tagsQuery.data ?? []).length === 0 ? (
              <div className="text-[10px] text-muted-foreground p-1 text-center">
                Nenhuma etiqueta cadastrada.
              </div>
            ) : (
              (tagsQuery.data ?? []).map((tag: any) => {
                const isApplied = msgTags.some((mt: any) => mt.tag_id === tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => handleToggleMessageTag(msg.id, tag.id, isApplied)}
                    className="w-full flex items-center justify-between p-1.5 rounded text-xs hover:bg-muted/60 transition-colors text-left"
                  >
                    <TagBadge tag={tag} className="border-transparent bg-transparent px-0" />
                    <span
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center transition-all",
                        isApplied
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-muted-foreground/30",
                      )}
                    >
                      {isApplied && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t mt-1.5 pt-1.5 space-y-1.5">
            <p className="text-[10px] text-muted-foreground px-1 font-semibold">Nova tag</p>
            <div className="flex gap-1">
              <Input
                placeholder="Nome..."
                className="h-7 text-xs px-2 flex-1"
                maxLength={20}
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const target = e.currentTarget;
                    const val = target.value.trim();
                    if (!val) return;
                    const res = await handleCreateTag(val, selectedColor, selectedIconName);
                    if (res?.id) {
                      target.value = "";
                      await handleToggleMessageTag(msg.id, res.id, false);
                    }
                  }
                }}
              />
            </div>
            <div className="flex justify-between items-center px-1">
              <input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-5 h-5 p-0 border-0 cursor-pointer rounded overflow-hidden"
              />
              <div className="flex gap-1">
                {PREDEFINED_COLORS.slice(0, 6).map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "h-3 w-3 rounded-full border transition-transform hover:scale-110",
                      selectedColor === c ? "border-foreground" : "border-transparent",
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setSelectedColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  // Queries
  const contactsQuery = useQuery({
    queryKey: ["chat-contacts"],
    queryFn: () => fetchContacts(),
    // Importante: contatos podem ser criados via webhook (mensagem recebida),
    // então precisamos revalidar periodicamente para o chat refletir novas conversas.
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  // Auto-select contact based on "phone" query parameter
  useEffect(() => {
    if (typeof window !== "undefined" && contactsQuery.data && !selectedContact) {
      const searchParams = new URLSearchParams(window.location.search);
      const searchPhone = searchParams.get("phone");
      if (searchPhone) {
        const cleanedSearchPhone = searchPhone.replace(/\D/g, "");
        const found = contactsQuery.data.find(
          (c: any) => c.phone_e164.replace(/\D/g, "") === cleanedSearchPhone,
        );
        if (found) {
          setSelectedContact(found);
        }
      }
    }
  }, [contactsQuery.data, selectedContact]);

  const selectedPhone = selectedContact?.phone_e164;

  const contactDetailsQuery = useQuery({
    queryKey: ["chat-contact-details", selectedPhone],
    queryFn: () => fetchContactDetails({ data: { phone: selectedPhone } }),
    enabled: !!selectedPhone && contactInfoOpen,
    staleTime: 10_000,
  });

  // Atualiza o selectedContact quando abrimos o painel e carregamos dados completos
  useEffect(() => {
    if (!contactDetailsQuery.data || !selectedContact) return;
    setSelectedContact((prev: any) => ({ ...(prev ?? {}), ...(contactDetailsQuery.data as any) }));
  }, [contactDetailsQuery.data]);

  const messagesQuery = useQuery({
    queryKey: ["chat-messages", selectedPhone],
    queryFn: () => fetchMessages({ data: { phone: selectedPhone } }),
    enabled: !!selectedPhone,
    // Polling nativo do React Query — sem setInterval manual
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  // Scroll ao fim ao carregar novas mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data?.length]);

  // Efeito para marcar mensagens recebidas como lidas quando selecionamos o contato
  useEffect(() => {
    if (selectedPhone) {
      fetchMarkAsRead({ data: { phone: selectedPhone } })
        .then(() => {
          qc.invalidateQueries({ queryKey: ["chat-contacts"] });
        })
        .catch((err) => {
          console.error("Erro ao marcar mensagens como lidas:", err);
        });
    }
  }, [selectedPhone, fetchMarkAsRead, qc]);

  // Helpers para o visual dos cards de contato conforme o mockup
  const getInitials = (name: string): string => {
    if (!name) return "C";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const getContactCategory = (c: any, currentUserId: string): "novos" | "meus" | "outros" => {
    if (c.active_agent_id) {
      if (c.active_agent_id === currentUserId) {
        return "meus";
      }
      return "outros";
    }
    return "novos";
  };

  const getDeptStyle = (dept: string): string => {
    const normalized = (dept || "").toLowerCase();
    if (normalized.includes("sucesso") || normalized.includes("cs")) {
      return "bg-violet-500/10 text-violet-700 border-violet-500/20 dark:text-violet-300";
    }
    if (normalized.includes("suporte") || normalized.includes("técnico")) {
      return "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-300";
    }
    return "bg-sky-500/10 text-sky-700 border-sky-500/20 dark:text-sky-300";
  };

  const formatRelativeTime = (dateInput: any): string => {
    if (!dateInput) return "";
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "";
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) {
      return "há poucos segundos";
    }
    if (diffMins < 60) {
      return `há ${diffMins} ${diffMins === 1 ? "minuto" : "minutos"}`;
    }
    if (diffHours < 24) {
      return `há ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
    }
    if (diffDays < 7) {
      return `há ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`;
    }
    
    return date.toLocaleDateString([], { day: "numeric", month: "short" });
  };

  // Mapeia e enriquece os contatos vindos da API do servidor
  const mappedContacts = (contactsQuery.data ?? []).map((c: any) => {
    const category = getContactCategory(c, profile?.id || "");
    
    // Mapeia setor de acordo com as etiquetas atribuídas ou equipe real
    const contactTags = cachedConvTags.filter((ct: any) => ct.contact_number === c.phone_e164);
    const hasSuporte = contactTags.some((ct: any) => ct.tags?.name?.toUpperCase().includes("SUPORTE"));
    const hasCS = contactTags.some((ct: any) => ct.tags?.name?.toUpperCase().includes("CS") || ct.tags?.name?.toUpperCase().includes("IMPLANTAÇÃO"));
    
    let department = c.active_team_name || c.custom_fields?.department;
    if (!department) {
      if (hasCS) {
        department = "Sucesso Cliente";
      } else if (hasSuporte) {
        if (c.name?.includes("Lucas")) {
          department = "Atendimento Geral";
        } else {
          department = "Suporte Técnico";
        }
      } else {
        const hash = (c.id || "")
          .split("")
          .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
        const deptMod = hash % 3;
        if (deptMod === 0) department = "Atendimento Geral";
        else if (deptMod === 1) department = "Sucesso Cliente";
        else department = "Suporte Técnico";
      }
    }

    return {
      ...c,
      category,
      department,
      last_message_body: c.last_message_body || "",
      last_message_time: c.last_message_time || null,
      unread_count: c.unread_count || 0,
    };
  });

  // Separação em abas conforme o mockup
  const novosContacts = mappedContacts.filter((c: any) => c.category === "novos");
  const meusContacts = mappedContacts.filter((c: any) => c.category === "meus");
  const outrosContacts = mappedContacts.filter((c: any) => c.category === "outros");

  const activeContactsList = 
    activeTab === "novos" 
      ? novosContacts 
      : activeTab === "meus" 
        ? meusContacts 
        : outrosContacts;

  // Contatos filtrados
  const filteredContacts = activeContactsList.filter((c: any) => {
    const term = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !term || (c.name ?? "").toLowerCase().includes(term) || (c.phone_e164 ?? "").includes(term);
    if (!matchesSearch) return false;

    if (selectedFilterTagIds.length === 0) return true;

    const contactTags = cachedConvTags.filter((ct: any) => ct.contact_number === c.phone_e164);
    return contactTags.some((ct: any) => selectedFilterTagIds.includes(ct.tag_id));
  });

  // Mutation para envio de mensagens
  const sendMutation = useMutation<any, any, any>({
    box: true,
    mutationFn: async (payload: {
      type:
        | "text"
        | "reaction"
        | "image"
        | "audio"
        | "video"
        | "document"
        | "sticker"
        | "location"
        | "contacts";
      text?: { body: string; preview_url: boolean };
      reaction?: { message_id: string; emoji: string };
      image?: { id?: string; link?: string };
      audio?: { id?: string; link?: string };
      video?: { id?: string; link?: string };
      document?: { id?: string; link?: string; filename?: string };
      sticker?: { id?: string; link?: string };
      location?: { latitude: number; longitude: number; name?: string; address?: string };
      contacts?: any[];
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
          audio: payload.audio,
          video: payload.video,
          document: payload.document,
          sticker: payload.sticker,
          location: payload.location,
          contacts: payload.contacts,
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
  } as any);

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

  const handleMediaAttachClick = (type: "image" | "audio" | "video" | "document" | "sticker") => {
    setPendingMediaType(type);
    if (mediaInputRef.current) {
      if (type === "image") mediaInputRef.current.accept = "image/*";
      else if (type === "audio") mediaInputRef.current.accept = "audio/*";
      else if (type === "video") mediaInputRef.current.accept = "video/*";
      else if (type === "document") mediaInputRef.current.accept = "*/*";
      else if (type === "sticker") mediaInputRef.current.accept = "image/webp,image/png";

      mediaInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingMediaType) return;

    const phoneId = profile?.whatsapp_phone_number_id;
    if (!phoneId) {
      toast.error("ID do número de telefone não configurado. Vá em Configurações.");
      return;
    }

    setUploadingMedia(true);
    const toastId = toast.loading(`Enviando ${pendingMediaType} para a Meta...`);

    try {
      const res = await uploadMetaMediaViaApi(phoneId, file);

      if (!res.ok || !res.data?.id) {
        throw new Error(res.error || "Falha no upload de mídia na Meta.");
      }

      const mediaId = res.data.id;

      const sendRes = await sendMessage({
        data: {
          to: selectedPhone,
          type: pendingMediaType,
          [pendingMediaType]:
            pendingMediaType === "document"
              ? { id: mediaId, filename: file.name }
              : { id: mediaId },
          reply_to_message_id: replyingTo?.id,
        } as any,
      });

      if (!sendRes.ok) {
        throw new Error(sendRes.error || "Falha ao enviar mensagem de mídia.");
      }

      toast.success(`${file.name} enviado com sucesso!`, { id: toastId });
      qc.invalidateQueries({ queryKey: ["chat-messages", selectedPhone] });
      setReplyingTo(null);
    } catch (err: any) {
      toast.error(err.message || "Erro ao realizar upload da mídia.", { id: toastId });
    } finally {
      setUploadingMedia(false);
      setPendingMediaType(null);
      if (e.target) e.target.value = "";
    }
  };

  const handleSendLocation = () => {
    const lat = parseFloat(locLat);
    const lng = parseFloat(locLng);
    if (isNaN(lat) || isNaN(lng)) {
      toast.error("Latitude e Longitude inválidas.");
      return;
    }

    sendMutation.mutate({
      type: "location",
      location: {
        latitude: lat,
        longitude: lng,
        name: locName.trim() || undefined,
        address: locAddress.trim() || undefined,
      },
      reply_to_message_id: replyingTo?.id,
    });

    setIsLocationModalOpen(false);
    setLocLat("");
    setLocLng("");
    setLocName("");
    setLocAddress("");
  };

  const handleSendContact = () => {
    if (!contactNameState.trim() || !contactPhoneState.trim()) {
      toast.error("Preencha Nome e Telefone do contato.");
      return;
    }

    const digits = contactPhoneState.replace(/\D/g, "");

    sendMutation.mutate({
      type: "contacts",
      contacts: [
        {
          name: {
            formatted_name: contactNameState.trim(),
            first_name: contactNameState.trim().split(" ")[0],
          },
          phones: [
            {
              phone: digits,
              type: "CELL",
            },
          ],
        },
      ],
      reply_to_message_id: replyingTo?.id,
    });

    setIsContactModalOpen(false);
    setContactNameState("");
    setContactPhoneState("");
  };

  const handleUploadContactPhoto = async (file: File) => {
    if (!selectedContact?.id) {
      toast.error("Selecione um contato válido.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5MB).");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("O arquivo precisa ser uma imagem.");
      return;
    }

    setUploadingContactPhoto(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const storagePath = `contacts/${selectedContact.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await db.storage
        .from("avatars")
        .upload(storagePath, file, { cacheControl: "3600", upsert: true } as any);
      if (upErr) throw new Error(upErr.message || "Falha ao enviar imagem.");

      const { data: pub } = db.storage.from("avatars").getPublicUrl(storagePath);
      const url = pub.publicUrl;
      const updated = await saveContactProfilePhoto({
        data: { id: selectedContact.id, avatar_url: url },
      });

      setSelectedContact((prev: any) => ({
        ...(prev ?? {}),
        ...(updated ?? {}),
        custom_fields: {
          ...((prev?.custom_fields as any) ?? {}),
          ...((updated?.custom_fields as any) ?? {}),
          avatar_url: url,
        },
      }));
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      qc.invalidateQueries({ queryKey: ["chat-contact-details", selectedPhone] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Foto do contato atualizada.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao atualizar foto do contato.");
    } finally {
      setUploadingContactPhoto(false);
      if (contactPhotoInputRef.current) contactPhotoInputRef.current.value = "";
    }
  };

  const handleRemoveContactPhoto = async () => {
    if (!selectedContact?.id) return;
    setUploadingContactPhoto(true);
    try {
      const updated = await saveContactProfilePhoto({
        data: { id: selectedContact.id, avatar_url: null },
      });
      setSelectedContact((prev: any) => {
        const custom = {
          ...((prev?.custom_fields as any) ?? {}),
          ...((updated?.custom_fields as any) ?? {}),
        };
        delete custom.avatar_url;
        delete custom.photo_url;
        delete custom.photo;
        delete custom.picture;
        delete custom.image_url;
        delete custom.image;
        return {
          ...(prev ?? {}),
          ...(updated ?? {}),
          custom_fields: custom,
        };
      });
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      qc.invalidateQueries({ queryKey: ["chat-contact-details", selectedPhone] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Foto do contato removida.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao remover foto do contato.");
    } finally {
      setUploadingContactPhoto(false);
    }
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

  const visibleMessageIds = displayMessages.map((m: any) => m.id);
  const messageTagsQuery = useQuery({
    queryKey: ["message-tags", visibleMessageIds],
    queryFn: async () => {
      if (visibleMessageIds.length === 0) return [];
      const { data, error } = await db
        .from("message_tags")
        .select("*, tags(*)")
        .in("message_id", visibleMessageIds);
      if (error) throw new Error(error.message);
      return data || [];
    },
    enabled: visibleMessageIds.length > 0,
    staleTime: 5000,
  });

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
      <style dangerouslySetInnerHTML={{ __html: `
        /* Estilos dos Balões estilo WhatsApp */
        .wa-bubble-outgoing {
          background-color: var(--primary) !important;
          color: var(--primary-foreground) !important;
          border-radius: 8px !important;
          border-top-right-radius: 0 !important;
          position: relative !important;
          margin-right: 8px !important;
        }
        .wa-bubble-outgoing::before {
          content: "";
          position: absolute;
          right: -8px;
          top: 0;
          width: 8px;
          height: 13px;
          background-color: var(--primary);
          clip-path: polygon(0 0, 0 100%, 100% 0);
        }

        .wa-bubble-incoming {
          background-color: var(--card) !important;
          color: var(--card-foreground) !important;
          border: 1px solid var(--border) !important;
          border-radius: 8px !important;
          border-top-left-radius: 0 !important;
          position: relative !important;
          margin-left: 8px !important;
        }
        .wa-bubble-incoming::before {
          content: "";
          position: absolute;
          left: -8px;
          top: 0;
          width: 8px;
          height: 13px;
          background-color: var(--card);
          clip-path: polygon(100% 0, 100% 100%, 0 0);
        }
        .wa-bubble-incoming::after {
          content: "";
          position: absolute;
          left: -8px;
          top: -1px;
          width: 8px;
          height: 14px;
          background-color: var(--border);
          z-index: -1;
          clip-path: polygon(100% 0, 100% 100%, 0 0);
        }

        .wa-quote-reply-outgoing {
          background-color: rgba(0, 0, 0, 0.15) !important;
          border-left: 4px solid currentColor !important;
          border-radius: 4px !important;
          opacity: 0.9;
        }
        
        .wa-quote-reply-incoming {
          background-color: rgba(255, 255, 255, 0.05) !important;
          border-left: 4px solid #00a884 !important;
          border-radius: 4px !important;
        }
        .light .wa-quote-reply-incoming {
          background-color: rgba(0, 0, 0, 0.05) !important;
          border-left: 4px solid #008069 !important;
        }

        .wa-button-separator-outgoing {
          border-top: 1px solid rgba(0, 0, 0, 0.08) !important;
        }
        
        .wa-button-separator-incoming {
          border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
        }
        .light .wa-button-separator-incoming {
          border-top: 1px solid rgba(0, 0, 0, 0.05) !important;
        }
        
        .wa-card-button-outgoing {
          color: inherit !important;
          transition: background-color 0.2s;
          cursor: pointer;
          font-weight: 600;
        }
        .wa-card-button-outgoing:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }

        .wa-card-button-incoming {
          color: #00a884 !important;
          transition: background-color 0.2s;
          cursor: pointer;
          font-weight: 600;
        }
        .light .wa-card-button-incoming {
          color: #008069 !important;
        }
        .wa-card-button-incoming:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }
        .light .wa-card-button-incoming:hover {
          background-color: rgba(0, 0, 0, 0.02);
        }

        .wa-timestamp {
          color: rgba(255, 255, 255, 0.6) !important;
        }
        .wa-bubble-incoming .wa-timestamp {
          color: #8696a0 !important;
        }
        .light .wa-bubble-incoming .wa-timestamp {
          color: #667781 !important;
        }
      ` }} />
      <PageHeader
        title="Chat Direto"
        subtitle="Converse diretamente com seus contatos cadastrados."
      />

      <div className="flex-1 min-h-0 flex border-t">
        {/* Sidebar de Contatos */}
        <div
          className={cn(
            "w-full md:w-80 lg:w-96 border-r flex flex-col h-full bg-muted/20 shrink-0",
            selectedContact ? "hidden md:flex" : "flex",
          )}
        >
          {/* Abas Superiores com contadores e botões de ação */}
          <div className="flex items-center justify-between p-3 border-b bg-muted/30 shrink-0">
            <div className="flex items-center gap-1.5 flex-1">
              <button
                type="button"
                onClick={() => setActiveTab("novos")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                  activeTab === "novos"
                    ? "bg-background text-foreground shadow-sm border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                Novos
                <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {novosContacts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("meus")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                  activeTab === "meus"
                    ? "bg-background text-foreground shadow-sm border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                Meus
                <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {meusContacts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("outros")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
                  activeTab === "outros"
                    ? "bg-background text-foreground shadow-sm border"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                Outros
                <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {outrosContacts.length}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-2">
              <Button size="icon" variant="ghost" title="Arquivados" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg">
                <Archive className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" title="Menu" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Barra de Busca e botões de filtro */}
          <div className="p-3 border-b flex flex-col gap-2 bg-background shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar atendimento"
                  className="pl-8 h-9 text-xs rounded-full border-border bg-muted/40 focus-visible:bg-background focus-visible:ring-primary"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-0.5 shrink-0">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowTagFilters(!showTagFilters)}
                  title="Filtro de etiquetas"
                  className={cn(
                    "h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/60 transition-colors",
                    showTagFilters && "bg-muted text-primary hover:bg-muted"
                  )}
                >
                  <Filter className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Ordenar" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg">
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Visualização" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg">
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" title="Novo Atendimento" className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg">
                  <FolderPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* TagFilterBar: Exibida sob demanda ao clicar no funil */}
            {showTagFilters && (
              <div className="flex flex-col gap-1 pt-1.5 border-t animate-in fade-in slide-in-from-top-1 duration-250">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Etiquetas
                  </span>
                  <div className="flex items-center gap-2">
                    {selectedFilterTagIds.length > 0 && (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground font-medium transition-colors"
                        onClick={() => setSelectedFilterTagIds([])}
                        title="Limpar filtros"
                      >
                        <X className="h-3 w-3" /> Limpar
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-[10px] text-primary hover:underline font-semibold transition-colors"
                      onClick={() => setIsManageTagsOpen(true)}
                    >
                      Gerenciar
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto py-0.5">
                  {tagsQuery.isLoading ? (
                    <div className="h-4 w-12 rounded bg-muted animate-pulse" />
                  ) : (tagsQuery.data ?? []).length === 0 ? (
                    <span className="text-[10px] text-muted-foreground italic">
                      Nenhuma etiqueta.
                    </span>
                  ) : (
                    (tagsQuery.data ?? []).map((tag: any) => {
                      const isActive = selectedFilterTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => {
                            setSelectedFilterTagIds((prev) =>
                              prev.includes(tag.id)
                                ? prev.filter((id) => id !== tag.id)
                                : [...prev, tag.id]
                            );
                          }}
                          className={cn(
                            "transition-all cursor-pointer hover:scale-105 rounded-full text-[9px] font-bold px-2 py-0.5 border",
                            isActive
                              ? "opacity-100 ring-2 ring-primary ring-offset-1 ring-offset-background text-white"
                              : "opacity-60 text-white"
                          )}
                          style={{ backgroundColor: tag.color, borderColor: tag.color }}
                        >
                          {tag.name}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Subheader Informativo */}
          <div className="px-3.5 py-2 border-b bg-muted/20 text-xs text-muted-foreground shrink-0">
            Atendimento distribuído para <strong className="text-foreground font-semibold">{profile?.full_name || 'Amanda'}</strong>
          </div>

          {/* Lista de Contatos */}
          <div className="flex-1 overflow-y-auto divide-y bg-background">
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
                const avatarUrl = getContactAvatarUrl(c);
                const avatarBg = getAvatarColor(c.name ?? "");
                const contactTags = cachedConvTags.filter(
                  (ct: any) => ct.contact_number === c.phone_e164
                );

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedContact(c);
                      setReplyingTo(null);
                    }}
                    className={cn(
                      "w-full flex items-start gap-3 p-3.5 text-left transition-colors border-b border-border",
                      isSelected ? "bg-primary/10" : "hover:bg-muted/40"
                    )}
                  >
                    {/* Avatar com WhatsApp Status Overlay */}
                    <div className="relative shrink-0">
                      <div
                        className="h-11 w-11 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold text-sm shadow-sm border border-border"
                        style={!avatarUrl ? { backgroundColor: avatarBg } : undefined}
                      >
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={c.name ?? "Contato"}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              const target = e.currentTarget;
                              const parent = target.parentElement;
                              if (parent) {
                                target.style.display = "none";
                                parent.style.backgroundColor = avatarBg;
                                parent.textContent = getInitials(c.name ?? "");
                              }
                            }}
                          />
                        ) : (
                          getInitials(c.name ?? "")
                        )}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 bg-background p-0.5 rounded-full shadow-sm">
                        <div className="bg-emerald-500 p-0.5 rounded-full text-white flex items-center justify-center">
                          {/* Ícone discreto do WhatsApp */}
                          <svg
                            viewBox="0 0 24 24"
                            className="h-2.5 w-2.5 fill-current"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.5-5.739-1.446L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.965C16.588 1.977 14.133.953 11.5.953c-5.439 0-9.859 4.373-9.862 9.802-.001 1.704.453 3.364 1.316 4.824L1.936 21.05l5.59-1.467-.879-.429z" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Conteúdo Central e Lateral Direito */}
                    <div className="flex-1 min-w-0 flex justify-between gap-2">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <h4 className="font-bold text-sm text-foreground truncate leading-snug">
                          {c.name || "Sem Nome"}
                        </h4>

                        {/* Etiquetas Textuais de Fundo Sólido */}
                        {contactTags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {contactTags.map((ct: any) => (
                              <span
                                key={ct.tag_id}
                                className="inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider text-white select-none"
                                style={{ backgroundColor: ct.tags?.color || '#6366f1' }}
                              >
                                {ct.tags?.name}
                              </span>
                            ))}
                          </div>
                        )}

                        <p className="text-xs text-muted-foreground truncate leading-normal">
                          {c.last_message_body || c.custom_fields?.company || "Sem mensagens"}
                        </p>
                      </div>

                      {/* Coluna Direita: Setor, Horário e Contagem de Não Lidas */}
                      <div className="shrink-0 flex flex-col items-end justify-between text-right space-y-1">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded-full text-[9.5px] font-medium border select-none",
                            getDeptStyle(c.department)
                          )}
                        >
                          {c.department}
                        </span>

                        <span className="text-[10px] text-muted-foreground select-none">
                          {c.last_message_time ? formatRelativeTime(c.last_message_time) : "sem data"}
                        </span>

                        {c.unread_count > 0 && (
                          <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-sm select-none">
                            {c.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Rodapé: Seletor de DDI + Telefone + Botão Conversar */}
          <div className="p-3 border-t flex items-center gap-2 shrink-0 bg-muted/30">
            <div className="relative shrink-0">
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="appearance-none bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-semibold text-foreground pr-7 cursor-pointer hover:bg-muted/40 focus:outline-none focus:ring-1 focus:ring-primary h-9 shadow-sm"
              >
                <option value="+55">+55</option>
                <option value="+1">+1</option>
                <option value="+351">+351</option>
                <option value="+54">+54</option>
              </select>
              <div className="absolute right-2 top-3 pointer-events-none text-muted-foreground">
                <ChevronRight className="h-3 w-3 rotate-90" />
              </div>
            </div>

            <Input
              type="text"
              placeholder="(00) 00000-0000"
              value={newChatPhone}
              onChange={(e) => {
                let val = e.target.value.replace(/\D/g, "");
                if (val.length > 11) val = val.slice(0, 11);
                if (val.length > 7) {
                  val = `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
                } else if (val.length > 2) {
                  val = `(${val.slice(0, 2)}) ${val.slice(2)}`;
                } else if (val.length > 0) {
                  val = `(${val}`;
                }
                setNewChatPhone(val);
              }}
              className="flex-1 h-9 text-xs rounded-lg border-border focus-visible:ring-primary shadow-sm bg-background"
            />

            <Button
              type="button"
              variant="outline"
              onClick={handleStartNewChat}
              disabled={addContactMutation.isPending || !newChatPhone}
              className="h-9 text-xs border-primary/30 hover:border-primary/50 text-primary hover:text-primary hover:bg-primary/10 px-4 rounded-full font-semibold transition-colors shadow-sm shrink-0"
            >
              {addContactMutation.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                "Conversar"
              )}
            </Button>
          </div>
        </div>

        {/* Janela de Mensagens + Painel de Info */}
        <div
          className={cn(
            "flex-1 flex h-full bg-background relative overflow-hidden",
            selectedContact ? "flex" : "hidden md:flex",
          )}
        >
          {/* Coluna central de mensagens */}
          <div className="flex-1 flex flex-col h-full min-w-0">
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

                    {(() => {
                      const avatarUrl = getContactAvatarUrl(selectedContact);
                      const avatarBg = getAvatarColor(selectedContact.name ?? "");
                      return (
                        <button
                          type="button"
                          onClick={() => setContactInfoOpen((o) => !o)}
                          title="Ver dados do contato"
                          className="h-9 w-9 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold text-sm shrink-0 ring-2 ring-transparent hover:ring-primary/60 transition-all duration-200 cursor-pointer"
                          style={!avatarUrl ? { backgroundColor: avatarBg } : undefined}
                        >
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={selectedContact.name ?? "Contato"}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                const target = e.currentTarget;
                                const parent = target.parentElement;
                                if (parent) {
                                  target.style.display = "none";
                                  parent.style.backgroundColor = avatarBg;
                                  parent.textContent = (selectedContact.name ?? "C")
                                    .slice(0, 2)
                                    .toUpperCase();
                                }
                              }}
                            />
                          ) : (
                            (selectedContact.name ?? "C").slice(0, 2).toUpperCase()
                          )}
                        </button>
                      );
                    })()}

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm truncate text-foreground leading-tight">
                          {selectedContact.name || "Sem Nome"}
                        </h3>
                        {/* Render conversation tag pills/dots in header */}
                        {(() => {
                          const contactTags = cachedConvTags.filter(
                            (ct: any) => ct.contact_number === selectedContact.phone_e164,
                          );
                          if (contactTags.length === 0) return null;
                          return (
                            <div className="flex gap-1">
                              {contactTags.map((ct: any) => (
                                <TagBadge key={ct.tag_id} tag={ct.tags} />
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                        <Phone className="h-3 w-3 shrink-0" />+{selectedContact.phone_e164}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Conversation Tag Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full hover:bg-muted"
                          title="Etiquetas da conversa"
                        >
                          <Tag className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="p-2 min-w-[200px]" align="end">
                        {(() => {
                          const contactTags = cachedConvTags.filter(
                            (ct: any) => ct.contact_number === selectedContact.phone_e164,
                          );
                          return (
                            <>
                              {contactTags.length > 0 && (
                                <div className="border-b pb-1.5 mb-1.5">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="w-full justify-start text-xs text-destructive hover:bg-destructive/10 hover:text-destructive h-7 px-2 font-medium"
                                    onClick={() =>
                                      handleClearConversationTags(selectedContact.phone_e164)
                                    }
                                  >
                                    <X className="h-3 w-3 mr-1.5" /> Limpar etiquetas (
                                    {contactTags.length})
                                  </Button>
                                </div>
                              )}

                              <div className="max-h-40 overflow-y-auto space-y-1">
                                {(tagsQuery.data ?? []).length === 0 ? (
                                  <div className="text-[10px] text-muted-foreground p-1 text-center">
                                    Nenhuma etiqueta cadastrada.
                                  </div>
                                ) : (
                                  (tagsQuery.data ?? []).map((tag: any) => {
                                    const isApplied = contactTags.some(
                                      (ct: any) => ct.tag_id === tag.id,
                                    );
                                    return (
                                      <button
                                        key={tag.id}
                                        type="button"
                                        onClick={() =>
                                          handleToggleConversationTag(
                                            selectedContact.phone_e164,
                                            tag.id,
                                            isApplied,
                                          )
                                        }
                                        className="w-full flex items-center justify-between p-1.5 rounded text-xs hover:bg-muted/60 transition-colors text-left"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span
                                            className="h-3 w-3 rounded-full"
                                            style={{ backgroundColor: tag.color }}
                                          />
                                          <span className="truncate">{tag.name}</span>
                                        </div>
                                        <span
                                          className={cn(
                                            "h-4 w-4 rounded border flex items-center justify-center transition-all",
                                            isApplied
                                              ? "bg-primary text-primary-foreground border-primary"
                                              : "border-muted-foreground/30",
                                          )}
                                        >
                                          {isApplied && <Check className="h-3 w-3" />}
                                        </span>
                                      </button>
                                    );
                                  })
                                )}
                              </div>

                              {/* Inline tag creator form */}
                              <div className="border-t mt-1.5 pt-1.5 space-y-1.5">
                                <p className="text-[10px] text-muted-foreground px-1 font-semibold">
                                  Nova etiqueta
                                </p>
                                <div className="flex gap-1">
                                  <Input
                                    placeholder="Nome..."
                                    className="h-7 text-xs px-2 flex-1"
                                    maxLength={20}
                                    onKeyDown={async (e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        const target = e.currentTarget;
                                        const val = target.value.trim();
                                        if (!val) return;
                                        const res = await handleCreateTag(val, selectedColor);
                                        if (res) {
                                          target.value = "";
                                          handleToggleConversationTag(
                                            selectedContact.phone_e164,
                                            res.id,
                                            false,
                                          );
                                        }
                                      }
                                    }}
                                  />
                                </div>
                                <div className="flex justify-between px-1">
                                  {PREDEFINED_COLORS.slice(0, 8).map((c) => (
                                    <button
                                      key={c}
                                      type="button"
                                      className={cn(
                                        "h-3 w-3 rounded-full border transition-transform hover:scale-110",
                                        selectedColor === c
                                          ? "border-foreground"
                                          : "border-transparent",
                                      )}
                                      style={{ backgroundColor: c }}
                                      onClick={() => setSelectedColor(c)}
                                    />
                                  ))}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Indicador discreto de sincronização automática */}
                    <div
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      title="Atualizando automaticamente a cada 4s"
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          messagesQuery.isFetching ? "bg-primary animate-pulse" : "bg-emerald-500",
                        )}
                      />
                      <span className="hidden sm:inline">
                        {messagesQuery.isFetching ? "Sincronizando..." : "Ao vivo"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Corpo / Lista de Balões */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 relative bg-muted/10">
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
                        Envie uma mensagem abaixo para iniciar a conversa direta oficial do
                        WhatsApp.
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
                              <div className="flex flex-col gap-1">
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

                                {renderMessageTagDropdown(msg)}

                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded-full"
                                  onClick={() => setReplyingTo(msg)}
                                  title="Responder"
                                >
                                  <Reply className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            )}

                            {/* Balão em si */}
                            <div className="flex flex-col relative">
                              {(() => {
                                const payload = msg.metadata?.payload;
                                const interactive = payload?.interactive;
                                
                                // Extract interactive header media
                                const header = interactive?.header;
                                let headerMediaUrl = "";
                                let headerMediaType = "";
                                let headerText = "";
                                
                                if (header) {
                                  if (header.type === "image" && header.image?.link) {
                                    headerMediaUrl = header.image.link;
                                    headerMediaType = "image";
                                  } else if (header.type === "video" && header.video?.link) {
                                    headerMediaUrl = header.video.link;
                                    headerMediaType = "video";
                                  } else if (header.type === "document" && header.document?.link) {
                                    headerMediaUrl = header.document.link;
                                    headerMediaType = "document";
                                  } else if (header.type === "text" && header.text) {
                                    headerText = header.text;
                                  }
                                }

                                // Extract standard message body and type
                                const type = msg.type || "text";
                                const bodyText = msg.body || "";
                                
                                // Helper to check if string is a URL
                                const isUrl = (str: string) => {
                                  if (!str) return false;
                                  return str.startsWith("http://") || str.startsWith("https://");
                                };

                                // Format WhatsApp bold, italic, strikethrough in bodyText
                                const formatMessageText = (text: string) => {
                                  if (!text) return "";
                                  let formatted = text;
                                  // Bold
                                  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
                                  formatted = formatted.replace(/\*([^*]+)\*/g, "<strong>$1</strong>");
                                  // Italic
                                  formatted = formatted.replace(/__([^_]+)__/g, "<em>$1</em>");
                                  formatted = formatted.replace(/_([^_]+)_/g, "<em>$1</em>");
                                  // Strikethrough
                                  formatted = formatted.replace(/~~([^~]+)~~/g, "<del>$1</del>");
                                  formatted = formatted.replace(/~([^~]+)~/g, "<del>$1</del>");
                                  // Code
                                  formatted = formatted.replace(/`([^`]+)`/g, "<code class='bg-black/25 px-1 py-0.5 rounded font-mono text-[11px]'>$1</code>");
                                  return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
                                };

                                // Helper to get media source URL
                                const getMediaUrl = (urlOrId: string) => {
                                  if (!urlOrId) return "";
                                  if (isUrl(urlOrId)) return urlOrId;
                                  return sessionToken ? `/api/whatsapp/media?id=${urlOrId}&token=${encodeURIComponent(sessionToken)}` : "";
                                };

                                const hasTopMedia = (headerMediaType === "image" || headerMediaType === "video") || (type === "image" || type === "video");
                                const hasBottomActions = (interactive?.type === "button" && interactive.action?.buttons) || (interactive?.type === "list") || (interactive?.type === "flow");
                                const isRichCard = hasTopMedia || hasBottomActions;

                                return (
                                  <div
                                    className={cn(
                                      "shadow-sm relative transition-all duration-200 max-w-sm",
                                      isOutgoing
                                        ? "wa-bubble-outgoing"
                                        : "wa-bubble-incoming",
                                      isRichCard ? "p-0 rounded-lg" : "p-3",
                                    )}
                                  >
                                    {/* Display applied tags in message body */}
                                    {(() => {
                                      const msgTags = (messageTagsQuery.data ?? []).filter(
                                        (mt: any) => mt.message_id === msg.id,
                                      );
                                      if (msgTags.length === 0) return null;
                                      return (
                                        <div className={cn("flex flex-wrap gap-1 mb-1.5", isRichCard ? "px-3 pt-3" : "")}>
                                          {msgTags.map((mt: any) => (
                                            <TagBadge
                                              key={mt.tag_id}
                                              tag={mt.tags}
                                              className={cn(
                                                "shadow-sm",
                                                isOutgoing ? "border-primary-foreground/30 text-white" : "",
                                              )}
                                            />
                                          ))}
                                        </div>
                                      );
                                    })()}

                                    {/* Quote reply block inside bubble */}
                                    {replyMessage && (
                                      <div className={cn("px-3 pt-3", isRichCard ? "" : "pb-1")}>
                                        <button
                                          onClick={() => scrollToMessage(replyMessage.id)}
                                          className={cn(
                                            "w-full text-left text-xs p-2 rounded-md border-l-4 transition-all hover:opacity-100 block",
                                            isOutgoing ? "wa-quote-reply-outgoing" : "wa-quote-reply-incoming"
                                          )}
                                        >
                                          <div className="font-bold mb-0.5 text-emerald-400 text-[11px]">
                                            {replyMessage.direction === "incoming" ? "Contato" : "Você"}
                                          </div>
                                          <div className="truncate opacity-80 text-[11px]">
                                            {replyMessage.type === "image"
                                              ? "📷 Imagem"
                                              : replyMessage.type === "audio"
                                                ? "🎙️ Áudio"
                                                : replyMessage.type === "video"
                                                  ? "🎥 Vídeo"
                                                  : replyMessage.type === "document"
                                                    ? "📄 Documento"
                                                    : replyMessage.type === "sticker"
                                                      ? "😊 Sticker"
                                                      : replyMessage.type === "location"
                                                        ? "📍 Localização"
                                                        : replyMessage.type === "contacts"
                                                          ? "👤 Contato"
                                                          : replyMessage.body}
                                          </div>
                                        </button>
                                      </div>
                                    )}

                                    <div className="space-y-0.5">
                                      {/* A. Render Interactive Header Media if present */}
                                      {headerMediaType === "image" && headerMediaUrl && (
                                        <div className={cn(
                                          "w-full overflow-hidden bg-black/10",
                                          isOutgoing ? "rounded-tl-lg rounded-tr-none" : "rounded-tl-none rounded-tr-lg"
                                        )}>
                                          <img src={headerMediaUrl} alt="Header" className="w-full max-h-60 object-cover" />
                                        </div>
                                      )}
                                      {headerMediaType === "video" && headerMediaUrl && (
                                        <div className={cn(
                                          "w-full overflow-hidden bg-black/10",
                                          isOutgoing ? "rounded-tl-lg rounded-tr-none" : "rounded-tl-none rounded-tr-lg"
                                        )}>
                                          <video src={headerMediaUrl} controls className="w-full max-h-60 object-cover" />
                                        </div>
                                      )}
                                      {headerMediaType === "document" && headerMediaUrl && (
                                        <div className="mx-3 mt-3 rounded-lg border border-muted-foreground/10 bg-black/10 p-2 flex items-center gap-2 text-xs">
                                          <FileText className="h-6 w-6 text-primary shrink-0" />
                                          <span className="truncate font-medium flex-1">{header.document?.filename || "Documento de Cabeçalho"}</span>
                                          <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0 ml-auto rounded-full" asChild>
                                            <a href={headerMediaUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3 w-3" /></a>
                                          </Button>
                                        </div>
                                      )}

                                      {/* B. Render Standard Media Types */}
                                      {type === "image" && bodyText && (
                                        <div className={cn(
                                          "w-full overflow-hidden bg-black/10",
                                          isOutgoing ? "rounded-lg rounded-tr-none" : "rounded-lg rounded-tl-none"
                                        )}>
                                          {getMediaUrl(bodyText) ? (
                                            <img src={getMediaUrl(bodyText)} alt="Imagem" className="w-full max-h-64 object-cover" />
                                          ) : (
                                            <div className="aspect-video w-full bg-muted flex items-center justify-center">
                                              <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {type === "audio" && bodyText && (
                                        <div className="px-1 py-1.5">
                                          {getMediaUrl(bodyText) ? (
                                            <audio src={getMediaUrl(bodyText)} controls className="w-[240px] max-w-full h-10" />
                                          ) : (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                              <Volume2 className="h-4 w-4" /> Áudio (ID: {bodyText})
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {type === "video" && bodyText && (
                                        <div className={cn(
                                          "w-full overflow-hidden bg-black/10",
                                          isOutgoing ? "rounded-lg rounded-tr-none" : "rounded-lg rounded-tl-none"
                                        )}>
                                          {getMediaUrl(bodyText) ? (
                                            <video src={getMediaUrl(bodyText)} controls className="w-full max-h-64 object-cover" />
                                          ) : (
                                            <div className="aspect-video w-full bg-muted flex items-center justify-center">
                                              <Video className="h-6 w-6 text-muted-foreground" />
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {type === "document" && bodyText && (
                                        <div className="mx-3 mt-3 rounded-lg border border-muted-foreground/15 bg-black/10 p-3 flex items-center gap-3">
                                          <FileText className="h-8 w-8 text-primary shrink-0" />
                                          <div className="min-w-0 flex-1">
                                            <p className="text-xs font-medium truncate text-foreground">
                                              {isUrl(bodyText) ? bodyText.substring(bodyText.lastIndexOf("/") + 1) : bodyText}
                                            </p>
                                            <p className="text-[10px] opacity-75">Documento PDF/Office</p>
                                          </div>
                                          {getMediaUrl(bodyText) && (
                                            <Button size="icon" variant="ghost" asChild className="h-8 w-8 shrink-0 rounded-full">
                                              <a href={getMediaUrl(bodyText)} target="_blank" rel="noreferrer">
                                                <ExternalLink className="h-4 w-4" />
                                              </a>
                                            </Button>
                                          )}
                                        </div>
                                      )}

                                      {type === "sticker" && bodyText && (
                                        <div className="p-1">
                                          {getMediaUrl(bodyText) ? (
                                            <img src={getMediaUrl(bodyText)} alt="Sticker" className="h-24 w-24 object-contain" />
                                          ) : (
                                            <span className="text-xs text-muted-foreground font-mono">Sticker (ID: {bodyText})</span>
                                          )}
                                        </div>
                                      )}

                                      {type === "location" && msg.location && (
                                        <div className="mx-3 mt-3 rounded-lg border border-muted-foreground/15 bg-black/10 p-3 space-y-2">
                                          <div className="flex items-start gap-2.5">
                                            <MapPin className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                                            <div className="min-w-0">
                                              <p className="text-xs font-semibold text-foreground">{msg.location.name || "Localização"}</p>
                                              <p className="text-[10px] text-muted-foreground leading-normal">
                                                {msg.location.address || `${msg.location.latitude}, ${msg.location.longitude}`}
                                              </p>
                                            </div>
                                          </div>
                                          <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1" asChild>
                                            <a href={`https://www.google.com/maps/search/?api=1&query=${msg.location.latitude},${msg.location.longitude}`} target="_blank" rel="noreferrer">
                                              <ExternalLink className="h-3 w-3" /> Ver no Google Maps
                                            </a>
                                          </Button>
                                        </div>
                                      )}

                                      {type === "contacts" && msg.contacts && (
                                        <div className="mx-3 mt-3 rounded-lg border border-muted-foreground/15 bg-black/10 p-3 space-y-3">
                                          <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                              <User className="h-4 w-4" />
                                            </div>
                                            <div className="min-w-0">
                                              <p className="text-xs font-semibold truncate">{msg.contacts[0]?.name?.formatted_name || "Contato"}</p>
                                              <p className="text-[10px] text-muted-foreground font-mono truncate">{msg.contacts[0]?.phones?.[0]?.phone || "Sem telefone"}</p>
                                            </div>
                                          </div>
                                          {msg.contacts[0]?.phones?.[0]?.phone && (
                                            <Button size="sm" variant="outline" className="w-full text-xs h-7 gap-1" asChild>
                                              <a href={`tel:${msg.contacts[0].phones[0].phone}`}><Phone className="h-3 w-3" /> Ligar para Contato</a>
                                            </Button>
                                          )}
                                        </div>
                                      )}

                                      {/* Text block for header text, body, and footer */}
                                      {((!["image", "audio", "video", "document", "sticker", "location", "contacts"].includes(type) && bodyText) || headerText || interactive?.footer?.text) && (
                                        <div className="px-3 py-2 space-y-1">
                                          {headerText && (
                                            <p className="text-[11px] font-bold uppercase tracking-wider opacity-85">
                                              {headerText}
                                            </p>
                                          )}
                                          {!["image", "audio", "video", "document", "sticker", "location", "contacts"].includes(type) && bodyText && (
                                            <p className="text-[13.5px] whitespace-pre-wrap break-words leading-relaxed select-text font-normal">
                                              {formatMessageText(bodyText)}
                                            </p>
                                          )}
                                          {interactive?.footer?.text && (
                                            <p className="text-[10px] opacity-60">
                                              {interactive.footer.text}
                                            </p>
                                          )}
                                        </div>
                                      )}

                                      {/* E. Render Buttons / Actions (WhatsApp Web Style) */}
                                      {interactive?.type === "button" && interactive.action?.buttons && (
                                        <div className="flex flex-col w-full mt-1.5">
                                          {interactive.action.buttons.map((btn: any, btnIdx: number) => {
                                            const isLast = btnIdx === interactive.action.buttons.length - 1;
                                            return (
                                              <div 
                                                key={btnIdx}
                                                className={cn(
                                                  "w-full py-2.5 text-xs text-center flex items-center justify-center gap-1.5 select-none",
                                                  isOutgoing
                                                    ? "wa-card-button-outgoing wa-button-separator-outgoing"
                                                    : "wa-card-button-incoming wa-button-separator-incoming",
                                                  isLast && (isOutgoing ? "rounded-b-lg rounded-br-none" : "rounded-b-lg rounded-bl-none")
                                                )}
                                              >
                                                <MessageSquare className="h-3.5 w-3.5 opacity-60" />
                                                {btn.reply?.title || "Botão"}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}

                                      {/* F. Render List selection action */}
                                      {interactive?.type === "list" && (
                                        <div className="flex flex-col w-full mt-1.5">
                                          <div 
                                            className={cn(
                                              "w-full py-2.5 text-xs text-center flex items-center justify-center gap-1.5 select-none",
                                              isOutgoing
                                                ? "wa-card-button-outgoing wa-button-separator-outgoing rounded-b-lg rounded-br-none"
                                                : "wa-card-button-incoming wa-button-separator-incoming rounded-b-lg rounded-bl-none"
                                            )}
                                          >
                                            <Menu className="h-3.5 w-3.5 opacity-60" />
                                            {interactive.action?.button || "Ver Recursos"}
                                          </div>
                                        </div>
                                      )}

                                      {/* G. Render Flow CTA action */}
                                      {interactive?.type === "flow" && (
                                        <div className="flex flex-col w-full mt-1.5">
                                          <div 
                                            className={cn(
                                              "w-full py-2.5 text-xs text-center flex items-center justify-center gap-1.5 select-none",
                                              isOutgoing
                                                ? "wa-card-button-outgoing wa-button-separator-outgoing rounded-b-lg rounded-br-none"
                                                : "wa-card-button-incoming wa-button-separator-incoming rounded-b-lg rounded-bl-none"
                                            )}
                                          >
                                            <ClipboardList className="h-3.5 w-3.5 opacity-80" />
                                            {interactive.action?.parameters?.flow_cta || "Preencher Formulário"}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {/* Horário + Status */}
                                    <div
                                      className={cn(
                                        "flex items-center justify-end gap-1 text-[10px] wa-timestamp pb-1.5 pr-2.5 pt-0.5",
                                        !isRichCard && "px-0 pb-0 pt-1"
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
                                );
                              })()}

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
                              <div className="flex flex-col gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded-full"
                                  onClick={() => setReplyingTo(msg)}
                                  title="Responder"
                                >
                                  <Reply className="h-4 w-4 text-muted-foreground" />
                                </Button>

                                {renderMessageTagDropdown(msg)}

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
                              </div>
                            )}
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          title="Anexar arquivo ou mídia"
                          className="shrink-0 h-10 w-10 rounded-full hover:bg-muted"
                          disabled={uploadingMedia || sendMutation.isPending}
                        >
                          {uploadingMedia ? (
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          ) : (
                            <Paperclip className="h-5 w-5 text-muted-foreground" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48 p-1">
                        <DropdownMenuItem onClick={() => handleMediaAttachClick("image")}>
                          <ImageIcon className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
                          <span>Imagem</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleMediaAttachClick("audio")}>
                          <Volume2 className="h-4 w-4 mr-2 text-orange-600 dark:text-orange-400" />
                          <span>Áudio</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleMediaAttachClick("video")}>
                          <Video className="h-4 w-4 mr-2 text-red-600 dark:text-red-400" />
                          <span>Vídeo</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleMediaAttachClick("document")}>
                          <FileText className="h-4 w-4 mr-2 text-emerald-600 dark:text-emerald-400" />
                          <span>Documento</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleMediaAttachClick("sticker")}>
                          <Smile className="h-4 w-4 mr-2 text-amber-500 dark:text-amber-400" />
                          <span>Sticker</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsLocationModalOpen(true)}>
                          <MapPin className="h-4 w-4 mr-2 text-rose-600 dark:text-rose-400" />
                          <span>Localização</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsContactModalOpen(true)}>
                          <Users className="h-4 w-4 mr-2 text-indigo-600 dark:text-indigo-400" />
                          <span>Contato</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsImageModalOpen(true)}>
                          <LinkIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                          <span>Imagem por ID</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Hidden file input */}
                    <input
                      type="file"
                      ref={mediaInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    {/* Modal de envio de Imagem da Meta por ID */}
                    <Dialog open={isImageModalOpen} onOpenChange={setIsImageModalOpen}>
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

                    {/* Modal de Envio de Localização */}
                    <Dialog open={isLocationModalOpen} onOpenChange={setIsLocationModalOpen}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Enviar Localização</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label htmlFor="loc-lat">Latitude</Label>
                              <Input
                                id="loc-lat"
                                placeholder="Ex: -23.55052"
                                value={locLat}
                                onChange={(e) => setLocLat(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor="loc-lng">Longitude</Label>
                              <Input
                                id="loc-lng"
                                placeholder="Ex: -46.633308"
                                value={locLng}
                                onChange={(e) => setLocLng(e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="loc-name">Nome do Local (Opcional)</Label>
                            <Input
                              id="loc-name"
                              placeholder="Ex: Praça da Sé"
                              value={locName}
                              onChange={(e) => setLocName(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="loc-address">Endereço (Opcional)</Label>
                            <Input
                              id="loc-address"
                              placeholder="Ex: Praça da Sé, São Paulo - SP"
                              value={locAddress}
                              onChange={(e) => setLocAddress(e.target.value)}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsLocationModalOpen(false)}>
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleSendLocation}
                            disabled={!locLat || !locLng || sendMutation.isPending}
                          >
                            Enviar Localização
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Modal de Envio de Contato */}
                    <Dialog open={isContactModalOpen} onOpenChange={setIsContactModalOpen}>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Enviar Contato</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                          <div className="space-y-1">
                            <Label htmlFor="contact-name">Nome do Contato</Label>
                            <Input
                              id="contact-name"
                              placeholder="Ex: João Silva"
                              value={contactNameState}
                              onChange={(e) => setContactNameState(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="contact-phone">Telefone (com DDI/DDD)</Label>
                            <Input
                              id="contact-phone"
                              placeholder="Ex: 5511999999999"
                              value={contactPhoneState}
                              onChange={(e) => setContactPhoneState(e.target.value)}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsContactModalOpen(false)}>
                            Cancelar
                          </Button>
                          <Button
                            onClick={handleSendContact}
                            disabled={
                              !contactNameState.trim() ||
                              !contactPhoneState.trim() ||
                              sendMutation.isPending
                            }
                          >
                            Enviar Contato
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Dialog de Gerenciamento de Etiquetas */}
                    <Dialog open={isManageTagsOpen} onOpenChange={setIsManageTagsOpen}>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Gerenciar Etiquetas</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                          {/* Criar nova tag */}
                          <div className="space-y-3 border-b pb-4">
                            <Label className="text-xs font-semibold">Nova etiqueta</Label>
                            <div className="flex gap-2">
                              <Input
                                placeholder="Nome (max 20 caracteres)"
                                value={newTagName}
                                maxLength={20}
                                onChange={(e) => setNewTagName(e.target.value)}
                                className="flex-1 font-sans"
                              />
                              <Button
                                onClick={async () => {
                                  if (!newTagName.trim()) return;
                                  const res = await handleCreateTag(
                                    newTagName,
                                    selectedColor,
                                    selectedIconName,
                                  );
                                  if (res) setNewTagName("");
                                }}
                              >
                                Criar
                              </Button>
                            </div>

                            <div className="flex flex-col gap-2">
                              <Label className="text-xs text-muted-foreground">Cor e Ícone</Label>
                              <div className="flex items-center gap-3">
                                <input
                                  type="color"
                                  value={selectedColor}
                                  onChange={(e) => setSelectedColor(e.target.value)}
                                  className="w-8 h-8 p-0 border-0 cursor-pointer rounded-lg overflow-hidden shrink-0"
                                />
                                <div className="flex gap-1.5 flex-wrap">
                                  {PREDEFINED_COLORS.map((c) => (
                                    <button
                                      key={c}
                                      type="button"
                                      className={cn(
                                        "h-5 w-5 rounded-full border-2 transition-transform hover:scale-110",
                                        selectedColor === c
                                          ? "border-foreground"
                                          : "border-transparent",
                                      )}
                                      style={{ backgroundColor: c }}
                                      onClick={() => setSelectedColor(c)}
                                    />
                                  ))}
                                </div>
                              </div>

                              {/* Ícone picker */}
                              <div className="flex gap-2 flex-wrap pt-1">
                                {Object.keys(TAG_ICONS).map((iconName) => {
                                  const IconComp = TAG_ICONS[iconName];
                                  return (
                                    <button
                                      key={iconName}
                                      type="button"
                                      onClick={() => setSelectedIconName(iconName)}
                                      className={cn(
                                        "h-7 w-7 rounded border flex items-center justify-center transition-colors hover:bg-muted",
                                        selectedIconName === iconName
                                          ? "bg-primary text-primary-foreground border-primary"
                                          : "border-transparent text-muted-foreground",
                                      )}
                                    >
                                      <IconComp className="h-4 w-4" />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {/* Listar tags existentes */}
                          <div className="space-y-1">
                            <Label className="text-xs font-semibold">Etiquetas existentes</Label>
                            <div className="max-h-60 overflow-y-auto space-y-1 pt-1">
                              {tagsQuery.isLoading ? (
                                <div className="text-center py-4 text-xs text-muted-foreground">
                                  Carregando...
                                </div>
                              ) : (tagsQuery.data ?? []).length === 0 ? (
                                <div className="text-center py-4 text-xs text-muted-foreground">
                                  Nenhuma etiqueta criada.
                                </div>
                              ) : (
                                (tagsQuery.data ?? []).map((tag: any) => (
                                  <div
                                    key={tag.id}
                                    className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/40 text-sm"
                                  >
                                    <TagBadge tag={tag} className="text-xs px-2 py-1" />
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => handleDeleteTag(tag.id)}
                                      title="Excluir etiqueta"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
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

          {/* Painel lateral de informações do contato */}
          {selectedContact && (
            <div
              className={cn(
                "h-full border-l bg-card flex flex-col transition-all duration-300 ease-in-out overflow-hidden shrink-0",
                contactInfoOpen ? "w-72" : "w-0 border-l-0",
              )}
            >
              {contactInfoOpen && (
                <div className="flex flex-col h-full w-72">
                  {/* Header do painel */}
                  <div className="flex items-center justify-between p-4 border-b shrink-0">
                    <span className="font-semibold text-sm">Dados do Contato</span>
                    <button
                      onClick={() => setContactInfoOpen(false)}
                      className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-muted transition-colors"
                    >
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>

                  {/* Conteúdo scrollável */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-5">
                    {contactDetailsQuery.isLoading && (
                      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Carregando dados completos do contato…
                      </div>
                    )}
                    {/* Avatar grande + nome */}
                    <div className="flex flex-col items-center gap-3 py-2">
                      {(() => {
                        const avatarUrl = getContactAvatarUrl(selectedContact);
                        const avatarBg = getAvatarColor(selectedContact.name ?? "");
                        return (
                          <div
                            className="h-20 w-20 rounded-full overflow-hidden flex items-center justify-center text-white text-2xl font-bold shadow-lg"
                            style={!avatarUrl ? { backgroundColor: avatarBg } : undefined}
                          >
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={selectedContact.name ?? ""}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              (selectedContact.name ?? "C").slice(0, 2).toUpperCase()
                            )}
                          </div>
                        );
                      })()}
                      <div className="text-center">
                        <p className="font-semibold text-base leading-tight">
                          {selectedContact.name || "Sem Nome"}
                        </p>
                        {selectedContact.opted_out && (
                          <span className="mt-1 inline-flex items-center gap-1 text-[10px] bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-full font-medium">
                            Opt-out
                          </span>
                        )}
                      </div>

                      <input
                        ref={contactPhotoInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadContactPhoto(file);
                        }}
                      />

                      <div className="flex w-full flex-col gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => contactPhotoInputRef.current?.click()}
                          disabled={uploadingContactPhoto}
                        >
                          {uploadingContactPhoto ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Camera className="mr-2 h-4 w-4" />
                          )}
                          {uploadingContactPhoto ? "Enviando…" : "Trocar foto"}
                        </Button>

                        {getContactAvatarUrl(selectedContact) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full text-destructive hover:text-destructive"
                            onClick={handleRemoveContactPhoto}
                            disabled={uploadingContactPhoto}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remover foto
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="h-px bg-border" />

                    {/* Campos principais */}
                    <div className="space-y-3">
                      {/* Telefone */}
                      <div className="flex items-start gap-2.5">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                            Telefone
                          </p>
                          <p className="text-sm font-mono break-all">
                            +{selectedContact.phone_e164}
                          </p>
                        </div>
                      </div>

                      {/* E-mail */}
                      {selectedContact.email && (
                        <div className="flex items-start gap-2.5">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                              E-mail
                            </p>
                            <p className="text-sm break-all">{selectedContact.email}</p>
                          </div>
                        </div>
                      )}

                      {/* Source */}
                      {selectedContact.source && (
                        <div className="flex items-start gap-2.5">
                          <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                              Origem
                            </p>
                            <p className="text-sm capitalize">
                              {selectedContact.source.replace(/_/g, " ")}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Custom Fields */}
                    {selectedContact.custom_fields &&
                      Object.keys(selectedContact.custom_fields).length > 0 &&
                      (() => {
                        const cf = selectedContact.custom_fields;
                        const photoKeys = new Set([
                          "avatar_url",
                          "photo_url",
                          "photo",
                          "picture",
                          "image_url",
                          "image",
                        ]);
                        const entries = Object.entries(cf).filter(([k]) => !photoKeys.has(k));
                        if (entries.length === 0) return null;
                        return (
                          <>
                            <div className="h-px bg-border" />
                            <div className="space-y-3">
                              <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1.5">
                                <Tag className="h-3 w-3" /> Campos personalizados
                              </p>
                              {entries.map(([key, value]) => (
                                <div key={key} className="flex items-start gap-2.5">
                                  <div className="min-w-0 w-full">
                                    <p className="text-[10px] text-muted-foreground capitalize">
                                      {key.replace(/_/g, " ")}
                                    </p>
                                    <p className="text-sm break-all font-mono">
                                      {typeof value === "object"
                                        ? JSON.stringify(value)
                                        : String(value ?? "")}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        );
                      })()}

                    {/* Painel de Atribuição de Atendimento */}
                    <div className="h-px bg-border" />
                    <div className="space-y-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> Atribuição de Atendimento
                      </p>
                      
                      {/* Dropdown de Equipe */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">Equipe</label>
                        <Select
                          value={selectedTeamId || "unassigned"}
                          onValueChange={(val) => {
                            const teamVal = val === "unassigned" ? "" : val;
                            setSelectedTeamId(teamVal);
                            setSelectedAgentId(""); // Limpa o agente selecionado ao mudar de equipe
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-muted/30">
                            <SelectValue placeholder="Sem equipe atribuída" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Sem equipe</SelectItem>
                            {(teamsQuery.data ?? []).map((t: any) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Dropdown de Agente */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">Agente</label>
                        <Select
                          value={selectedAgentId || "unassigned"}
                          onValueChange={(val) => {
                            const agentVal = val === "unassigned" ? "" : val;
                            setSelectedAgentId(agentVal);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs bg-muted/30">
                            <SelectValue placeholder="Sem agente atribuído" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unassigned">Sem agente</SelectItem>
                            {selectedTeamId ? (
                              // Se tem equipe selecionada, mostra apenas os membros dela
                              (teamMembersQuery.data ?? []).map((m: any) => (
                                <SelectItem key={m.user_id} value={m.user_id}>
                                  {m.full_name || m.display_name || m.email}
                                </SelectItem>
                              ))
                            ) : (
                              // Senão, mostra todos os agentes da plataforma
                              (agentsQuery.data ?? []).map((a: any) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.full_name || a.display_name || a.email}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Ações */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() =>
                            assignMutation.mutate({
                              teamId: selectedTeamId ? selectedTeamId : null,
                              agentId: selectedAgentId ? selectedAgentId : null,
                            })
                          }
                          disabled={assignMutation.isPending}
                        >
                          {assignMutation.isPending ? "Salvando..." : "Salvar"}
                        </Button>

                        {selectedTeamId && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs"
                            onClick={() => autoAssignMutation.mutate(selectedTeamId)}
                            disabled={autoAssignMutation.isPending}
                            title="Auto-atribuir usando Round-Robin"
                          >
                            {autoAssignMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Auto-atribuir"
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Metadados do sistema */}
                    <div className="h-px bg-border" />
                    <div className="space-y-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium flex items-center gap-1.5">
                        <Info className="h-3 w-3" /> Sistema
                      </p>
                      {selectedContact.id && (
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground capitalize">ID</p>
                          <p className="text-xs font-mono break-all">{selectedContact.id}</p>
                        </div>
                      )}
                      {selectedContact.created_at && (
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground capitalize">Criado em</p>
                          <p className="text-xs font-mono break-all">
                            {String(selectedContact.created_at)}
                          </p>
                        </div>
                      )}
                      {selectedContact.updated_at && (
                        <div className="space-y-0.5">
                          <p className="text-[10px] text-muted-foreground capitalize">
                            Atualizado em
                          </p>
                          <p className="text-xs font-mono break-all">
                            {String(selectedContact.updated_at)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Atalhos */}
                    <div className="h-px bg-border" />
                    <div className="space-y-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                        Ações rápidas
                      </p>
                      <a
                        href={`/contacts`}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg px-3 py-2 transition-colors"
                      >
                        <User className="h-4 w-4" />
                        <span>Ver na lista de contatos</span>
                        <ExternalLink className="h-3 w-3 ml-auto" />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
