import type { ElementType } from "react";
import {
  Activity,
  BookOpen,
  Bot,
  BrainCircuit,
  Calendar,
  FileText,
  Instagram,
  Kanban,
  LayoutDashboard,
  ListChecks,
  MessageCircle,
  Receipt,
  ScrollText,
  Send,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  Webhook,
  Zap,
} from "lucide-react";

export type NavigationVisibility = "all" | "admin" | "master";

export type NavigationChildDefinition = {
  id: string;
  to: string;
  label: string;
  icon: ElementType<{ className?: string }>;
  visibility?: NavigationVisibility;
};

export type NavigationItemDefinition = NavigationChildDefinition & {
  group: string;
  children?: readonly NavigationChildDefinition[];
};

export const NAVIGATION_REGISTRY: readonly NavigationItemDefinition[] = [
  {
    id: "dashboard",
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    group: "primary",
  },
  {
    id: "messages",
    to: "/chat",
    label: "Mensagens",
    icon: MessageCircle,
    group: "primary",
  },
  {
    id: "instagram-content",
    to: "/instagram-content",
    label: "Conteúdo Instagram",
    icon: Instagram,
    group: "primary",
  },
  {
    id: "contacts",
    to: "/contacts/",
    label: "Contatos",
    icon: Users,
    group: "contacts",
  },
  {
    id: "lists-tags",
    to: "/lists",
    label: "Listas & Tags",
    icon: ListChecks,
    group: "contacts",
  },
  {
    id: "templates",
    to: "/templates",
    label: "Templates",
    icon: FileText,
    group: "content",
  },
  {
    id: "campaigns",
    to: "/campaigns/",
    label: "Campanhas",
    icon: Send,
    group: "content",
  },
  {
    id: "crm",
    to: "/crm",
    label: "Kanban",
    icon: Kanban,
    group: "work",
  },
  {
    id: "agenda",
    to: "/agenda",
    label: "Agenda",
    icon: Calendar,
    group: "work",
  },
  {
    id: "automations",
    to: "/automacoes",
    label: "Automações",
    icon: Zap,
    group: "automation",
    children: [
      { id: "automation-flows", to: "/bot", label: "Fluxos de Automação", icon: Bot },
      { id: "ds-agent", to: "/ds-agente", label: "DS Agente", icon: BrainCircuit },
      { id: "webhooks", to: "/webhooks", label: "Webhooks", icon: Webhook },
    ],
  },
  {
    id: "billing",
    to: "/billing",
    label: "Faturamento",
    icon: Receipt,
    group: "system",
    visibility: "admin",
  },
  {
    id: "settings",
    to: "/settings",
    label: "Configurações",
    icon: Settings,
    group: "system",
    children: [
      { id: "settings-general", to: "/settings", label: "Geral", icon: Settings },
      {
        id: "whatsapp-profile",
        to: "/whatsapp-business-profile",
        label: "Perfil WhatsApp",
        icon: UserCog,
      },
      {
        id: "company-members",
        to: "/users",
        label: "Membros da empresa",
        icon: ShieldCheck,
      },
      {
        id: "audit",
        to: "/audit",
        label: "Auditoria",
        icon: ScrollText,
        visibility: "admin",
      },
      {
        id: "webhook-events",
        to: "/webhook-events",
        label: "Eventos do Webhook",
        icon: Activity,
        visibility: "admin",
      },
      { id: "documentation", to: "/docs", label: "Documentação", icon: BookOpen },
    ],
  },
  {
    id: "license-management",
    to: "/licenses/",
    label: "Gerenciamento de Clientes / Assinaturas",
    icon: Users,
    group: "master",
    visibility: "master",
  },
];

export const DEFAULT_NAVIGATION_ORDER = NAVIGATION_REGISTRY.map(({ id }) => id);
export const NAVIGATION_ITEM_IDS = new Set<string>(DEFAULT_NAVIGATION_ORDER);

const registryById = new Map<string, NavigationItemDefinition>(
  NAVIGATION_REGISTRY.map((item) => [item.id, item]),
);

function normalizeRoute(route: string) {
  if (route === "/") return route;
  return route.replace(/\/+$/, "");
}

const legacyRouteToId = new Map<string, string>(
  NAVIGATION_REGISTRY.map((item) => [normalizeRoute(item.to), item.id]),
);

const navigableRoutes = new Set<string>(
  NAVIGATION_REGISTRY.flatMap((item) => [
    normalizeRoute(item.to),
    ...(item.children || []).map((child) => normalizeRoute(child.to)),
  ]),
);

export function resolveNavigationRoute(value: string): string | null {
  const route = normalizeRoute(value);
  return navigableRoutes.has(route) ? route : null;
}

export function normalizeNavigationOrder(value: unknown): string[] {
  let candidate = value;
  if (typeof candidate === "string") {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      candidate = [];
    }
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  if (Array.isArray(candidate)) {
    for (const raw of candidate) {
      if (typeof raw !== "string") continue;
      const id = NAVIGATION_ITEM_IDS.has(raw) ? raw : legacyRouteToId.get(normalizeRoute(raw));
      if (!id || seen.has(id)) continue;
      seen.add(id);
      normalized.push(id);
    }
  }

  for (const id of DEFAULT_NAVIGATION_ORDER) {
    if (!seen.has(id)) normalized.push(id);
  }
  return normalized;
}

export function getOrderedNavigationItems(value: unknown): NavigationItemDefinition[] {
  return normalizeNavigationOrder(value)
    .map((id) => registryById.get(id))
    .filter((item): item is NavigationItemDefinition => Boolean(item));
}

export function isCompleteNavigationOrder(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === DEFAULT_NAVIGATION_ORDER.length &&
    new Set(value).size === value.length &&
    value.every((id) => typeof id === "string" && NAVIGATION_ITEM_IDS.has(id))
  );
}

export function isNavigationVisible(
  visibility: NavigationVisibility = "all",
  access: { isAdmin: boolean; isMaster: boolean },
) {
  return (
    visibility === "all" ||
    (visibility === "admin" && access.isAdmin) ||
    (visibility === "master" && access.isMaster)
  );
}

export function moveNavigationItem(
  order: readonly string[],
  index: number,
  direction: "up" | "down",
) {
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || index >= order.length || target < 0 || target >= order.length) {
    return [...order];
  }
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
