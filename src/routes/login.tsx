import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: name },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (e: any) {
      toast.error(e.message ?? "Falha na autenticação");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) toast.error("Falha no login com Google");
    setBusy(false);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-sidebar p-12 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <MessageCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-semibold">ZapDispatch</span>
        </div>
        <div className="space-y-4">
          <h1 className="font-display text-4xl font-semibold leading-tight">
            Dispare mensagens em escala com a API oficial do WhatsApp.
          </h1>
          <p className="text-sidebar-foreground/70">
            Contatos, listas, templates aprovados, fila de envio e webhooks de status — tudo em um painel.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">
          100% via WhatsApp Cloud API da Meta. Sem chip, sem instância.
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8">
          <h2 className="font-display text-2xl font-semibold">
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "signin" ? "Acesse seu painel de disparo." : "Comece a configurar suas campanhas."}
          </p>

          <Button type="button" variant="outline" className="mt-6 w-full" onClick={google} disabled={busy}>
            Continuar com Google
          </Button>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> ou <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Não tem conta?" : "Já tem conta?"}{" "}
            <button
              type="button"
              className="font-medium text-primary hover:underline"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "Criar agora" : "Entrar"}
            </button>
          </p>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            <Link to="/">← Voltar</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
