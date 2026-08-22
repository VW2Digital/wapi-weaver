import { createFileRoute, Outlet, Link, useRouter, useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSidebarOrder, getLicenseStatus } from "@/lib/admin.functions";
import { getLicenseRole } from "@/lib/license-admin.functions";
import { getProfile } from "@/lib/profile.functions";
import { listChatContacts } from "@/lib/chat.functions";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { hasMasterRole } from "@/lib/roles";
import { AUTH_EXPIRED_EVENT, db } from "@/integrations/mysql/client";
import { SeoHead } from "@/components/seo";
import {
  MessageCircle,
  LayoutDashboard,
  Users,
  ListChecks,
  FileText,
  Send,
  Settings,
  LogOut,
  User as UserIcon,
  ChevronUp,
  Sun,
  Moon,
  Receipt,
  ShieldCheck,
  Menu,
  ScrollText,
  UserCog,
  Activity,
  Kanban,
  Bot,
  BrainCircuit,
  Zap,
  Webhook,
  BookOpen,
  AlertTriangle,
  Sparkles,
  Calendar,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarProvider, Sidebar, SidebarRail, SidebarTrigger, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset } from "@/components/ui/sidebar";
import { SidebarNav, type SidebarNavItem } from "@/components/SidebarNav";
import { PageHeaderProvider } from "@/components/layout/page-header-provider";
import { SubscriptionCheckoutModal } from "@/components/subscription/subscription-checkout-modal";
import { useCallback, useEffect, useMemo, useState } from "react";

function useGravatarUrl(email: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!email) {
      setUrl(null);
      return;
    }
    const normalized = email.trim().toLowerCase();
    crypto.subtle
      .digest("SHA-256", new TextEncoder().encode(normalized))
      .then((buf) => {
        const hex = Array.from(new Uint8Array(buf))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        setUrl(`https://www.gravatar.com/avatar/${hex}?s=128&d=mp`);
      })
      .catch(() => setUrl(null));
  }, [email]);
  return url;
}

type NavChildItem = {
  to: string;
  label: string;
  icon: React.ElementType<{ className?: string }>;
};

type NavParentItem = NavChildItem & {
  children: NavChildItem[];
};

type NavItem = NavChildItem | NavParentItem;

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/chat", label: "Mensagens", icon: MessageCircle },
  { to: "/contacts/", label: "Contatos", icon: Users },
  { to: "/lists", label: "Listas & Tags", icon: ListChecks },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/campaigns/", label: "Campanhas", icon: Send },
  { to: "/crm", label: "Kanban", icon: Kanban },
  { to: "/agenda", label: "Agenda", icon: Calendar },
  {
    to: "/automacoes",
    label: "Automações",
    icon: Zap,
    children: [
      { to: "/bot", label: "Fluxos de Automação", icon: Bot },
      { to: "/ds-agente", label: "DS Agente", icon: BrainCircuit },
      { to: "/webhooks", label: "Webhooks", icon: Webhook },
    ],
  },
  { to: "/billing", label: "Faturamento", icon: Receipt },
  {
    to: "/settings",
    label: "Configurações",
    icon: Settings,
    children: [
      { to: "/settings", label: "Geral", icon: Settings },
      { to: "/whatsapp-business-profile", label: "Perfil WhatsApp", icon: UserCog },
      { to: "/users", label: "Membros da empresa", icon: ShieldCheck },
      { to: "/audit", label: "Auditoria", icon: ScrollText },
      { to: "/webhook-events", label: "Eventos do Webhook", icon: Activity },
      { to: "/docs", label: "Documentação", icon: BookOpen },
    ],
  },
];

const ADMIN_ONLY_PATHS = new Set([
  "/webhook-events",
  "/billing",
]);

const OPERATIONAL_PATHS = new Set([
  "/chat",
  "/contacts",
  "/contacts/",
  "/lists",
  "/templates",
  "/campaigns",
  "/campaigns/",
  "/crm",
  "/agenda",
  "/automacoes",
  "/bot",
  "/ds-agente",
  "/webhooks",
  "/webhook-events",
]);

const GROUP_ORDER: Record<string, number> = {
  "/dashboard": 0,
  "/chat": 0,
  "/contacts/": 1,
  "/lists": 1,
  "/templates": 2,
  "/campaigns/": 2,
  "/crm": 3,
  "/agenda": 3,
  "/automacoes": 4,
  "/billing": 5,
  "/settings": 6,
  "/licenses/": 7,
};

function AppLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const loc = useLocation();
  const { theme, toggleTheme } = useTheme();
  const gravatarUrl = useGravatarUrl(user?.email);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const [mfaOk, setMfaOk] = useState<boolean | null>(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const { isAdmin, roles, loading: rolesLoading } = useRoles();

  const fetchContacts = useServerFn(listChatContacts);
  const fetchLicenseStatus = useServerFn(getLicenseStatus);

  const licenseQuery = useQuery({
    queryKey: ["license-status"],
    queryFn: () => fetchLicenseStatus(),
    enabled: !loading && !!user,
    staleTime: 30000,
  });

  const contactsQuery = useQuery({
    queryKey: ["chat-contacts"],
    queryFn: () => fetchContacts(),
    enabled: !loading && !!user,
    staleTime: 5000,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });

  const totalUnread = useMemo(() => {
    if (!contactsQuery.data) return 0;
    return (contactsQuery.data ?? []).reduce(
      (acc: number, c: any) => acc + (c.unread_count || 0),
      0,
    );
  }, [contactsQuery.data]);

  const fetchSidebarOrder = useServerFn(getSidebarOrder);
  const fetchLicenseRole = useServerFn(getLicenseRole);

  const { data: sidebarOrderData } = useQuery({
    queryKey: ["sidebar-order"],
    queryFn: () => fetchSidebarOrder(),
    staleTime: 60_000,
  });

  const licenseRoleQuery = useQuery({
    queryKey: ["license-role"],
    queryFn: () => fetchLicenseRole({}),
    enabled: !loading && !!user && isAdmin,
    staleTime: 60_000,
  });

  const subscriptionQuery = useQuery({
    queryKey: ["subscription-access"],
    queryFn: async () => {
      const token = localStorage.getItem("app-token") || localStorage.getItem("sb-token");
      const res = await fetch("/api/billing/subscription", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error(`Falha ao consultar assinatura (${res.status})`);
      }
      return await res.json();
    },
    enabled: !loading && !!user,
    staleTime: 10000,
    retry: false,
    refetchInterval: (query) => query.state.status === "error" ? false : 30000,
  });

  const subAccess = subscriptionQuery.data?.access;
  const isSubscriptionBlocked = subAccess ? subAccess.allowed === false : false;
  const isTrialActive = subAccess ? subAccess.status === "trialing" && subAccess.allowed : false;

  const navItems = useMemo(() => {
    const base: NavItem[] = [...NAV];
    const billingEnabled = import.meta.env.VITE_BILLING_ENABLED !== "false";
    const filtered = billingEnabled ? base : base.filter(item => item.to !== "/billing");

    const isAdminMasterUser = hasMasterRole(roles);

    if (isAdminMasterUser) {
      const panelItem: NavChildItem = {
        to: "/licenses/",
        label: "Gerenciamento de Clientes / Assinaturas",
        icon: Users,
      };
      filtered.push(panelItem);
    }
    return filtered;
  }, [licenseRoleQuery.data?.isAdmin, isAdmin, roles]);

  const orderedNav = useMemo(() => {
    const raw = sidebarOrderData?.order;
    if (!raw) return [...navItems];
    try {
      const pathsOrder =
        typeof raw === "string" ? (JSON.parse(raw) as string[]) : (raw as string[]);
      if (!Array.isArray(pathsOrder) || pathsOrder.length === 0) return [...navItems];

      const navDefaults = new Map(navItems.map((item, idx) => [item.to, idx]));
      const navCopy = [...navItems];
      navCopy.sort((a, b) => {
        const idxA = pathsOrder.indexOf(a.to);
        const idxB = pathsOrder.indexOf(b.to);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        const defA = navDefaults.get(a.to) ?? 999;
        const defB = navDefaults.get(b.to) ?? 999;
        return defA - defB;
      });
      return navCopy;
    } catch {
      return [...navItems];
    }
  }, [sidebarOrderData, navItems]);

  const sidebarGroups = useMemo(() => {
    const groupMap = new Map<number, SidebarNavItem[]>();
    for (const item of orderedNav) {
      if (ADMIN_ONLY_PATHS.has(item.to) && !isAdmin) continue;
      const gIdx = GROUP_ORDER[item.to] ?? 0;
      if (!groupMap.has(gIdx)) groupMap.set(gIdx, []);
      
      const isLocked = isSubscriptionBlocked && OPERATIONAL_PATHS.has(item.to);

      const navItem: SidebarNavItem = {
        id: item.to,
        label: item.label,
        icon: item.icon,
        isLocked,
        badge: item.to === "/chat" && totalUnread > 0 ? totalUnread : undefined,
      };
      if ("children" in item && item.children.length > 0) {
        navItem.children = item.children
          .filter((child) => !ADMIN_ONLY_PATHS.has(child.to) || isAdmin)
          .map((child) => ({
            id: child.to,
            label: child.label,
            icon: child.icon,
            isLocked: isSubscriptionBlocked && OPERATIONAL_PATHS.has(child.to),
          }));
        if (navItem.children.length === 0) continue;
      }
      groupMap.get(gIdx)!.push(navItem);
    }
    return Array.from(groupMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([, items]) => items)
      .filter((g) => g.length > 0);
  }, [orderedNav, isAdmin, totalUnread, isSubscriptionBlocked]);

  const handleNavigate = useCallback(
    (path: string) => {
      const p = path.endsWith("/") && path !== "/" ? path.slice(0, -1) : path;
      if (isSubscriptionBlocked && OPERATIONAL_PATHS.has(p)) {
        setIsCheckoutModalOpen(true);
        return;
      }
      if (p === "/settings") {
        router.navigate({ to: "/settings", search: { s: undefined } });
      } else if (p === "/chat") {
        router.navigate({ to: "/chat" });
      } else if (p === "/dashboard") {
        router.navigate({ to: "/dashboard" });
      } else if (p === "/contacts") {
        router.navigate({ to: "/contacts" });
      } else if (p === "/lists") {
        router.navigate({ to: "/lists" });
      } else if (p === "/templates") {
        router.navigate({ to: "/templates" });
      } else if (p === "/campaigns") {
        router.navigate({ to: "/campaigns" });
      } else if (p === "/crm") {
        router.navigate({ to: "/crm" });
      } else if (p === "/agenda") {
        router.navigate({ to: "/agenda" });
      } else if (p === "/bot") {
        router.navigate({ to: "/bot" });
      } else if (p === "/ds-agente") {
        router.navigate({ to: "/ds-agente" });
      } else if (p === "/webhooks") {
        router.navigate({ to: "/webhooks" });
      } else if (p === "/billing") {
        router.navigate({ to: "/billing" });
      } else if (p === "/whatsapp-business-profile") {
        router.navigate({ to: "/whatsapp-business-profile" });
      } else if (p === "/users") {
        router.navigate({ to: "/users" });
      } else if (p === "/audit") {
        router.navigate({ to: "/audit" });
      } else if (p === "/webhook-events") {
        router.navigate({ to: "/webhook-events" });
      } else if (p === "/licenses") {
        router.navigate({ to: "/licenses" });
      } else {
        router.navigate({ to: "/settings", search: { s: undefined } });
      }
    },
    [router, isSubscriptionBlocked],
  );

  const fetchProfile = useServerFn(getProfile);

  const profileSidebarQuery = useQuery({
    queryKey: ["profile-sidebar"],
    queryFn: () => fetchProfile(),
    enabled: !loading && !!user,
    staleTime: 60_000,
  });

  useEffect(() => {
    setProfileAvatar(profileSidebarQuery.data?.avatar_url ?? null);
    setProfileDisplayName(
      profileSidebarQuery.data?.display_name ||
      profileSidebarQuery.data?.full_name ||
      null
    );
  }, [profileSidebarQuery.data]);

  const avatarUrl = profileAvatar || gravatarUrl;

  useEffect(() => {
    if (!loading && !user) {
      router.navigate({ to: "/login", replace: true });
    }
  }, [loading, user?.id, router]);

  useEffect(() => {
    const handleAuthExpired = () => {
      router.navigate({ to: "/login", replace: true });
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, [router]);

  useEffect(() => {
    if (!user) {
      setMfaOk(null);
      return;
    }
    let cancelled = false;
    db.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }: any) => {
      if (cancelled) return;
      if (data && data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
        setMfaOk(false);
      } else {
        setMfaOk(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (mfaOk === false) {
      router.navigate({ to: "/login", replace: true });
    }
  }, [mfaOk, router]);

  const licenseData: any = licenseQuery.data;
  const isLicenseExpiredOrWarning =
    licenseData &&
    (!licenseData.isValid ||
      !licenseData.isAccessAllowed ||
      licenseData.status === "expired" ||
      licenseData.status === "suspended" ||
      licenseData.status === "past_due" ||
      licenseData.status === "expiring" ||
      licenseData.hasGraceStarted);

  if (loading || (user && mfaOk === null) || (user && mfaOk && rolesLoading)) {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background text-muted-foreground"
        role="status"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm">Carregando...</p>
      </div>
    );
  }
  if (!user || mfaOk === false) {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background text-muted-foreground"
        role="status"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm">Redirecionando...</p>
      </div>
    );
  }

  const logout = async () => {
    await db.auth.signOut();
    router.navigate({ to: "/login", replace: true });
  };
  const SidebarBody = (
    <SidebarNav
      appName="Bliv"
      logo={
        <img
          src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
          alt="Bliv Logo"
          className="h-11 w-11 shrink-0 rounded-lg object-contain shadow-sm"
        />
      }
      groups={sidebarGroups}
      activePath={loc.pathname}
      onNavigate={handleNavigate}
      footer={
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:!w-10 group-data-[collapsible=icon]:!h-10 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={user.email ?? ""} />}
                    <AvatarFallback className="bg-sidebar-primary/15 text-sidebar-primary text-xs font-semibold">
                      {(user.email ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-medium">{profileDisplayName ?? user.email?.split("@")?.[0]}</span>
                    <span className="truncate text-xs text-sidebar-foreground/60">{user.email}</span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="center" sideOffset={4} className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg z-[100]">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium truncate">{profileDisplayName ?? user.email?.split("@")?.[0]}</span>
                  <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="cursor-pointer">
                  <UserIcon className="mr-2 h-4 w-4" /> Perfil
                </Link>
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem asChild>
                  <Link to="/settings" search={{ s: undefined }} className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" /> Configurações
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  toggleTheme();
                }}
                className="cursor-pointer"
              >
                {theme === "dark" ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                {theme === "dark" ? "Tema claro" : "Tema escuro"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" /> Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      }
    />
  );

  return (
    <>
      <SeoHead noindex />
      <SidebarProvider>
        <Sidebar
          collapsible="icon"
          className="border border-sidebar-border bg-sidebar text-sidebar-foreground rounded-2xl"
        >
          {SidebarBody}
          <SidebarRail />
        </Sidebar>

        <SidebarInset className="h-dvh overflow-hidden bg-background flex flex-col flex-1 p-0 m-0 border-0 md:peer-data-[variant=inset]:m-0 md:peer-data-[variant=inset]:rounded-none shadow-none">
          {/* Mobile top bar */}
          <header className="md:hidden flex items-center gap-2 border-b bg-card px-4 py-3 shrink-0">
            <SidebarTrigger className="h-8 w-8 -ml-1 text-sidebar-foreground/70" />
            <div className="flex items-center gap-2 ml-1">
              <img
                src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
                alt="Bliv Logo"
                className="h-8 w-8 object-contain rounded-lg shadow-sm"
              />
              <span className="font-display text-base font-semibold">Bliv</span>
            </div>
          </header>

          {/* Banner de Trial Ativo */}
          {isTrialActive && subAccess && (
            <div className="bg-gradient-to-r from-[#F23869] via-[#D93B92] to-[#BF39B6] text-white px-4 py-2.5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm shrink-0 border-b border-white/10 z-30">
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-amber-300 shrink-0 animate-pulse" />
                <div>
                  <span className="font-bold">Período de Teste Gratuito Ativo:</span>{" "}
                  <span className="opacity-95">
                    {subAccess.remainingSeconds > 86400
                      ? `Você tem ${Math.floor(subAccess.remainingSeconds / 86400)} dia(s) e ${Math.floor((subAccess.remainingSeconds % 86400) / 3600)} hora(s) restantes de acesso completo.`
                      : `Seu teste gratuito encerra em ${Math.floor(subAccess.remainingSeconds / 3600)} hora(s) e ${Math.floor((subAccess.remainingSeconds % 3600) / 60)} min.`}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsCheckoutModalOpen(true)}
                className="inline-flex items-center rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 px-4 py-2 text-xs font-extrabold shadow-md active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                Conhecer Planos
              </button>
            </div>
          )}

          {/* Banner de Assinatura Expirada / Bloqueada */}
          {(isSubscriptionBlocked || isLicenseExpiredOrWarning) && !isTrialActive && (
            <div className="bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 text-white px-4 py-2.5 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm shrink-0 border-b border-red-500/30 z-30">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-200 shrink-0 animate-bounce" />
                <div>
                  <span className="font-bold">Seu Período de Teste Terminou:</span>{" "}
                  <span className="opacity-95">
                    Para continuar utilizando todos os recursos operacionais do BLIV CRM, ative sua assinatura.
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsCheckoutModalOpen(true)}
                className="inline-flex items-center rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-bold shadow-md active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                Ativar Minha Assinatura
              </button>
            </div>
          )}

          <main className="flex-1 overflow-y-auto flex flex-col">
            <PageHeaderProvider>
              <Outlet />
            </PageHeaderProvider>
          </main>
        </SidebarInset>
      </SidebarProvider>

      {/* Modal de Checkout / Renovação de Assinatura */}
      <SubscriptionCheckoutModal
        open={isCheckoutModalOpen}
        onOpenChange={setIsCheckoutModalOpen}
      />
    </>
  );
}

export const Route = createFileRoute("/_app")({ component: AppLayout });
