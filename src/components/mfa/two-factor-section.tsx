import { useEffect, useState } from "react";
import { db as supabase } from "@/integrations/mysql/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, ShieldOff, Loader2, KeyRound } from "lucide-react";

type Factor = { id: string; status: "verified" | "unverified"; friendly_name?: string | null };

export function TwoFactorSection() {
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enrolling, setEnrolling] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.listFactors();
    setLoading(false);
    if (error) return toast.error(error.message);
    setFactors((data?.all ?? []) as Factor[]);
  }

  useEffect(() => {
    refresh();
  }, []);

  const verified = factors.filter((f) => f.status === "verified");

  async function startEnroll() {
    setBusy(true);
    try {
      // Limpa fatores não verificados antigos
      for (const f of factors.filter((x) => x.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `App ${new Date().toLocaleDateString("pt-BR")}`,
      });
      if (error) throw error;
      if (!data) throw new Error("Falha ao iniciar 2FA");
      setEnrolling({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
      setCode("");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao iniciar 2FA");
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll() {
    if (!enrolling) return;
    if (code.length < 6) return toast.error("Informe o código de 6 dígitos");
    setBusy(true);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrolling.factorId });
      if (chErr) throw chErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId: enrolling.factorId,
        challengeId: ch!.id,
        code,
      });
      if (vErr) throw vErr;
      toast.success("2FA ativado com sucesso");
      setEnrolling(null);
      setCode("");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Código inválido");
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnroll() {
    if (!enrolling) return;
    await supabase.auth.mfa.unenroll({ factorId: enrolling.factorId });
    setEnrolling(null);
    setCode("");
    refresh();
  }

  async function disable(factorId: string) {
    if (!confirm("Desativar 2FA? Sua conta voltará a depender apenas da senha.")) return;
    setBusy(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("2FA desativado");
    refresh();
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h2 className="font-display text-lg font-semibold">Autenticação em dois fatores (2FA)</h2>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        Aumente a segurança da sua conta exigindo um código gerado em um app autenticador
        (Google Authenticator, Authy, 1Password, etc.) ao entrar.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : verified.length > 0 && !enrolling ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            2FA está <strong>ativo</strong> nesta conta.
          </div>
          {verified.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="text-sm">
                <div className="font-medium">{f.friendly_name || "App autenticador"}</div>
                <div className="text-xs text-muted-foreground">TOTP — código de 6 dígitos</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => disable(f.id)} disabled={busy}>
                <ShieldOff className="mr-2 h-4 w-4" /> Desativar
              </Button>
            </div>
          ))}
        </div>
      ) : enrolling ? (
        <div className="space-y-4">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Abra seu app autenticador e adicione uma nova conta.</li>
            <li>Escaneie o QR Code abaixo (ou digite a chave manual).</li>
            <li>Informe o código de 6 dígitos exibido pelo app para confirmar.</li>
          </ol>
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-4 sm:flex-row sm:items-start">
            <img src={enrolling.qr} alt="QR Code 2FA" className="h-44 w-44 rounded bg-white p-2" />
            <div className="flex-1 space-y-2 text-sm">
              <div>
                <Label className="text-xs">Chave manual</Label>
                <code className="mt-1 block break-all rounded bg-background px-2 py-1 font-mono text-xs">
                  {enrolling.secret}
                </code>
              </div>
              <div>
                <Label htmlFor="totp">Código do app</Label>
                <Input
                  id="totp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="font-mono text-lg tracking-widest"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={cancelEnroll} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={confirmEnroll} disabled={busy || code.length < 6}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
              Ativar 2FA
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-dashed p-4">
          <div className="text-sm text-muted-foreground">2FA está desativado nesta conta.</div>
          <Button onClick={startEnroll} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
            Ativar 2FA
          </Button>
        </div>
      )}
    </Card>
  );
}
