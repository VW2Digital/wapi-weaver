import { createFileRoute, Outlet, Link, useRouter, useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSidebarOrder, getLicenseStatus } from "@/lib/admin.functions";
import { getLicenseRole } from "@/lib/license-admin.functions";
import { listChatContacts } from "@/lib/chat.functions";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { db } from "@/integrations/mysql/client";
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
  ShieldAlert,
  Activity,
  Kanban,
  Bot,
  BrainCircuit,
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
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarProvider, Sidebar, SidebarRail } from "@/components/ui/sidebar";
import { SidebarNav, type SidebarNavItem } from "@/components/SidebarNav";
import { useCallback, useEffect, useMemo, useState } from "react";

function reportServerFnAbortDebug(
  hypothesisId: string,
  location: string,
  msg: string,
  data: Record<string, unknown>,
) {
  void fetch("http://127.0.0.1:7777/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: "serverfn-aborts",
      runId: "pre-fix",
      hypothesisId,
      location,
      msg: `[DEBUG] ${msg}`,
      data,
      ts: Date.now(),
    }),
  }).catch(() => {});
}

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
        setUrl(`https://www.gravatar.com/avatar/${hex}?s=128&d=404`);
      })
      .catch(() => setUrl(null));
  }, [email]);
  return url;
}

export const Route = createFileRoute("/_app")({ component: AppLayout });

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
  { to: "/chat", label: "Chat Direto", icon: MessageCircle },
  { to: "/contacts", label: "Contatos", icon: Users },
  { to: "/lists", label: "Listas & Tags", icon: ListChecks },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/campaigns", label: "Campanhas", icon: Send },
  { to: "/crm", label: "Funil de Vendas", icon: Kanban },
  { to: "/bot", label: "Bot de Fluxo", icon: Bot },
  { to: "/ai-agent", label: "Agente de IA", icon: BrainCircuit },
  { to: "/billing", label: "Faturamento", icon: Receipt },
  {
    to: "/settings",
    label: "Configurações",
    icon: Settings,
    children: [
      { to: "/settings", label: "Geral", icon: Settings },
      { to: "/whatsapp-business-profile", label: "Perfil WhatsApp", icon: UserCog },
      { to: "/users", label: "Usuários", icon: ShieldCheck },
      { to: "/audit", label: "Auditoria", icon: ScrollText },
      { to: "/webhook-events", label: "Eventos do Webhook", icon: Activity },
    ],
  },
];

const ADMIN_ONLY_PATHS = new Set(["/users", "/audit", "/webhook-events", "/billing"]);

function AppLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const loc = useLocation();
  const { theme, toggleTheme } = useTheme();
  const gravatarUrl = useGravatarUrl(user?.email);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mfaOk, setMfaOk] = useState<boolean | null>(null);
  const { isAdmin, loading: rolesLoading } = useRoles();

  const fetchContacts = useServerFn(listChatContacts);
  const fetchLicenseStatus = useServerFn(getLicenseStatus);

  const licenseQuery = useQuery({
    queryKey: ["license-status"],
    queryFn: () => fetchLicenseStatus(),
    enabled: !loading && !!user,
    staleTime: 30000,
  });

  const isAccessAllowed = true;
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

  const navItems = useMemo(() => {
    const base: NavItem[] = [...NAV];
    if (licenseRoleQuery.data?.role === "panel" && licenseRoleQuery.data?.isAdmin) {
      const settingsIdx = base.findIndex((item) => item.to === "/settings");
      const panelItem: NavChildItem = {
        to: "/licenses",
        label: "Gerenciamento de Clientes",
        icon: Users,
      };
      if (settingsIdx !== -1) {
        base.splice(settingsIdx, 0, panelItem);
      } else {
        base.push(panelItem);
      }
    }
    return base;
  }, [licenseRoleQuery.data?.role, licenseRoleQuery.data?.isAdmin]);

  const orderedNav = useMemo(() => {
    const raw = sidebarOrderData?.order;
    if (!raw) return [...navItems];
    try {
      const pathsOrder =
        typeof raw === "string" ? (JSON.parse(raw) as string[]) : (raw as string[]);
      if (!Array.isArray(pathsOrder) || pathsOrder.length === 0) return [...navItems];

      const navDefaults = navItems.map((item, idx) => ({ to: item.to, defaultIdx: idx }));
      const navCopy = [...navItems];
      navCopy.sort((a, b) => {
        const idxA = pathsOrder.indexOf(a.to);
        const idxB = pathsOrder.indexOf(b.to);
        // Both are in saved order — sort by saved position
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        // Both are NOT in saved order — preserve default order
        if (idxA === -1 && idxB === -1) {
          const defA = navDefaults.find((n) => n.to === a.to)?.defaultIdx ?? 999;
          const defB = navDefaults.find((n) => n.to === b.to)?.defaultIdx ?? 999;
          return defA - defB;
        }
        // One is in saved order, the other is not — put unsaved after saved
        if (idxA === -1) return 1;
        return -1;
      });
      return navCopy;
    } catch {
      return [...navItems];
    }
  }, [sidebarOrderData, navItems]);

  const GROUP_ORDER: Record<string, number> = {
    "/dashboard": 0,
    "/chat": 0,
    "/contacts": 1,
    "/lists": 1,
    "/templates": 2,
    "/campaigns": 2,
    "/crm": 3,
    "/bot": 3,
    "/ai-agent": 3,
    "/billing": 4,
    "/licenses": 4,
    "/settings": 5,
  };

  const sidebarGroups = useMemo(() => {
    const groupMap = new Map<number, SidebarNavItem[]>();
    for (const item of orderedNav) {
      if (ADMIN_ONLY_PATHS.has(item.to) && !isAdmin) continue;
      const gIdx = GROUP_ORDER[item.to] ?? 0;
      if (!groupMap.has(gIdx)) groupMap.set(gIdx, []);
      const navItem: SidebarNavItem = {
        id: item.to,
        label: item.label,
        icon: item.icon,
        badge: item.to === "/chat" && totalUnread > 0 ? totalUnread : undefined,
      };
      if ("children" in item && item.children.length > 0) {
        navItem.children = item.children
          .filter((child) => !ADMIN_ONLY_PATHS.has(child.to) || isAdmin)
          .map((child) => ({
            id: child.to,
            label: child.label,
            icon: child.icon,
          }));
        if (navItem.children.length === 0) continue;
      }
      groupMap.get(gIdx)!.push(navItem);
    }
    return Array.from(groupMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([, items]) => items)
      .filter((g) => g.length > 0);
  }, [orderedNav, isAdmin, totalUnread]);

  const handleNavigate = useCallback(
    (path: string) => {
      if (path === "/settings") {
        router.navigate({ to: path, search: { s: undefined } } as any);
      } else {
        router.navigate({ to: path } as any);
      }
    },
    [router],
  );

  useEffect(() => {
    if (!user) {
      setProfileAvatar(null);
      return;
    }
    let cancelled = false;
    db.from("profiles")
      .select("avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!cancelled) setProfileAvatar(data?.avatar_url ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const avatarUrl = profileAvatar || gravatarUrl;

  // Close drawer on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    if (!loading && !user) {
      // #region debug-point E:app-redirect-login
      reportServerFnAbortDebug(
        "E",
        "_app.tsx:redirect-login",
        "Redirecting to /login from AppLayout",
        {
          loading,
          hasUser: Boolean(user),
          pathname: loc.pathname,
        },
      );
      // #endregion
      router.navigate({ to: "/login", replace: true });
    }
  }, [loading, user?.id, router]);

  // Garante AAL2 quando o usuário tem 2FA habilitado
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
      // #region debug-point F:app-redirect-mfa
      reportServerFnAbortDebug("F", "_app.tsx:redirect-mfa", "Redirecting to /login due to MFA", {
        pathname: loc.pathname,
        hasUser: Boolean(user),
        mfaOk,
      });
      // #endregion
      router.navigate({ to: "/login", replace: true });
    }
  }, [mfaOk, router]);

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
          className="h-9 w-9 shrink-0 rounded-lg object-contain shadow-sm"
        />
      }
      groups={sidebarGroups}
      activePath={loc.pathname}
      onNavigate={handleNavigate}
      footer={
        <div className="m-3 mt-4 border-t border-sidebar-border pt-3 group-data-[collapsible=icon]:m-1 group-data-[collapsible=icon]:px-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Abrir menu do usuário"
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sidebar-foreground hover:bg-sidebar-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring transition-colors group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center"
              >
                <Avatar className="h-9 w-9 shrink-0">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={user.email ?? ""} />}
                  <AvatarFallback className="bg-sidebar-primary/15 text-sidebar-primary text-xs font-semibold">
                    {(user.email ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                  <div className="text-sm font-medium truncate text-sidebar-foreground">
                    {user.email?.split("@")[0]}
                  </div>
                  <div className="text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
                </div>
                <ChevronUp className="h-4 w-4 text-sidebar-foreground/60 shrink-0 group-data-[collapsible=icon]:hidden" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" sideOffset={16} className="w-64 z-[100]">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium truncate">{user.email?.split("@")[0]}</span>
                  <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile" className="cursor-pointer">
                  <UserIcon className="mr-2 h-4 w-4" /> Perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings" search={{ s: undefined }} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" /> Configurações
                </Link>
              </DropdownMenuItem>
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
        </div>
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

        <div className="h-dvh overflow-hidden bg-background flex flex-col flex-1">
          {/* Mobile top bar */}
          <header className="md:hidden flex items-center gap-2 border-b bg-card px-4 py-3 shrink-0">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Abrir menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[280px] bg-sidebar p-0 text-sidebar-foreground"
              >
                <SheetTitle className="sr-only">Menu</SheetTitle>
                {SidebarBody}
              </SheetContent>
            </Sheet>
            <div className="flex items-center gap-2">
              <img
                src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
                alt="Bliv Logo"
                className="h-8 w-8 object-contain rounded-lg shadow-sm"
              />
              <span className="font-display text-sm font-semibold">Bliv</span>
            </div>
          </header>

          <main className="flex-1 overflow-hidden flex flex-col">
            {!isAccessAllowed ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
                <div className="h-16 w-16 bg-destructive/10 text-destructive flex items-center justify-center rounded-full mb-6">
                  <ShieldAlert className="h-8 w-8 animate-pulse" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
                  Acesso Bloqueado — Conta Não Autorizada
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  Sua conta ou assinatura não está ativa ou expirou o período de validade. O uso do
                  disparador e de todos os recursos da plataforma foi suspenso. Por favor, entre em
                  contato com o suporte para regularizar seu acesso.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto justify-center">
                  <Button
                    asChild
                    variant="default"
                    className="w-full sm:w-auto bg-[#25D366] hover:bg-[#1ebd56] text-white border-none shadow-sm hover:text-white cursor-pointer"
                  >
                    <a
                      href="https://wa.me/5591936180534?text=Ol%C3%A1%2C%20gostaria%20de%20regularizar%20o%20acesso%20da%20minha%20conta%20no%20sistema."
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Falar com o Suporte
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <Outlet />
            )}
          </main>
        </div>
      </SidebarProvider>
    </>
  );
}
