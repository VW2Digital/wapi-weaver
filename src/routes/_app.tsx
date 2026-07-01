import { createFileRoute, Outlet, Link, useRouter, useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getSidebarOrder, getLicenseStatus } from "@/lib/admin.functions";
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
  ChevronDown,
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
  Download,
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
import { Card } from "@/components/ui/card";
import { SidebarProvider, Sidebar, SidebarRail } from "@/components/ui/sidebar";
import { useEffect, useMemo, useState } from "react";

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

const NAV = [
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
      { to: "/license", label: "Licença SaaS", icon: ShieldCheck },
    ],
  },
] as const;

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
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const fetchContacts = useServerFn(listChatContacts);
  const fetchLicenseStatus = useServerFn(getLicenseStatus);

  const licenseQuery = useQuery({
    queryKey: ["license-status"],
    queryFn: () => fetchLicenseStatus(),
    enabled: !loading && !!user,
    staleTime: 30000,
  });

  const isAccessAllowed = licenseQuery.data?.isAccessAllowed !== false;
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
      0
    );
  }, [contactsQuery.data]);

  useEffect(() => {
    const path = loc.pathname;
    if (
      path.startsWith("/settings") ||
      path.startsWith("/whatsapp-business-profile") ||
      path.startsWith("/users") ||
      path.startsWith("/audit") ||
      path.startsWith("/webhook-events")
    ) {
      setOpenMenus((prev) => ({ ...prev, "/settings": true }));
    }
  }, [loc.pathname]);

  const fetchSidebarOrder = useServerFn(getSidebarOrder);

  const { data: sidebarOrderData } = useQuery({
    queryKey: ["sidebar-order"],
    queryFn: () => fetchSidebarOrder(),
    staleTime: 60_000,
  });

  const orderedNav = useMemo(() => {
    const raw = sidebarOrderData?.order;
    if (!raw) return [...NAV];
    try {
      const pathsOrder = typeof raw === "string" ? JSON.parse(raw) as string[] : raw as string[];
      if (!Array.isArray(pathsOrder) || pathsOrder.length === 0) return [...NAV];

      const navDefaults = NAV.map((item, idx) => ({ to: item.to, defaultIdx: idx }));
      const navCopy = [...NAV];
      navCopy.sort((a, b) => {
        const idxA = pathsOrder.indexOf(a.to);
        const idxB = pathsOrder.indexOf(b.to);
        // Both are in saved order — sort by saved position
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        // Both are NOT in saved order — preserve NAV default order
        if (idxA === -1 && idxB === -1) {
          const defA = navDefaults.find(n => n.to === a.to)?.defaultIdx ?? 999;
          const defB = navDefaults.find(n => n.to === b.to)?.defaultIdx ?? 999;
          return defA - defB;
        }
        // One is in saved order, the other is not — put unsaved after saved
        if (idxA === -1) return 1;
        return -1;
      });
      return navCopy;
    } catch {
      return [...NAV];
    }
  }, [sidebarOrderData]);

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
    <div className="flex h-full flex-col overflow-x-hidden">
      <div className="flex items-center gap-2 px-6 py-5 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:justify-center">
        <img
          src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
          alt="Bliv Logo"
          className="h-9 w-9 object-contain rounded-lg shrink-0 shadow-sm"
        />
        <span className="font-display text-base font-semibold text-sidebar-foreground group-data-[collapsible=icon]:hidden">
          Bliv
        </span>
      </div>
      <div className="px-6 pb-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
        Menu
      </div>
      <nav className="flex-1 space-y-1 px-3 overflow-y-auto group-data-[collapsible=icon]:px-1.5">
        {orderedNav.map((item: any) => {
          const { to, label, icon: Icon } = item;
          const isAdminOnly = ["/users", "/audit", "/webhook-events", "/billing"].includes(to);
          if (isAdminOnly && !isAdmin) return null;

          const hasChildren = item.children && item.children.length > 0;
          if (hasChildren) {
            const visibleChildren = item.children.filter((child: any) => {
              const isChildAdminOnly = ["/users", "/audit", "/webhook-events"].includes(child.to);
              return !isChildAdminOnly || isAdmin;
            });
            if (visibleChildren.length === 0) return null;

            const isOpen = openMenus[to] || false;
            const isAnyChildActive = visibleChildren.some((child: any) =>
              loc.pathname.startsWith(child.to),
            );

            return (
              <div key={to} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setOpenMenus((prev) => ({ ...prev, [to]: !prev[to] }))}
                  className={cn(
                    "w-full group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-all duration-200 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center",
                    isAnyChildActive
                      ? "bg-sidebar-accent/50 text-sidebar-accent-foreground font-medium"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                  )}
                >
                  <div className="flex items-center gap-3 group-data-[collapsible=icon]:gap-0">
                    <Icon
                      className={cn(
                        "h-4 w-4 transition-transform duration-200 group-hover:scale-110 shrink-0",
                        isAnyChildActive
                          ? "text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70",
                      )}
                    />
                    <span className="transition-transform duration-200 group-hover:translate-x-0.5 group-data-[collapsible=icon]:hidden">
                      {label}
                    </span>
                  </div>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4 text-sidebar-foreground/60 shrink-0 group-data-[collapsible=icon]:hidden" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-sidebar-foreground/60 shrink-0 group-data-[collapsible=icon]:hidden" />
                  )}
                </button>
                {isOpen && (
                  <div className="pl-6 space-y-1 border-l border-sidebar-border/60 ml-5 mt-1 transition-all duration-200 group-data-[collapsible=icon]:hidden">
                    {visibleChildren.map((child: any) => {
                      const childActive = loc.pathname.startsWith(child.to);
                      const ChildIcon = child.icon;
                      return (
                        <Link
                          key={child.to}
                          to={child.to}
                          className={cn(
                            "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs transition-all duration-200",
                            childActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground/60 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground",
                          )}
                        >
                          <ChildIcon className="h-3.5 w-3.5" />
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const active = loc.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:justify-center",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary transition-all duration-200 group-data-[collapsible=icon]:hidden" />
              )}
              <div className="relative flex items-center justify-center shrink-0">
                <Icon
                  className={cn(
                    "h-4 w-4 transition-transform duration-200 group-hover:scale-110",
                    active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/70",
                  )}
                />
                {to === "/chat" && totalUnread > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-2 w-2 rounded-full bg-[#FF424E] border border-sidebar group-data-[collapsible=icon]:block hidden animate-pulse" />
                )}
              </div>
              <span className="transition-transform duration-200 group-hover:translate-x-0.5 group-data-[collapsible=icon]:hidden">
                {label}
              </span>
              {to === "/chat" && totalUnread > 0 && (
                <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#FF424E] px-1.5 text-[10px] font-bold text-white group-data-[collapsible=icon]:hidden animate-pulse">
                  {totalUnread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

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
          <DropdownMenuContent side="top" align="end" className="w-64">
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
              <Link to="/settings" className="cursor-pointer">
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
    </div>
  );

  return (
    <>
      <SeoHead noindex />
      <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
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
            <SheetContent side="left" className="w-[280px] bg-sidebar p-0 text-sidebar-foreground">
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
          {!isAccessAllowed && loc.pathname !== "/license" ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto">
              <div className="h-16 w-16 bg-destructive/10 text-destructive flex items-center justify-center rounded-full mb-6">
                <ShieldAlert className="h-8 w-8 animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-foreground mb-2">
                Acesso Bloqueado — Sem Licença Ativa
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                Sua instalação está sem uma licença ativa válida. O envio de mensagens e o uso da plataforma foram suspensos. Por favor, insira uma licença válida nas configurações ou entre em contato com o suporte para regularizar.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Button asChild variant="default" className="w-full sm:w-auto cursor-pointer">
                  <Link to="/license">Gerenciar Licença</Link>
                </Button>
                <Button asChild variant="outline" className="w-full sm:w-auto bg-[#25D366] hover:bg-[#1ebd56] text-white border-none shadow-sm hover:text-white cursor-pointer">
                  <a href="https://wa.me/5591936180534?text=Ol%C3%A1%2C%20gostaria%20de%20regularizar%20a%20minha%20licen%C3%A7a%20do%20sistema." target="_blank" rel="noopener noreferrer">
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
