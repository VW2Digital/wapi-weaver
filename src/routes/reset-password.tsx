import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MessageCircle, Lock } from "lucide-react";

export const Route = createFileRoute("/reset-password")({ component: ResetPasswordPage });

function ResetPasswordPage() {
  const navigate = useNavigate();
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") ?? "";
  }, []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Link inválido. Solicite uma nova recuperação de senha.");
      return;
    }
    if (password.length < 8) {
      toast.error("A senha precisa ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao atualizar senha");
      toast.success("Senha atualizada! Faça login novamente.");
      navigate({ to: "/login" });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao atualizar senha");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <MessageCircle className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-semibold">Definir nova senha</span>
        </div>

        {!token ? (
          <p className="text-sm text-muted-foreground">
            Link inválido. Volte ao{" "}
            <a href="/login" className="text-primary hover:underline">
              login
            </a>{" "}
            e clique em Esqueci minha senha.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Nova senha</Label>
              <PasswordInput
                id="password"
                value={password}
                minLength={8}
                required
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmar nova senha</Label>
              <PasswordInput
                id="confirm"
                value={confirm}
                minLength={8}
                required
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              <Lock className="mr-2 h-4 w-4" /> Atualizar senha
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
