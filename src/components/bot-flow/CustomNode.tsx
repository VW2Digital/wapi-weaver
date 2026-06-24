import { Handle, Position } from "@xyflow/react";
import {
  MessageSquare,
  Image,
  MousePointerClick,
  Play,
  Hash,
  List,
  ShoppingBag,
  Link,
  FileText,
  Video,
  Music,
  FileJson,
} from "lucide-react";

export function CustomNode({ data, selected }: any) {
  const { step } = data;

  const getTypeIcon = () => {
    if (step.trigger_type === "start") return <Play className="w-4 h-4 text-green-500" />;
    if (step.trigger_type === "keyword") return <Hash className="w-4 h-4 text-blue-500" />;

    switch (step.message_type) {
      case "text":
        return <MessageSquare className="w-4 h-4 text-primary" />;
      case "image":
        return <Image className="w-4 h-4 text-orange-500" />;
      case "video":
        return <Video className="w-4 h-4 text-red-500" />;
      case "audio":
        return <Music className="w-4 h-4 text-purple-500" />;
      case "document":
        return <FileText className="w-4 h-4 text-blue-500" />;
      case "buttons":
      case "dynamic_buttons":
        return <MousePointerClick className="w-4 h-4 text-pink-500" />;
      case "list":
        return <List className="w-4 h-4 text-teal-500" />;
      case "cta_url":
        return <Link className="w-4 h-4 text-indigo-500" />;
      case "whatsapp_flow":
        return <FileJson className="w-4 h-4 text-teal-600" />;
      case "product":
      case "product_list":
      case "catalog_message":
        return <ShoppingBag className="w-4 h-4 text-amber-500" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const isStart = step.trigger_type === "start";

  // Safely parse buttons_config
  let config: any = {};
  try {
    config = typeof step.buttons_config === "string"
      ? JSON.parse(step.buttons_config || "{}")
      : step.buttons_config || {};
  } catch (e) {
    config = {};
  }

  const getStepTitle = (stepLike: any) => {
    if (!stepLike) return "Passo";
    if (stepLike.trigger_type === "start") return "Início";
    if (stepLike.trigger_type === "keyword" && stepLike.trigger_value) return `Palavra-chave: ${stepLike.trigger_value}`;
    if (stepLike.trigger_type === "button" && stepLike.trigger_value) return `Botão: ${stepLike.trigger_value}`;
    const text = String(stepLike.message_content || "").trim();
    if (text) return text.length > 24 ? `${text.slice(0, 24)}...` : text;

    const typeMap: Record<string, string> = {
      text: "Mensagem",
      image: "Imagem",
      video: "Vídeo",
      audio: "Áudio",
      document: "Documento",
      buttons: "Botões",
      dynamic_buttons: "Botões",
      list: "Lista",
      cta_url: "Link",
      product: "Produto",
      product_list: "Produtos",
      catalog_message: "Catálogo",
    };
    return typeMap[stepLike.message_type] || "Passo";
  };

  const findTargetStep = (targetId: string) => {
    const steps = data?.allSteps || [];
    return steps.find((s: any) => s.id === targetId);
  };

  const getTargetLabel = (rawId: string) => {
    if (!rawId) return "";
    if (rawId === "-999") return "Atendente";
    if (rawId === "-997") return "Reiniciar";
    if (rawId.startsWith("step:")) {
      const stepId = rawId.replace("step:", "");
      const targetStep = findTargetStep(stepId);
      return targetStep ? `#${targetStep.step_order} · ${getStepTitle(targetStep)}` : "Passo vinculado";
    }
    const targetStep = findTargetStep(rawId);
    return targetStep ? `#${targetStep.step_order} · ${getStepTitle(targetStep)}` : "Passo vinculado";
  };

  return (
    <div
      className={`bg-card text-card-foreground border rounded-lg shadow-sm w-[280px] overflow-hidden flex flex-col transition-all ${
        selected ? "ring-2 ring-primary border-primary scale-[1.02]" : "border-border"
      } ${isStart ? "border-green-500/50 ring-1 ring-green-500/20" : ""}`}
    >
      {!isStart && (
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-muted-foreground" />
      )}

      {/* Header */}
      <div className="bg-muted/80 px-3 py-2 flex items-center justify-between border-b backdrop-blur-sm">
        <div className="flex items-center gap-2 font-medium text-xs">
          {getTypeIcon()}
          <span>
            {step.trigger_type === "start"
              ? "Início"
              : step.trigger_type === "keyword"
                ? `Keyword: ${step.trigger_value}`
                : step.trigger_type === "button"
                  ? `Botão: ${step.trigger_value}`
                  : "Passo"}
          </span>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground bg-muted-foreground/10 px-1.5 py-0.5 rounded">
          #{step.step_order}
        </span>
      </div>

      {/* Media Indicator */}
      {step.media_url && (
        <div className="mx-3 mt-3 px-2 py-1 text-[11px] bg-muted/40 border border-border/60 rounded flex items-center gap-1.5 truncate text-muted-foreground">
          <span className="font-semibold uppercase text-[9px] bg-primary/10 text-primary px-1 rounded">
            {step.message_type}
          </span>
          <span className="truncate">{step.media_url}</span>
        </div>
      )}

      {/* Message Content */}
      <div className="p-3 text-xs line-clamp-3 text-muted-foreground leading-relaxed">
        {step.message_content || <span className="italic text-muted-foreground/50">Sem conteúdo de texto...</span>}
      </div>

      {/* Interactive Buttons / Quick Replies */}
      {["buttons", "dynamic_buttons"].includes(step.message_type) && (() => {
        const buttons = config?.action?.buttons || [];
        if (buttons.length === 0) return null;
        return (
          <div className="px-3 pb-3 space-y-1">
            {buttons.map((btn: any, idx: number) => {
              const title = btn.reply?.title || `Botão ${idx + 1}`;
              const dest = getTargetLabel(btn.reply?.id);
              return (
                <div
                  key={idx}
                  className="bg-background border rounded px-2 py-1 text-[11px] flex items-center justify-between shadow-sm"
                >
                  <span className="font-medium truncate">{title}</span>
                  {dest && (
                    <span className="text-[9px] font-bold text-primary bg-primary/10 px-1 py-0.5 rounded ml-1.5">
                      → {dest}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Interactive List Options */}
      {step.message_type === "list" && (() => {
        const sections = config?.action?.sections || [];
        const buttonText = config?.action?.button || "Ver opções";
        const hasRows = sections.some((sec: any) => sec.rows?.length > 0);
        return (
          <div className="px-3 pb-3 space-y-1.5 border-t border-border/30 pt-2">
            <div className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1">
              <span>Menu:</span>
              <span className="text-foreground italic font-medium">{buttonText}</span>
            </div>
            {sections.map((sec: any, secIdx: number) => (
              <div key={secIdx} className="space-y-1 pl-1">
                {sec.title && (
                  <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-wider mt-1">
                    {sec.title}
                  </div>
                )}
                {(sec.rows || []).map((row: any, rowIdx: number) => {
                  const dest = getTargetLabel(row.id);
                  return (
                    <div
                      key={rowIdx}
                      className="bg-background border border-border/80 rounded px-2 py-0.5 text-[10px] flex items-center justify-between"
                    >
                      <span className="font-medium truncate">{row.title || "Item"}</span>
                      {dest && (
                        <span className="text-[8px] font-bold text-primary bg-primary/10 px-1 py-0.5 rounded ml-1">
                          → {dest}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {!hasRows && (
              <div className="text-[10px] text-muted-foreground/50 italic">Sem itens configurados...</div>
            )}
          </div>
        );
      })()}

      {/* CTA URL (Link Button) */}
      {step.message_type === "cta_url" && (() => {
        const buttonText = config?.action?.parameters?.display_text || "Acessar Link";
        const url = config?.action?.parameters?.url || "";
        return (
          <div className="px-3 pb-3 space-y-1 border-t border-border/30 pt-2">
            <div className="bg-background border rounded px-2 py-1 text-[11px] flex items-center justify-between shadow-sm">
              <span className="font-medium truncate">{buttonText}</span>
              <span className="text-[9px] font-bold text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                Link
              </span>
            </div>
            {url && (
              <div className="text-[9px] text-muted-foreground truncate px-1 italic">
                {url}
              </div>
            )}
          </div>
        );
      })()}

      {/* Product Card / Catalog Message */}
      {["product", "product_list", "catalog_message"].includes(step.message_type) && (() => {
        const catalogId = config?.action?.catalog_id || "";
        const retailerId = config?.action?.product_retailer_id || config?.action?.parameters?.thumbnail_product_retailer_id || "";
        return (
          <div className="px-3 pb-3 text-[10px] border-t border-border/30 pt-2 space-y-0.5 text-muted-foreground">
            {catalogId && (
              <div>
                Catálogo ID: <span className="font-mono text-foreground">{catalogId}</span>
              </div>
            )}
            {retailerId && (
              <div>
                Produto SKU: <span className="font-mono text-foreground">{retailerId}</span>
              </div>
            )}
          </div>
        );
      })()}

      {/* WhatsApp Flow Block */}
      {step.message_type === "whatsapp_flow" && (() => {
        const flowName = config?.flow_name || "Formulário WhatsApp";
        const ctaText = config?.flow_cta || config?.cta || "Preencher";
        const successDest = getTargetLabel(config?.next_step_on_success);
        return (
          <div className="px-3 pb-3 space-y-1.5 border-t border-border/30 pt-2 text-[10px] text-muted-foreground">
            <div className="bg-background border rounded px-2 py-1 text-[11px] flex items-center justify-between shadow-sm text-foreground">
              <span className="font-medium truncate">{ctaText}</span>
              <span className="text-[9px] font-bold text-teal-600 bg-teal-500/10 px-1.5 py-0.5 rounded">
                Flow
              </span>
            </div>
            <div className="truncate px-1">
              Fluxo: <span className="font-semibold text-foreground">{flowName}</span>
            </div>
            {successDest && (
              <div className="px-1 text-[9px] text-green-600 font-semibold truncate">
                Sucesso: <span className="font-bold text-foreground">→ {successDest}</span>
              </div>
            )}
          </div>
        );
      })()}

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary" />
    </div>
  );
}
