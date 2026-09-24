import { createFileRoute, Outlet, Link, useRouter, useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSidebarOrder, getLicenseStatus } from "@/lib/admin.functions";
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
  Instagram,
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
import { Button } from "@/components/ui/button";
import {
  SidebarProvider,
  Sidebar,
  SidebarRail,
  SidebarTrigger,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from "@/components/ui/sidebar";
import { SidebarNav, type SidebarNavItem } from "@/components/SidebarNav";
import { PageHeaderProvider } from "@/components/layout/page-header-provider";
import { SubscriptionCheckoutModal } from "@/components/subscription/subscription-checkout-modal";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getOrderedNavigationItems,
  isNavigationVisible,
  NAVIGATION_REGISTRY,
  resolveNavigationRoute,
} from "@/lib/navigation-registry";

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

const OPERATIONAL_PATHS = new Set([
  "/chat",
  "/contacts",
  "/contacts/",
  "/lists",
  "/templates",
  "/galeria",
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

  const { data: sidebarOrderData } = useQuery({
    queryKey: ["sidebar-order"],
    queryFn: () => fetchSidebarOrder(),
    enabled: !loading && Boolean(user),
    staleTime: 0,
    refetchInterval: 15_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
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
    refetchInterval: (query) => (query.state.status === "error" ? false : 30000),
  });

  const subAccess = subscriptionQuery.data?.access;
  const isSubscriptionBlocked = subAccess ? subAccess.allowed === false : false;
  const isTrialActive = subAccess ? subAccess.status === "trialing" && subAccess.allowed : false;

  const navItems = useMemo(() => {
    const billingEnabled = import.meta.env.VITE_BILLING_ENABLED !== "false";
    const isAdminMasterUser = hasMasterRole(roles);
    return NAVIGATION_REGISTRY.filter(
      (item) =>
        (billingEnabled || item.id !== "billing") &&
        isNavigationVisible(item.visibility, {
          isAdmin,
          isMaster: isAdminMasterUser,
        }),
    );
  }, [isAdmin, roles]);

  const orderedNav = useMemo(() => {
    const available = new Set(navItems.map(({ id }) => id));
    return getOrderedNavigationItems(sidebarOrderData?.order).filter(({ id }) => available.has(id));
  }, [sidebarOrderData, navItems]);

  const sidebarGroups = useMemo(() => {
    const groups: SidebarNavItem[][] = [];
    let previousGroup: string | null = null;
    const isAdminMasterUser = hasMasterRole(roles);

    for (const item of orderedNav) {
      const isLocked = isSubscriptionBlocked && OPERATIONAL_PATHS.has(item.to);

      const navItem: SidebarNavItem = {
        id: item.to,
        label: item.label,
        icon: item.icon,
        isLocked,
        badge: item.to === "/chat" && totalUnread > 0 ? totalUnread : undefined,
      };
      const children = item.children;
      if (children?.length) {
        navItem.children = children
          .filter((child) =>
            isNavigationVisible(child.visibility, {
              isAdmin,
              isMaster: isAdminMasterUser,
            }),
          )
          .map((child) => ({
            id: child.to,
            label: child.label,
            icon: child.icon,
            isLocked: isSubscriptionBlocked && OPERATIONAL_PATHS.has(child.to),
          }));
        if (navItem.children.length === 0) continue;
      }
      if (previousGroup !== item.group || groups.length === 0) {
        groups.push([]);
      }
      groups[groups.length - 1].push(navItem);
      previousGroup = item.group;
    }
    return groups;
  }, [orderedNav, isAdmin, totalUnread, isSubscriptionBlocked, roles]);

  const handleNavigate = useCallback(
    (path: string) => {
      const route = resolveNavigationRoute(path);
      if (!route) {
        console.error(`[Navigation] Unknown sidebar route: ${path}`);
        toast.error("Não foi possível abrir esta seção: rota inválida.");
        return;
      }
      if (isSubscriptionBlocked && OPERATIONAL_PATHS.has(route)) {
        setIsCheckoutModalOpen(true);
        return;
      }
      router.history.push(route);
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
      profileSidebarQuery.data?.display_name || profileSidebarQuery.data?.full_name || null,
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
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:w-10! group-data-[collapsible=icon]:h-10! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={user.email ?? ""} />}
                    <AvatarFallback className="bg-sidebar-primary/15 text-sidebar-primary text-xs font-semibold">
                      {(user.email ?? "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-medium">
                      {profileDisplayName ?? user.email?.split("@")?.[0]}
                    </span>
                    <span className="truncate text-xs text-sidebar-foreground/60">
                      {user.email}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto h-4 w-4 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="center"
                sideOffset={4}
                className="z-100 w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
              >
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium truncate">
                      {profileDisplayName ?? user.email?.split("@")?.[0]}
                    </span>
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
            <div className="bg-brand-gradient text-primary-foreground px-4 py-2.5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm shrink-0 border-b border-primary-foreground/10 z-30">
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-5 w-5 text-warning shrink-0 animate-pulse" />
                <div>
                  <span className="font-bold">Período de Teste Gratuito Ativo:</span>{" "}
                  <span className="opacity-95">
                    {subAccess.remainingSeconds > 86400
                      ? `Você tem ${Math.floor(subAccess.remainingSeconds / 86400)} dia(s) e ${Math.floor((subAccess.remainingSeconds % 86400) / 3600)} hora(s) restantes de acesso completo.`
                      : `Seu teste gratuito encerra em ${Math.floor(subAccess.remainingSeconds / 3600)} hora(s) e ${Math.floor((subAccess.remainingSeconds % 3600) / 60)} min.`}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsCheckoutModalOpen(true)}
                className="bg-warning text-foreground shadow-sm hover:bg-warning/90"
              >
                Conhecer Planos
              </Button>
            </div>
          )}

          {/* Banner de Assinatura Expirada / Bloqueada */}
          {(isSubscriptionBlocked || isLicenseExpiredOrWarning) && !isTrialActive && (
            <div className="bg-destructive text-destructive-foreground px-4 py-2.5 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm shrink-0 border-b border-destructive-foreground/20 z-30">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0 animate-bounce" />
                <div>
                  <span className="font-bold">Seu Período de Teste Terminou:</span>{" "}
                  <span className="opacity-95">
                    Para continuar utilizando todos os recursos operacionais do BLIV CRM, ative sua
                    assinatura.
                  </span>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsCheckoutModalOpen(true)}
                className="bg-success text-success-foreground shadow-sm hover:bg-success/90"
              >
                Ativar Minha Assinatura
              </Button>
            </div>
          )}

          <main className="flex-1 min-h-0 overflow-y-auto flex flex-col">
            <PageHeaderProvider>
              <Outlet />
            </PageHeaderProvider>
          </main>
        </SidebarInset>
      </SidebarProvider>

      {/* Modal de Checkout / Renovação de Assinatura */}
      <SubscriptionCheckoutModal open={isCheckoutModalOpen} onOpenChange={setIsCheckoutModalOpen} />
    </>
  );
}

export const Route = createFileRoute("/_app")({ component: AppLayout });
