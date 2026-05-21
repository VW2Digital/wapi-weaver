import { createFileRoute, Navigate, Outlet, Link, useRouter, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, LayoutDashboard, Users, ListChecks, FileText, Send, Settings, LogOut, User as UserIcon, ChevronUp, Sun, Moon, Receipt } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/_app")({ component: AppLayout });

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/contacts", label: "Contatos", icon: Users },
  { to: "/lists", label: "Listas & Tags", icon: ListChecks },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/campaigns", label: "Campanhas", icon: Send },
  { to: "/settings", label: "Configurações", icon: Settings },
] as const;

function AppLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const loc = useLocation();
  const { theme, toggleTheme } = useTheme();

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  }
  if (!user) return <Navigate to="/login" />;

  const logout = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-background p-3 md:pl-[276px]">
      <aside className="flex flex-col rounded-2xl border bg-sidebar text-sidebar-foreground shadow-sm md:fixed md:inset-y-3 md:left-3 md:w-[260px] md:z-30">
        <div className="flex items-center gap-2 px-6 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <MessageCircle className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-base font-semibold">ZapDispatch</span>
        </div>
        <div className="px-6 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Menu</div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = loc.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                )}
              >
                {active && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 mt-4 border-t pt-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-sidebar-accent/40 transition-colors">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">
                    {(user.email ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{user.email?.split("@")[0]}</div>
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                </div>
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
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
                <Link to="/settings" className="cursor-pointer">
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
      </aside>
      <main className="rounded-2xl border bg-card shadow-sm overflow-hidden h-[calc(100vh-1.5rem)] flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
