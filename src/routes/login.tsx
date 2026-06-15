import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
import { MfaChallenge } from "@/components/mfa/mfa-challenge";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);

  useEffect(() => {
    if (mfaRequired) return;
    if (user) {
      // Verifica se o usuário precisa concluir 2FA antes de entrar
      supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
        if (data && data.nextLevel === "aal2" && data.currentLevel !== "aal2") {
          setMfaRequired(true);
        } else {
          navigate({ to: "/dashboard" });
        }
      });
    }
  }, [user, navigate, mfaRequired]);

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

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Se este email existir, você receberá um link em instantes.");
      setForgotOpen(false);
      setForgotEmail("");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao enviar email");
    } finally {
      setForgotBusy(false);
    }
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
            {mfaRequired ? "Verificação 2FA" : mode === "signin" ? "Entrar" : "Criar conta"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mfaRequired
              ? "Informe o código gerado pelo seu app autenticador."
              : mode === "signin"
                ? "Acesse seu painel de disparo."
                : "Comece a configurar suas campanhas."}
          </p>

          {mfaRequired ? (
            <div className="mt-6">
              <MfaChallenge
                onVerified={() => { setMfaRequired(false); navigate({ to: "/dashboard" }); }}
                onCancel={() => setMfaRequired(false)}
              />
            </div>
          ) : (
          <>


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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                {mode === "signin" && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-primary hover:underline"
                    onClick={() => { setForgotEmail(email); setForgotOpen(true); }}
                  >
                    Esqueci minha senha
                  </button>
                )}
              </div>
              <PasswordInput id="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "signin" ? "Entrar" : "Criar conta"}
            </Button>
            {mode === "signin" && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={async () => {
                  if (!email) {
                    toast.error("Informe seu e-mail para receber o link mágico.");
                    return;
                  }
                  setBusy(true);
                  try {
                    const { error } = await supabase.auth.signInWithOtp({
                      email,
                      options: {
                        emailRedirectTo: `${window.location.origin}/dashboard`,
                      },
                    });
                    if (error) throw error;
                    toast.success("Link mágico enviado! Verifique sua caixa de entrada.");
                  } catch (e: any) {
                    toast.error(e.message ?? "Falha ao enviar link mágico");
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
              >
                Entrar com Link Mágico (sem senha)
              </Button>
            )}
          </form>

          <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Recuperar acesso</DialogTitle>
              </DialogHeader>
              <form onSubmit={sendReset} className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Informe o e-mail da conta. Enviaremos um link para você definir uma nova senha.
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">E-mail</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={forgotBusy}>
                  Enviar link de recuperação
                </Button>
              </form>
            </DialogContent>
          </Dialog>


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
          <footer className="mt-6 flex flex-wrap items-center justify-center gap-3 border-t pt-4 text-[11px] text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground">Política de Privacidade</Link>
            <span className="text-border">|</span>
            <Link to="/terms" className="hover:text-foreground">Termos de Serviço</Link>
            <span className="text-border">|</span>
            <Link to="/data-deletion" className="hover:text-foreground">Exclusão de Dados</Link>
          </footer>
          </>
          )}
        </Card>
      </div>
    </div>
  );
}
