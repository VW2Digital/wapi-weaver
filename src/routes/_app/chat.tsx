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
import { sendGroupMessage } from "@/lib/groups.functions";
import {
  updateContactProfilePhoto,
  createContact,
  deleteContact,
  autoFetchContactPhoto,
} from "@/lib/contacts.functions";
import { getProfile } from "@/lib/profile.functions";
import {
  listTeams,
  listTeamMembers,
  listAllAgents,
  assignConversation,
  autoAssignConversation,
  selfAssignConversation,
} from "@/lib/assignment.functions";
import {
  togglePinContact,
  toggleArchiveContact,
  updateChatStatus,
  toggleUnreadContact,
  setContactKanbanStage,
  quickSaveContact,
  toggleBotActive,
} from "@/lib/chat-actions.functions";
import { listFunnels, listAllUserStages, createOpportunity, createActivity, bulkAssignToKanban, createNote } from "@/lib/crm.functions";
import { uploadMetaMediaViaApi } from "@/lib/meta-media-upload";
import { convertWebMToOggOpus } from "@/lib/webm-to-ogg";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  type LucideIcon,
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
  RefreshCw,
  X,
  XCircle,
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
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Paperclip,
  Mic,
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
  Clock,
  UserCheck,
  Bot,
  Package,
  History,
  Ban,
  CornerUpRight,
  UserPen,
  Forward,
} from "lucide-react";
import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { db } from "@/integrations/mysql/client";
import { useConfirm } from "@/components/confirm-dialog";

interface ContactCustomFields {
  avatar_url?: string;
  photo_url?: string;
  photo?: string;
  picture?: string;
  image_url?: string;
  image?: string;
  is_blocked?: boolean;
  [key: string]: unknown;
}

type ContactFlagValue = boolean | number | null | undefined;

interface ChatContactRecord {
  id: string;
  user_id?: string | null;
  name?: string | null;
  email?: string | null;
  phone_e164?: string | null;
  source?: string | null;
  channel?: string | null;
  chat_status?: string | null;
  active_team_id?: string | null;
  active_team_name?: string | null;
  active_agent_id?: string | null;
  active_agent_name?: string | null;
  unread_count?: number | null;
  is_pinned?: ContactFlagValue;
  is_archived?: ContactFlagValue;
  is_unread?: ContactFlagValue;
  opted_out?: boolean;
  bot_active?: ContactFlagValue;
  last_message_body?: string | null;
  last_message_time?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  kanban_stage_id?: string | null;
  kanban_stage_name?: string | null;
  kanban_stage_color?: string | null;
  custom_fields?: ContactCustomFields | null;
  [key: string]: unknown;
}

interface TeamMemberOption {
  user_id: string;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
}

interface TeamOption {
  id: string;
  name?: string | null;
}

interface AgentOption {
  id: string;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
}

interface InventoryProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  isUnlimited: boolean;
}

interface SalesFunnelOption {
  id: string;
  name?: string | null;
  is_default?: boolean | null;
}

interface SalesStageOption {
  id: string;
  name?: string | null;
  color?: string | null;
  funnel_id?: string | null;
}

interface ChatTagRecord {
  id?: string;
  name: string;
  color?: string | null;
  icon?: string | null;
  created_at?: string | null;
}

interface AutoAssignResult {
  agentId?: string | null;
}

interface QuickSaveResult {
  previousPhone?: string | null;
  phone?: string | null;
}

interface ConversationTagRecord {
  contact_number: string;
  tag_id: string;
  user_id?: string;
  tags: ChatTagRecord | null;
}

interface MessageTagRecord {
  message_id: string;
  tag_id: string;
  user_id?: string;
  tags: ChatTagRecord | null;
}

interface LeadActivityRecord {
  id: string;
  title?: string | null;
  description?: string | null;
  type?: string | null;
  status?: string | null;
  created_at?: string | null;
  due_at?: string | null;
}

interface OpportunityAuditLogRecord {
  id: string;
  action?: string | null;
  old_values?: unknown;
  new_values?: unknown;
  created_at?: string | null;
}

interface LeadTimelineItem {
  id: string;
  type: "activity" | "audit";
  title?: string | null;
  description?: string | null;
  activityType?: string | null;
  status?: string | null;
  date: Date;
  due_at?: string | null;
  old_values?: unknown;
  new_values?: unknown;
}

interface ChatOpportunityRecord {
  id: string;
  title?: string | null;
}

interface ChatMessageReactionRecord {
  emoji: string;
  direction: "incoming" | "outgoing";
}

type ChatMessageType =
  | "text"
  | "reaction"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "sticker"
  | "location"
  | "contacts"
  | "system";

interface InteractiveButtonRecord {
  reply?: {
    title?: string;
  };
}

interface InteractiveListSectionRecord {
  title?: string;
  rows?: Array<{ title?: string; description?: string }>;
}

interface InteractiveHeaderRecord {
  type?: string;
  image?: { id?: string; link?: string };
  video?: { id?: string; link?: string };
  document?: { id?: string; link?: string; filename?: string };
  text?: string;
}

interface InteractivePayloadRecord {
  type?: string;
  header?: InteractiveHeaderRecord;
  footer?: { text?: string };
  body?: { text?: string };
  action?: {
    button?: string;
    buttons?: InteractiveButtonRecord[];
    sections?: InteractiveListSectionRecord[];
    parameters?: { display_text?: string; flow_cta?: string; url?: string };
  };
}

interface ChatMessageRecord {
  id: string;
  wa_message_id?: string | null;
  provider_message_id?: string | null;
  direction: "incoming" | "outgoing";
  timestamp: string;
  type: ChatMessageType;
  body?: string | null;
  status?: string | null;
  sender_name?: string | null;
  sender_wa_id?: string | null;
  context?: { message_id?: string | null } | null;
  metadata?: Record<string, unknown> | null;
  image?: { id?: string; link?: string; caption?: string; mime_type?: string } | null;
  audio?: { id?: string; link?: string; mime_type?: string } | null;
  video?: { id?: string; link?: string; caption?: string; mime_type?: string } | null;
  document?: {
    id?: string;
    link?: string;
    filename?: string;
    caption?: string;
    mime_type?: string;
  } | null;
  sticker?: { id?: string; link?: string; mime_type?: string } | null;
  location?: {
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
  } | null;
  contacts?: Array<{
    name?: { formatted_name?: string };
    phones?: Array<{ phone?: string }>;
  }> | null;
  reactions?: ChatMessageReactionRecord[];
}

interface SendContactPayload {
  name: {
    formatted_name: string;
    first_name?: string;
    last_name?: string;
  };
  phones: Array<{
    phone: string;
    type?: string;
  }>;
}

type SendMessagePayload =
  | {
      to: string;
      type: "text";
      text: { body: string; preview_url: boolean };
      reply_to_message_id?: string;
    }
  | {
      to: string;
      type: "reaction";
      reaction: { message_id: string; emoji: string };
      reply_to_message_id?: string;
    }
  | {
      to: string;
      type: "image";
      image: { id?: string; link?: string };
      reply_to_message_id?: string;
    }
  | {
      to: string;
      type: "audio";
      audio: { id?: string; link?: string };
      reply_to_message_id?: string;
    }
  | {
      to: string;
      type: "video";
      video: { id?: string; link?: string };
      reply_to_message_id?: string;
    }
  | {
      to: string;
      type: "document";
      document: { id?: string; link?: string; filename?: string };
      reply_to_message_id?: string;
    }
  | {
      to: string;
      type: "sticker";
      sticker: { id?: string; link?: string };
      reply_to_message_id?: string;
    }
  | {
      to: string;
      type: "location";
      location: { latitude: number; longitude: number; name?: string; address?: string };
      reply_to_message_id?: string;
    }
  | {
      to: string;
      type: "contacts";
      contacts: SendContactPayload[];
      reply_to_message_id?: string;
    };

function getErrorMessage(error: unknown): string {
  if (!error) return "Erro inesperado";

  let msg = "Erro inesperado";
  if (error instanceof Error) {
    msg = error.message;
  } else if (typeof error === "string") {
    msg = error;
  } else if (typeof error === "object" && error !== null && "message" in error) {
    msg = String((error as any).message);
  }

  const lower = msg.toLowerCase();

  // 1. Unsupported post request / Object not found (ID do número incorreto ou sem permissão)
  if (
    lower.includes("unsupported post request") ||
    lower.includes("cannot be loaded due to missing permissions") ||
    lower.includes("does not exist")
  ) {
    return "Conexão com WhatsApp inválida ou sem permissão. Verifique suas credenciais da Meta (Token ou ID do Telefone) nas configurações.";
  }

  // 2. Token inválido/expirado
  if (
    lower.includes("invalid oauth access token") ||
    lower.includes("expired") ||
    lower.includes("access token")
  ) {
    return "O token de acesso do WhatsApp expirou ou é inválido. Por favor, atualize o token em Configurações.";
  }

  // 3. Janela de 24 horas expirada
  if (
    lower.includes("outside the 24-hour window") ||
    lower.includes("24-hour") ||
    lower.includes("131047")
  ) {
    return "O contato está fora da janela de 24 horas. Você só pode enviar mensagens de modelos (templates) homologados para reiniciar a conversa.";
  }

  // 4. Parâmetro de telefone inválido
  if (
    lower.includes("param to must be a valid phone number") ||
    lower.includes("invalid phone number")
  ) {
    return "O número do destinatário é inválido ou não está cadastrado no WhatsApp.";
  }

  // 5. Limite de requisições excedido
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Limite de envio da API atingido. Por favor, aguarde alguns instantes antes de enviar novamente.";
  }

  // 6. Arquivo não suportado ou erro de mídia
  if (lower.includes("media") || lower.includes("mime type") || lower.includes("file size")) {
    return "Erro no envio de mídia. Verifique se o formato ou tamanho do arquivo é compatível com os limites do WhatsApp.";
  }

  return msg;
}

function isFlagEnabled(value: ContactFlagValue): boolean {
  return value === true || value === 1;
}

function normalizeOptionalString(value: unknown): string | null | undefined {
  return typeof value === "string" ? value : value == null ? null : undefined;
}

function normalizeContactCustomFields(value: unknown): ContactCustomFields | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const normalized: ContactCustomFields = {};

  for (const [key, entry] of Object.entries(source)) {
    normalized[key] = entry;
  }

  return normalized;
}

function normalizeChatContactRecord(value: unknown): ChatContactRecord | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.id !== "string" || record.id.length === 0) {
    return null;
  }

  return {
    id: record.id,
    user_id: normalizeOptionalString(record.user_id),
    name: normalizeOptionalString(record.name),
    email: normalizeOptionalString(record.email),
    phone_e164: normalizeOptionalString(record.phone_e164),
    source: normalizeOptionalString(record.source),
    channel: normalizeOptionalString(record.channel),
    chat_status: normalizeOptionalString(record.chat_status),
    active_team_id: normalizeOptionalString(record.active_team_id),
    active_team_name: normalizeOptionalString(record.active_team_name),
    active_agent_id: normalizeOptionalString(record.active_agent_id),
    active_agent_name: normalizeOptionalString(record.active_agent_name),
    unread_count: typeof record.unread_count === "number" ? record.unread_count : null,
    is_pinned:
      typeof record.is_pinned === "boolean" || typeof record.is_pinned === "number"
        ? record.is_pinned
        : null,
    is_archived:
      typeof record.is_archived === "boolean" || typeof record.is_archived === "number"
        ? record.is_archived
        : null,
    is_unread:
      typeof record.is_unread === "boolean" || typeof record.is_unread === "number"
        ? record.is_unread
        : null,
    opted_out: typeof record.opted_out === "boolean" ? record.opted_out : false,
    bot_active:
      typeof record.bot_active === "boolean" || typeof record.bot_active === "number"
        ? record.bot_active
        : null,
    last_message_body: normalizeOptionalString(record.last_message_body),
    last_message_time: normalizeOptionalString(record.last_message_time),
    created_at: normalizeOptionalString(record.created_at),
    updated_at: normalizeOptionalString(record.updated_at),
    kanban_stage_id: normalizeOptionalString(record.kanban_stage_id),
    kanban_stage_name: normalizeOptionalString(record.kanban_stage_name),
    kanban_stage_color: normalizeOptionalString(record.kanban_stage_color),
    custom_fields: normalizeContactCustomFields(record.custom_fields),
  };
}

function getMessageInteractivePayload(metadata: Record<string, unknown> | null | undefined) {
  const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null;
      } catch {
        return null;
      }
    }
    return null;
  };

  const payload =
    asRecord(metadata?.payload) || asRecord(metadata?.request_payload) || metadata || null;

  let interactive =
    (asRecord(payload?.interactive) as InteractivePayloadRecord | null) ||
    (asRecord(metadata?.interactive) as InteractivePayloadRecord | null);

  if (!interactive) {
    const buttonsConfig = asRecord(metadata?.buttons_config) || asRecord(payload?.buttons_config);
    const action =
      asRecord(buttonsConfig?.action) ||
      asRecord(metadata?.action) ||
      asRecord(payload?.action) ||
      buttonsConfig;
    const rawButtons = Array.isArray(action?.buttons)
      ? action.buttons
      : Array.isArray(metadata?.buttons)
        ? metadata.buttons
        : Array.isArray(payload?.buttons)
          ? payload.buttons
          : [];
    const buttons = rawButtons.reduce<InteractiveButtonRecord[]>((result, button) => {
        const buttonRecord = asRecord(button);
        const reply = asRecord(buttonRecord?.reply) || buttonRecord;
        const title = reply?.title;
        if (typeof title === "string") result.push({ reply: { title } });
        return result;
      }, []);

    const fallbackHeader =
      (asRecord(action?.header) as InteractiveHeaderRecord | null) ||
      (asRecord(buttonsConfig?.header) as InteractiveHeaderRecord | null) ||
      (asRecord(metadata?.header) as InteractiveHeaderRecord | null) ||
      (asRecord(payload?.header) as InteractiveHeaderRecord | null);

    if (buttons.length > 0) {
      interactive = {
        type: "button",
        ...(fallbackHeader ? { header: fallbackHeader } : {}),
        action: { buttons },
      };
    } else if (Array.isArray(action?.sections)) {
      interactive = {
        type: "list",
        ...(fallbackHeader ? { header: fallbackHeader } : {}),
        action: {
          button: typeof action.button === "string" ? action.button : undefined,
          sections: action.sections as InteractiveListSectionRecord[],
        },
      };
    } else {
      const parameters = asRecord(action?.parameters) || action;
      if (typeof parameters?.url === "string") {
        interactive = {
          type: "cta_url",
          action: {
            parameters: {
              url: parameters.url,
              display_text:
                typeof parameters.display_text === "string"
                  ? parameters.display_text
                  : typeof parameters.title === "string"
                    ? parameters.title
                    : undefined,
            },
          },
        };
      }
    }
  }

  return { payload, interactive };
}

function getCustomFieldText(
  customFields: ContactCustomFields | null | undefined,
  key: string,
): string | undefined {
  const value = customFields?.[key];
  return typeof value === "string" ? value : undefined;
}

function mergeChatContactRecord(
  current: ChatContactRecord,
  patch: Partial<ChatContactRecord>,
): ChatContactRecord {
  return {
    ...current,
    ...patch,
    id: current.id,
    custom_fields:
      patch.custom_fields === undefined
        ? (current.custom_fields ?? null)
        : normalizeContactCustomFields(patch.custom_fields),
  };
}

function getAgentDisplayName(agent?: AgentOption | null): string | null {
  return agent?.full_name || agent?.display_name || agent?.email || null;
}

function isInventoryProduct(value: unknown): value is InventoryProduct {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<InventoryProduct>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.price === "number" &&
    typeof candidate.stock === "number" &&
    typeof candidate.isUnlimited === "boolean"
  );
}

