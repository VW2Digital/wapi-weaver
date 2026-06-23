import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { db } from "@/integrations/mysql/client";
import {
  WHATSAPP_VERTICALS,
  type WhatsAppBusinessProfile,
} from "@/lib/whatsapp-business-profile.shared";
import {
  getWhatsAppBusinessProfile,
  updateWhatsAppBusinessProfile,
} from "@/lib/whatsapp-business-profile.functions";

export const Route = createFileRoute("/_app/whatsapp-business-profile")({
  component: WhatsAppBusinessProfilePage,
});

type FormState = {
  about: string;
  address: string;
  description: string;
  email: string;
  websites: string[];
  vertical: string;
};

function toForm(p: WhatsAppBusinessProfile): FormState {
  return {
    about: p.about ?? "",
    address: p.address ?? "",
    description: p.description ?? "",
    email: p.email ?? "",
    websites: [...(p.websites ?? [])],
    vertical: p.vertical ?? "",
  };
}

/** Bloco de skeleton animado */
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted ${className}`}
    />
  );
}

function WhatsAppBusinessProfilePage() {
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getWhatsAppBusinessProfile);
  const saveProfile = useServerFn(updateWhatsAppBusinessProfile);

  const [form, setForm] = useState<FormState>({
    about: "",
    address: "",
    description: "",
    email: "",
    websites: [],
    vertical: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [profilePictureHandle, setProfilePictureHandle] = useState<string>("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const profileQuery = useQuery({
    queryKey: ["whatsapp-business-profile"],
    queryFn: async () => {
      const res = await fetchProfile();
      if (!res.success) throw new Error(res.message || "Falha ao buscar perfil empresarial.");
      return res.data;
    },
  });

  useEffect(() => {
    if (profileQuery.data) setForm(toForm(profileQuery.data));
  }, [profileQuery.data]);

  // Gera preview local quando o usuário seleciona um arquivo
  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview("");
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const photoUrl = profileQuery.data?.profile_picture_url ?? "";

  const websitesSlots = useMemo(() => {
    const w = [...(form.websites ?? [])].slice(0, 2);
    while (w.length < 2) w.push("");
    return w;
  }, [form.websites]);

  const uploadPhoto = async () => {
    if (!photoFile) return;
    setUploadingPhoto(true);
    try {
      const { data: sessionData } = await db.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sessão expirada. Faça login novamente.");

      const fd = new FormData();
      fd.append("profile_picture", photoFile);
      const r = await fetch("/api/whatsapp/business-profile/photo", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok || !body?.success) {
        throw new Error(body?.message || "Falha no upload da foto.");
      }
      setProfilePictureHandle(body.profile_picture_handle);
      toast.success('Foto enviada. Clique em "Salvar alterações" para aplicar no WhatsApp.');
    } catch (e: any) {
      toast.error(e?.message || "Erro no upload da foto.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const websites = websitesSlots.map((x) => x.trim()).filter(Boolean);
      const res = await saveProfile({
        data: {
          about: form.about,
          address: form.address,
          description: form.description,
          email: form.email,
          websites,
          vertical: form.vertical,
          profile_picture_handle: profilePictureHandle || undefined,
        },
      });
      if (!res.success) throw new Error(res.message || "Falha ao salvar.");
      return res;
    },
    onSuccess: (res) => {
      toast.success(res.message || "Salvo!");
      setProfilePictureHandle("");
      setPhotoFile(null);
      setPhotoPreview("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["whatsapp-business-profile"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar."),
  });

  const isLoading = profileQuery.isLoading;
  const isError = profileQuery.isError;

  // A foto exibida é o preview local (se houver) ou a foto da Meta
  const displayedPhoto = photoPreview || photoUrl;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Perfil Empresarial do WhatsApp"
        subtitle="Edite os dados públicos do perfil do número conectado à Cloud API."
      />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Estado de erro */}
        {isError && (
          <div className="mb-6 flex items-center gap-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <span className="flex-1">
              {(profileQuery.error as any)?.message || "Erro ao carregar os dados do perfil."}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => profileQuery.refetch()}
              disabled={profileQuery.isFetching}
            >
              {profileQuery.isFetching ? "Tentando..." : "Tentar novamente"}
            </Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Card da foto */}
          <Card className="p-5 lg:col-span-1">
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium">Foto atual</div>
                <div className="mt-2 flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-muted">
                    {isLoading ? (
                      <Skeleton className="h-full w-full rounded-none" />
                    ) : displayedPhoto ? (
                      <>
                        <img
                          src={displayedPhoto}
                          alt="Foto do perfil"
                          className="h-full w-full object-cover"
                        />
                        {/* badge "preview" quando for foto local */}
                        {photoPreview && (
                          <span className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-white">
                            Preview
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="h-full w-full grid place-items-center text-xs text-muted-foreground">
                        sem foto
                      </div>
                    )}
                  </div>

                  {/* URL / info */}
                  <div className="text-xs text-muted-foreground break-all">
                    {isLoading ? (
                      <div className="space-y-1.5">
                        <Skeleton className="h-3 w-40" />
                        <Skeleton className="h-3 w-28" />
                      </div>
                    ) : photoPreview ? (
                      <span className="text-amber-500 font-medium">
                        Foto local selecionada — faça upload para enviar.
                      </span>
                    ) : photoUrl ? (
                      <span className="select-all">{photoUrl}</span>
                    ) : (
                      "A Meta não retornou profile_picture_url."
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Trocar foto (JPG/PNG)</Label>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  disabled={isLoading}
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={uploadPhoto}
                    disabled={!photoFile || uploadingPhoto || isLoading}
                    variant="secondary"
                  >
                    {uploadingPhoto ? "Enviando..." : "Fazer upload"}
                  </Button>
                  {profilePictureHandle ? (
                    <div className="text-xs text-green-600 dark:text-green-400 self-center font-medium">
                      ✓ Handle pronto para salvar.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => profileQuery.refetch()}
                  disabled={profileQuery.isFetching}
                  className="w-full"
                >
                  {profileQuery.isFetching ? "Atualizando..." : "Atualizar dados da Meta"}
                </Button>
              </div>
            </div>
          </Card>

          {/* Card dos campos */}
          <Card className="p-5 lg:col-span-2">
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Sobre (about)</Label>
                  {isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Input
                      value={form.about}
                      onChange={(e) => setForm((s) => ({ ...s, about: e.target.value }))}
                      placeholder="Texto curto sobre a empresa"
                    />
                  )}
                  <div className="text-xs text-muted-foreground">{form.about.trim().length}/139</div>
                </div>

                <div className="space-y-2">
                  <Label>Categoria (vertical)</Label>
                  {isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <NativeSelect
                      value={form.vertical}
                      onChange={(e) => setForm((s) => ({ ...s, vertical: e.target.value }))}
                    >
                      <option value="">(não alterar)</option>
                      {WHATSAPP_VERTICALS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição (description)</Label>
                {isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : (
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm((s) => ({ ...s, description: e.target.value }))}
                    placeholder="Descrição mais completa da empresa"
                    rows={4}
                  />
                )}
                <div className="text-xs text-muted-foreground">{form.description.trim().length}/512</div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Endereço (address)</Label>
                  {isLoading ? (
                    <Skeleton className="h-20 w-full" />
                  ) : (
                    <Textarea
                      value={form.address}
                      onChange={(e) => setForm((s) => ({ ...s, address: e.target.value }))}
                      placeholder="Endereço da empresa"
                      rows={3}
                    />
                  )}
                  <div className="text-xs text-muted-foreground">{form.address.trim().length}/256</div>
                </div>

                <div className="space-y-2">
                  <Label>E-mail (email)</Label>
                  {isLoading ? (
                    <Skeleton className="h-10 w-full" />
                  ) : (
                    <Input
                      value={form.email}
                      onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                      placeholder="contato@empresa.com"
                    />
                  )}
                  <div className="text-xs text-muted-foreground">
                    Para evitar apagar dados sem querer, e-mail vazio não é enviado.
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sites (websites) (máx. 2)</Label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {isLoading ? (
                    <>
                      <Skeleton className="h-10 w-full" />
                      <Skeleton className="h-10 w-full" />
                    </>
                  ) : (
                    websitesSlots.map((v, idx) => (
                      <Input
                        key={idx}
                        value={v}
                        onChange={(e) => {
                          const next = [...websitesSlots];
                          next[idx] = e.target.value;
                          setForm((s) => ({ ...s, websites: next }));
                        }}
                        placeholder={idx === 0 ? "https://www.empresa.com.br" : "https://instagram.com/empresa"}
                      />
                    ))
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Dica: URLs precisam começar com <code>http://</code> ou <code>https://</code>.
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || isLoading}
                >
                  {saveMutation.isPending ? "Salvando..." : "Salvar alterações"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (profileQuery.data) {
                      setForm(toForm(profileQuery.data));
                      setProfilePictureHandle("");
                      setPhotoFile(null);
                      setPhotoPreview("");
                      if (fileInputRef.current) fileInputRef.current.value = "";
                      toast.message("Alterações locais descartadas.");
                    }
                  }}
                  disabled={!profileQuery.data}
                >
                  Descartar alterações
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
