import React, { useState } from "react";
import {
  Search,
  MessageSquare,
  Tag,
  Webhook,
  ArrowRightLeft,
  Bot,
  Send,
  Image,
  List,
  Database,
  GitFork,
  Clock,
  Shuffle,
  Sparkles,
  ShoppingCart,
  Layers,
  Filter,
  Plus,
  Zap,
  BookOpen,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ComponentItem {
  id: string;
  category: "action" | "flow";
  title: string;
  description: string;
  icon: React.ElementType;
  type: string;
}

export interface TriggerItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  type: string;
  color?: string;
}

const ACTION_COMPONENTS: ComponentItem[] = [
  {
    id: "create_chat",
    category: "action",
    title: "Criar Conversa",
    description: "Cria uma nova conversa",
    icon: MessageSquare,
    type: "create_chat",
  },
  {
    id: "search_chat",
    category: "action",
    title: "Buscar Conversa",
    description: "Busca uma conversa existente",
    icon: Search,
    type: "search_chat",
  },
  {
    id: "add_tag",
    category: "action",
    title: "Adicionar Tag",
    description: "Adiciona tags ao contato",
    icon: Tag,
    type: "add_tag",
  },
  {
    id: "http_request",
    category: "action",
    title: "Requisição HTTP",
    description: "Faz uma requisição HTTP para API externa",
    icon: Webhook,
    type: "http_request",
  },
  {
    id: "transfer_chat",
    category: "action",
    title: "Transferir Conversa",
    description: "Transfere para outra fila ou canal",
    icon: ArrowRightLeft,
    type: "transfer_chat",
  },
  {
    id: "link_ai_agent",
    category: "action",
    title: "Vincular Agente IA",
    description: "Vincula um agente IA à conversa",
    icon: Bot,
    type: "link_ai_agent",
  },
  {
    id: "text_message",
    category: "action",
    title: "Mensagem de Texto",
    description: "Envia uma mensagem de texto ao contato",
    icon: Send,
    type: "text",
  },
  {
    id: "media_message",
    category: "action",
    title: "Mensagem de Mídia",
    description: "Envia mídia (imagem, áudio, vídeo)",
    icon: Image,
    type: "image",
  },
  {
    id: "options_menu",
    category: "action",
    title: "Menu de opções",
    description: "Envia um menu com opções e aguarda resposta",
    icon: List,
    type: "list",
  },
  {
    id: "save_variable",
    category: "action",
    title: "Salvar Variável",
    description: "Salva uma variável no contato",
    icon: Database,
    type: "save_variable",
  },
];

const FLOW_COMPONENTS: ComponentItem[] = [
  {
    id: "condition",
    category: "flow",
    title: "Condicional",
    description: "Divide o fluxo baseado em condições",
    icon: GitFork,
    type: "condition",
  },
  {
    id: "randomizer",
    category: "flow",
    title: "Randomizador",
    description: "Escolhe um caminho aleatório ou sequencial",
    icon: Shuffle,
    type: "randomizer",
  },
  {
    id: "delay",
    category: "flow",
    title: "Delay",
    description: "Aguarda um período antes de continuar",
    icon: Clock,
    type: "delay",
  },
];

const TRIGGERS_LIST: TriggerItem[] = [
  {
    id: "webhook",
    title: "Webhook",
    description: "Dispara quando um webhook recebe um evento",
    icon: Webhook,
    type: "webhook",
  },
  {
    id: "first_message",
    title: "Primeira mensagem",
    description: "Dispara quando uma mensagem é recebida pela primeira vez",
    icon: MessageSquare,
    type: "first_message",
  },
  {
    id: "keyword",
    title: "Quando mensagem for...",
    description: "Dispara quando uma mensagem atende a uma condição",
    icon: Filter,
    type: "keyword",
  },
  {
    id: "tag_assigned",
    title: "Tag Atribuída",
    description: "Dispara quando uma tag é atribuída a um contato",
    icon: Tag,
    type: "tag_assigned",
  },
  {
    id: "queue_assigned",
    title: "Fila Atribuída",
    description: "Dispara quando uma fila é atribuída ao ticket",
    icon: Layers,
    type: "queue_assigned",
  },
  {
    id: "instagram_event",
    title: "Evento Instagram",
    description: "Dispara em eventos do Instagram (comentários, menções)",
    icon: Sparkles,
    type: "instagram_event",
    color: "#F23869",
  },
  {
    id: "shopify_event",
    title: "Evento Shopify",
    description: "Dispara em eventos da Shopify (carrinho, pedido)",
    icon: ShoppingCart,
    type: "shopify_event",
    color: "#10b981",
  },
];

