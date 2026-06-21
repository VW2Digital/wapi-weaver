import { createFileRoute, Outlet, Link, useRouter, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { db } from "@/integrations/mysql/client";
import { MessageCircle, LayoutDashboard, Users, ListChecks, FileText, Send, Settings, LogOut, User as UserIcon, ChevronUp, Sun, Moon, Receipt, ShieldCheck, Menu, ScrollText, UserCog, ShieldAlert, Activity } from "lucide-react";
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
import { useEffect, useState } from "react";

function useGravatarUrl(email: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!email) { setUrl(null); return; }
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
  
  { to: "/billing", label: "Faturamento", icon: Receipt },
  { to: "/users", label: "Usuários", icon: ShieldCheck },
  { to: "/audit", label: "Auditoria", icon: ScrollText },
  { to: "/webhook-events", label: "Eventos do Webhook", icon: Activity },
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

  useEffect(() => {
    if (!user) { setProfileAvatar(null); return; }
    let cancelled = false;
    db.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle().then(({ data }: any) => {
      if (!cancelled) setProfileAvatar(data?.avatar_url ?? null);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const avatarUrl = profileAvatar || gravatarUrl;

  // Close drawer on navigation
  useEffect(() => { setMobileOpen(false); }, [loc.pathname]);

  useEffect(() => {
    if (!loading && !user) {
      router.navigate({ to: "/login", replace: true });
    }
  }, [loading, user?.id, router]);

  // Garante AAL2 quando o usuário tem 2FA habilitado
  useEffect(() => {
    if (!user) { setMfaOk(null); return; }
    let cancelled = false;
    db.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }: any) => {
      if (cancelled) return;
      if (data && data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
        setMfaOk(false);
      } else {
        setMfaOk(true);
      }
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (mfaOk === false) {
      router.navigate({ to: "/login", replace: true });
    }
  }, [mfaOk, router]);

  if (loading || (user && mfaOk === null) || (user && mfaOk && rolesLoading)) {
    return <div className="flex min-h-dvh items-center justify-center text-muted-foreground">Carregando…</div>;
  }
  if (!user || mfaOk === false) {
    return <div className="flex min-h-dvh items-center justify-center text-muted-foreground">Carregando…</div>;
  }

  const logout = async () => {
    await db.auth.signOut();
    router.navigate({ to: "/login", replace: true });
  };
  const SidebarBody = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-6 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary">
          <MessageCircle className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
        <span className="font-display text-base font-semibold text-sidebar-foreground">ZapDispatch</span>
      </div>
      <div className="px-6 pb-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/60">Menu</div>
      <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
        {NAV.map(({ to, label, icon: Icon }) => {
          const isAdminOnly = ["/users", "/audit", "/webhook-events", "/billing"].includes(to);
          if (isAdminOnly && !isAdmin) return null;
          const active = loc.pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
              )}
            >
              {active && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-sidebar-primary transition-all duration-200" />}
              <Icon className={cn("h-4 w-4 transition-transform duration-200 group-hover:scale-110", active ? "text-sidebar-accent-foreground" : "text-sidebar-foreground/70")} />
              <span className="transition-transform duration-200 group-hover:translate-x-0.5">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="m-3 mt-4 border-t border-sidebar-border pt-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button aria-label="Abrir menu do usuário" className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left text-sidebar-foreground hover:bg-sidebar-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring transition-colors">
              <Avatar className="h-9 w-9">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={user.email ?? ""} />}
                <AvatarFallback className="bg-sidebar-primary/15 text-sidebar-primary text-xs font-semibold">
                  {(user.email ?? "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-sidebar-foreground">{user.email?.split("@")[0]}</div>
                <div className="text-xs text-sidebar-foreground/60 truncate">{user.email}</div>
              </div>
              <ChevronUp className="h-4 w-4 text-sidebar-foreground/60 shrink-0" />
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
            <DropdownMenuItem onClick={(e) => { e.preventDefault(); toggleTheme(); }} className="cursor-pointer">
              {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {theme === "dark" ? "Tema claro" : "Tema escuro"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background p-3 md:pl-[276px]">
      <aside className="hidden md:flex flex-col rounded-2xl border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm md:fixed md:inset-y-3 md:left-3 md:w-[260px] md:z-30">
        {SidebarBody}
      </aside>



      {/* Mobile top bar */}
      <header className="md:hidden mb-3 flex items-center gap-2 rounded-2xl border bg-card px-3 py-2 shadow-sm">
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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
            <MessageCircle className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <span className="font-display text-sm font-semibold">ZapDispatch</span>
        </div>
      </header>

      <main className="rounded-2xl border bg-card shadow-sm overflow-hidden h-[calc(100dvh-1.5rem)] flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
