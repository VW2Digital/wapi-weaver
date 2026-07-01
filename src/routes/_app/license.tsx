import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDetailedLicenseStatus, activateLicenseMutation } from "@/lib/admin.functions";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert, Key } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/license")({
  component: LicensePage,
});

function LicensePage() {
  const { user } = useAuth();
  const { isAdmin } = useRoles();
  const queryClient = useQueryClient();
  const router = useRouter();

  const fetchLicenseStatus = useServerFn(getDetailedLicenseStatus);
  const activateLicense = useServerFn(activateLicenseMutation);

  const [licenseKey, setLicenseKey] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["detailed-license-status"],
    queryFn: () => fetchLicenseStatus(),
    enabled: !!user && isAdmin,
  });

  const mutation = useMutation({
    mutationFn: (key: string) => activateLicense({ data: { licenseKey: key } }),
    onSuccess: () => {
      toast.success("Licença ativada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["detailed-license-status"] });
      queryClient.invalidateQueries({ queryKey: ["license-status"] }); // also global one
      setLicenseKey("");
      router.invalidate();
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao ativar licença");
    },
  });

  if (!isAdmin) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <h2 className="text-xl font-bold">Acesso Negado</h2>
        <p className="text-muted-foreground mt-2">Apenas administradores podem gerenciar a licença do sistema.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6">Carregando informações da licença...</div>;
  }

  const isValida = data?.status === "active";

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Key className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Gerenciamento de Licença</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Status da Licença
            {isValida ? (
              <ShieldCheck className="w-5 h-5 text-green-500" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-destructive" />
            )}
          </CardTitle>
          <CardDescription>
            Informações sobre a licença atual do sistema e comunicação com o painel central.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 p-4 rounded-lg">
              <span className="block text-xs font-semibold uppercase text-muted-foreground mb-1">Status</span>
              <span className={`font-medium ${isValida ? "text-green-600" : "text-destructive"}`}>
                {data?.status === "active" ? "Ativa" : data?.status === "missing" ? "Ausente" : "Inválida/Bloqueada"}
              </span>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg">
              <span className="block text-xs font-semibold uppercase text-muted-foreground mb-1">Plano</span>
              <span className="font-medium capitalize">{data?.plan || "N/A"}</span>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg">
              <span className="block text-xs font-semibold uppercase text-muted-foreground mb-1">Domínio Autorizado</span>
              <span className="font-medium">{data?.domain || "N/A"}</span>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg">
              <span className="block text-xs font-semibold uppercase text-muted-foreground mb-1">Data de Expiração</span>
              <span className="font-medium">
                {data?.expires_at
                  ? format(new Date(data.expires_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                  : "Vitalícia / N/A"}
              </span>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg col-span-2">
              <span className="block text-xs font-semibold uppercase text-muted-foreground mb-1">Última Validação</span>
              <span className="font-medium">
                {data?.last_validated_at
                  ? format(new Date(data.last_validated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                  : "Nunca"}
              </span>
            </div>
          </div>

          {!isValida && data?.last_error && (
            <div className="mt-4 p-4 border border-destructive/20 bg-destructive/10 text-destructive rounded-lg text-sm">
              <p className="font-semibold mb-1">Motivo do Bloqueio:</p>
              <p>{data.last_error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ativar ou Atualizar Licença</CardTitle>
          <CardDescription>
            Insira a chave da licença recebida para ativar o uso da plataforma neste domínio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (licenseKey.trim().length > 0) {
                mutation.mutate(licenseKey.trim());
              }
            }}
            className="flex gap-3"
          >
            <Input
              type="text"
              placeholder="Ex: VW2-PRO-1234-5678-90AB"
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              disabled={mutation.isPending}
              className="flex-1"
            />
            <Button type="submit" disabled={mutation.isPending || !licenseKey.trim()}>
              {mutation.isPending ? "Ativando..." : "Ativar Licença"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