interface BotComponentsSidebarProps {
  onAddComponent: (item: ComponentItem) => void;
  onSelectTrigger: (trigger: TriggerItem) => void;
  onOpenTemplates: () => void;
}

export function BotComponentsSidebar({
  onAddComponent,
  onSelectTrigger,
  onOpenTemplates,
}: BotComponentsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState(false);
  const [triggerSearch, setTriggerSearch] = useState("");

  const filteredActions = ACTION_COMPONENTS.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFlows = FLOW_COMPONENTS.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTriggers = TRIGGERS_LIST.filter(
    (t) =>
      t.title.toLowerCase().includes(triggerSearch.toLowerCase()) ||
      t.description.toLowerCase().includes(triggerSearch.toLowerCase())
  );

  return (
    <div className="w-80 border-r border-border bg-card text-foreground p-4 flex flex-col h-full space-y-4 shrink-0 overflow-y-auto">
      {/* Header buttons with Bliv Brand Identity */}
      <div className="space-y-2">
        <Button
          onClick={() => setIsTriggerModalOpen(true)}
          className="w-full bg-brand-gradient text-white font-bold shadow-md hover:opacity-95 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 fill-white text-white" />
            <span>Escolher Gatilho</span>
          </div>
          <Plus className="h-4 w-4" />
        </Button>

        <Button
          onClick={onOpenTemplates}
          variant="outline"
          className="w-full border-border bg-background text-foreground hover:bg-muted text-xs font-semibold"
        >
          <BookOpen className="h-4 w-4 mr-2 text-primary" />
          Galeria de Templates
        </Button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar componentes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-background border-border text-xs pl-9 text-foreground placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      {/* Categories */}
      <div className="space-y-5 flex-1">
        {/* AÇÕES */}
        {filteredActions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold font-display uppercase tracking-wider text-muted-foreground">
              Ações
            </h4>
            <div className="space-y-1.5">
              {filteredActions.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onAddComponent(item)}
                    className="w-full flex items-start gap-3 p-2.5 rounded-xl border border-border bg-background hover:bg-muted/40 hover:border-primary/50 transition-all text-left group shadow-xs"
                  >
                    <div className="rounded-lg bg-primary/10 p-2 text-primary group-hover:scale-105 transition-transform shrink-0 mt-0.5">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="overflow-hidden">
                      <h5 className="text-xs font-display font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {item.title}
                      </h5>
                      <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CONTROLE DE FLUXO */}
        {filteredFlows.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold font-display uppercase tracking-wider text-muted-foreground">
              Controle de Fluxo
            </h4>
            <div className="space-y-1.5">
              {filteredFlows.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onAddComponent(item)}
                    className="w-full flex items-start gap-3 p-2.5 rounded-xl border border-border bg-background hover:bg-muted/40 hover:border-primary/50 transition-all text-left group shadow-xs"
                  >
                    <div className="rounded-lg bg-primary/10 p-2 text-primary group-hover:scale-105 transition-transform shrink-0 mt-0.5">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="overflow-hidden">
                      <h5 className="text-xs font-display font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {item.title}
                      </h5>
                      <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                        {item.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Modal Escolher Gatilho */}
      <Dialog open={isTriggerModalOpen} onOpenChange={setIsTriggerModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border text-foreground p-6 rounded-2xl shadow-2xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                <Zap className="h-5 w-5 fill-primary" />
              </div>
              <div>
                <DialogTitle className="text-base font-display font-bold text-foreground">
                  Escolher Gatilho
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Selecione quando a automação deve ser acionada
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-3">
            {/* Modal Trigger Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar gatilho..."
                value={triggerSearch}
                onChange={(e) => setTriggerSearch(e.target.value)}
                className="bg-background border-border text-xs pl-9 text-foreground placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            {/* Triggers List */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {filteredTriggers.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      onSelectTrigger(t);
                      setIsTriggerModalOpen(false);
                    }}
                    className="w-full flex items-start gap-3.5 p-3 rounded-xl border border-border bg-background hover:bg-muted/40 hover:border-primary/60 transition-all text-left group shadow-xs"
                  >
                    <div
                      className="rounded-xl p-2.5 shrink-0"
                      style={{
                        backgroundColor: "rgba(242, 56, 105, 0.1)",
                        color: "#F23869",
                      }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-display font-bold text-foreground group-hover:text-primary transition-colors">
                        {t.title}
                      </h5>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {t.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
