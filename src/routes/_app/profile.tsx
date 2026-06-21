import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProfile, updateProfile } from "@/lib/profile.functions";
import { db } from "@/integrations/mysql/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Camera, Loader2, Trash2, User, Building2, KeyRound } from "lucide-react";
import { TwoFactorSection } from "@/components/mfa/two-factor-section";
import { PasswordInput } from "@/components/password-input";
import { useConfirm } from "@/components/confirm-dialog";

export const Route = createFileRoute("/_app/profile")({ component: ProfilePage });

function ProfilePage() {
  const { user } = useAuth();
  const fetchProfile = useServerFn(getProfile);
  const save = useServerFn(updateProfile);
  const qc = useQueryClient();
  const confirm = useConfirm();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
  });

  const [form, setForm] = useState<any>({});
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  const saveMut = useMutation({
    mutationFn: (d: any) => save({ data: d }),
    onSuccess: () => {
      toast.success("Perfil atualizado");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  async function handleUpload(file: File) {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 5MB)");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("O arquivo precisa ser uma imagem");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await db.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = db.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      await save({ data: { avatar_url: url } });
      setForm((f: any) => ({ ...f, avatar_url: url }));
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Foto atualizada");
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao enviar imagem");
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    try {
      await save({ data: { avatar_url: null } });
      setForm((f: any) => ({ ...f, avatar_url: null }));
      qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Foto removida");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setPasswordBusy(true);
    try {
      const { error } = await db.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha de acesso configurada com sucesso!");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao atualizar senha");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleDeletePassword() {
    const ok = await confirm({
      title: "Remover senha de acesso?",
      description: "Tem certeza de que deseja remover a senha? Você perderá o acesso por email + senha e só poderá entrar usando o Google OAuth ou links mágicos enviados por e-mail.",
      destructive: true,
      confirmText: "Remover senha",
      cancelText: "Cancelar"
    });
    if (!ok) return;
    setPasswordBusy(true);
    try {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      const randomPassword = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("") + "A1!";
      
      const { error } = await db.auth.updateUser({ password: randomPassword });
      if (error) throw error;
      toast.success("Senha de acesso removida. A partir de agora você deve entrar via Google ou links mágicos.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao remover senha");
    } finally {
      setPasswordBusy(false);
    }
  }

  if (isLoading) return <div className="p-6 text-muted-foreground">Carregando…</div>;

  const initials = (form.full_name || form.display_name || user?.email || "?")
    .split(/\s+/)
    .map((s: string) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader title="Meu perfil" subtitle="Gerencie sua foto, dados pessoais e dados da empresa." />

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {/* Foto + identificação */}
        <Card className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <Avatar className="h-24 w-24">
                {form.avatar_url && <AvatarImage src={form.avatar_url} alt="Avatar" />}
                <AvatarFallback className="bg-primary/15 text-primary text-xl font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
                  {uploading ? "Enviando…" : "Trocar foto"}
                </Button>
                {form.avatar_url && (
                  <Button variant="ghost" size="sm" onClick={removeAvatar} className="text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" /> Remover
                  </Button>
                )}
              </div>
            </div>
            <div className="flex-1 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">{user?.email}</p>
              <p className="mt-1 text-xs">PNG ou JPG até 5MB. Recomendado 256×256px.</p>
            </div>
          </div>
        </Card>

        {/* Dados pessoais */}
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Dados pessoais</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input
                value={form.full_name ?? ""}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="João da Silva"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nome de exibição</Label>
              <Input
                value={form.display_name ?? ""}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="João"
              />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={user?.email ?? ""} disabled />
              <p className="text-[11px] text-muted-foreground">O e-mail de login não pode ser alterado aqui.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Telefone / WhatsApp pessoal</Label>
              <Input
                value={form.phone ?? ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(11) 99999-0000"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() =>
                saveMut.mutate({
                  full_name: form.full_name ?? null,
                  display_name: form.display_name ?? null,
                  phone: form.phone ?? null,
                })
              }
              disabled={saveMut.isPending}
            >
              Salvar dados pessoais
            </Button>
          </div>
        </Card>

        {/* Dados da empresa */}
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h2 className="font-display text-lg font-semibold">Dados da empresa</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Razão social / Nome da empresa</Label>
              <Input
                value={form.company_name ?? ""}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                placeholder="VW2 Digital LTDA"
              />
            </div>
            <div className="space-y-1.5">
              <Label>CNPJ / Documento</Label>
              <Input
                value={form.company_document ?? ""}
                onChange={(e) => setForm({ ...form, company_document: e.target.value })}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Site</Label>
              <Input
                value={form.company_website ?? ""}
                onChange={(e) => setForm({ ...form, company_website: e.target.value })}
                placeholder="https://suaempresa.com"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Endereço</Label>
              <Textarea
                rows={2}
                value={form.company_address ?? ""}
                onChange={(e) => setForm({ ...form, company_address: e.target.value })}
                placeholder="Rua, número, bairro, cidade — UF, CEP"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() =>
                saveMut.mutate({
                  company_name: form.company_name ?? null,
                  company_document: form.company_document ?? null,
                  company_website: form.company_website ?? null,
                  company_address: form.company_address ?? null,
                })
              }
              disabled={saveMut.isPending}
            >
              Salvar dados da empresa
            </Button>
          </div>
        </Card>

        {/* Senha de acesso */}
        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-semibold">Senha de acesso</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={handleDeletePassword}
              disabled={passwordBusy}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Remover senha
            </Button>
          </div>
          <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
            Configure uma senha para poder logar diretamente com seu e-mail e senha, sem depender exclusivamente de login social (Google) ou links mágicos.
          </p>
          <form onSubmit={handleUpdatePassword} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Nova senha</Label>
              <PasswordInput
                id="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <PasswordInput
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                required
              />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={passwordBusy}>
                {passwordBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar senha
              </Button>
            </div>
          </form>
        </Card>

        {/* 2FA */}
        <TwoFactorSection />
      </div>
    </div>
  );
}