/** Extrai a URL de foto de perfil dos custom_fields do contato, seguindo o mesmo padrão do CRM */
function getContactAvatarUrl(contact: ChatContactRecord | null): string {
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

/** Formata o número de telefone no padrão +XX (XX) XXXXX-XXXX */
function formatPhone(phone: string): string {
  if (!phone) return "";
  if (phone.startsWith("ig_")) {
    return "@" + phone.slice(3);
  }
  if (phone.startsWith("fb_")) {
    return "@fb_" + phone.slice(3);
  }
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 12 || clean.length === 13) {
    const ddi = clean.slice(0, 2);
    const ddd = clean.slice(2, 4);
    const rest = clean.slice(4);
    if (rest.length === 9) {
      return `+${ddi} (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    } else {
      return `+${ddi} (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    }
  }
  if (phone.startsWith("+")) return phone;
  return `+${phone}`;
}

function ChannelBadge({
  channel,
  className = "h-2.5 w-2.5",
}: {
  channel: string;
  className?: string;
}) {
  if (channel === "instagram") {
    return (
      <div className="bg-pink-600 p-0.5 rounded-full text-white flex items-center justify-center">
        <svg
          viewBox="0 0 24 24"
          className={`${className} fill-none stroke-current stroke-2`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
        </svg>
      </div>
    );
  }
  if (channel === "messenger") {
    return (
      <div className="bg-blue-600 p-0.5 rounded-full text-white flex items-center justify-center">
        <svg
          viewBox="0 0 24 24"
          className={`${className} fill-current`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.914 1.453 5.508 3.738 7.18v3.743c0 .285.31.464.556.32l4.137-2.42c.504.07 1.02.11 1.569.11 5.523 0 10-4.146 10-9.26C22 6.144 17.523 2 12 2zm1.096 12.062l-2.616-2.79-5.1 2.79 5.6-5.95 2.616 2.79 5.1-2.79-5.6 5.95z" />
        </svg>
      </div>
    );
  }
  if (channel === "whatsapp_group") {
    return (
      <div
        className="bg-indigo-600 p-0.5 rounded-full text-white flex items-center justify-center"
        title="Grupo de WhatsApp"
      >
        <svg
          viewBox="0 0 24 24"
          className={`${className} fill-current`}
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M17 11c.966 0 1.75-.784 1.75-1.75S17.966 7.5 17 7.5s-1.75.784-1.75 1.75.784 1.75 1.75 1.75zm-10 0c.966 0 1.75-.784 1.75-1.75S7.966 7.5 7 7.5 5.25 8.284 5.25 9.25 6.034 11 7 11zm5 .5c1.38 0 2.5-1.12 2.5-2.5s-1.12-2.5-2.5-2.5-2.5 1.12-2.5 2.5 1.12 2.5 2.5 2.5zm5 2.5c-1.1 0-2.03.63-2.5 1.54-.47-.91-1.4-1.54-2.5-1.54s-2.03.63-2.5 1.54c-.47-.91-1.4-1.54-2.5-1.54-1.66 0-3 1.34-3 3v1h16v-1c0-1.66-1.34-3-3-3zm-10 0c-.8 0-1.5.3-2.05.8-.18-.48-.45-.9-.8-1.25.75-.85 1.83-1.35 3.05-1.35.53 0 1.03.1 1.5.3-.65.65-1.1 1.5-1.1 2.5zm10 0c0-1-.45-1.85-1.1-2.5.47-.2.97-.3 1.5-.3 1.22 0 2.3.5 3.05 1.35-.35.35-.62.77-.8 1.25-.55-.5-1.25-.8-2.05-.8z" />
        </svg>
      </div>
    );
  }
  return (
    <div className="bg-emerald-500 p-0.5 rounded-full text-white flex items-center justify-center">
      <svg
        viewBox="0 0 24 24"
        className={`${className} fill-current`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.458 5.704 1.459h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    </div>
  );
}

const TAG_ICONS: Record<string, LucideIcon> = {
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
  tag: ChatTagRecord | null;
  className?: string;
  showName?: boolean;
}) {
  if (!tag) return null;
  const Icon = typeof tag.icon === "string" ? (TAG_ICONS[tag.icon] ?? Tag) : Tag;
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
  const sendGroupMsg = useServerFn(sendGroupMessage);
  const saveContactProfilePhoto = useServerFn(updateContactProfilePhoto);
  const fetchContactPhoto = useServerFn(autoFetchContactPhoto);
  const qc = useQueryClient();
  const confirm = useConfirm();

  const [selectedContact, setSelectedContact] = useState<ChatContactRecord | null>(null);

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

  const teams = (teamsQuery.data ?? []) as TeamOption[];
  const agents = (agentsQuery.data ?? []) as AgentOption[];
  const teamMembers = (teamMembersQuery.data ?? []) as TeamMemberOption[];
  const getTeamName = (teamId?: string | null) =>
    teams.find((team) => team.id === teamId)?.name ?? null;
  const getAgentById = (agentId?: string | null) => agents.find((agent) => agent.id === agentId);

  const assignMutation = useMutation({
    mutationFn: async (payload: {
      teamId: string | null;
      agentId: string | null;
      contactPhone?: string;
    }) => {
      const phone = payload.contactPhone || selectedPhone;
      if (!phone) throw new Error("Nenhum contato selecionado");
      return assignConversation({
        data: {
          contactPhone: phone,
          teamId: payload.teamId,
          agentId: payload.agentId,
        },
      });
    },
    onSuccess: (_res, variables) => {
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      setSelectedContact((prev) =>
        prev
          ? {
              ...prev,
              active_team_id: variables.teamId,
              active_agent_id: variables.agentId,
              active_team_name: getTeamName(variables.teamId),
              active_agent_name: getAgentDisplayName(getAgentById(variables.agentId)),
            }
          : prev,
      );
      toast.success("Atendimento atribuído com sucesso!");
    },
    onError: (err: unknown) => {
      toast.error("Erro ao atribuir: " + getErrorMessage(err));
    },
  });

  const autoAssignMutation = useMutation({
    mutationFn: async (payload: { teamId: string; contactPhone?: string } | string) => {
      const targetTeamId = typeof payload === "string" ? payload : payload.teamId;
      const phone =
        typeof payload === "string" ? selectedPhone : payload.contactPhone || selectedPhone;
      if (!phone) throw new Error("Nenhum contato selecionado");
      return autoAssignConversation({
        data: {
          contactPhone: phone,
          teamId: targetTeamId,
        },
      });
    },
    onSuccess: (res: AutoAssignResult, variables) => {
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      const targetTeamId = typeof variables === "string" ? variables : variables.teamId;
      const assignedAgent = getAgentById(res.agentId);
      setSelectedContact((prev) =>
        prev
          ? {
              ...prev,
              active_team_id: targetTeamId,
              active_agent_id: res.agentId ?? null,
              active_team_name: getTeamName(targetTeamId),
              active_agent_name: getAgentDisplayName(assignedAgent),
            }
          : prev,
      );
      if (res.agentId) {
        toast.success("Auto-atribuição concluída!");
      } else {
        toast.warning("Nenhum agente disponível. O chat ficou na fila da equipe.");
      }
    },
    onError: (err: unknown) => {
      toast.error("Erro ao auto-atribuir: " + getErrorMessage(err));
    },
  });

  const selfAssignMutation = useMutation({
    mutationFn: async (payload: { teamId: string; contactPhone?: string }) => {
      const phone = payload.contactPhone || selectedPhone;
      if (!phone) throw new Error("Nenhum contato selecionado");
      return selfAssignConversation({
        data: {
          contactPhone: phone,
          teamId: payload.teamId,
        },
      });
    },
    onSuccess: (_res, variables) => {
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      const currentAgent = getAgentById(profile?.id);
      setSelectedContact((prev) =>
        prev
          ? {
              ...prev,
              active_team_id: variables.teamId,
              active_agent_id: profile?.id ?? null,
              active_team_name: getTeamName(variables.teamId),
              active_agent_name: getAgentDisplayName(currentAgent),
            }
          : prev,
      );
      toast.success("Conversa atribuída a você!");
    },
    onError: (err: unknown) => {
      toast.error("Erro ao atribuir a você: " + getErrorMessage(err));
    },
  });

  // Novos estados para diálogos de ações de chat
  const [quickSaveContactData, setQuickSaveContactData] = useState<ChatContactRecord | null>(null);
  const [assigningContactData, setAssigningContactData] = useState<ChatContactRecord | null>(null);

  // Estados para novas ações rápidas
  const [isQuickOpportunityOpen, setIsQuickOpportunityOpen] = useState(false);
  const [isMessageSearchOpen, setIsMessageSearchOpen] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [isFollowUpOpen, setIsFollowUpOpen] = useState(false);
  const [isLeadHistoryOpen, setIsLeadHistoryOpen] = useState(false);
  const [isInventoryOpen, setIsInventoryOpen] = useState(false);

  // States for Quick Opportunity Form
  const [oppTitle, setOppTitle] = useState("");
  const [oppValue, setOppValue] = useState(0);
  const [oppSource, setOppSource] = useState("whatsapp");
  const [oppFunnelId, setOppFunnelId] = useState("");
  const [oppStageId, setOppStageId] = useState("");
  const [oppNote, setOppNote] = useState("");

  // States for Follow Up Form
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpDesc, setFollowUpDesc] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");

  // Estados para Gerenciar Estoque
  const [products, setProducts] = useState<InventoryProduct[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const val = localStorage.getItem("inventory:products");
        if (val) {
          const parsed: unknown = JSON.parse(val);
          if (Array.isArray(parsed)) {
            return parsed.filter(isInventoryProduct);
          }
        }
      } catch (error) {
        console.warn("Falha ao ler produtos do estoque local:", error);
      }
    }
    return [
      { id: "prod-1", name: "Plano Mensal Bliv", price: 97.0, stock: 9999, isUnlimited: true },
      { id: "prod-2", name: "Plano Anual Bliv", price: 997.0, stock: 9999, isUnlimited: true },
      { id: "prod-3", name: "Instalação e Setup VPS", price: 199.0, stock: 15, isUnlimited: false },
      {
        id: "prod-4",
        name: "Consultoria IA Customizada",
        price: 1500.0,
        stock: 3,
        isUnlimited: false,
      },
    ];
  });

  const updateProductStock = (id: string, newStock: number) => {
    setProducts((prev) => {
      const updated = prev.map((p) => (p.id === id ? { ...p, stock: newStock } : p));
      try {
        localStorage.setItem("inventory:products", JSON.stringify(updated));
      } catch (error) {
        console.warn("Falha ao salvar produtos do estoque local:", error);
      }
      return updated;
    });
  };

  // Pre-fill Follow-up Form when opened
  useEffect(() => {
    if (isFollowUpOpen) {
      setFollowUpTitle("Follow-up de Atendimento");
      setFollowUpDesc("");
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // Default to 9:00 AM tomorrow
      const tzOffset = tomorrow.getTimezoneOffset() * 60000;
      const localISOTime = new Date(tomorrow.getTime() - tzOffset).toISOString().slice(0, 16);
      setFollowUpDate(localISOTime);
    }
  }, [isFollowUpOpen]);

  // Estados para Edição Rápida de Contato
  const [quickSaveName, setQuickSaveName] = useState("");
  const [quickSaveEmail, setQuickSaveEmail] = useState("");
  const [quickSavePhone, setQuickSavePhone] = useState("");

  useEffect(() => {
    if (quickSaveContactData) {
      setQuickSaveName(quickSaveContactData.name || "");
      setQuickSaveEmail(quickSaveContactData.email || "");
      setQuickSavePhone(quickSaveContactData.phone_e164 || "");
    }
  }, [quickSaveContactData]);

  // Estados para Atribuição Rápida de Conversa
  const [assignDialogTeamId, setAssignDialogTeamId] = useState<string>("");
  const [assignDialogAgentId, setAssignDialogAgentId] = useState<string>("");

  const assignDialogTeamMembersQuery = useQuery({
    queryKey: ["team-members", assignDialogTeamId],
    queryFn: () => fetchTeamMembersFn({ data: { teamId: assignDialogTeamId } }),
    enabled: !!assignDialogTeamId && assignDialogTeamId !== "none",
  });

  useEffect(() => {
    if (assigningContactData) {
      setAssignDialogTeamId(assigningContactData.active_team_id || "");
      setAssignDialogAgentId(assigningContactData.active_agent_id || "");
    }
  }, [assigningContactData]);

  const fetchFunnels = useServerFn(listFunnels);
  const fetchAllUserStages = useServerFn(listAllUserStages);

  // Queries para Funis e Etapas do Kanban
  const salesFunnelsQuery = useQuery({
    queryKey: ["sales-funnels"],
    queryFn: () => fetchFunnels(),
  });

  const salesStagesQuery = useQuery({
    queryKey: ["sales-stages"],
    queryFn: () => fetchAllUserStages(),
  });

  const rawFunnels = (salesFunnelsQuery.data ?? []) as SalesFunnelOption[];
  const salesFunnels = useMemo(() => {
    const seen = new Set<string>();
    return rawFunnels.filter((f) => {
      if (!f || !f.id || seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    });
  }, [rawFunnels]);

  const salesStages = (salesStagesQuery.data ?? []) as SalesStageOption[];

  // Pre-fill Opportunity Form when opened
  useEffect(() => {
    if (isQuickOpportunityOpen && selectedContact) {
      setOppTitle(`Oportunidade - ${selectedContact.name || selectedContact.phone_e164}`);
      setOppValue(0);

      const defaultFunnel = salesFunnels.find((funnel) => funnel.is_default) || salesFunnels[0];
      if (defaultFunnel) {
        setOppFunnelId(defaultFunnel.id);
        const defaultStage =
          salesStages.find((stage) => stage.funnel_id === defaultFunnel.id) || salesStages[0];
        if (defaultStage) {
          setOppStageId(defaultStage.id);
        }
      }
    }
  }, [isQuickOpportunityOpen, selectedContact, salesFunnelsQuery.data, salesStagesQuery.data]);

  const togglePinContactFn = useServerFn(togglePinContact);
  const toggleArchiveContactFn = useServerFn(toggleArchiveContact);
  const updateChatStatusFn = useServerFn(updateChatStatus);
  const toggleUnreadContactFn = useServerFn(toggleUnreadContact);
  const setContactKanbanStageFn = useServerFn(setContactKanbanStage);
  const quickSaveContactFn = useServerFn(quickSaveContact);
  const deleteContactFn = useServerFn(deleteContact);

  const pinMutation = useMutation({
    mutationFn: async (payload: { contactId: string; isPinned: boolean }) =>
      togglePinContactFn({ data: payload }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      setSelectedContact((prev) =>
        prev?.id === variables.contactId ? { ...prev, is_pinned: variables.isPinned } : prev,
      );
      toast.success("Alteração de pinagem salva!");
    },
    onError: (err: unknown) => {
      toast.error("Erro: " + getErrorMessage(err));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async (payload: { contactId: string; isArchived: boolean }) =>
      toggleArchiveContactFn({ data: payload }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      setSelectedContact((prev) => {
        if (prev?.id !== variables.contactId) return prev;
        if (variables.isArchived && filterView !== "archived") return null;
        return { ...prev, is_archived: variables.isArchived };
      });
      toast.success(variables.isArchived ? "Conversa arquivada!" : "Conversa desarquivada!");
    },
    onError: (err: unknown) => {
      toast.error("Erro: " + getErrorMessage(err));
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: { contactId: string; status: string }) =>
      updateChatStatusFn({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      toast.success("Status de atendimento atualizado!");
    },
    onError: (err: unknown) => {
      toast.error("Erro: " + getErrorMessage(err));
    },
  });

  const unreadMutation = useMutation({
    mutationFn: async (payload: { contactId: string; isUnread: boolean }) =>
      toggleUnreadContactFn({ data: payload }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      setSelectedContact((prev) => {
        if (prev?.id !== variables.contactId) return prev;
        return {
          ...prev,
          is_unread: variables.isUnread,
          unread_count: variables.isUnread ? Math.max(prev?.unread_count ?? 0, 1) : 0,
        };
      });
      toast.success(
        variables.isUnread ? "Conversa marcada como não lida!" : "Conversa marcada como lida!",
      );
    },
    onError: (err: unknown) => {
      toast.error("Erro: " + getErrorMessage(err));
    },
  });

  const kanbanStageMutation = useMutation({
    mutationFn: async (payload: { contactId: string; stageId: string | null }) =>
      setContactKanbanStageFn({ data: payload }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      toast.success("Etapa do Kanban atualizada!");
    },
    onError: (err: unknown) => {
      toast.error("Erro: " + getErrorMessage(err));
    },
  });

  const quickSaveMutation = useMutation({
    mutationFn: async (payload: {
      contactId: string;
      name: string;
      email: string;
      phone: string;
    }) => quickSaveContactFn({ data: payload }),
    onSuccess: (result: QuickSaveResult, variables) => {
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      if (result?.previousPhone) {
        qc.invalidateQueries({ queryKey: ["chat-messages", result.previousPhone] });
        qc.invalidateQueries({ queryKey: ["chat-contact-details", result.previousPhone] });
      }
      if (result?.phone) {
        qc.invalidateQueries({ queryKey: ["chat-messages", result.phone] });
        qc.invalidateQueries({ queryKey: ["chat-contact-details", result.phone] });
      }
      if (selectedContact?.id === variables.contactId && result?.phone) {
        setSelectedContact((prev) =>
          prev
            ? {
                ...prev,
                name: variables.name,
                email: variables.email || null,
                phone_e164: result.phone,
              }
            : prev,
        );
      }
      toast.success("Contato atualizado com sucesso!");
      setQuickSaveContactData(null);
    },
    onError: (err: unknown) => {
      toast.error("Erro ao salvar contato: " + getErrorMessage(err));
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => deleteContactFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      toast.success("Contato excluído do sistema!");
      setSelectedContact(null);
    },
    onError: (err: unknown) => {
      toast.error("Erro ao excluir: " + getErrorMessage(err));
    },
  });

  const botActiveMutation = useMutation({
    mutationFn: async (payload: { contactPhone: string; botActive: boolean; channel: string }) =>
      toggleBotActive({ data: payload }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      qc.invalidateQueries({ queryKey: ["chat-contact-details", selectedPhone] });
      toast.success(
        variables.botActive
          ? "Chatbot ativado para este contato!"
          : "Chatbot pausado para este contato!",
      );
    },
    onError: (err: unknown) => {
      toast.error("Erro ao alterar status do bot: " + getErrorMessage(err));
    },
  });

  // Novas Server Functions para CRM
  const createOpportunityFn = useServerFn(createOpportunity);
  const createActivityFn = useServerFn(createActivity);
  const createNoteFn = useServerFn(createNote);
  const bulkAssignToKanbanFn = useServerFn(bulkAssignToKanban);

  // Query para buscar as oportunidades ativas do contato
  const contactOpportunitiesQuery = useQuery({
    queryKey: ["contact-opportunities", selectedContact?.id],
    queryFn: async () => {
      if (!selectedContact?.id) return [];
      const { data, error } = await db
        .from("opportunities")
        .select("*")
        .eq("primary_contact_id", selectedContact.id)
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedContact?.id,
  });

  // Mutação para criar oportunidade rápida
  const createOpportunityMutation = useMutation({
    mutationFn: async (payload: {
      title: string;
      value: number;
      funnel_id: string;
      stage_id: string;
      primary_contact_id: string;
      description?: string;
      source?: string;
      temperature?: "cold" | "warm" | "hot";
    }) => {
      const newOpp = await createOpportunityFn({ data: payload });
      if (oppNote.trim()) {
        await createNoteFn({
          data: {
            opportunity_id: newOpp.id,
            body: oppNote.trim(),
          },
        });
      }
      return newOpp;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-opportunities", selectedContact?.id] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      // Também atualiza o estágio do contato no Kanban
      if (oppStageId && selectedContact?.id) {
        kanbanStageMutation.mutate({
          contactId: selectedContact.id,
          stageId: oppStageId,
        });
      }
      toast.success("Oportunidade de venda criada no CRM!");
      setIsQuickOpportunityOpen(false);
    },
    onError: (err: unknown) => {
      toast.error("Erro ao criar oportunidade: " + getErrorMessage(err));
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: (payload: { contactIds: string[]; funnelId: string; stageId: string }) =>
      bulkAssignToKanbanFn({ data: payload }),
    onSuccess: () => {
      toast.success("Contatos adicionados ao funil com sucesso!");
      setIsSelectionMode(false);
      setSelectedContactIds([]);
      setIsBulkFunnelDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err) || "Falha ao adicionar contatos ao funil.");
    },
  });

  // Mutação para agendar follow-up (cria oportunidade padrão se não existir)
  const followUpMutation = useMutation({
    mutationFn: async (payload: { title: string; description?: string; due_at: string }) => {
      if (!selectedContact?.id) throw new Error("Nenhum contato selecionado");

      let oppId = "";
      const existingOpps = contactOpportunitiesQuery.data || [];
      if (existingOpps.length > 0) {
        oppId = existingOpps[0].id;
      } else {
        // Criar oportunidade padrão automática
        const defaultFunnel = salesFunnels.find((funnel) => funnel.is_default) || salesFunnels[0];
        if (!defaultFunnel) throw new Error("Nenhum funil de vendas cadastrado no CRM");

        const defaultStage =
          salesStages.find((stage) => stage.funnel_id === defaultFunnel.id) || salesStages[0];
        if (!defaultStage) throw new Error("Nenhuma etapa de vendas cadastrada para este funil");

        const newOpp = await createOpportunityFn({
          data: {
            title: `Oportunidade - ${selectedContact.name || selectedContact.phone_e164}`,
            value: 0,
            funnel_id: defaultFunnel.id,
            stage_id: defaultStage.id,
            primary_contact_id: selectedContact.id,
          },
        });
        oppId = newOpp.id;
      }

      return createActivityFn({
        data: {
          opportunity_id: oppId,
          contact_id: selectedContact.id,
          type: "follow_up",
          title: payload.title,
          description: payload.description || "",
          due_at: payload.due_at,
          status: "pending",
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-opportunities", selectedContact?.id] });
      qc.invalidateQueries({ queryKey: ["lead-history", selectedContact?.id] });
      toast.success("Follow-up agendado com sucesso!");
      setIsFollowUpOpen(false);
    },
    onError: (err: unknown) => {
      toast.error("Erro ao agendar follow-up: " + getErrorMessage(err));
    },
  });

  // Mutação para bloquear/desbloquear contato
  const blockContactMutation = useMutation({
    mutationFn: async (payload: { contactId: string; block: boolean }) => {
      const { data: contact, error: fetchErr } = await db
        .from("contacts")
        .select("custom_fields")
        .eq("id", payload.contactId)
        .single();

      if (fetchErr) throw fetchErr;

      const currentCF = contact?.custom_fields || {};
      const newCF = {
        ...currentCF,
        is_blocked: payload.block,
      };

      const { data, error } = await db
        .from("contacts")
        .update({
          opted_out: payload.block,
          custom_fields: newCF,
        })
        .eq("id", payload.contactId);

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      qc.invalidateQueries({ queryKey: ["chat-contact-details", selectedPhone] });
      toast.success(variables.block ? "Contato bloqueado!" : "Contato desbloqueado!");
      setSelectedContact((prev) =>
        prev
          ? mergeChatContactRecord(prev, {
              opted_out: variables.block,
              custom_fields: { ...(prev.custom_fields ?? {}), is_blocked: variables.block },
            })
          : prev,
      );
    },
    onError: (err: unknown) => {
      toast.error("Erro ao atualizar status de bloqueio: " + getErrorMessage(err));
    },
  });

  // Query para buscar a linha do tempo histórica do Lead
  const leadHistoryQuery = useQuery({
    queryKey: ["lead-history", selectedContact?.id],
    queryFn: async () => {
      if (!selectedContact?.id) return [];

      // 1. Atividades do contato
      const { data: activities, error: actError } = await db
        .from("opportunity_activities")
        .select("*")
        .eq("contact_id", selectedContact.id)
        .order("created_at", { ascending: false });

      if (actError) throw actError;

      // 2. Oportunidades do contato
      const { data: opps, error: oppError } = await db
        .from("opportunities")
        .select("id, title")
        .eq("primary_contact_id", selectedContact.id);

      if (oppError) throw oppError;

      // 3. Histórico de auditoria do CRM
      let auditLogs: OpportunityAuditLogRecord[] = [];
      if (opps && opps.length > 0) {
        const oppIds = (opps as ChatOpportunityRecord[]).map((opportunity) => opportunity.id);
        const { data: audits, error: auditError } = await db
          .from("opportunity_audit_logs")
          .select("*")
          .in("opportunity_id", oppIds)
          .order("created_at", { ascending: false });
        if (auditError) throw auditError;
        auditLogs = audits || [];
      }

      // Combinar em uma única timeline ordenada
      const timeline: LeadTimelineItem[] = [];

      (activities as LeadActivityRecord[] | null)?.forEach((activity) => {
        timeline.push({
          id: activity.id,
          type: "activity",
          title: activity.title,
          description: activity.description,
          activityType: activity.type,
          status: activity.status,
          date: new Date(activity.created_at || activity.due_at || Date.now()),
          due_at: activity.due_at,
        });
      });

      auditLogs.forEach((log) => {
        timeline.push({
          id: log.id,
          type: "audit",
          title: log.action,
          old_values: log.old_values,
          new_values: log.new_values,
          date: new Date(log.created_at ?? Date.now()),
        });
      });

      timeline.sort((a, b) => b.date.getTime() - a.date.getTime());
      return timeline;
    },
    enabled: !!selectedContact?.id && isLeadHistoryOpen,
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
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [isBulkFunnelDialogOpen, setIsBulkFunnelDialogOpen] = useState(false);
  const [bulkFunnelId, setBulkFunnelId] = useState("");
  const [bulkStageId, setBulkStageId] = useState("");
  const [typedMessage, setTypedMessage] = useState("");
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<any | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [replyingTo, setReplyingTo] = useState<ChatMessageRecord | null>(null);
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
    db.auth.getSession().then((result: { data: { session: { access_token?: string } | null } }) => {
      setSessionToken(result.data.session?.access_token || "");
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
  const [mainTab, setMainTab] = useState<"conversas" | "grupos">("conversas");
  const [activeTab, setActiveTab] = useState<"novos" | "meus" | "outros">("novos");
  const [showTagFilters, setShowTagFilters] = useState(false);
  const [countryCode, setCountryCode] = useState("+55");
  const [newChatPhone, setNewChatPhone] = useState("");
  const [draftChatContacts, setDraftChatContacts] = useState<ChatContactRecord[]>([]);

  const upsertDraftChatContact = (contact: ChatContactRecord | null) => {
    if (!contact?.id) return;

    const draftContact = {
      ...contact,
      last_message_body: contact.last_message_body || "",
      last_message_time:
        contact.last_message_time || contact.updated_at || contact.created_at || null,
      unread_count: contact.unread_count || 0,
      is_unread: contact.is_unread ?? false,
      is_archived: contact.is_archived ?? false,
      is_pinned: contact.is_pinned ?? false,
      bot_active: contact.bot_active ?? true,
    };

    setDraftChatContacts((prev) => [
      draftContact,
      ...prev.filter((candidate) => candidate.id !== contact.id),
    ]);
  };

  // Mutation para iniciar novo chat/criar contato manual no rodapé
  const addContactMutation = useMutation({
    mutationFn: async (phone: string) => {
      // Limpa a formatação e junta com o DDI selecionado
      const digits = phone.replace(/\D/g, "");
      const fullPhone = countryCode.replace("+", "") + digits;
      const res = await createContact({
        data: { phone: fullPhone, name: `Contato +${fullPhone}` },
      });
      return res;
    },
    onSuccess: (data: unknown) => {
      const normalizedContact = normalizeChatContactRecord(data);
      if (!normalizedContact) {
        toast.error("Contato criado, mas a resposta retornou em formato inválido.");
        return;
      }
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      upsertDraftChatContact(normalizedContact);
      setMainTab("conversas");
      setActiveTab("outros");
      setFilterView("all");
      setSelectedContact(normalizedContact);
      setNewChatPhone("");
      toast.success("Nova conversa iniciada!");
    },
    onError: (err: unknown) => {
      toast.error("Erro ao iniciar conversa: " + getErrorMessage(err));
    },
  });

  const handleStartNewChat = () => {
    if (!newChatPhone.trim()) return;
    addContactMutation.mutate(newChatPhone);
  };

  // States and mutations for custom sorting, filtering and new chat dialog
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name" | "unread">("newest");
  const [filterView, setFilterView] = useState<
    | "all"
    | "unread"
    | "bot_paused"
    | "bot_active"
    | "archived"
    | "whatsapp"
    | "instagram"
    | "messenger"
    | "whatsapp_group"
  >("all");
  const [isNewChatDialogOpen, setIsNewChatDialogOpen] = useState(false);
  const [newChatName, setNewChatName] = useState("");
  const [newChatPhoneDialog, setNewChatPhoneDialog] = useState("");

  const handleCreateContactAndChat = useMutation({
    mutationFn: async () => {
      const digits = newChatPhoneDialog.replace(/\D/g, "");
      const fullPhone = countryCode.replace("+", "") + digits;
      const res = await createContact({
        data: {
          phone: fullPhone,
          name: newChatName.trim() || `Contato +${fullPhone}`,
        },
      });
      return res;
    },
    onSuccess: (data: unknown) => {
      const normalizedContact = normalizeChatContactRecord(data);
      if (!normalizedContact) {
        toast.error("Contato criado, mas a resposta retornou em formato inválido.");
        return;
      }
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      upsertDraftChatContact(normalizedContact);
      setMainTab("conversas");
      setActiveTab("outros");
      setFilterView("all");
      setSelectedContact(normalizedContact);
      setNewChatName("");
      setNewChatPhoneDialog("");
      setIsNewChatDialogOpen(false);
      toast.success("Nova conversa iniciada!");
    },
    onError: (err: unknown) => {
      toast.error("Erro ao iniciar conversa: " + getErrorMessage(err));
    },
  });

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
  const [cachedConvTags, setCachedConvTags] = useState<ConversationTagRecord[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const val = localStorage.getItem("tags:conv");
        const parsed: unknown = val ? JSON.parse(val) : [];
        return Array.isArray(parsed) ? (parsed as ConversationTagRecord[]) : [];
      } catch (error) {
        console.warn("Falha ao ler cache local de tags de conversa:", error);
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
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });

  const conversationTagsQuery = useQuery({
    queryKey: ["conversation-tags"],
    queryFn: async () => {
      const { data, error } = await db.from("conversation_tags").select("*, tags(*)");
      if (error) throw new Error(error.message);
      return data || [];
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
  });

  // Sync cache and localstorage when query finishes
  useEffect(() => {
    if (conversationTagsQuery.data) {
      setCachedConvTags(conversationTagsQuery.data as ConversationTagRecord[]);
      try {
        localStorage.setItem("tags:conv", JSON.stringify(conversationTagsQuery.data));
      } catch (error) {
        console.warn("Falha ao salvar cache local de tags de conversa:", error);
      }
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

    const existing = ((tagsQuery.data ?? []) as ChatTagRecord[]).find(
      (tag) => tag.name.toLowerCase() === nameTrim.toLowerCase(),
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

  const renderMessageTagSubmenu = (msg: ChatMessageRecord) => {
    const msgTags = ((messageTagsQuery.data ?? []) as MessageTagRecord[]).filter(
      (messageTag) => messageTag.message_id === msg.id,
    );
    return (
      <>
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
            ((tagsQuery.data ?? []) as ChatTagRecord[]).map((tag) => {
              const tagId = tag.id;
              if (!tagId) return null;
              const isApplied = msgTags.some((messageTag) => messageTag.tag_id === tagId);
              return (
                <button
                  key={tagId}
                  type="button"
                  onClick={() => handleToggleMessageTag(msg.id, tagId, isApplied)}
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
      </>
    );
  };

  // Queries
  const contactsQuery = useQuery<ChatContactRecord[]>({
    queryKey: ["chat-contacts"],
    queryFn: async () => {
      const data = await fetchContacts();
      if (!Array.isArray(data)) return [];

      return data
        .map((contact) => normalizeChatContactRecord(contact))
        .filter((contact): contact is ChatContactRecord => contact !== null);
    },
    staleTime: 1000,
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  // Auto-select contact based on deep link params.
  useEffect(() => {
    if (typeof window !== "undefined" && contactsQuery.data && !selectedContact) {
      const searchParams = new URLSearchParams(window.location.search);
      const searchContactId = searchParams.get("contactId");
      const searchPhone = searchParams.get("phone");

      if (searchContactId) {
        const foundById = contactsQuery.data.find((contact) => contact.id === searchContactId);
        if (foundById) {
          if (foundById.channel === "whatsapp_group") {
            setMainTab("grupos");
          } else {
            setMainTab("conversas");
          }
          setSelectedContact(foundById);
          return;
        }
      }

      if (searchPhone) {
        const cleanedSearchPhone = searchPhone.replace(/\D/g, "");
        const found = contactsQuery.data.find(
          (contact) =>
            contact.phone_e164 === searchPhone ||
            contact.phone_e164?.replace(/\D/g, "") === cleanedSearchPhone,
        );
        if (found) {
          if (found.channel === "whatsapp_group") {
            setMainTab("grupos");
          } else {
            setMainTab("conversas");
          }
          setSelectedContact(found);
          return;
        }

        // Um deep link vindo da ficha do contato deve abrir a conversa mesmo
        // antes da lista/polling incluir o contato (por exemplo, sem mensagens
        // anteriores). Busca-o diretamente e o mantém na lista temporária.
        if (cleanedSearchPhone) {
          fetchContactDetails({
            data: { phone: cleanedSearchPhone, contactId: searchContactId || undefined },
          })
            .then((details) => {
              const directContact = normalizeChatContactRecord(details);
              if (!directContact) return;
              upsertDraftChatContact(directContact);
              setMainTab(
                directContact.channel === "whatsapp_group" ? "grupos" : "conversas",
              );
              setSelectedContact(directContact);
            })
            .catch(() => {
              toast.error("NÃ£o foi possÃ­vel abrir a conversa deste contato.");
            });
        }
      }
    }
  }, [contactsQuery.data, selectedContact, fetchContactDetails]);

  // Mantém o contato selecionado sincronizado com a lista em polling.
  useEffect(() => {
    if (!contactsQuery.data || !selectedContact?.id) return;

    const freshSelected = contactsQuery.data.find((contact) => contact.id === selectedContact.id);

    if (!freshSelected) {
      if (draftChatContacts.some((contact) => contact.id === selectedContact.id)) return;
      setSelectedContact(null);
      return;
    }

    setSelectedContact((prev) => (prev ? mergeChatContactRecord(prev, freshSelected) : prev));
  }, [contactsQuery.data, draftChatContacts, selectedContact?.id]);

  const selectedPhone = selectedContact?.phone_e164;

  const contactDetailsQuery = useQuery<ChatContactRecord | null>({
    queryKey: ["chat-contact-details", selectedPhone],
    queryFn: async () => {
      if (!selectedPhone) return null;
      const details = await fetchContactDetails({ data: { phone: selectedPhone } });
      return normalizeChatContactRecord(details);
    },
    enabled: !!selectedPhone && contactInfoOpen,
    staleTime: 10_000,
  });

  // Atualiza o selectedContact quando abrimos o painel e carregamos dados completos
  useEffect(() => {
    if (!contactDetailsQuery.data || !selectedContact) return;
    const contactDetails = contactDetailsQuery.data;
    setSelectedContact((prev) => (prev ? mergeChatContactRecord(prev, contactDetails) : prev));
  }, [contactDetailsQuery.data]);

  // Busca automaticamente a foto de perfil do WhatsApp quando o contato não tem avatar
  const photoFetchingRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedPhone || !selectedContact?.id) return;
    if (getContactAvatarUrl(selectedContact)) return;
    if (photoFetchingRef.current === selectedPhone) return;
    photoFetchingRef.current = selectedPhone;
    fetchContactPhoto({ data: { contactId: selectedContact.id, phone: selectedPhone } })
      .then((result) => {
        if (result?.photo_url) {
          setSelectedContact((prev) =>
            prev
              ? mergeChatContactRecord(prev, {
                  custom_fields: { ...(prev.custom_fields ?? {}), avatar_url: result.photo_url },
                })
              : prev,
          );
          qc.invalidateQueries({ queryKey: ["chat-contacts"] });
        }
      })
      .catch(() => {});
  }, [selectedPhone, selectedContact?.id]);

  const messagesQuery = useQuery({
    queryKey: ["chat-messages", selectedPhone],
    queryFn: () => fetchMessages({ data: { phone: selectedPhone } }),
    enabled: !!selectedPhone,
    staleTime: 1000,
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const contactsForUi = useMemo<ChatContactRecord[]>(() => {
    const baseContacts = [...(contactsQuery.data ?? [])];

    for (const draft of draftChatContacts) {
      if (!baseContacts.some((contact) => contact.id === draft.id)) {
        baseContacts.unshift(draft);
      }
    }

    if (!selectedContact?.id) return baseContacts;

    return baseContacts.map((contact) =>
      contact.id === selectedContact.id
        ? mergeChatContactRecord(contact, selectedContact)
        : contact,
    );
  }, [contactsQuery.data, draftChatContacts, selectedContact]);

  const hasUnreadInOpenChat = useMemo(() => {
    if (!selectedPhone) return false;
    if (isFlagEnabled(selectedContact?.is_unread) || (selectedContact?.unread_count ?? 0) > 0) {
      return true;
    }

    return (messagesQuery.data ?? []).some(
      (message) =>
        message.direction === "incoming" && (message.status == null || message.status !== "read"),
    );
  }, [
    messagesQuery.data,
    selectedContact?.is_unread,
    selectedContact?.unread_count,
    selectedPhone,
  ]);

  // Função para reproduzir um som amigável de notificação
  const playNotificationSound = () => {
    try {
      const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
      const AudioContextCtor = window.AudioContext ?? audioWindow.webkitAudioContext;
      if (!AudioContextCtor) return;
      const audioCtx = new AudioContextCtor();
      // Tom 1 (G5 agudo rápido)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5
      gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.12);

      // Tom 2 (A5 mais agudo, curto delay)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08); // A5
      gain2.gain.setValueAtTime(0.12, audioCtx.currentTime + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc2.start(audioCtx.currentTime + 0.08);
      osc2.stop(audioCtx.currentTime + 0.25);
    } catch (err) {
      console.warn("AudioContext bloqueado ou não suportado:", err);
    }
  };

  // Notificação sonora para novas mensagens recebidas
  const prevMessagesLengthRef = useRef<number>(0);
  const prevSelectedPhoneRef = useRef<string | undefined>(undefined);
  const prevUnreadSumRef = useRef<number>(0);

  useEffect(() => {
    // 1. Notificação para novas mensagens no chat aberto ativo
    if (selectedPhone) {
      const incomingMsgs = (messagesQuery.data ?? []).filter(
        (message) => message.direction === "incoming",
      );

      if (prevSelectedPhoneRef.current !== selectedPhone) {
        prevSelectedPhoneRef.current = selectedPhone;
        prevMessagesLengthRef.current = incomingMsgs.length;
      } else {
        if (incomingMsgs.length > prevMessagesLengthRef.current) {
          playNotificationSound();
        }
        prevMessagesLengthRef.current = incomingMsgs.length;
      }
    }

    // 2. Notificação para novas mensagens em outros contatos da lista
    const currentUnreadSum = contactsForUi
      .filter((contact) => contact.phone_e164 !== selectedPhone)
      .reduce(
        (acc, contact) =>
          acc + Math.max(contact.unread_count || 0, isFlagEnabled(contact.is_unread) ? 1 : 0),
        0,
      );
    if (currentUnreadSum > prevUnreadSumRef.current) {
      playNotificationSound();
    }
    prevUnreadSumRef.current = currentUnreadSum;
  }, [messagesQuery.data, contactsForUi, selectedPhone]);

  // Scroll ao fim ao carregar novas mensagens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data?.length]);

  // Marca como lida tanto ao abrir quanto ao receber novas mensagens no chat aberto.
  useEffect(() => {
    if (!selectedPhone || !hasUnreadInOpenChat) return;

    fetchMarkAsRead({ data: { phone: selectedPhone } })
      .then(() => {
        qc.invalidateQueries({ queryKey: ["chat-contacts"] });
        qc.invalidateQueries({ queryKey: ["chat-messages", selectedPhone] });
        setSelectedContact((prev) =>
          prev ? { ...prev, is_unread: false, unread_count: 0 } : prev,
        );
      })
      .catch((err) => {
        console.error("Erro ao marcar mensagens como lidas:", err);
      });
  }, [selectedPhone, hasUnreadInOpenChat, fetchMarkAsRead, qc]);

  // Helpers para o visual dos cards de contato conforme o mockup
  const getSlaWarning = (contact: ChatContactRecord): boolean => {
    if ((contact.unread_count ?? 0) > 0 && contact.last_message_time) {
      const diffMs = Date.now() - new Date(contact.last_message_time).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      return diffMins >= 15;
    }
    return false;
  };

  const getInitials = (name: string): string => {
    if (!name) return "C";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  };

  const getContactCategory = (
    contact: ChatContactRecord,
    currentUserId: string,
  ): "novos" | "meus" | "outros" => {
    const hasUnread = isFlagEnabled(contact.is_unread) || (contact.unread_count ?? 0) > 0;
    if (!contact.active_agent_id && hasUnread) {
      return "novos";
    }
    if (contact.active_agent_id === currentUserId) {
      return "meus";
    }
    return "outros";
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

  const formatRelativeTime = (dateInput: string | number | Date | null | undefined): string => {
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

  const unreadConversas = useMemo(() => {
    return contactsForUi
      .filter(
        (contact) => contact.channel !== "whatsapp_group" && !isFlagEnabled(contact.is_archived),
      )
      .reduce(
        (acc, contact) =>
          acc + Math.max(contact.unread_count || 0, isFlagEnabled(contact.is_unread) ? 1 : 0),
        0,
      );
  }, [contactsForUi]);

  const unreadGrupos = useMemo(() => {
    return contactsForUi
      .filter(
        (contact) => contact.channel === "whatsapp_group" && !isFlagEnabled(contact.is_archived),
      )
      .reduce(
        (acc, contact) =>
          acc + Math.max(contact.unread_count || 0, isFlagEnabled(contact.is_unread) ? 1 : 0),
        0,
      );
  }, [contactsForUi]);

  // Mapeia e enriquece os contatos vindos da API do servidor
  const mappedContacts = contactsForUi
    .filter((contact) =>
      mainTab === "grupos"
        ? contact.channel === "whatsapp_group"
        : contact.channel !== "whatsapp_group",
    )
    .map((contact) => {
      const isPinned = isFlagEnabled(contact.is_pinned);
      const isArchived = isFlagEnabled(contact.is_archived);
      const isUnread = isFlagEnabled(contact.is_unread);
      const category = getContactCategory({ ...contact, is_unread: isUnread }, profile?.id || "");

      // Mapeia setor de acordo com as etiquetas atribuídas ou equipe real
      const contactTags = cachedConvTags.filter(
        (conversationTag) => conversationTag.contact_number === contact.phone_e164,
      );
      const hasSuporte = contactTags.some((conversationTag) =>
        conversationTag.tags?.name?.toUpperCase().includes("SUPORTE"),
      );
      const hasCS = contactTags.some(
        (conversationTag) =>
          conversationTag.tags?.name?.toUpperCase().includes("CS") ||
          conversationTag.tags?.name?.toUpperCase().includes("IMPLANTAÇÃO"),
      );

      let department = contact.active_team_name || contact.custom_fields?.department;
      if (!department) {
        if (hasCS) {
          department = "Sucesso Cliente";
        } else if (hasSuporte) {
          if (contact.name?.includes("Lucas")) {
            department = "Atendimento Geral";
          } else {
            department = "Suporte Técnico";
          }
        } else {
          const hash = (contact.id || "")
            .split("")
            .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
          const deptMod = hash % 3;
          if (deptMod === 0) department = "Atendimento Geral";
          else if (deptMod === 1) department = "Sucesso Cliente";
          else department = "Suporte Técnico";
        }
      }

      return {
        ...contact,
        category,
        department,
        is_pinned: isPinned,
        is_archived: isArchived,
        is_unread: isUnread,
        last_message_body: contact.last_message_body || "",
        last_message_time: contact.last_message_time || null,
        unread_count: Math.max(contact.unread_count || 0, isUnread ? 1 : 0),
      };
    });

  const tabScopedContacts = mappedContacts.filter((contact) =>
    filterView === "archived"
      ? isFlagEnabled(contact.is_archived)
      : !isFlagEnabled(contact.is_archived),
  );

  // Separação em abas conforme o mockup
  const novosContacts = tabScopedContacts.filter((contact) => contact.category === "novos");
  const meusContacts = tabScopedContacts.filter((contact) => contact.category === "meus");
  const outrosContacts = tabScopedContacts.filter((contact) => contact.category === "outros");

  const activeContactsList =
    activeTab === "novos" ? novosContacts : activeTab === "meus" ? meusContacts : outrosContacts;

  useEffect(() => {
    if (!selectedContact) return;

    const isGroupChat = selectedContact.channel === "whatsapp_group";
    if (mainTab === "grupos" && !isGroupChat) {
      setSelectedContact(null);
      return;
    }
    if (mainTab === "conversas" && isGroupChat) {
      setSelectedContact(null);
      return;
    }

    const isArchived = isFlagEnabled(selectedContact.is_archived);
    if (filterView === "archived" && !isArchived) {
      setSelectedContact(null);
      return;
    }
    if (filterView !== "archived" && isArchived) {
      setSelectedContact(null);
    }
  }, [filterView, mainTab, selectedContact]);

  useEffect(() => {
    if (mainTab === "grupos") {
      if (["whatsapp", "instagram", "messenger"].includes(filterView)) {
        setFilterView("all");
      }
      return;
    }

    if (filterView === "whatsapp_group") {
      setFilterView("all");
    }
  }, [filterView, mainTab]);

  // Contatos filtrados e ordenados por filtros de visualização e ordenação personalizada
  const rawFilteredContacts = activeContactsList.filter((contact) => {
    // Se o filtro de visualização for "archived", mostramos apenas arquivados.
    // Caso contrário, ocultamos arquivados por padrão.
    if (filterView === "archived") {
      if (!isFlagEnabled(contact.is_archived)) return false;
    } else {
      if (isFlagEnabled(contact.is_archived)) return false;
    }

    // Filtros de visualização adicionais
    if (filterView === "unread" && !contact.unread_count && !isFlagEnabled(contact.is_unread))
      return false;
    if (filterView === "bot_paused" && !contact.bot_active === false) return false;
    if (filterView === "bot_active" && !isFlagEnabled(contact.bot_active)) return false;
    if (filterView === "whatsapp" && contact.channel !== "whatsapp") return false;
    if (filterView === "instagram" && contact.channel !== "instagram") return false;
    if (filterView === "messenger" && contact.channel !== "messenger") return false;
    if (filterView === "whatsapp_group" && contact.channel !== "whatsapp_group") return false;

    const term = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !term ||
      (contact.name ?? "").toLowerCase().includes(term) ||
      (contact.phone_e164 ?? "").includes(term);
    if (!matchesSearch) return false;

    if (selectedFilterTagIds.length === 0) return true;

    const contactTags = cachedConvTags.filter(
      (conversationTag) => conversationTag.contact_number === contact.phone_e164,
    );
    return contactTags.some((conversationTag) =>
      selectedFilterTagIds.includes(conversationTag.tag_id),
    );
  });

  const filteredContacts = [...rawFilteredContacts].sort((a, b) => {
    const aPinned = a.is_pinned ? 1 : 0;
    const bPinned = b.is_pinned ? 1 : 0;
    if (bPinned !== aPinned) return bPinned - aPinned;

    if (sortBy === "name") {
      return (a.name || "").localeCompare(b.name || "");
    }
    if (sortBy === "unread") {
      const aUnread = a.unread_count || (a.is_unread ? 1 : 0);
      const bUnread = b.unread_count || (b.is_unread ? 1 : 0);
      if (bUnread !== aUnread) return bUnread - aUnread;
    }
    if (sortBy === "oldest") {
      const aTime = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
      const bTime = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
      return aTime - bTime;
    }
    // Default: newest
    const aTime = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
    const bTime = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
    return bTime - aTime;
  });

  const visibleFilteredContactIds = useMemo(
    () => filteredContacts.map((contact) => contact.id),
    [filteredContacts],
  );
  const visibleFilteredContactIdSet = useMemo(
    () => new Set(visibleFilteredContactIds),
    [visibleFilteredContactIds],
  );
  const visibleSelectedContactIds = useMemo(
    () => selectedContactIds.filter((id) => visibleFilteredContactIdSet.has(id)),
    [selectedContactIds, visibleFilteredContactIdSet],
  );
  const allVisibleContactsSelected =
    filteredContacts.length > 0 && visibleSelectedContactIds.length === filteredContacts.length;

  useEffect(() => {
    if (!isSelectionMode) return;
    if (visibleSelectedContactIds.length === selectedContactIds.length) return;
    setSelectedContactIds(visibleSelectedContactIds);
  }, [isSelectionMode, selectedContactIds.length, visibleSelectedContactIds]);

  // Mutation para envio de mensagens
  const sendMutation = useMutation<
    unknown,
    unknown,
    {
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
      contacts?: SendContactPayload[];
      reply_to_message_id?: string;
    }
  >({
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
      contacts?: SendContactPayload[];
      reply_to_message_id?: string;
    }) => {
      if (!selectedPhone) throw new Error("Nenhum contato selecionado");
      if (selectedContact?.channel === "whatsapp_group") {
        if (payload.type !== "text") {
          throw new Error(
            "Envio de mídia para grupos ainda não está disponível neste painel. Use apenas texto por enquanto.",
          );
        }
        const bodyText = payload.text?.body;
        const res = await sendGroupMsg({
          data: {
            groupId: selectedPhone,
            body: bodyText || "",
          },
        });
        if (!res.success) {
          throw new Error(res.error?.message || "Falha ao enviar mensagem para o grupo");
        }
        return res;
      }
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
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: ["chat-messages", selectedPhone] });
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      setSelectedContact((prev) => {
        if (!prev) return prev;

        let preview = prev.last_message_body || "";
        if (variables.type === "text") preview = variables.text?.body || "";
        else if (variables.type === "reaction")
          preview = `${variables.reaction?.emoji || ""} Reação`;
        else if (variables.type === "location")
          preview = variables.location?.name || "Localização enviada";
        else if (variables.type === "contacts") preview = "Contato compartilhado";
        else preview = "Mídia enviada";

        return {
          ...prev,
          is_unread: false,
          last_message_body: preview,
          last_message_time: new Date().toISOString(),
        };
      });
      setTypedMessage("");
      setReplyingTo(null);
    },
    onError: (err) => {
      toast.error(getErrorMessage(err) || "Erro ao enviar mensagem");
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
      reply_to_message_id: replyingTo?.wa_message_id ?? undefined,
    });
  };

  const handleSendReaction = (messageId: string | null | undefined, emoji: string) => {
    if (!messageId) {
      toast.error("Não foi possível reagir: identificador da mensagem ausente.");
      return;
    }
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
      reply_to_message_id: replyingTo?.wa_message_id ?? undefined,
    });
    setMetaImageId("");
    setIsImageModalOpen(false);
  };

  // Timer effect for recording duration
  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingSeconds(0);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Fallback de formatos suportados pelo browser para Meta Cloud API (WhatsApp)
      const mimeTypes = [
        "audio/ogg; codecs=opus",
        "audio/ogg",
        "audio/mp4",
        "audio/webm; codecs=opus",
        "audio/webm",
      ];
      const supportedType = mimeTypes.find(t => MediaRecorder.isTypeSupported(t)) || "audio/ogg";
      
      const recorder = new MediaRecorder(stream, supportedType ? { mimeType: supportedType } : undefined);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const rawAudioBlob = new Blob(chunks, { type: supportedType });
        const oggOpusBlob = await convertWebMToOggOpus(rawAudioBlob);
        
        const file = new File([oggOpusBlob], `audio_${Date.now()}.ogg`, { type: "audio/ogg" });

        stream.getTracks().forEach((track) => track.stop());

        setPendingMediaType("audio");
        if (!selectedPhone) {
          toast.error("Nenhum contato selecionado para envio de áudio.");
          return;
        }
        const phoneId = profile?.whatsapp_phone_number_id;
        if (!phoneId) {
          toast.error("ID do número de telefone não configurado.");
          return;
        }

        setUploadingMedia(true);
        const toastId = toast.loading("Enviando áudio gravado...");

        try {
          const res = await uploadMetaMediaViaApi(phoneId, file);
          if (!res.ok || !res.data?.id) {
            throw new Error(res.error || "Falha no upload de mídia na Meta.");
          }

          const mediaId = res.data.id;
          const payload: any = {
            type: "audio",
            audio: { id: mediaId },
            reply_to_message_id: replyingTo?.wa_message_id ?? undefined,
          };

          sendMutation.mutate(payload, {
            onSuccess: () => {
              setReplyingTo(null);
              toast.success("Áudio enviado com sucesso!", { id: toastId });
            },
            onError: (err: any) => {
              toast.error(getErrorMessage(err), { id: toastId });
            },
          });
        } catch (err: any) {
          toast.error(getErrorMessage(err), { id: toastId });
        } finally {
          setUploadingMedia(false);
          setPendingMediaType(null);
        }
      };

      recorder.start();
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      setRecordingSeconds(0);
      setIsRecording(true);
    } catch (err: any) {
      toast.error("Não foi possível acessar o microfone. Verifique as permissões.");
      console.error(err);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const handleCancelRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.onstop = () => {};
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      setIsRecording(false);
      setRecordingSeconds(0);
      toast.info("Gravação de áudio cancelada.");
    }
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
    if (!selectedPhone) {
      toast.error("Nenhum contato selecionado para envio de mídia.");
      return;
    }

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

      const payload: SendMessagePayload =
        pendingMediaType === "document"
          ? {
              to: selectedPhone,
              type: "document",
              document: { id: mediaId, filename: file.name },
              reply_to_message_id: replyingTo?.wa_message_id ?? undefined,
            }
          : pendingMediaType === "image"
            ? {
                to: selectedPhone,
                type: "image",
                image: { id: mediaId },
                reply_to_message_id: replyingTo?.wa_message_id ?? undefined,
              }
            : pendingMediaType === "audio"
              ? {
                  to: selectedPhone,
                  type: "audio",
                  audio: { id: mediaId },
                  reply_to_message_id: replyingTo?.wa_message_id ?? undefined,
                }
              : pendingMediaType === "video"
                ? {
                    to: selectedPhone,
                    type: "video",
                    video: { id: mediaId },
                    reply_to_message_id: replyingTo?.wa_message_id ?? undefined,
                  }
                : {
                    to: selectedPhone,
                    type: "sticker",
                    sticker: { id: mediaId },
                    reply_to_message_id: replyingTo?.wa_message_id ?? undefined,
                  };

      const sendRes = await sendMessage({ data: payload });

      if (!sendRes.ok) {
        throw new Error(sendRes.error || "Falha ao enviar mensagem de mídia.");
      }

      toast.success(`${file.name} enviado com sucesso!`, { id: toastId });
      qc.invalidateQueries({ queryKey: ["chat-messages", selectedPhone] });
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      setSelectedContact((prev) =>
        prev
          ? {
              ...prev,
              is_unread: false,
              last_message_body: file.name || "Mídia enviada",
              last_message_time: new Date().toISOString(),
            }
          : prev,
      );
      setReplyingTo(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || "Erro ao realizar upload da mídia.", { id: toastId });
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
      reply_to_message_id: replyingTo?.wa_message_id ?? undefined,
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
      reply_to_message_id: replyingTo?.wa_message_id ?? undefined,
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
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 20MB).");
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
      const { data: upRes, error: upErr } = await db.storage.from("avatars").upload(storagePath, file);
      if (upErr) throw new Error(upErr.message || "Falha ao enviar imagem.");

      const uploadedPath = upRes?.path || storagePath;
      const { data: pub } = db.storage.from("avatars").getPublicUrl(uploadedPath);
      const url = pub.publicUrl;
      const updated = await saveContactProfilePhoto({
        data: { id: selectedContact.id, avatar_url: url },
      });

      setSelectedContact((prev) =>
        prev
          ? mergeChatContactRecord(prev, {
              ...(normalizeChatContactRecord(updated) ?? {}),
              custom_fields: {
                ...(prev.custom_fields ?? {}),
                ...(normalizeContactCustomFields(updated?.custom_fields) ?? {}),
                avatar_url: url,
              },
            })
          : prev,
      );
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      qc.invalidateQueries({ queryKey: ["chat-contact-details", selectedPhone] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Foto do contato atualizada.");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "Falha ao atualizar foto do contato.");
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
      setSelectedContact((prev) => {
        if (!prev) return prev;

        const custom = {
          ...(prev.custom_fields ?? {}),
          ...(normalizeContactCustomFields(updated?.custom_fields) ?? {}),
        };
        delete custom.avatar_url;
        delete custom.photo_url;
        delete custom.photo;
        delete custom.picture;
        delete custom.image_url;
        delete custom.image;
        return {
          ...prev,
          ...(normalizeChatContactRecord(updated) ?? {}),
          custom_fields: custom,
        };
      });
      qc.invalidateQueries({ queryKey: ["chat-contacts"] });
      qc.invalidateQueries({ queryKey: ["chat-contact-details", selectedPhone] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Foto do contato removida.");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error) || "Falha ao remover foto do contato.");
    } finally {
      setUploadingContactPhoto(false);
    }
  };

  // Processa reações e monta árvore de mensagens
  const rawMessages = (messagesQuery.data ?? []) as ChatMessageRecord[];
  const normalMessages = rawMessages.filter((message) => message.type !== "reaction");
  const reactions = rawMessages.filter((message) => message.type === "reaction");

  const messageMap = new Map<string, ChatMessageRecord>();
  normalMessages.forEach((message) => {
    if (message.wa_message_id) {
      messageMap.set(message.wa_message_id, { ...message, reactions: [] });
    } else {
      messageMap.set(message.id, { ...message, reactions: [] });
    }
  });

  reactions.forEach((reaction) => {
    const targetId = reaction.context?.message_id;
    if (targetId && messageMap.has(targetId)) {
      const msg = messageMap.get(targetId);
      if (!msg) return;
      // Evita duplicar reação igual do mesmo remetente
      const exists = (msg.reactions ?? []).some(
        (currentReaction) =>
          currentReaction.emoji === reaction.body &&
          currentReaction.direction === reaction.direction,
      );
      if (!exists) {
        (msg.reactions ??= []).push({
          emoji: reaction.body ?? "",
          direction: reaction.direction,
        });
      }
    }
  });

  const displayMessages = Array.from(messageMap.values());

  const visibleMessageIds = displayMessages.map((message) => message.id);
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
      <style
        dangerouslySetInnerHTML={{
          __html: `
        /* Estilos dos Balões estilo WhatsApp */
        .wa-bubble-outgoing {
          background: color-mix(in oklab, var(--primary) 12%, var(--card)) !important;
          color: var(--foreground) !important;
          border: 1px solid color-mix(in oklab, var(--primary) 28%, var(--border)) !important;
          border-radius: 18px 18px 5px 18px !important;
          position: relative !important;
          box-shadow: 0 1px 2px rgb(0 0 0 / 0.06) !important;
        }
        .dark .wa-bubble-outgoing {
          background: color-mix(in oklab, var(--primary) 22%, var(--card)) !important;
          border-color: color-mix(in oklab, var(--primary) 38%, var(--border)) !important;
        }

        .wa-bubble-incoming {
          background: var(--card) !important;
          color: var(--foreground) !important;
          border: 1px solid color-mix(in oklab, var(--border) 82%, transparent) !important;
          border-radius: 18px 18px 18px 5px !important;
          position: relative !important;
          box-shadow: 0 1px 2px rgb(0 0 0 / 0.05) !important;
        }

        .wa-quote-reply-outgoing {
          background: color-mix(in oklab, var(--primary) 9%, transparent) !important;
          border-left: 3px solid var(--primary) !important;
          border-radius: 8px !important;
        }
        
        .wa-quote-reply-incoming {
          background: var(--muted) !important;
          border-left: 3px solid var(--primary) !important;
          border-radius: 8px !important;
        }

        .wa-button-separator-outgoing {
          border-top: 1px solid color-mix(in oklab, var(--primary) 18%, var(--border)) !important;
        }
        
        .wa-button-separator-incoming {
          border-top: 1px solid var(--border) !important;
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
          color: var(--primary) !important;
          transition: background-color 0.2s;
          cursor: pointer;
          font-weight: 600;
        }
        .wa-card-button-incoming:hover {
          background-color: color-mix(in oklab, var(--primary) 7%, transparent);
        }

        .wa-timestamp {
          color: var(--muted-foreground) !important;
          opacity: 0.9;
        }
      `,
        }}
      />

      <div className="flex-1 min-h-0 flex border-t">
        {/* Sidebar de Contatos */}
        <div
          className={cn(
            "w-full md:w-80 lg:w-96 border-r flex flex-col h-full bg-muted/20 shrink-0",
            selectedContact ? "hidden md:flex" : "flex",
          )}
        >
          {/* Divisão Principal: Conversas vs Grupos */}
          <div className="flex border-b border-border bg-card shrink-0 select-none">
            <button
              type="button"
              onClick={() => setMainTab("conversas")}
              className={cn(
                "flex-1 py-3 text-xs font-extrabold transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider",
                mainTab === "conversas"
                  ? "border-primary text-primary bg-muted/10"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              <MessageCircle className="h-4 w-4" />
              Conversas
              {unreadConversas > 0 && (
                <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {unreadConversas > 99 ? "99+" : unreadConversas}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMainTab("grupos")}
              className={cn(
                "flex-1 py-3 text-xs font-extrabold transition-all border-b-2 flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider",
                mainTab === "grupos"
                  ? "border-primary text-primary bg-muted/10"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30",
              )}
            >
              <Users className="h-4 w-4" />
              Grupos
              {unreadGrupos > 0 && (
                <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {unreadGrupos > 99 ? "99+" : unreadGrupos}
                </span>
              )}
            </button>
          </div>

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
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                Novos
                <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
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
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                Meus
                <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
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
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
              >
                Outros
                <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {outrosContacts.length}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-2">
              <Button
                onClick={() => setFilterView(filterView === "archived" ? "all" : "archived")}
                size="icon"
                variant={filterView === "archived" ? "secondary" : "ghost"}
                title="Arquivados"
                className={cn(
                  "h-8 w-8 rounded-lg",
                  filterView === "archived"
                    ? "text-primary bg-muted"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Archive className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Menu"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() => setShowTagFilters(!showTagFilters)}
                    className="flex items-center gap-2 text-xs cursor-pointer"
                  >
                    <Filter className="h-3.5 w-3.5" />
                    <span>Filtro de etiquetas</span>
                  </DropdownMenuItem>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="flex items-center gap-2 text-xs cursor-pointer">
                      <ArrowUpDown className="h-3.5 w-3.5" />
                      <span>Ordenar conversas</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="w-48">
                        <DropdownMenuItem
                          onClick={() => setSortBy("newest")}
                          className="flex items-center justify-between text-xs cursor-pointer"
                        >
                          <span>Mais recentes</span>
                          {sortBy === "newest" && <Check className="h-3.5 w-3.5" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setSortBy("oldest")}
                          className="flex items-center justify-between text-xs cursor-pointer"
                        >
                          <span>Mais antigas</span>
                          {sortBy === "oldest" && <Check className="h-3.5 w-3.5" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setSortBy("name")}
                          className="flex items-center justify-between text-xs cursor-pointer"
                        >
                          <span>Nome (A-Z)</span>
                          {sortBy === "name" && <Check className="h-3.5 w-3.5" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setSortBy("unread")}
                          className="flex items-center justify-between text-xs cursor-pointer"
                        >
                          <span>Não lidas primeiro</span>
                          {sortBy === "unread" && <Check className="h-3.5 w-3.5" />}
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="flex items-center gap-2 text-xs cursor-pointer">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      <span>Filtrar por canal/status</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="w-48">
                        <DropdownMenuItem
                          onClick={() => setFilterView("all")}
                          className="flex items-center justify-between text-xs cursor-pointer"
                        >
                          <span>Todos</span>
                          {filterView === "all" && <Check className="h-3.5 w-3.5" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setFilterView("unread")}
                          className="flex items-center justify-between text-xs cursor-pointer"
                        >
                          <span>Não lidas</span>
                          {filterView === "unread" && <Check className="h-3.5 w-3.5" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setFilterView("bot_active")}
                          className="flex items-center justify-between text-xs cursor-pointer"
                        >
                          <span>Chatbot ativo</span>
                          {filterView === "bot_active" && <Check className="h-3.5 w-3.5" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setFilterView("bot_paused")}
                          className="flex items-center justify-between text-xs cursor-pointer"
                        >
                          <span>Chatbot pausado</span>
                          {filterView === "bot_paused" && <Check className="h-3.5 w-3.5" />}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setFilterView("archived")}
                          className="flex items-center justify-between text-xs cursor-pointer"
                        >
                          <span>Arquivados</span>
                          {filterView === "archived" && <Check className="h-3.5 w-3.5" />}
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  <DropdownMenuItem
                    onClick={() => {
                      setIsSelectionMode(!isSelectionMode);
                      setSelectedContactIds([]);
                    }}
                    className="flex items-center gap-2 text-xs cursor-pointer"
                  >
                    <ClipboardList className="h-3.5 w-3.5" />
                    <span>Seleção em massa</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => setIsNewChatDialogOpen(true)}
                    className="flex items-center gap-2 text-xs cursor-pointer text-primary focus:text-primary"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    <span>Novo Atendimento</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
            </div>

            {isSelectionMode && (
              <div className="flex items-center justify-between bg-muted/60 p-2.5 rounded-lg border text-xs gap-2 mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[10px] px-2"
                    onClick={() => {
                      if (allVisibleContactsSelected) {
                        setSelectedContactIds([]);
                      } else {
                        setSelectedContactIds(filteredContacts.map((contact) => contact.id));
                      }
                    }}
                  >
                    {allVisibleContactsSelected ? "Desmarcar Todos" : "Selecionar Todos"}
                  </Button>
                  <span className="font-semibold text-muted-foreground text-[10px]">
                    {visibleSelectedContactIds.length} selecionado(s)
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-[10px] px-2.5 bg-violet-600 hover:bg-violet-700 text-white font-medium"
                    disabled={visibleSelectedContactIds.length === 0}
                    onClick={() => {
                      // Set default funnel and stage
                      const defaultFunnel =
                        salesFunnels.find((funnel) => funnel.is_default) ||
                        salesFunnelsQuery.data?.[0];
                      if (defaultFunnel) {
                        setBulkFunnelId(defaultFunnel.id);
                        const defaultStage =
                          salesStages.find((stage) => stage.funnel_id === defaultFunnel.id) ||
                          salesStagesQuery.data?.[0];
                        if (defaultStage) {
                          setBulkStageId(defaultStage.id);
                        }
                      }
                      setIsBulkFunnelDialogOpen(true);
                    }}
                  >
                    Enviar p/ Funil
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-[10px] px-1.5 hover:bg-muted"
                    onClick={() => {
                      setIsSelectionMode(false);
                      setSelectedContactIds([]);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

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
                    ((tagsQuery.data ?? []) as ChatTagRecord[]).map((tag) => {
                      const tagId = tag.id;
                      if (!tagId) return null;
                      const isActive = selectedFilterTagIds.includes(tagId);
                      return (
                        <button
                          key={tagId}
                          type="button"
                          onClick={() => {
                            setSelectedFilterTagIds((prev) =>
                              prev.includes(tagId)
                                ? prev.filter((id) => id !== tagId)
                                : [...prev, tagId],
                            );
                          }}
                          className={cn(
                            "transition-all cursor-pointer hover:scale-105 rounded-full text-[9px] font-bold px-2 py-0.5 border",
                            isActive
                              ? "opacity-100 ring-2 ring-primary ring-offset-1 ring-offset-background text-white"
                              : "opacity-60 text-white",
                          )}
                          style={{
                            backgroundColor: tag.color ?? undefined,
                            borderColor: tag.color ?? undefined,
                          }}
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
              filteredContacts.map((c) => {
                const isSelected = selectedContact?.id === c.id;
                const avatarUrl = getContactAvatarUrl(c);
                const avatarBg = getAvatarColor(c.name ?? "");
                const contactTags = cachedConvTags.filter(
                  (conversationTag) => conversationTag.contact_number === c.phone_e164,
                );
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "relative group w-full flex items-start gap-3 p-3.5 text-left transition-colors border-b border-border",
                      isSelected ? "bg-primary/10" : "hover:bg-muted/40",
                    )}
                  >
                    {/* Clickable Area for Contact Selection */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (isSelectionMode) {
                          setSelectedContactIds((prev) =>
                            prev.includes(c.id)
                              ? prev.filter((id) => id !== c.id)
                              : [...prev, c.id],
                          );
                        } else {
                          setSelectedContact(c);
                          setReplyingTo(null);
                        }
                      }}
                      className="flex-1 flex items-start gap-3 min-w-0 cursor-pointer"
                    >
                      {/* Checkbox para modo de seleção */}
                      {isSelectionMode && (
                        <div
                          className="shrink-0 flex items-center justify-center mt-3 mr-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedContactIds.includes(c.id)}
                            onChange={() => {
                              setSelectedContactIds((prev) =>
                                prev.includes(c.id)
                                  ? prev.filter((id) => id !== c.id)
                                  : [...prev, c.id],
                              );
                            }}
                            className="h-4.5 w-4.5 rounded border-input text-violet-600 focus:ring-violet-500 cursor-pointer"
                          />
                        </div>
                      )}
                      {/* Avatar */}
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
                          <ChannelBadge channel={c.channel ?? "whatsapp"} />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        {/* First row: Name and Time */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <h4 className="font-bold text-sm text-foreground truncate leading-none">
                              {c.name || "Sem Nome"}
                            </h4>
                            {c.channel === "whatsapp_group" && (
                              <span className="bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase shrink-0">
                                Grupo
                              </span>
                            )}
                            {c.is_pinned && (
                              <Bookmark className="h-3.5 w-3.5 text-amber-500 fill-current shrink-0 ml-1" />
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0 text-muted-foreground select-none">
                            {!c.unread_count && (
                              <span className="text-emerald-500 shrink-0">
                                <CheckCheck className="h-3.5 w-3.5" />
                              </span>
                            )}
                            <span className="text-[10px]">
                              {c.last_message_time
                                ? formatRelativeTime(c.last_message_time)
                                : "sem data"}
                            </span>
                          </div>
                        </div>

                        {/* Second row: Last message body */}
                        <p className="text-xs text-muted-foreground truncate leading-normal">
                          {c.last_message_body ||
                            getCustomFieldText(c.custom_fields, "company") ||
                            "Sem mensagens"}
                        </p>

                        {/* Third row: Badges */}
                        <div className="flex flex-wrap gap-1 pt-1">
                          {/* Status Badge */}
                          <span
                            className={cn(
                              "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold uppercase border select-none",
                              c.chat_status === "fechado"
                                ? "border-gray-500/30 text-gray-500 bg-gray-500/10"
                                : c.chat_status === "aguardando"
                                  ? "border-amber-500/30 text-amber-500 bg-amber-500/10"
                                  : "border-emerald-500/30 text-emerald-500 bg-emerald-500/10",
                            )}
                          >
                            {c.chat_status === "fechado" ? (
                              <Check className="h-2.5 w-2.5" />
                            ) : c.chat_status === "aguardando" ? (
                              <Clock className="h-2.5 w-2.5" />
                            ) : (
                              <Activity className="h-2.5 w-2.5" />
                            )}
                            {c.chat_status || "aberto"}
                          </span>

                          {/* SLA Badge */}
                          {getSlaWarning(c) && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold uppercase border border-rose-500/30 text-rose-500 bg-rose-500/10 select-none">
                              <AlertCircle className="h-2.5 w-2.5" />
                              SLA
                            </span>
                          )}

                          {/* Team Badge */}
                          {c.active_team_name && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold uppercase bg-pink-500 text-white select-none">
                              <Users className="h-2.5 w-2.5" />
                              {c.active_team_name}
                            </span>
                          )}

                          {/* Agent Badge */}
                          {c.active_agent_name && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold uppercase bg-violet-600 text-white select-none">
                              <User className="h-2.5 w-2.5" />
                              {c.active_agent_name}
                            </span>
                          )}

                          {/* Kanban Badge */}
                          {(c.kanban_stage_name ||
                            getCustomFieldText(c.custom_fields, "company")) && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8.5px] font-bold uppercase bg-cyan-700 text-white select-none">
                              <Phone className="h-2.5 w-2.5" />
                              {c.kanban_stage_name ||
                                getCustomFieldText(c.custom_fields, "company")}
                            </span>
                          )}

                          {/* Textual Tags (legacy) */}
                          {contactTags.map((ct) => (
                            <span
                              key={ct.tag_id}
                              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[8.5px] font-bold uppercase tracking-wider text-white select-none"
                              style={{ backgroundColor: ct.tags?.color || "#6366f1" }}
                            >
                              {ct.tags?.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right side unread count & Dropdown menu */}
                    <div className="shrink-0 flex flex-col items-end justify-between self-stretch pt-0.5">
                      {c.unread_count > 0 ? (
                        <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-sm select-none">
                          {c.unread_count}
                        </span>
                      ) : (
                        <div className="h-5 w-5" />
                      )}

                      {/* Dropdown Menu Trigger on Hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 hover:bg-muted/80"
                            >
                              <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[200px]">
                            {/* Pin */}
                            <DropdownMenuItem
                              onClick={() =>
                                pinMutation.mutate({ contactId: c.id, isPinned: !c.is_pinned })
                              }
                            >
                              <Bookmark className="mr-2 h-4 w-4 text-amber-500" />
                              {c.is_pinned ? "Desafixar conversa" : "Fixar conversa"}
                            </DropdownMenuItem>

                            {/* Kanban Submenu */}
                            {salesStages.length > 0 && salesFunnels.length > 0 && (
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                                  <span>Kanban</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                  <DropdownMenuSubContent className="w-[200px]">
                                    <DropdownMenuItem
                                      onClick={() =>
                                        kanbanStageMutation.mutate({
                                          contactId: c.id,
                                          stageId: null,
                                        })
                                      }
                                      className="cursor-pointer"
                                    >
                                      <X className="mr-2 h-3.5 w-3.5" />
                                      <span>Sem funil</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {salesFunnels.map((funnel) => {
                                      const funnelStages = salesStages.filter(
                                        (stage) => stage.funnel_id === funnel.id,
                                      );
                                      if (funnelStages.length === 0) return null;
                                      return (
                                        <DropdownMenuSub key={funnel.id}>
                                          <DropdownMenuSubTrigger className="cursor-pointer">
                                            <span className="truncate">{funnel.name}</span>
                                          </DropdownMenuSubTrigger>
                                          <DropdownMenuPortal>
                                            <DropdownMenuSubContent className="w-[180px]">
                                              {funnelStages.map((stage) => (
                                                <DropdownMenuItem
                                                  key={stage.id}
                                                  onClick={() =>
                                                    kanbanStageMutation.mutate({
                                                      contactId: c.id,
                                                      stageId: stage.id,
                                                    })
                                                  }
                                                  className="cursor-pointer"
                                                >
                                                  <span
                                                    className="h-2 w-2 rounded-full mr-2 shrink-0"
                                                    style={{
                                                      backgroundColor: stage.color || "#8b5cf6",
                                                    }}
                                                  />
                                                  <span className="truncate">{stage.name}</span>
                                                </DropdownMenuItem>
                                              ))}
                                            </DropdownMenuSubContent>
                                          </DropdownMenuPortal>
                                        </DropdownMenuSub>
                                      );
                                    })}
                                  </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                              </DropdownMenuSub>
                            )}

                            {/* Tags Submenu */}
                            {tagsQuery.data && tagsQuery.data.length > 0 && (
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                  <Tag className="mr-2 h-4 w-4" />
                                  <span>Tags</span>
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                  <DropdownMenuSubContent className="w-[180px]">
                                    {(tagsQuery.data as ChatTagRecord[]).map((tag) => {
                                      const tagId = tag.id;
                                      const contactPhone = c.phone_e164;
                                      if (!tagId || !contactPhone) return null;
                                      const isTagged = contactTags.some(
                                        (conversationTag) => conversationTag.tag_id === tagId,
                                      );
                                      return (
                                        <DropdownMenuItem
                                          key={tagId}
                                          onClick={() =>
                                            handleToggleConversationTag(
                                              contactPhone,
                                              tagId,
                                              isTagged,
                                            )
                                          }
                                        >
                                          {isTagged ? (
                                            <Check className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                                          ) : (
                                            <div className="mr-2 h-3.5 w-3.5" />
                                          )}
                                          <span
                                            className="h-2 w-2 rounded-full mr-2 shrink-0"
                                            style={{ backgroundColor: tag.color || "#6366f1" }}
                                          />
                                          <span className="truncate">{tag.name}</span>
                                        </DropdownMenuItem>
                                      );
                                    })}
                                  </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                              </DropdownMenuSub>
                            )}

                            {/* Status Submenu */}
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <Activity className="mr-2 h-4 w-4" />
                                <span>Status</span>
                              </DropdownMenuSubTrigger>
                              <DropdownMenuPortal>
                                <DropdownMenuSubContent className="w-[150px]">
                                  <DropdownMenuItem
                                    onClick={() =>
                                      statusMutation.mutate({ contactId: c.id, status: "aberto" })
                                    }
                                  >
                                    <Activity className="mr-2 h-3.5 w-3.5 text-emerald-500" />
                                    <span>Aberto</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      statusMutation.mutate({
                                        contactId: c.id,
                                        status: "aguardando",
                                      })
                                    }
                                  >
                                    <Clock className="mr-2 h-3.5 w-3.5 text-amber-500" />
                                    <span>Aguardando</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      statusMutation.mutate({ contactId: c.id, status: "fechado" })
                                    }
                                  >
                                    <Check className="mr-2 h-3.5 w-3.5 text-gray-500" />
                                    <span>Fechado</span>
                                  </DropdownMenuItem>
                                </DropdownMenuSubContent>
                              </DropdownMenuPortal>
                            </DropdownMenuSub>

                            <DropdownMenuSeparator />

                            {/* Editar */}
                            <DropdownMenuItem onClick={() => setQuickSaveContactData(c)}>
                              <User className="mr-2 h-4 w-4" />
                              <span>Salvar contato</span>
                            </DropdownMenuItem>

                            {/* Atribuir */}
                            <DropdownMenuItem onClick={() => setAssigningContactData(c)}>
                              <UserCheck className="mr-2 h-4 w-4" />
                              <span>Atribuir conversa</span>
                            </DropdownMenuItem>

                            {/* Não Lida */}
                            <DropdownMenuItem
                              onClick={() =>
                                unreadMutation.mutate({
                                  contactId: c.id,
                                  isUnread: !c.is_unread,
                                })
                              }
                            >
                              <Mail className="mr-2 h-4 w-4" />
                              {c.is_unread ? "Marcar como lida" : "Marcar como não lida"}
                            </DropdownMenuItem>

                            {/* Arquivar */}
                            <DropdownMenuItem
                              onClick={() =>
                                archiveMutation.mutate({
                                  contactId: c.id,
                                  isArchived: !c.is_archived,
                                })
                              }
                            >
                              <Archive className="mr-2 h-4 w-4" />
                              {c.is_archived ? "Desarquivar conversa" : "Arquivar conversa"}
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {/* Apagar */}
                            <DropdownMenuItem
                              className="text-destructive hover:text-destructive"
                              onClick={async () => {
                                const ok = await confirm({
                                  title: "Excluir contato?",
                                  description: `O contato ${c.name || c.phone_e164} será excluído permanentemente.`,
                                  confirmText: "Excluir",
                                  destructive: true,
                                });
                                if (ok) {
                                  deleteContactMutation.mutate(c.id);
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Apagar conversa</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
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
                <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between h-[72px] shrink-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="md:hidden h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
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
                          className="h-10 w-10 rounded-full overflow-hidden flex items-center justify-center text-white font-semibold text-sm shrink-0 border-2 border-amber-400 hover:border-amber-300 transition-all duration-200 cursor-pointer shadow-sm"
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

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-bold text-[15px] truncate text-foreground leading-tight">
                          {selectedContact.name || "Sem Nome"}
                        </h3>
                        {/* Render conversation tag pills/dots in header */}
                        {(() => {
                          const contactTags = cachedConvTags.filter(
                            (conversationTag) =>
                              conversationTag.contact_number === selectedContact.phone_e164,
                          );
                          if (contactTags.length === 0) return null;
                          return (
                            <div className="flex gap-1 shrink-0">
                              {contactTags.map((ct) => (
                                <TagBadge key={ct.tag_id} tag={ct.tags} />
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      <span className="text-xs text-muted-foreground font-medium leading-normal truncate whitespace-nowrap">
                        {formatPhone(selectedContact.phone_e164 ?? "")}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Status Badge Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-border bg-background hover:bg-accent text-foreground select-none cursor-pointer transition-colors"
                        >
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              selectedContact.chat_status === "fechado"
                                ? "bg-zinc-500"
                                : selectedContact.chat_status === "aguardando"
                                  ? "bg-amber-500"
                                  : "bg-emerald-500",
                            )}
                          />
                          <span>
                            {selectedContact.chat_status === "fechado"
                              ? "Resolvida"
                              : selectedContact.chat_status === "aguardando"
                                ? "Pendente"
                                : "Aberta"}
                          </span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-[150px] bg-popover border-border text-popover-foreground"
                      >
                        <DropdownMenuItem
                          onClick={() =>
                            statusMutation.mutate({
                              contactId: selectedContact.id,
                              status: "aberto",
                            })
                          }
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                            <span>Aberta</span>
                          </div>
                          {selectedContact.chat_status === "aberto" && (
                            <Check className="h-3.5 w-3.5 text-violet-500" />
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            statusMutation.mutate({
                              contactId: selectedContact.id,
                              status: "aguardando",
                            })
                          }
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                            <span>Pendente</span>
                          </div>
                          {selectedContact.chat_status === "aguardando" && (
                            <Check className="h-3.5 w-3.5 text-violet-500" />
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            statusMutation.mutate({
                              contactId: selectedContact.id,
                              status: "fechado",
                            })
                          }
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full bg-zinc-500" />
                            <span>Resolvida</span>
                          </div>
                          {selectedContact.chat_status === "fechado" && (
                            <Check className="h-3.5 w-3.5 text-violet-500" />
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Bot Toggle Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const contactPhone = selectedContact.phone_e164 ?? "";
                        const channel = selectedContact.channel ?? "whatsapp";
                        if (!contactPhone) {
                          toast.error(
                            "Este contato não possui telefone válido para alterar o bot.",
                          );
                          return;
                        }

                        botActiveMutation.mutate({
                          contactPhone,
                          botActive: !isFlagEnabled(selectedContact.bot_active),
                          channel,
                        });
                      }}
                      className="h-8 w-8 rounded-full flex items-center justify-center transition-colors cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground relative"
                      title={
                        selectedContact.bot_active
                          ? "Desativar Inteligência / Chatbot"
                          : "Ativar Inteligência / Chatbot"
                      }
                    >
                      {isFlagEnabled(selectedContact.bot_active) ? (
                        <Bot className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <div className="relative h-5 w-5 flex items-center justify-center">
                          <Bot className="h-5 w-5 text-zinc-400 opacity-60" />
                          <svg
                            className="absolute inset-0 h-5 w-5 text-zinc-400 opacity-60"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          >
                            <line x1="4" y1="4" x2="20" y2="20" />
                          </svg>
                        </div>
                      )}
                    </button>

                    {/* Options Dropdown Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[220px]">
                        <DropdownMenuItem
                          onClick={() => setIsQuickOpportunityOpen(true)}
                          className="cursor-pointer"
                        >
                          <Filter className="mr-2.5 h-4 w-4 text-zinc-400" />
                          <span>Oportunidade Rápida</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => setAssigningContactData(selectedContact)}
                          className="cursor-pointer"
                        >
                          <Forward className="mr-2.5 h-4 w-4 text-zinc-400" />
                          <span>Atribuir Conversa</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => setQuickSaveContactData(selectedContact)}
                          className="cursor-pointer"
                        >
                          <UserPen className="mr-2.5 h-4 w-4 text-zinc-400" />
                          <span>Salvar Contato</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => setIsInventoryOpen(true)}
                          className="cursor-pointer"
                        >
                          <Package className="mr-2.5 h-4 w-4 text-zinc-400" />
                          <span>Gerenciar Estoque</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => setIsMessageSearchOpen(true)}
                          className="cursor-pointer"
                        >
                          <Search className="mr-2.5 h-4 w-4 text-zinc-400" />
                          <span>Buscar Mensagens</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => setIsFollowUpOpen(true)}
                          className="cursor-pointer"
                        >
                          <Clock className="mr-2.5 h-4 w-4 text-zinc-400" />
                          <span>Agendar Follow-up</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => setIsLeadHistoryOpen(true)}
                          className="cursor-pointer"
                        >
                          <History className="mr-2.5 h-4 w-4 text-zinc-400" />
                          <span>Histórico do Lead</span>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className={cn(
                            selectedContact.opted_out
                              ? "text-emerald-500 hover:text-emerald-500 focus:text-emerald-500 focus:bg-emerald-500/10"
                              : "text-red-500 hover:text-red-500 focus:text-red-500 focus:bg-red-500/10",
                            "cursor-pointer",
                          )}
                          onClick={async () => {
                            const isBlocked = selectedContact.opted_out === true;
                            const ok = await confirm({
                              title: isBlocked ? "Desbloquear Contato?" : "Bloquear Contato?",
                              description: isBlocked
                                ? `Deseja realmente desbloquear o contato ${selectedContact.name || selectedContact.phone_e164}?`
                                : `Deseja realmente bloquear o contato ${selectedContact.name || selectedContact.phone_e164}?`,
                              confirmText: isBlocked ? "Desbloquear" : "Bloquear",
                              destructive: !isBlocked,
                            });
                            if (ok) {
                              blockContactMutation.mutate({
                                contactId: selectedContact.id,
                                block: !isBlocked,
                              });
                            }
                          }}
                        >
                          <Ban
                            className={cn(
                              "mr-2.5 h-4 w-4",
                              selectedContact.opted_out ? "text-emerald-500" : "text-red-500",
                            )}
                          />
                          <span>
                            {selectedContact.opted_out ? "Desbloquear Contato" : "Bloquear Contato"}
                          </span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Message Search Bar */}
                {isMessageSearchOpen && (
                  <div className="px-4 py-2.5 bg-card border-b border-border flex items-center gap-2 animate-in slide-in-from-top duration-200">
                    <Search className="h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar nas mensagens deste chat..."
                      value={messageSearchQuery}
                      onChange={(e) => setMessageSearchQuery(e.target.value)}
                      className="flex-1 h-8 text-xs bg-white dark:bg-[#0c0a0f] border-neutral-200 dark:border-neutral-800 text-zinc-800 dark:text-zinc-200 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:ring-1"
                      autoFocus
                    />
                    {messageSearchQuery && (
                      <span className="text-[10px] text-muted-foreground font-semibold px-2 py-0.5 bg-muted border border-border rounded">
                        {
                          displayMessages.filter((m) =>
                            (m.body || "").toLowerCase().includes(messageSearchQuery.toLowerCase()),
                          ).length
                        }{" "}
                        encontrada(s)
                      </span>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full"
                      onClick={() => {
                        setMessageSearchQuery("");
                        setIsMessageSearchOpen(false);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Corpo / Lista de Balões */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 relative bg-muted/10">
                  {(() => {
                    let lastDateStr = "";
                    const formatDateSeparator = (
                      dateInput: string | number | Date | null | undefined,
                    ) => {
                      const date = new Date(dateInput ?? Date.now());
                      const today = new Date();
                      const yesterday = new Date();
                      yesterday.setDate(today.getDate() - 1);

                      if (date.toDateString() === today.toDateString()) {
                        return "Hoje";
                      } else if (date.toDateString() === yesterday.toDateString()) {
                        return "Ontem";
                      } else {
                        const day = String(date.getDate()).padStart(2, "0");
                        const month = String(date.getMonth() + 1).padStart(2, "0");
                        const year = date.getFullYear();
                        return `${day}/${month}/${year}`;
                      }
                    };

                    return messagesQuery.isLoading ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                          <span>Carregando conversa...</span>
                        </div>
                      </div>
                    ) : messagesQuery.isError ? (
                      <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
                        <XCircle className="h-9 w-9 text-destructive" />
                        <div>
                          <p className="font-semibold text-foreground">Não foi possível carregar a conversa</p>
                          <p className="mt-1 text-xs">Tente novamente. Se persistir, a falha ficará visível para diagnóstico.</p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => messagesQuery.refetch()}>
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Tentar novamente
                        </Button>
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
                      displayMessages.map((msg) => {
                        const isOutgoing = msg.direction === "outgoing";
                        const replyMsgId = msg.context?.message_id;
                        const replyMessage =
                          replyMsgId &&
                          displayMessages.find((message) => message.id === replyMsgId);

                        const msgDateStr = new Date(msg.timestamp).toDateString();
                        const showDateSeparator = msgDateStr !== lastDateStr;
                        lastDateStr = msgDateStr;

                        const agentName =
                          profile?.full_name || profile?.display_name || "Atendente";
                        const agentTeamId = selectedContact?.active_team_id;
                        const agentTeamName = agentTeamId ? getTeamName(agentTeamId) : null;
                        const agentLabel = agentTeamName
                          ? `${agentName} (${agentTeamName})`
                          : agentName;
                        const senderName =
                          selectedContact?.channel === "whatsapp_group" && msg.sender_name
                            ? msg.sender_name
                            : selectedContact?.name || selectedContact?.phone_e164 || "Contato";

                        return (
                          <div key={msg.id} className="w-full flex flex-col">
                            {showDateSeparator && (
                              <div className="relative flex items-center justify-center my-4 select-none px-4">
                                <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-px bg-border/60" />
                                <span className="relative z-10 bg-muted/10 px-3 text-[11px] font-medium text-muted-foreground/70">
                                  {formatDateSeparator(msg.timestamp)}
                                </span>
                              </div>
                            )}

                            {msg.type === "system" ? (
                              <div className="flex w-full justify-center my-2 select-none">
                                <div className="bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 px-3.5 py-1.5 rounded-full text-[11px] text-muted-foreground text-center max-w-[85%] shadow-xs flex items-center gap-1.5 font-normal">
                                  <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <span>{msg.body}</span>
                                </div>
                              </div>
                            ) : (
                              <div
                                id={`msg-${msg.id}`}
                                className={cn(
                                  "flex w-full flex-col group transition-all duration-300 rounded-lg p-1",
                                  isOutgoing ? "items-end" : "items-start",
                                )}
                              >
                                {/* Container do Balão + Avatar + Ações */}
                                <div
                                  className={cn(
                                    "flex items-end gap-2 max-w-[85%] md:max-w-[70%]",
                                    isOutgoing ? "flex-row-reverse" : "flex-row",
                                  )}
                                >
                                  {/* Avatar (Esquerda para incoming, Direita para outgoing) */}
                                  {isOutgoing ? (
                                    <Avatar className="h-7 w-7 shrink-0 mb-1 ring-1 ring-primary/30 shadow-sm">
                                      <AvatarImage
                                        src={profile?.avatar_url || ""}
                                        alt={profile?.full_name || profile?.display_name || "A"}
                                      />
                                      <AvatarFallback className="text-[10px] font-bold text-white bg-primary">
                                        {(profile?.full_name || profile?.display_name || "A")
                                          .slice(0, 2)
                                          .toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  ) : (
                                    <Avatar className="h-7 w-7 shrink-0 mb-1 ring-1 ring-border/40 shadow-sm">
                                      <AvatarImage
                                        src={getContactAvatarUrl(selectedContact)}
                                        alt={selectedContact?.name || ""}
                                      />
                                      <AvatarFallback
                                        className="text-[10px] font-bold text-white"
                                        style={{
                                          backgroundColor: getAvatarColor(
                                            selectedContact?.name ||
                                              selectedContact?.phone_e164 ||
                                              "C",
                                          ),
                                        }}
                                      >
                                        {(
                                          selectedContact?.name ||
                                          selectedContact?.phone_e164 ||
                                          "C"
                                        )
                                          .slice(0, 2)
                                          .toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                  )}

                                  {/* Ações Rápidas em Menu Único */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 rounded-full self-center"
                                        title="Opções"
                                      >
                                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                      align={isOutgoing ? "end" : "start"}
                                      className="w-56 p-1"
                                    >
                                      {/* Reações Rápidas */}
                                      <div className="flex justify-between items-center px-2 py-1.5 border-b mb-1">
                                        {DEFAULT_EMOJIS.map((emoji) => (
                                          <button
                                            key={emoji}
                                            onClick={() =>
                                              handleSendReaction(msg.wa_message_id, emoji)
                                            }
                                            className="hover:bg-muted p-1 rounded text-base transition-transform hover:scale-125"
                                          >
                                            {emoji}
                                          </button>
                                        ))}
                                      </div>

                                      {/* Responder */}
                                      <DropdownMenuItem
                                        onClick={() => setReplyingTo(msg)}
                                        className="flex items-center gap-2 cursor-pointer text-xs"
                                      >
                                        <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>Responder</span>
                                      </DropdownMenuItem>

                                      {/* Etiquetar */}
                                      <DropdownMenuSub>
                                        <DropdownMenuSubTrigger className="flex items-center gap-2 cursor-pointer text-xs">
                                          <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                                          <span>Etiquetar</span>
                                        </DropdownMenuSubTrigger>
                                        <DropdownMenuPortal>
                                          <DropdownMenuSubContent className="p-2 min-w-[200px]">
                                            {renderMessageTagSubmenu(msg)}
                                          </DropdownMenuSubContent>
                                        </DropdownMenuPortal>
                                      </DropdownMenuSub>
                                    </DropdownMenuContent>
                                  </DropdownMenu>

                                  {/* Balão em si */}
                                  <div className="flex flex-col relative">
                                    {(() => {
                                      const { interactive } = getMessageInteractivePayload(
                                        msg.metadata,
                                      );
                                      const metadataMediaUrl =
                                        typeof msg.metadata?.media_url === "string"
                                          ? msg.metadata.media_url
                                          : typeof msg.metadata?.mediaUrl === "string"
                                            ? msg.metadata.mediaUrl
                                            : typeof msg.metadata?.image_url === "string"
                                              ? msg.metadata.image_url
                                              : typeof msg.metadata?.imageUrl === "string"
                                                ? msg.metadata.imageUrl
                                                : typeof msg.metadata?.media_id === "string"
                                                  ? msg.metadata.media_id
                                                  : typeof msg.metadata?.mediaId === "string"
                                                    ? msg.metadata.mediaId
                                                    : "";

                                      // Extract interactive header media
                                      const header =
                                        interactive?.header ||
                                        (typeof msg.metadata?.header === "object"
                                          ? (msg.metadata.header as any)
                                          : null);
                                      let headerMediaUrl = "";
                                      let headerMediaType = "";
                                      let headerText = "";

                                      if (header) {
                                        const hImg =
                                          header.image && typeof header.image === "object"
                                            ? header.image
                                            : null;
                                        const hVid =
                                          header.video && typeof header.video === "object"
                                            ? header.video
                                            : null;
                                        const hDoc =
                                          header.document && typeof header.document === "object"
                                            ? header.document
                                            : null;

                                        if (header.type === "image" || hImg || typeof header.image === "string") {
                                          headerMediaUrl =
                                            hImg?.link ||
                                            hImg?.id ||
                                            hImg?.url ||
                                            (typeof header.image === "string" ? header.image : "");
                                          headerMediaType = "image";
                                        } else if (header.type === "video" || hVid || typeof header.video === "string") {
                                          headerMediaUrl =
                                            hVid?.link ||
                                            hVid?.id ||
                                            hVid?.url ||
                                            (typeof header.video === "string" ? header.video : "");
                                          headerMediaType = "video";
                                        } else if (header.type === "document" || hDoc || typeof header.document === "string") {
                                          headerMediaUrl =
                                            hDoc?.link ||
                                            hDoc?.id ||
                                            hDoc?.url ||
                                            (typeof header.document === "string" ? header.document : "");
                                          headerMediaType = "document";
                                        } else if (header.type === "text" && header.text) {
                                          headerText = header.text;
                                        }
                                      }

                                      if (!headerMediaUrl && metadataMediaUrl) {
                                        headerMediaUrl = metadataMediaUrl;
                                        const lower = metadataMediaUrl.toLowerCase().split(/[?#]/)[0];
                                        if (lower.endsWith(".mp4") || lower.endsWith(".3gp") || lower.endsWith(".mov") || lower.endsWith(".webm")) {
                                          headerMediaType = "video";
                                        } else if (lower.endsWith(".pdf") || lower.endsWith(".doc") || lower.endsWith(".docx") || lower.endsWith(".xls") || lower.endsWith(".xlsx") || lower.endsWith(".ppt") || lower.endsWith(".txt")) {
                                          headerMediaType = "document";
                                        } else {
                                          headerMediaType = "image";
                                        }
                                      }

                                      // Extract standard message body and type
                                      let type = msg.type || "text";
                                      const bodyText = msg.body || "";

                                      if (type === "text") {
                                        if (
                                          msg.audio ||
                                          (msg.metadata as any)?.audio ||
                                          (msg.metadata as any)?.type === "audio" ||
                                          (msg.metadata as any)?.message?.type === "audio" ||
                                          (msg.metadata as any)?.message?.audio ||
                                          (bodyText && /^\d{15,18}$/.test(bodyText.trim()))
                                        ) {
                                          type = "audio";
                                        } else if (
                                          msg.image ||
                                          (msg.metadata as any)?.image ||
                                          (msg.metadata as any)?.type === "image" ||
                                          (msg.metadata as any)?.message?.type === "image" ||
                                          (msg.metadata as any)?.message?.image
                                        ) {
                                          type = "image";
                                        } else if (
                                          msg.video ||
                                          (msg.metadata as any)?.video ||
                                          (msg.metadata as any)?.type === "video" ||
                                          (msg.metadata as any)?.message?.type === "video" ||
                                          (msg.metadata as any)?.message?.video
                                        ) {
                                          type = "video";
                                        } else if (
                                          msg.document ||
                                          (msg.metadata as any)?.document ||
                                          (msg.metadata as any)?.type === "document" ||
                                          (msg.metadata as any)?.message?.type === "document" ||
                                          (msg.metadata as any)?.message?.document
                                        ) {
                                          type = "document";
                                        } else if (
                                          msg.sticker ||
                                          (msg.metadata as any)?.sticker ||
                                          (msg.metadata as any)?.type === "sticker" ||
                                          (msg.metadata as any)?.message?.type === "sticker" ||
                                          (msg.metadata as any)?.message?.sticker
                                        ) {
                                          type = "sticker";
                                        }
                                      }

                                      // Helper to check if string is a URL
                                      const isUrl = (str: string) => {
                                        if (!str) return false;
                                        return (
                                          str.startsWith("http://") ||
                                          str.startsWith("https://") ||
                                          str.startsWith("/") ||
                                          str.startsWith("blob:") ||
                                          str.startsWith("data:")
                                        );
                                      };

                                      // Format WhatsApp bold, italic, strikethrough in bodyText
                                      const formatMessageText = (text: string) => {
                                        if (!text) return "";
                                        let formatted = text;

                                        // Escape HTML characters to prevent XSS before formatting
                                        formatted = formatted
                                          .replace(/&/g, "&amp;")
                                          .replace(/</g, "&lt;")
                                          .replace(/>/g, "&gt;");

                                        // Highlight message search query if active
                                        if (messageSearchQuery.trim()) {
                                          const escapedQuery = messageSearchQuery.replace(
                                            /[-/\\^$*+?.()|[\]{}]/g,
                                            "\\$&",
                                          );
                                          const regex = new RegExp(`(${escapedQuery})`, "gi");
                                          formatted = formatted.replace(
                                            regex,
                                            "<mark class='bg-yellow-500/40 text-yellow-100 px-0.5 rounded'>$1</mark>",
                                          );
                                        }

                                        // Bold
                                        formatted = formatted.replace(
                                          /\*\*([^*]+)\*\*/g,
                                          "<strong>$1</strong>",
                                        );
                                        formatted = formatted.replace(
                                          /\*([^*]+)\*/g,
                                          "<strong>$1</strong>",
                                        );
                                        // Italic
                                        formatted = formatted.replace(
                                          /__([^_]+)__/g,
                                          "<em>$1</em>",
                                        );
                                        formatted = formatted.replace(/_([^_]+)_/g, "<em>$1</em>");
                                        // Strikethrough
                                        formatted = formatted.replace(
                                          /~~([^~]+)~~/g,
                                          "<del>$1</del>",
                                        );
                                        formatted = formatted.replace(
                                          /~([^~]+)~/g,
                                          "<del>$1</del>",
                                        );
                                        // Code
                                        formatted = formatted.replace(
                                          /`([^`]+)`/g,
                                          "<code class='bg-black/25 px-1 py-0.5 rounded font-mono text-[11px]'>$1</code>",
                                        );
                                        return (
                                          <span dangerouslySetInnerHTML={{ __html: formatted }} />
                                        );
                                      };

                                      // Helper to get media source URL
                                      const getMediaUrl = (urlOrId: string) => {
                                        if (!urlOrId) return "";
                                        if (isUrl(urlOrId)) return urlOrId;
                                        const token =
                                          sessionToken ||
                                          (typeof window !== "undefined"
                                            ? localStorage.getItem("app-token") ||
                                              localStorage.getItem("sb-token") ||
                                              ""
                                            : "");
                                        return token
                                          ? `/api/whatsapp/media?id=${encodeURIComponent(urlOrId)}&token=${encodeURIComponent(token)}`
                                          : `/api/whatsapp/media?id=${encodeURIComponent(urlOrId)}`;
                                      };

                                      const hasTopMedia =
                                        headerMediaType === "image" ||
                                        headerMediaType === "video" ||
                                        type === "image" ||
                                        type === "video";
                                      const hasBottomActions =
                                        (interactive?.type === "button" &&
                                          interactive.action?.buttons) ||
                                        interactive?.type === "list" ||
                                        interactive?.type === "flow" ||
                                        interactive?.type === "cta_url";
                                      const isRichCard = hasTopMedia || hasBottomActions;

                                      return (
                                        <div
                                          className={cn(
                                            "relative min-w-[7rem] max-w-full transition-all duration-200",
                                            isOutgoing
                                              ? "wa-bubble-outgoing"
                                              : "wa-bubble-incoming",
                                            isRichCard
                                              ? "p-0 rounded-xl"
                                              : "px-3.5 py-2.5 flex flex-col gap-1",
                                          )}
                                        >
                                          {/* Nome do Remetente */}
                                          <div
                                            className={cn(
                                              "text-[10px] font-semibold text-muted-foreground select-none",
                                              isRichCard ? "px-3 pt-2" : "",
                                            )}
                                          >
                                            {isOutgoing ? agentLabel : senderName}
                                          </div>

                                          {/* Display applied tags in message body */}
                                          {(() => {
                                            const msgTags = (
                                              (messageTagsQuery.data ?? []) as MessageTagRecord[]
                                            ).filter(
                                              (messageTag) => messageTag.message_id === msg.id,
                                            );
                                            if (msgTags.length === 0) return null;
                                            return (
                                              <div
                                                className={cn(
                                                  "flex flex-wrap gap-1 mb-1",
                                                  isRichCard ? "px-3 pt-1" : "",
                                                )}
                                              >
                                                {msgTags.map((mt) => (
                                                  <TagBadge
                                                    key={mt.tag_id}
                                                    tag={mt.tags}
                                                    className={cn(
                                                      "shadow-sm",
                                                      isOutgoing
                                                        ? "border-primary-foreground/30 text-white"
                                                        : "",
                                                    )}
                                                  />
                                                ))}
                                              </div>
                                            );
                                          })()}

                                          {/* Quote reply block inside bubble */}
                                          {replyMessage && (
                                            <div
                                              className={cn(
                                                "px-3 pt-1",
                                                isRichCard ? "" : "pb-0.5",
                                              )}
                                            >
                                              <button
                                                onClick={() => scrollToMessage(replyMessage.id)}
                                                className={cn(
                                                  "w-full text-left text-xs p-2 rounded-md border-l-4 transition-all hover:opacity-100 block",
                                                  isOutgoing
                                                    ? "wa-quote-reply-outgoing"
                                                    : "wa-quote-reply-incoming",
                                                )}
                                              >
                                                <div className="font-bold mb-0.5 text-emerald-400 text-[11px]">
                                                  {replyMessage.direction === "incoming"
                                                    ? "Contato"
                                                    : "Você"}
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
                                              <div className="w-full overflow-hidden bg-black/10 rounded-t-xl">
                                                <img
                                                  src={getMediaUrl(headerMediaUrl)}
                                                  alt="Header"
                                                  className="w-full max-h-64 object-cover"
                                                />
                                              </div>
                                            )}
                                            {headerMediaType === "video" && headerMediaUrl && (
                                              <div className="w-full overflow-hidden bg-black/10 rounded-t-xl">
                                                <video
                                                  src={getMediaUrl(headerMediaUrl)}
                                                  controls
                                                  className="w-full max-h-64 object-cover"
                                                />
                                              </div>
                                            )}
                                            {headerMediaType === "document" && headerMediaUrl && (
                                              <div className="mx-3 mt-3 rounded-lg border border-muted-foreground/10 bg-black/10 p-2 flex items-center gap-2 text-xs">
                                                <FileText className="h-6 w-6 text-primary shrink-0" />
                                                <span className="truncate font-medium flex-1">
                                                  {header?.document?.filename ||
                                                    "Documento de Cabeçalho"}
                                                </span>
                                                <Button
                                                  size="icon"
                                                  variant="ghost"
                                                  className="h-6 w-6 shrink-0 ml-auto rounded-full"
                                                  asChild
                                                >
                                                  <a
                                                    href={getMediaUrl(headerMediaUrl)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                  >
                                                    <ExternalLink className="h-3 w-3" />
                                                  </a>
                                                </Button>
                                              </div>
                                            )}

                                            {/* B. Render Standard Media Types */}
                                            {type === "image" && (
                                              <div
                                                className={cn(
                                                  "w-full overflow-hidden bg-black/10",
                                                  isOutgoing
                                                    ? "rounded-lg rounded-tr-none"
                                                    : "rounded-lg rounded-tl-none",
                                                )}
                                              >
                                                {getMediaUrl(msg.image?.link || msg.image?.id || (isUrl(bodyText) ? bodyText : "")) ? (
                                                  <img
                                                    src={getMediaUrl(msg.image?.link || msg.image?.id || (isUrl(bodyText) ? bodyText : ""))}
                                                    alt="Imagem"
                                                    className="w-full max-h-64 object-cover"
                                                  />
                                                ) : (
                                                  <div className="aspect-video w-full bg-muted flex items-center justify-center">
                                                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                                                  </div>
                                                )}
                                              </div>
                                            )}

                                            {type === "audio" && (
                                              <div className="px-1 py-1.5">
                                                <audio
                                                  src={getMediaUrl(msg.audio?.link || msg.audio?.id || (isUrl(bodyText) ? bodyText : ""))}
                                                  controls
                                                  preload="metadata"
                                                  className="w-[240px] max-w-full h-10"
                                                />
                                              </div>
                                            )}

                                            {type === "video" && (
                                              <div
                                                className={cn(
                                                  "w-full overflow-hidden bg-black/10",
                                                  isOutgoing
                                                    ? "rounded-lg rounded-tr-none"
                                                    : "rounded-lg rounded-tl-none",
                                                )}
                                              >
                                                {getMediaUrl(msg.video?.link || msg.video?.id || (isUrl(bodyText) ? bodyText : "")) ? (
                                                  <video
                                                    src={getMediaUrl(msg.video?.link || msg.video?.id || (isUrl(bodyText) ? bodyText : ""))}
                                                    controls
                                                    className="w-full max-h-64 object-cover"
                                                  />
                                                ) : (
                                                  <div className="aspect-video w-full bg-muted flex items-center justify-center">
                                                    <Video className="h-6 w-6 text-muted-foreground" />
                                                  </div>
                                                )}
                                              </div>
                                            )}

                                            {type === "document" && (
                                              <div className="mx-3 mt-3 rounded-lg border border-muted-foreground/15 bg-black/10 p-3 flex items-center gap-3">
                                                <FileText className="h-8 w-8 text-primary shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                  <p className="text-xs font-medium truncate text-foreground">
                                                    {msg.document?.filename ||
                                                      (isUrl(bodyText)
                                                        ? bodyText.substring(bodyText.lastIndexOf("/") + 1)
                                                        : (bodyText && !["[Documento]"].includes(bodyText) ? bodyText : "Documento"))}
                                                  </p>
                                                  <p className="text-[10px] opacity-75">
                                                    Documento PDF/Office
                                                  </p>
                                                </div>
                                                {getMediaUrl(msg.document?.link || msg.document?.id || (isUrl(bodyText) ? bodyText : "")) && (
                                                  <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    asChild
                                                    className="h-8 w-8 shrink-0 rounded-full"
                                                  >
                                                    <a
                                                      href={getMediaUrl(msg.document?.link || msg.document?.id || (isUrl(bodyText) ? bodyText : ""))}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                    >
                                                      <ExternalLink className="h-4 w-4" />
                                                    </a>
                                                  </Button>
                                                )}
                                              </div>
                                            )}

                                            {type === "sticker" && (
                                              <div className="p-1">
                                                {getMediaUrl(msg.sticker?.link || msg.sticker?.id || (isUrl(bodyText) ? bodyText : "")) ? (
                                                  <img
                                                    src={getMediaUrl(msg.sticker?.link || msg.sticker?.id || (isUrl(bodyText) ? bodyText : ""))}
                                                    alt="Sticker"
                                                    className="h-24 w-24 object-contain"
                                                  />
                                                ) : (
                                                  <span className="text-xs text-muted-foreground font-mono">
                                                    Sticker
                                                  </span>
                                                )}
                                              </div>
                                            )}

                                            {type === "location" && msg.location && (
                                              <div className="mx-3 mt-3 rounded-lg border border-muted-foreground/15 bg-black/10 p-3 space-y-2">
                                                <div className="flex items-start gap-2.5">
                                                  <MapPin className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                                                  <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-foreground">
                                                      {msg.location.name || "Localização"}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground leading-normal">
                                                      {msg.location.address ||
                                                        `${msg.location.latitude}, ${msg.location.longitude}`}
                                                    </p>
                                                  </div>
                                                </div>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  className="w-full text-xs h-7 gap-1"
                                                  asChild
                                                >
                                                  <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${msg.location.latitude},${msg.location.longitude}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                  >
                                                    <ExternalLink className="h-3 w-3" /> Ver no
                                                    Google Maps
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
                                                    <p className="text-xs font-semibold truncate">
                                                      {msg.contacts[0]?.name?.formatted_name ||
                                                        "Contato"}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground font-mono truncate">
                                                      {msg.contacts[0]?.phones?.[0]?.phone ||
                                                        "Sem telefone"}
                                                    </p>
                                                  </div>
                                                </div>
                                                {msg.contacts[0]?.phones?.[0]?.phone && (
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="w-full text-xs h-7 gap-1"
                                                    asChild
                                                  >
                                                    <a
                                                      href={`tel:${msg.contacts[0].phones[0].phone}`}
                                                    >
                                                      <Phone className="h-3 w-3" /> Ligar para
                                                      Contato
                                                    </a>
                                                  </Button>
                                                )}
                                              </div>
                                            )}

                                            {/* Text block for header text, body/captions, and footer */}
                                            {(((bodyText &&
                                              !["[Imagem]", "[Vídeo]", "[Documento]", "[Áudio]", "[Figurinha]"].includes(bodyText) &&
                                              !["audio", "sticker", "location", "contacts"].includes(type)) ||
                                              headerText ||
                                              interactive?.footer?.text) && (
                                              <div
                                                className={cn(
                                                  "py-2 space-y-1",
                                                  isRichCard && "px-3",
                                                )}
                                              >
                                                {headerText && (
                                                  <p className="text-[11px] font-bold uppercase tracking-wider opacity-85">
                                                    {headerText}
                                                  </p>
                                                )}
                                                {bodyText &&
                                                  !["[Imagem]", "[Vídeo]", "[Documento]", "[Áudio]", "[Figurinha]"].includes(bodyText) &&
                                                  !["audio", "sticker", "location", "contacts"].includes(type) && (
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
                                            ))}

                                            {/* E. Render Buttons / Actions (WhatsApp Web Style) */}
                                            {interactive?.type === "button" &&
                                              interactive.action?.buttons && (
                                                <div className="flex flex-col gap-1.5 w-full px-2.5 pb-2.5 pt-2 border-t border-border/40">
                                                  {interactive.action.buttons.map(
                                                    (
                                                      btn: InteractiveButtonRecord,
                                                      btnIdx: number,
                                                    ) => {
                                                      const isLast =
                                                        btnIdx ===
                                                        (interactive.action?.buttons?.length ?? 0) -
                                                          1;
                                                      return (
                                                        <div
                                                          key={btnIdx}
                                                          className={cn(
                                                            "w-full rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary text-center flex items-center justify-center gap-1.5 select-none",
                                                            isLast && "mb-0",
                                                          )}
                                                        >
                                                          <MessageSquare className="h-3.5 w-3.5 opacity-60" />
                                                          {btn.reply?.title || "Botão"}
                                                        </div>
                                                      );
                                                    },
                                                  )}
                                                </div>
                                              )}

                                            {/* F. Render List selection action */}
                                            {interactive?.type === "list" && (
                                              <div className="space-y-2 px-2.5 pb-2.5 pt-2 border-t border-border/40">
                                                {(interactive.action?.sections ?? []).map(
                                                  (section, sectionIndex) => (
                                                    <div key={sectionIndex} className="space-y-1">
                                                      {section.title && (
                                                        <p className="px-1 text-[10px] font-semibold text-muted-foreground">
                                                          {section.title}
                                                        </p>
                                                      )}
                                                      {(section.rows ?? []).map((row, rowIndex) => (
                                                        <div
                                                          key={rowIndex}
                                                          className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-2 text-left"
                                                        >
                                                          <p className="text-xs font-bold leading-tight">
                                                            {row.title || `Opção ${rowIndex + 1}`}
                                                          </p>
                                                          {row.description && (
                                                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                                                              {row.description}
                                                            </p>
                                                          )}
                                                        </div>
                                                      ))}
                                                    </div>
                                                  ),
                                                )}
                                                {!interactive.action?.sections?.length && (
                                                  <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 py-2 text-center text-xs font-semibold text-emerald-500">
                                                    <Menu className="mr-1.5 inline h-3.5 w-3.5" />
                                                    {interactive.action?.button || "Ver Recursos"}
                                                  </div>
                                                )}
                                              </div>
                                            )}

                                            {/* G. Render URL CTA */}
                                            {interactive?.type === "cta_url" && (
                                              <div className="px-2.5 pb-2.5 pt-2 border-t border-border/40">
                                                <a
                                                  href={interactive.action?.parameters?.url || "#"}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-500 hover:bg-blue-500/20"
                                                >
                                                  <LinkIcon className="h-3.5 w-3.5" />
                                                  {interactive.action?.parameters?.display_text ||
                                                    "Acessar Link"}
                                                </a>
                                              </div>
                                            )}

                                            {/* H. Render Flow CTA action */}
                                            {interactive?.type === "flow" && (
                                              <div className="flex flex-col w-full mt-1.5">
                                                <div
                                                  className={cn(
                                                    "w-full py-2.5 text-xs text-center flex items-center justify-center gap-1.5 select-none",
                                                    isOutgoing
                                                      ? "wa-card-button-outgoing wa-button-separator-outgoing rounded-b-lg rounded-br-none"
                                                      : "wa-card-button-incoming wa-button-separator-incoming rounded-b-lg rounded-bl-none",
                                                  )}
                                                >
                                                  <ClipboardList className="h-3.5 w-3.5 opacity-80" />
                                                  {interactive.action?.parameters?.flow_cta ||
                                                    "Preencher Formulário"}
                                                </div>
                                              </div>
                                            )}
                                          </div>

                                          {/* Horário + Status */}
                                          <div
                                            className={cn(
                                              "flex items-center justify-end gap-1 text-[10px] wa-timestamp pb-0.5 pt-0.5 self-end",
                                              isRichCard && "pb-1.5 pr-2.5",
                                            )}
                                          >
                                            <span>
                                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                              })}
                                            </span>
                                            {isOutgoing && renderStatus(msg.status ?? "")}
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
                                        {msg.reactions.map((rx, idx: number) => (
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
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    );
                  })()}
                  <div ref={messagesEndRef} />
                </div>

                {/* Caixa de Texto de Envio */}
                <div className="bg-transparent flex flex-col px-6 pb-6 pt-2">
                  <div className="bg-background border border-border/80 rounded-2xl shadow-md overflow-hidden flex flex-col">
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

                    {/* Área do Input */}
                    <div className="p-2.5">
                      {isRecording ? (
                        <div className="flex items-center justify-between p-1.5 pr-2 pl-3">
                          <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                            <span className="h-2 w-2 rounded-full bg-destructive animate-ping shrink-0" />
                            <span>Gravando: {formatTime(recordingSeconds)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              title="Cancelar gravação"
                              onClick={handleCancelRecording}
                              className="h-9 w-9 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive shrink-0"
                            >
                              <Trash2 className="h-5 w-5" />
                            </Button>
                            <Button
                              type="button"
                              onClick={handleStopRecording}
                              className="h-10 px-4 rounded-xl bg-[#ff3366] hover:bg-[#e02453] text-white font-medium flex items-center gap-2 shadow-sm shrink-0"
                            >
                              <span>Enviar Áudio</span>
                              <Send className="h-4 w-4 text-white shrink-0" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-1.5 pr-2 pl-3">
                          {/* Textarea */}
                          <div className="flex-1">
                            <Label className="sr-only">Mensagem</Label>
                            <Textarea
                              placeholder="Escreva sua mensagem aqui"
                              className="min-h-[36px] max-h-[120px] py-1 px-0 resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-sm shadow-none font-sans"
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

                          {/* Input de arquivo oculto para upload de mídia */}
                          <input
                            ref={mediaInputRef}
                            type="file"
                            className="hidden"
                            onChange={handleFileChange}
                          />

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                title="Anexar mídia"
                                className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted shrink-0"
                              >
                                <Paperclip className="h-5 w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 bg-card border border-border"
                            >
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer text-xs"
                                onClick={() => handleMediaAttachClick("image")}
                              >
                                <ImageIcon className="h-4 w-4 text-blue-500" />
                                <span>Imagem</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer text-xs"
                                onClick={() => handleMediaAttachClick("video")}
                              >
                                <Video className="h-4 w-4 text-rose-500" />
                                <span>Vídeo</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer text-xs"
                                onClick={() => handleMediaAttachClick("audio")}
                              >
                                <Volume2 className="h-4 w-4 text-emerald-500" />
                                <span>Áudio</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer text-xs"
                                onClick={() => handleMediaAttachClick("document")}
                              >
                                <FileText className="h-4 w-4 text-amber-500" />
                                <span>Documento</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 cursor-pointer text-xs"
                                onClick={() => handleMediaAttachClick("sticker")}
                              >
                                <Smile className="h-4 w-4 text-indigo-500" />
                                <span>Figurinha</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title={
                              previewUrl ? "Preview de link ATIVADO" : "Habilitar preview de link"
                            }
                            onClick={() => setPreviewUrl(!previewUrl)}
                            className={cn(
                              "h-9 w-9 rounded-full text-muted-foreground hover:bg-muted shrink-0",
                              previewUrl && "text-primary bg-primary/10",
                            )}
                          >
                            <LinkIcon className="h-5 w-5" />
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            title="Gravar áudio"
                            onClick={handleStartRecording}
                            className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted shrink-0"
                          >
                            <Mic className="h-5 w-5" />
                          </Button>

                          <Button
                            disabled={!typedMessage.trim() || sendMutation.isPending}
                            onClick={handleSendText}
                            className="h-10 px-4 rounded-xl bg-[#ff3366] hover:bg-[#e02453] active:scale-95 transition-all text-white font-medium flex items-center gap-2 shadow-sm shrink-0"
                          >
                            {sendMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin text-white" />
                            ) : (
                              <>
                                <span>Enviar</span>
                                <Send className="h-4 w-4 text-white shrink-0" />
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 gap-4 bg-muted/5">
                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center shadow-inner">
                  <MessageCircle className="h-8 w-8 text-muted-foreground/60" />
                </div>
                <div className="text-center max-w-sm space-y-1">
                  <p className="font-semibold text-foreground">Bliv Chat Direto</p>
                  <p className="text-xs">
                    Selecione um contato na lista à esquerda para carregar o histórico de conversas
                    diretas e enviar novas mensagens.
                  </p>
                </div>
              </div>
            )}
          </div>

          {selectedContact && (
            <div
              className={cn(
                "h-full border-l bg-card flex flex-col transition-all duration-300 ease-in-out overflow-hidden shrink-0",
                "absolute md:relative right-0 top-0 z-20 shadow-xl md:shadow-none",
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
                        {selectedContact.opted_out === true && (
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
                        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> Atribuição
                        de Atendimento
                      </p>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full h-9 justify-between text-xs bg-muted/20 hover:bg-muted/40"
                          >
                            <span className="truncate">
                              {selectedContact?.active_team_name ||
                              selectedContact?.active_agent_name
                                ? `${selectedContact.active_team_name ? `Equipe: ${selectedContact.active_team_name}` : ""} ${selectedContact.active_agent_name ? `(${selectedContact.active_agent_name})` : ""}`
                                : "Sem atribuição"}
                            </span>
                            <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          className="w-[240px] max-h-[350px] overflow-y-auto"
                          align="end"
                        >
                          <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground">
                            Ações rápidas
                          </DropdownMenuLabel>
                          <DropdownMenuItem
                            className="text-xs cursor-pointer gap-2"
                            onClick={() => {
                              const targetTeam =
                                selectedTeamId ||
                                selectedContact?.active_team_id ||
                                (teamsQuery.data?.[0]?.id ?? "");
                              if (!targetTeam) {
                                toast.error("Por favor, selecione uma equipe primeiro.");
                                return;
                              }
                              selfAssignMutation.mutate({ teamId: targetTeam });
                            }}
                            disabled={
                              selfAssignMutation.isPending ||
                              (!selectedTeamId &&
                                !selectedContact?.active_team_id &&
                                !(teamsQuery.data?.[0]?.id ?? ""))
                            }
                          >
                            <UserCheck className="h-3.5 w-3.5" />
                            Atribuir a mim
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            className="text-xs cursor-pointer gap-2"
                            onClick={() => {
                              const targetTeam =
                                selectedTeamId ||
                                selectedContact?.active_team_id ||
                                teamsQuery.data?.[0]?.id;
                              if (targetTeam) {
                                autoAssignMutation.mutate(targetTeam);
                              } else {
                                toast.error("Por favor, selecione uma equipe primeiro.");
                              }
                            }}
                            disabled={autoAssignMutation.isPending}
                          >
                            <Activity className="h-3.5 w-3.5" />
                            Auto-atribuir
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground">
                            Remover Atribuição
                          </DropdownMenuLabel>
                          <DropdownMenuItem
                            className="text-xs cursor-pointer text-destructive hover:text-destructive gap-2"
                            onClick={() =>
                              assignMutation.mutate({
                                teamId: null,
                                agentId: null,
                              })
                            }
                            disabled={assignMutation.isPending}
                          >
                            <X className="h-3.5 w-3.5" />
                            Limpar atribuição
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground">
                            Selecionar Equipe
                          </DropdownMenuLabel>
                          {teams.map((t) => {
                            const isCurrentTeam =
                              selectedContact?.active_team_id === t.id || selectedTeamId === t.id;
                            return (
                              <DropdownMenuItem
                                key={t.id}
                                className={cn(
                                  "text-xs cursor-pointer justify-between",
                                  isCurrentTeam && "bg-accent font-medium",
                                )}
                                onClick={() => {
                                  setSelectedTeamId(t.id);
                                  assignMutation.mutate({
                                    teamId: t.id,
                                    agentId: null,
                                  });
                                }}
                              >
                                <span>{t.name}</span>
                                {isCurrentTeam && <Check className="h-3.5 w-3.5 text-primary" />}
                              </DropdownMenuItem>
                            );
                          })}

                          <DropdownMenuSeparator />

                          <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground">
                            Selecionar Agente
                          </DropdownMenuLabel>
                          {(selectedTeamId || selectedContact?.active_team_id
                            ? teamMembers
                            : agents
                          ).map((a: TeamMemberOption | AgentOption) => {
                            const agentId = "user_id" in a ? a.user_id : a.id;
                            const isCurrentAgent = selectedContact?.active_agent_id === agentId;
                            return (
                              <DropdownMenuItem
                                key={agentId}
                                className={cn(
                                  "text-xs cursor-pointer justify-between",
                                  isCurrentAgent && "bg-accent font-medium",
                                )}
                                onClick={() =>
                                  assignMutation.mutate({
                                    teamId:
                                      selectedTeamId || selectedContact?.active_team_id || null,
                                    agentId: agentId,
                                  })
                                }
                              >
                                <span className="truncate">
                                  {a.full_name || a.display_name || a.email}
                                </span>
                                {isCurrentAgent && <Check className="h-3.5 w-3.5 text-primary" />}
                              </DropdownMenuItem>
                            );
                          })}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
          {/* Diálogos Rápidos de Ações */}
          <Sheet
            open={!!quickSaveContactData}
            onOpenChange={(open) => !open && setQuickSaveContactData(null)}
          >
            <SheetContent className="w-full sm:max-w-md bg-card border-l border-muted-foreground/15 p-6 flex flex-col h-full gap-0 overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle>Editar Contato Rápido</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 py-2 flex-1">
                <div className="space-y-1">
                  <Label htmlFor="qs-name">Nome</Label>
                  <Input
                    id="qs-name"
                    placeholder="Nome do contato"
                    value={quickSaveName}
                    onChange={(e) => setQuickSaveName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="qs-email">E-mail</Label>
                  <Input
                    id="qs-email"
                    type="email"
                    placeholder="email@exemplo.com"
                    value={quickSaveEmail}
                    onChange={(e) => setQuickSaveEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="qs-phone">Telefone</Label>
                  <Input
                    id="qs-phone"
                    placeholder="Ex: 5511999999999"
                    value={quickSavePhone}
                    onChange={(e) => setQuickSavePhone(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t mt-auto">
                <Button variant="outline" onClick={() => setQuickSaveContactData(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!quickSaveName.trim()) {
                      toast.error("O nome é obrigatório");
                      return;
                    }
                    if (!quickSavePhone.trim()) {
                      toast.error("O telefone é obrigatório");
                      return;
                    }
                    if (!quickSaveContactData) return;
                    quickSaveMutation.mutate({
                      contactId: quickSaveContactData.id,
                      name: quickSaveName,
                      email: quickSaveEmail,
                      phone: quickSavePhone,
                    });
                  }}
                  disabled={quickSaveMutation.isPending}
                >
                  {quickSaveMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <Sheet
            open={!!assigningContactData}
            onOpenChange={(open) => !open && setAssigningContactData(null)}
          >
            <SheetContent className="w-full sm:max-w-md bg-card border-l border-muted-foreground/15 p-6 flex flex-col h-full gap-0 overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle>Atribuir Conversa</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 py-2 flex-1">
                <div className="space-y-1">
                  <Label>Equipe / Setor</Label>
                  <Select
                    value={assignDialogTeamId || "none"}
                    onValueChange={(val) => {
                      setAssignDialogTeamId(val);
                      setAssignDialogAgentId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sem equipe (Não atribuído)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem equipe (Não atribuído)</SelectItem>
                      {(teamsQuery.data ?? []).map((t: TeamOption) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Agente / Atendente</Label>
                  <Select
                    value={assignDialogAgentId || "none"}
                    onValueChange={setAssignDialogAgentId}
                    disabled={!assignDialogTeamId || assignDialogTeamId === "none"}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sem agente (Fila da equipe)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem agente (Fila da equipe)</SelectItem>
                      {(assignDialogTeamMembersQuery.data ?? []).map((m: TeamMemberOption) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name || m.display_name || m.email || m.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Ações Rápidas de Atribuição */}
                {assignDialogTeamId && assignDialogTeamId !== "none" && (
                  <div className="flex gap-2 pt-2">
                    {(assignDialogTeamMembersQuery.data ?? []).some(
                      (m: TeamMemberOption) => m.user_id === profile?.id,
                    ) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        type="button"
                        onClick={() => {
                          const contactPhone = assigningContactData?.phone_e164 ?? undefined;
                          if (!contactPhone) {
                            toast.error("Este contato não possui telefone válido para atribuição.");
                            return;
                          }
                          selfAssignMutation.mutate(
                            {
                              teamId: assignDialogTeamId,
                              contactPhone,
                            },
                            {
                              onSuccess: () => setAssigningContactData(null),
                            },
                          );
                        }}
                        disabled={selfAssignMutation.isPending}
                        className="flex-1 text-xs"
                      >
                        {selfAssignMutation.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                        ) : (
                          <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Atribuir a mim
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      onClick={() => {
                        const contactPhone = assigningContactData?.phone_e164 ?? undefined;
                        if (!contactPhone) {
                          toast.error("Este contato não possui telefone válido para atribuição.");
                          return;
                        }
                        autoAssignMutation.mutate(
                          {
                            teamId: assignDialogTeamId,
                            contactPhone,
                          },
                          {
                            onSuccess: () => setAssigningContactData(null),
                          },
                        );
                      }}
                      disabled={autoAssignMutation.isPending}
                      className="flex-1 text-xs"
                    >
                      {autoAssignMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Auto-atribuir
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t mt-auto">
                <Button variant="outline" onClick={() => setAssigningContactData(null)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    const targetTeamId =
                      assignDialogTeamId === "none" || !assignDialogTeamId
                        ? null
                        : assignDialogTeamId;
                    const targetAgentId =
                      assignDialogAgentId === "none" || !assignDialogAgentId
                        ? null
                        : assignDialogAgentId;
                    const contactPhone = assigningContactData?.phone_e164 ?? undefined;
                    if (!contactPhone) {
                      toast.error("Este contato não possui telefone válido para atribuição.");
                      return;
                    }
                    assignMutation.mutate(
                      {
                        teamId: targetTeamId,
                        agentId: targetAgentId,
                        contactPhone,
                      },
                      {
                        onSuccess: () => setAssigningContactData(null),
                      },
                    );
                  }}
                  disabled={assignMutation.isPending}
                >
                  {assignMutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Diálogo de Oportunidade Rápida */}
          {/* Drawer de Oportunidade Rápida */}
          <Sheet open={isQuickOpportunityOpen} onOpenChange={setIsQuickOpportunityOpen}>
            <SheetContent className="w-full sm:max-w-2xl bg-card border-l border-muted-foreground/15 p-6 flex flex-col h-full gap-0 overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle>Criar Oportunidade Rápida</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 py-2 flex-1">
                <div className="grid grid-cols-10 gap-4">
                  <div className="space-y-1 col-span-7">
                    <Label>Título da Oportunidade</Label>
                    <Input
                      placeholder="Ex: Contrato de Licença"
                      value={oppTitle}
                      onChange={(e) => setOppTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 col-span-3">
                    <Label>Valor (R$)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={oppValue}
                      onChange={(e) => setOppValue(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1 min-w-0">
                    <Label className="truncate block">Origem</Label>
                    <Select value={oppSource} onValueChange={setOppSource}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Origem" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">WhatsApp Direto</SelectItem>
                        <SelectItem value="site">Site / Orgânico</SelectItem>
                        <SelectItem value="indicacao">Indicação</SelectItem>
                        <SelectItem value="outros">Outros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <Label className="truncate block">Funil de Vendas</Label>
                    <Select
                      value={oppFunnelId}
                      onValueChange={(val) => {
                        setOppFunnelId(val);
                        const stages = salesStages.filter((stage) => stage.funnel_id === val);
                        if (stages && stages.length > 0) {
                          setOppStageId(stages[0].id);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Funil" />
                      </SelectTrigger>
                      <SelectContent>
                        {salesFunnels.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <Label className="truncate block">Etapa do Funil</Label>
                    <Select value={oppStageId} onValueChange={setOppStageId} disabled={!oppFunnelId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Etapa" />
                      </SelectTrigger>
                      <SelectContent>
                        {salesStages
                          .filter((s) => s.funnel_id === oppFunnelId)
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Adicionar Nova Nota</Label>
                  <Textarea
                    placeholder="Adicione observações importantes sobre esta oportunidade..."
                    value={oppNote}
                    onChange={(e) => setOppNote(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t mt-auto">
                <Button variant="outline" onClick={() => setIsQuickOpportunityOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!oppTitle.trim()) {
                      toast.error("O título da oportunidade é obrigatório");
                      return;
                    }
                    if (!oppFunnelId || !oppStageId) {
                      toast.error("Selecione o funil e a etapa");
                      return;
                    }
                    if (!selectedContact?.id) {
                      toast.error("Nenhum contato selecionado");
                      return;
                    }
                    createOpportunityMutation.mutate({
                      title: oppTitle.trim(),
                      value: oppValue,
                      funnel_id: oppFunnelId,
                      stage_id: oppStageId,
                      primary_contact_id: selectedContact.id,
                      source: oppSource,
                      temperature: "warm",
                    });
                  }}
                  disabled={createOpportunityMutation.isPending}
                >
                  {createOpportunityMutation.isPending ? "Criando..." : "Criar Oportunidade"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Drawer de Agendar Follow-up */}
          <Sheet open={isFollowUpOpen} onOpenChange={setIsFollowUpOpen}>
            <SheetContent className="w-full sm:max-w-md bg-card border-l border-muted-foreground/15 p-6 flex flex-col h-full gap-0 overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle>Agendar Novo Follow-up</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 py-2 flex-1">
                <div className="space-y-1">
                  <Label>Título do Compromisso</Label>
                  <Input
                    placeholder="Ex: Ligar para confirmar proposta"
                    value={followUpTitle}
                    onChange={(e) => setFollowUpTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Data e Hora Limite</Label>
                  <Input
                    type="datetime-local"
                    value={followUpDate}
                    onChange={(e) => setFollowUpDate(e.target.value)}
                    className="block w-full px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Descrição / Notas</Label>
                  <Textarea
                    placeholder="Insira detalhes da ação do follow-up..."
                    value={followUpDesc}
                    onChange={(e) => setFollowUpDesc(e.target.value)}
                    className="resize-none h-20"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t mt-auto">
                <Button variant="outline" onClick={() => setIsFollowUpOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!followUpTitle.trim()) {
                      toast.error("O título do follow-up é obrigatório");
                      return;
                    }
                    if (!followUpDate) {
                      toast.error("A data limite é obrigatória");
                      return;
                    }
                    followUpMutation.mutate({
                      title: followUpTitle.trim(),
                      description: followUpDesc.trim(),
                      due_at: followUpDate,
                    });
                  }}
                  disabled={followUpMutation.isPending}
                >
                  {followUpMutation.isPending ? "Agendando..." : "Agendar"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Drawer de Histórico do Lead */}
          <Sheet open={isLeadHistoryOpen} onOpenChange={setIsLeadHistoryOpen}>
            <SheetContent className="w-full sm:max-w-md bg-card border-l border-muted-foreground/15 p-6 flex flex-col h-full gap-0 overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle>Histórico de Atividades do Lead</SheetTitle>
              </SheetHeader>

              <div className="flex-1 overflow-y-auto pr-1 py-2 space-y-4">
                {leadHistoryQuery.isLoading ? (
                  <div className="py-8 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span>Carregando histórico do lead...</span>
                  </div>
                ) : (leadHistoryQuery.data ?? []).length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-xs italic">
                    Nenhuma atividade registrada para este contato no CRM.
                  </div>
                ) : (
                  <div className="relative border-l border-border ml-3 pl-5 space-y-5">
                    {(leadHistoryQuery.data ?? []).map((item: LeadTimelineItem) => {
                      const itemDate = new Date(item.date);
                      return (
                        <div key={item.id} className="relative group">
                          {/* Dot indicator */}
                          <span
                            className={cn(
                              "absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border border-background flex items-center justify-center text-[8px] font-bold text-white shadow-sm select-none",
                              item.type === "activity"
                                ? item.status === "done"
                                  ? "bg-emerald-500"
                                  : "bg-amber-500"
                                : "bg-indigo-500",
                            )}
                          >
                            {item.type === "activity" ? "A" : "U"}
                          </span>

                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-semibold text-sm text-foreground">
                                {item.title}
                              </h4>
                              <span className="text-[10px] text-muted-foreground select-none">
                                {itemDate.toLocaleDateString([], {
                                  day: "numeric",
                                  month: "short",
                                })}{" "}
                                -{" "}
                                {itemDate.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-1 bg-muted/50 p-2 rounded border border-border">
                                {item.description}
                              </p>
                            )}
                            {item.type === "audit" && Boolean(item.new_values) && (
                              <div className="text-[10px] text-muted-foreground font-mono mt-1 bg-muted p-1.5 rounded truncate max-w-full">
                                Modificado:{" "}
                                {typeof item.new_values === "object"
                                  ? String(JSON.stringify(item.new_values) ?? "")
                                  : String(item.new_values)}
                              </div>
                            )}
                            {item.type === "activity" && (
                              <div className="flex gap-2 items-center mt-1.5">
                                <span
                                  className={cn(
                                    "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase",
                                    item.activityType === "follow_up"
                                      ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                      : "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20",
                                  )}
                                >
                                  {item.activityType}
                                </span>
                                <span
                                  className={cn(
                                    "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase",
                                    item.status === "done"
                                      ? "bg-emerald-500/10 text-emerald-500 border border-emerald-550/20"
                                      : "bg-neutral-800 text-zinc-400",
                                  )}
                                >
                                  {item.status === "done" ? "Concluído" : "Pendente"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button onClick={() => setIsLeadHistoryOpen(false)} className="w-full">
                  Fechar
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Drawer de Gerenciar Estoque */}
          <Sheet open={isInventoryOpen} onOpenChange={setIsInventoryOpen}>
            <SheetContent className="w-full sm:max-w-md bg-card border-l border-muted-foreground/15 p-6 flex flex-col h-full gap-0 overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle>Gerenciador de Estoque / Catálogo</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 py-2 flex-1">
                <div className="space-y-3">
                  {products.map((prod) => (
                    <div
                      key={prod.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20 text-card-foreground"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-sm text-foreground">{prod.name}</h4>
                        <p className="text-xs text-muted-foreground font-semibold mt-0.5">
                          Preço: R${" "}
                          {prod.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Estoque: {prod.isUnlimited ? "Ilimitado" : `${prod.stock} un`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-4">
                        {!prod.isUnlimited && (
                          <div className="flex items-center border border-input rounded bg-background">
                            <button
                              type="button"
                              className="px-2 py-1 text-xs hover:bg-muted transition-colors"
                              onClick={() =>
                                updateProductStock(prod.id, Math.max(0, prod.stock - 1))
                              }
                            >
                              -
                            </button>
                            <span className="px-2 text-xs font-mono select-none text-foreground">
                              {prod.stock}
                            </span>
                            <button
                              type="button"
                              className="px-2 py-1 text-xs hover:bg-muted transition-colors"
                              onClick={() => updateProductStock(prod.id, prod.stock + 1)}
                            >
                              +
                            </button>
                          </div>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1 border-primary/20 hover:border-primary/40 hover:bg-primary/5 text-primary"
                          onClick={() => {
                            if (!prod.isUnlimited && prod.stock <= 0) {
                              toast.error("Produto esgotado no estoque!");
                              return;
                            }

                            const paymentLink = `http://localhost:8080/admin/links-pagamento`;
                            const message = `*Catálogo:* Olá! Aqui estão os detalhes do produto:\n\n*${prod.name}*\nPreço: *R$ ${prod.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}*\n\nAdquira agora acessando o link de pagamento seguro:\n${paymentLink}`;

                            sendMutation.mutate({
                              type: "text",
                              text: {
                                body: message,
                                preview_url: true,
                              },
                            });

                            if (!prod.isUnlimited) {
                              updateProductStock(prod.id, prod.stock - 1);
                            }

                            toast.success("Catálogo do produto enviado para o cliente!");
                            setIsInventoryOpen(false);
                          }}
                        >
                          <Send className="h-3 w-3" />
                          Enviar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button onClick={() => setIsInventoryOpen(false)} className="w-full">
                  Fechar
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {/* Drawer de Atribuição em Massa de Funil */}
          <Sheet open={isBulkFunnelDialogOpen} onOpenChange={setIsBulkFunnelDialogOpen}>
            <SheetContent className="w-full sm:max-w-md bg-card border-l border-muted-foreground/15 p-6 flex flex-col h-full gap-0 overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle>Enviar Contatos para o Funil</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 py-2 flex-1">
                <p className="text-xs text-muted-foreground">
                  Você está enviando {visibleSelectedContactIds.length} contato(s) selecionado(s)
                  para o funil e etapa abaixo.
                </p>

                <div className="space-y-1">
                  <Label>Funil de Vendas</Label>
                  <Select
                    value={bulkFunnelId}
                    onValueChange={(val) => {
                      setBulkFunnelId(val);
                      const stages = salesStages.filter((stage) => stage.funnel_id === val);
                      if (stages && stages.length > 0) {
                        setBulkStageId(stages[0].id);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o Funil" />
                    </SelectTrigger>
                    <SelectContent>
                      {salesFunnels.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Etapa do Funil</Label>
                  <Select
                    value={bulkStageId}
                    onValueChange={setBulkStageId}
                    disabled={!bulkFunnelId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a Etapa" />
                    </SelectTrigger>
                    <SelectContent>
                      {salesStages
                        .filter((s) => s.funnel_id === bulkFunnelId)
                        .map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-4 border-t mt-auto">
                <Button variant="outline" onClick={() => setIsBulkFunnelDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => {
                    if (!bulkFunnelId || !bulkStageId) {
                      toast.error("Por favor, selecione o funil e a etapa.");
                      return;
                    }
                    bulkAssignMutation.mutate({
                      contactIds: visibleSelectedContactIds,
                      funnelId: bulkFunnelId,
                      stageId: bulkStageId,
                    });
                  }}
                  disabled={bulkAssignMutation.isPending}
                >
                  {bulkAssignMutation.isPending ? "Processando..." : "Confirmar Envio"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_app/chat")({
  component: ChatPage,
});
