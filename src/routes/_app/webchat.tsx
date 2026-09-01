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
import { Copy, Plus, ArrowLeft, MessageCircle, ChevronRight } from "lucide-react";
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
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);

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

  const selectedWidget = selectedWidgetId
    ? widgets.find((w: WebchatWidget) => w.id === selectedWidgetId)
    : null;

  const createMutation = useMutation({
    mutationFn: () => createWidget({}),
    onSuccess: () => {
      toast.success("Widget criado");
      queryClient.invalidateQueries({ queryKey: ["webchat-widgets"] });
    },
    onError: () => toast.error("Erro ao criar widget"),
  });

  if (selectedWidget) {
    return (
      <div className="p-6">
        <WidgetCard
          widget={selectedWidget}
          updateWidget={updateWidget}
          queryClient={queryClient}
          onBack={() => setSelectedWidgetId(null)}
        />
      </div>
    );
  }

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

      {widgets.length > 0 && (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden divide-y divide-border">
          {widgets.map((widget: WebchatWidget) => (
            <button
              key={widget.id}
              onClick={() => setSelectedWidgetId(widget.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-muted/40 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 bg-primary/10 text-primary flex items-center justify-center rounded-xl shrink-0 group-hover:scale-105 transition-transform">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <h5 className="font-semibold text-sm text-foreground">{widget.title}</h5>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {widget.enabled ? "Ativo" : "Inativo"} · Public ID: {widget.publicId}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground/60 group-hover:translate-x-0.5 transition-transform" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function WidgetCard({
  widget,
  updateWidget,
  queryClient,
  onBack,
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
  onBack: () => void;
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
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para lista
        </Button>
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

        <WidgetPreview
          title={form.title}
          welcomeMessage={form.welcomeMessage}
          placeholder={form.placeholder}
          accentColor={form.accentColor}
          position={form.position}
          enabled={form.enabled}
        />
      </CardContent>
    </Card>
  );
}

function WidgetPreview({
  title,
  welcomeMessage,
  placeholder,
  accentColor,
  position,
  enabled,
}: {
  title: string;
  welcomeMessage: string;
  placeholder: string;
  accentColor: string;
  position: string;
  enabled: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isLeft = position === "bottom-left";

  return (
    <div className="space-y-2">
      <Label>Visualização</Label>
      <div className="relative h-96 bg-muted/30 rounded-lg border overflow-hidden">
        {!enabled && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 text-sm font-medium">
            Widget inativo
          </div>
        )}

        {isOpen && (
          <div
            className={`absolute bottom-20 ${isLeft ? "left-4" : "right-4"} w-80 h-[22rem] bg-background rounded-2xl shadow-xl border overflow-hidden flex flex-col z-10`}
          >
            <div
              className="px-4 py-3 text-white font-semibold text-sm flex items-center gap-2"
              style={{ backgroundColor: accentColor }}
            >
              <MessageCircle className="h-4 w-4" />
              {title || "Chat"}
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50 dark:bg-slate-950">
              {(welcomeMessage || "Olá! Como podemos ajudar?") && (
                <div className="self-start bg-white dark:bg-slate-900 border text-foreground max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-sm text-sm">
                  {welcomeMessage || "Olá! Como podemos ajudar?"}
                </div>
              )}
            </div>
            <div className="p-3 border-t bg-background flex items-center gap-2">
              <input
                type="text"
                readOnly
                placeholder={placeholder || "Digite uma mensagem..."}
                className="flex-1 bg-muted px-3 py-2 rounded-lg text-sm outline-none"
              />
              <button
                type="button"
                className="px-3 py-2 rounded-lg text-white text-sm font-medium"
                style={{ backgroundColor: accentColor }}
                disabled
              >
                Enviar
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => enabled && setIsOpen((v) => !v)}
          className={`absolute bottom-4 ${isLeft ? "left-4" : "right-4"} w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105 z-10`}
          style={{ backgroundColor: enabled ? accentColor : "#9ca3af" }}
          disabled={!enabled}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
