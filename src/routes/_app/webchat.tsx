import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { usePageHeader } from "@/components/layout/page-header-provider";
import { Copy, Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  getWebchatWidgets,
  createWebchatWidget,
  updateWebchatWidget,
  type WebchatWidget,
} from "@/lib/webchat.functions";

export const Route = createFileRoute("/_app/webchat")({
  component: WebchatSettingsPage,
});

const POSITIONS = [
  { value: "bottom-right", label: "Inferior direito" },
  { value: "bottom-left", label: "Inferior esquerdo" },
];

function WebchatSettingsPage() {
  const getWidgets = useServerFn(getWebchatWidgets);
  const createWidget = useServerFn(createWebchatWidget);
  const updateWidget = useServerFn(updateWebchatWidget);
  const queryClient = useQueryClient();

  usePageHeader({
    title: "WebChat",
    subtitle: "Gerencie widgets e copie o código de instalação.",
    action: (
      <Button variant="outline" size="sm" asChild>
        <Link to="/settings" search={{ s: undefined }}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Link>
      </Button>
    ),
  });

  const { data: widgets = [], isLoading } = useQuery({
    queryKey: ["webchat-widgets"],
    queryFn: () => getWidgets({}),
  });

  const createMutation = useMutation({
    mutationFn: () => createWidget({}),
    onSuccess: () => {
      toast.success("Widget criado");
      queryClient.invalidateQueries({ queryKey: ["webchat-widgets"] });
    },
    onError: () => toast.error("Erro ao criar widget"),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-end">
        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          <Plus className="h-4 w-4 mr-2" />
          Criar widget
        </Button>
      </div>

      {widgets.length === 0 && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum widget configurado</CardTitle>
            <CardDescription>
              Clique em “Criar widget” para gerar o código de instalação do WebChat.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {widgets.map((widget: WebchatWidget) => (
        <WidgetCard
          key={widget.id}
          widget={widget}
          updateWidget={updateWidget}
          queryClient={queryClient}
        />
      ))}
    </div>
  );
}

function WidgetCard({
  widget,
  updateWidget,
  queryClient,
}: {
  widget: WebchatWidget;
  updateWidget: (args: {
    data: {
      id: string;
      title?: string;
      welcomeMessage?: string;
      placeholder?: string;
      accentColor?: string;
      enabled?: boolean;
      position?: string;
    };
  }) => Promise<{ ok: boolean }>;
  queryClient: any;
}) {
  const [form, setForm] = useState({
    title: widget.title,
    welcomeMessage: widget.welcomeMessage || "",
    placeholder: widget.placeholder,
    accentColor: widget.accentColor,
    enabled: widget.enabled,
    position: widget.position,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: { id: string } & Partial<typeof form>) =>
      updateWidget({ data: payload }),
    onSuccess: () => {
      toast.success("Widget atualizado");
      queryClient.invalidateQueries({ queryKey: ["webchat-widgets"] });
    },
    onError: () => toast.error("Erro ao atualizar widget"),
  });

  const [copied, setCopied] = useState(false);
  const snippet = widget.embedCode || "";

  const handleCopy = async () => {
    if (!navigator.clipboard) {
      toast.error("Navegador não suporta cópia automática");
      return;
    }
    if (!snippet) {
      toast.error("Código de instalação indisponível");
      return;
    }
    try {
      await navigator.clipboard.writeText(snippet);
      toast.success("Código copiado");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{widget.title}</CardTitle>
        <CardDescription className="space-y-1">
          <p>Public ID: {widget.publicId}</p>
          <p>Status: {widget.enabled ? "Ativo" : "Inativo"}</p>
          <p className="truncate">
            Domínios permitidos: {widget.allowedOrigins.length > 0 ? widget.allowedOrigins.join(", ") : "Nenhum"}
          </p>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`title-${widget.id}`}>Título</Label>
            <Input
              id={`title-${widget.id}`}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onBlur={() =>
                updateMutation.mutate({ id: widget.id, title: form.title })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`color-${widget.id}`}>Cor</Label>
            <Input
              id={`color-${widget.id}`}
              value={form.accentColor}
              onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
              onBlur={() =>
                updateMutation.mutate({ id: widget.id, accentColor: form.accentColor })
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`welcome-${widget.id}`}>Mensagem de boas-vindas</Label>
            <Input
              id={`welcome-${widget.id}`}
              value={form.welcomeMessage}
              onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
              onBlur={() =>
                updateMutation.mutate({
                  id: widget.id,
                  welcomeMessage: form.welcomeMessage,
                })
              }
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor={`placeholder-${widget.id}`}>Placeholder</Label>
            <Input
              id={`placeholder-${widget.id}`}
              value={form.placeholder}
              onChange={(e) => setForm({ ...form, placeholder: e.target.value })}
              onBlur={() =>
                updateMutation.mutate({
                  id: widget.id,
                  placeholder: form.placeholder,
                })
              }
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              id={`enabled-${widget.id}`}
              checked={form.enabled}
              onCheckedChange={(checked: boolean) => {
                setForm({ ...form, enabled: checked });
                updateMutation.mutate({ id: widget.id, enabled: checked });
              }}
            />
            <Label htmlFor={`enabled-${widget.id}`}>Ativo</Label>
          </div>
          <select
            value={form.position}
            onChange={(e) => {
              setForm({ ...form, position: e.target.value });
              updateMutation.mutate({ id: widget.id, position: e.target.value });
            }}
            className="border rounded p-1"
          >
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label>Código de instalação</Label>
          <div className="relative">
            <pre className="bg-muted p-3 rounded text-sm overflow-x-auto whitespace-pre-wrap">
              {snippet}
            </pre>
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-2 right-2"
              onClick={handleCopy}
            >
              <Copy className="h-4 w-4 mr-1" />
              {copied ? "Copiado!" : "Copiar código"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Cole este código antes do fechamento da tag {"</body>"} do seu site.
            O domínio do site precisa estar cadastrado nos domínios permitidos deste widget.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
