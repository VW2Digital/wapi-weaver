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
import { Copy, Plus, ArrowLeft, MessageCircle, ChevronRight, X, User, Mail, Phone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-4">
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
          </div>

          <div className="space-y-2">
            <WidgetPreview
              title={form.title}
              welcomeMessage={form.welcomeMessage}
              placeholder={form.placeholder}
              accentColor={form.accentColor}
              position={form.position}
              enabled={form.enabled}
            />
          </div>
        </div>
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
  const [step, setStep] = useState<"form" | "chat">("form");
  const [prechat, setPrechat] = useState({ name: "", email: "", phone: "" });
  const isLeft = position === "bottom-left";

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prechat.name || !prechat.email || !prechat.phone) return;
    setStep("chat");
  };

  const toggleOpen = () => {
    if (!enabled) return;
    setIsOpen((open) => {
      const next = !open;
      if (next) setStep("form");
      return next;
    });
  };

  const header = (
    <div
      className="px-4 py-3 text-white flex items-center justify-between gap-3"
      style={{ backgroundColor: accentColor }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <MessageCircle className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm truncate">{title || "Chat"}</div>
          <div className="text-xs text-white/90 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400" />
            Online agora
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="text-white/90 hover:text-white transition-colors"
        aria-label="Fechar"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );

  const formView = (
    <div className="flex-1 overflow-y-auto p-5 flex flex-col items-center text-center bg-white dark:bg-slate-950">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-3xl mb-4">💬</div>
      <h3 className="text-lg font-bold text-foreground">VAMOS CONVERSAR?</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-[17rem]">
        Preencha seus dados e fale com nossa equipe no WhatsApp.
      </p>
      <form onSubmit={handleStart} className="w-full max-w-[17rem] space-y-3">
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={prechat.name}
            onChange={(e) => setPrechat({ ...prechat, name: e.target.value })}
            placeholder="Seu nome"
            required
            className="w-full pl-9 pr-3 py-2.5 bg-muted border rounded-lg text-sm outline-none focus:border-ring"
          />
        </div>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="email"
            value={prechat.email}
            onChange={(e) => setPrechat({ ...prechat, email: e.target.value })}
            placeholder="Seu e-mail"
            required
            className="w-full pl-9 pr-3 py-2.5 bg-muted border rounded-lg text-sm outline-none focus:border-ring"
          />
        </div>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="tel"
            value={prechat.phone}
            onChange={(e) => setPrechat({ ...prechat, phone: e.target.value })}
            placeholder="WhatsApp (com DDD)"
            required
            className="w-full pl-9 pr-3 py-2.5 bg-muted border rounded-lg text-sm outline-none focus:border-ring"
          />
        </div>
        <button
          type="submit"
          className="w-full py-2.5 rounded-lg text-white text-sm font-semibold transition-transform active:scale-95"
          style={{ backgroundColor: accentColor }}
        >
          Iniciar conversa →
        </button>
      </form>
      <p className="text-xs text-muted-foreground mt-5">Resposta em ate 15 minutos, em horario comercial.</p>
    </div>
  );

  const chatView = (
    <>
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50 dark:bg-slate-950">
        <div className="self-start bg-background border text-foreground max-w-[80%] px-3 py-2 rounded-2xl rounded-bl-sm text-sm shadow-sm">
          {welcomeMessage || "Olá! Como podemos ajudar?"}
        </div>
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
    </>
  );

  return (
    <div className="space-y-2">
      <Label>Visualização</Label>
      <div className="relative h-80 md:h-96 bg-muted/30 rounded-lg border overflow-hidden">
        {!enabled && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/70 text-sm font-medium">
            Widget inativo
          </div>
        )}

        {isOpen && (
          <div
            className={cn(
              "absolute bottom-20 w-[calc(100%-2rem)] max-w-sm h-[22rem] max-h-[calc(100%-6rem)] bg-background rounded-2xl shadow-xl border overflow-hidden flex flex-col z-10",
              isLeft ? "left-4" : "right-4",
            )}
          >
            {header}
            {step === "form" ? formView : chatView}
          </div>
        )}

        <button
          type="button"
          onClick={toggleOpen}
          disabled={!enabled}
          aria-label={isOpen ? "Fechar chat" : "Abrir chat"}
          className={cn(
            "absolute bottom-4 w-14 h-14 rounded-full text-white shadow-lg flex items-center justify-center transition-all duration-200 z-10",
            isLeft ? "left-4" : "right-4",
            enabled ? "hover:scale-110 active:scale-95" : "",
          )}
          style={{ backgroundColor: enabled ? accentColor : "#9ca3af" }}
        >
          <div className="relative w-6 h-6">
            <MessageCircle
              className={cn(
                "absolute inset-0 h-6 w-6 transition-all duration-200",
                isOpen ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100",
              )}
            />
            <X
              className={cn(
                "absolute inset-0 h-6 w-6 transition-all duration-200",
                isOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50",
              )}
            />
          </div>
        </button>
      </div>
    </div>
  );
}
