import { useEffect, useState } from "react";
import { db as supabase } from "@/integrations/mysql/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck, LogOut } from "lucide-react";

type Props = {
  onVerified: () => void;
  onCancel?: () => void;
};

export function MfaChallenge({ onVerified, onCancel }: Props) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }
      const totp = (data?.totp ?? []).find((f: any) => f.status === "verified");
      if (!totp) {
        toast.error("Nenhum fator 2FA encontrado");
        setLoading(false);
        return;
      }
      setFactorId(totp.id);
      const ch = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (ch.error) toast.error(ch.error.message);
      else setChallengeId(ch.data!.id);
      setLoading(false);
    })();
  }, []);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !challengeId) return;
    if (code.length < 6) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
    setBusy(false);
    if (error) {
      toast.error("Código inválido. Tente novamente.");
      setCode("");
      // novo challenge para o próximo intento
      const ch = await supabase.auth.mfa.challenge({ factorId });
      if (!ch.error) setChallengeId(ch.data!.id);
      return;
    }
    toast.success("Verificação concluída");
    onVerified();
  }

  async function cancel() {
    await supabase.auth.signOut();
    onCancel?.();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Preparando verificação…
      </div>
    );
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Verificação em dois fatores necessária.
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="otp">Código do app autenticador</Label>
        <Input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="font-mono text-lg tracking-widest"
          autoFocus
        />
      </div>
      <Button type="submit" className="w-full" disabled={busy || code.length < 6}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Verificar e entrar
      </Button>
      <Button type="button" variant="ghost" className="w-full" onClick={cancel}>
        <LogOut className="mr-2 h-4 w-4" /> Cancelar e sair
      </Button>
    </form>
  );
}
