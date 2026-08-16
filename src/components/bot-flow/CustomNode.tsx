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
  Clock,
  GitFork,
  Shuffle,
  Database,
  Webhook,
} from "lucide-react";

const getMediaType = (url: string, type: string) => {
  if (["image", "video", "audio", "document"].includes(type)) return type;
  const cleanUrl = (url || "").toLowerCase().split("?")[0];
  if (cleanUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)$/)) return "image";
  if (cleanUrl.match(/\.(mp4|webm|ogg|mov|3gp)$/)) return "video";
  if (cleanUrl.match(/\.(mp3|wav|ogg|aac|m4a)$/)) return "audio";
  if (cleanUrl.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|zip)$/)) return "document";
  if (url.includes("images.unsplash.com") || url.includes("img") || url.includes("image"))
    return "image";
  if (url.includes("video")) return "video";
  if (url.includes("audio")) return "audio";
  return "link";
};

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
      case "delay":
        return <Clock className="w-4 h-4 text-sky-500" />;
      case "condition":
        return <GitFork className="w-4 h-4 text-amber-500" />;
      case "randomizer":
        return <Shuffle className="w-4 h-4 text-violet-500" />;
      case "save_variable":
        return <Database className="w-4 h-4 text-emerald-500" />;
      case "http_request":
        return <Webhook className="w-4 h-4 text-rose-500" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const isStart = step.trigger_type === "start";

  // Safely parse buttons_config
  let config: any = {};
  try {
    config =
      typeof step.buttons_config === "string"
        ? JSON.parse(step.buttons_config || "{}")
        : step.buttons_config || {};
  } catch (e) {
    config = {};
  }

  const getStepTitle = (stepLike: any) => {
    if (!stepLike) return "Passo";
    if (stepLike.trigger_type === "start") return "Início";

    const isUUID = (val: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    if (
      stepLike.trigger_type === "keyword" &&
      stepLike.trigger_value &&
      !isUUID(stepLike.trigger_value)
    )
      return `Palavra-chave: ${stepLike.trigger_value}`;
    if (
      stepLike.trigger_type === "button" &&
      stepLike.trigger_value &&
      !isUUID(stepLike.trigger_value)
    )
      return `Botão: ${stepLike.trigger_value}`;
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
      delay: "Delay",
      condition: "Condicional",
      randomizer: "Randomizador",
      save_variable: "Salvar Variável",
      http_request: "Requisição HTTP",
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
      return targetStep
        ? `#${targetStep.step_order} · ${getStepTitle(targetStep)}`
        : "Passo vinculado";
    }
    const targetStep = findTargetStep(rawId);
    return targetStep
      ? `#${targetStep.step_order} · ${getStepTitle(targetStep)}`
      : "Passo vinculado";
  };

  return (
    <div
      className={`rounded-2xl border bg-card text-card-foreground shadow-md min-w-[260px] max-w-[320px] overflow-hidden transition-all ${
        selected ? "ring-2 ring-primary border-primary shadow-lg" : "border-border hover:border-primary/50"
      }`}
    >
      {!isStart && (
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-muted-foreground" />
      )}

      {/* Header */}
      <div className="bg-muted/40 px-3.5 py-2.5 flex items-center justify-between border-b border-border/80">
        <div className="flex items-center gap-2 font-display font-semibold text-xs text-foreground">
          {getTypeIcon()}
          <span>
            {(() => {
              if (step.trigger_type === "start") return "Início";
              const isUUID = (val: string) =>
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
              if (step.trigger_type === "keyword") {
                return isUUID(step.trigger_value)
                  ? "Palavra-chave"
                  : `Keyword: ${step.trigger_value}`;
              }
              if (step.trigger_type === "button") {
                return isUUID(step.trigger_value) ? "Botão" : `Botão: ${step.trigger_value}`;
              }
              return "Passo";
            })()}
          </span>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground bg-muted-foreground/10 px-1.5 py-0.5 rounded">
          #{step.step_order}
        </span>
      </div>

      {/* Media Indicator / Thumbnail Preview */}
      {step.media_url && (
        <div className="mx-3 mt-3 border rounded-lg overflow-hidden bg-muted/20 relative group">
          {(() => {
            const mediaType = getMediaType(step.media_url, step.message_type);

            if (mediaType === "image") {
              return (
                <img
                  src={step.media_url}
                  alt="Preview"
                  className="w-full h-24 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              );
            }
            if (mediaType === "video") {
              return (
                <div className="relative w-full h-24 bg-black/10 dark:bg-black/40 flex items-center justify-center">
                  <video
                    src={step.media_url}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                    <Video className="w-6 h-6 text-white drop-shadow-md" />
                  </div>
                </div>
              );
            }
            if (mediaType === "audio") {
              return (
                <div className="p-2 flex items-center gap-1.5 bg-purple-500/5 text-purple-600 dark:text-purple-400">
                  <Music className="w-4 h-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold truncate">Mensagem de Áudio</div>
                    <div className="text-[8px] text-muted-foreground truncate">
                      {step.media_url.split("/").pop()}
                    </div>
                  </div>
                </div>
              );
            }
            if (mediaType === "document") {
              return (
                <div className="p-2 flex items-center gap-1.5 bg-blue-500/5 text-blue-600 dark:text-blue-400">
                  <FileText className="w-4 h-4 shrink-0 text-red-500" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold truncate">
                      Documento PDF / Arquivo
                    </div>
                    <div className="text-[8px] text-muted-foreground truncate">
                      {step.media_url.split("/").pop()}
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <div className="p-1.5 text-[10px] truncate text-muted-foreground">
                {step.media_url}
              </div>
            );
          })()}
        </div>
      )}

      {/* Message Content */}
      <div className="p-3 text-xs line-clamp-3 text-muted-foreground leading-relaxed">
        {step.message_content || (
          <span className="italic text-muted-foreground/50">Sem conteúdo de texto...</span>
        )}
      </div>

      {/* Interactive Buttons / Quick Replies */}
      {["buttons", "dynamic_buttons"].includes(step.message_type) &&
        (() => {
          const buttons = config?.action?.buttons || [];
          if (buttons.length === 0) return null;
          return (
            <div className="px-3 pb-3 space-y-1">
              {buttons.map((btn: any, idx: number) => {
                const title = btn.reply?.title || `Botão ${idx + 1}`;
                const dest = getTargetLabel(btn.reply?.id);
                const handleId = btn.handleId || btn.reply?.id || `btn-${idx}`;
                return (
                  <div
                    key={idx}
                    className="bg-background border rounded px-2 py-1 text-[11px] flex items-center justify-between shadow-sm relative"
                  >
                    <span className="font-medium truncate">{title}</span>
                    {dest && (
                      <span className="text-[9px] font-bold text-primary bg-primary/10 px-1 py-0.5 rounded ml-1.5">
                        → {dest}
                      </span>
                    )}
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={handleId}
                      style={{ right: -6, top: "50%", transform: "translateY(-50%)", width: 8, height: 8 }}
                      className="bg-primary hover:scale-125 transition-transform"
                    />
                  </div>
                );
              })}
            </div>
          );
        })()}

      {/* Interactive List Options */}
      {step.message_type === "list" &&
        (() => {
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
                    const handleId = row.handleId || row.id || `row-${rowIdx}`;
                    return (
                      <div
                        key={rowIdx}
                        className="bg-background border border-border/80 rounded px-2 py-0.5 text-[10px] flex items-center justify-between relative"
                      >
                        <span className="font-medium truncate">{row.title || "Item"}</span>
                        {dest && (
                          <span className="text-[8px] font-bold text-primary bg-primary/10 px-1 py-0.5 rounded ml-1">
                            → {dest}
                          </span>
                        )}
                        <Handle
                          type="source"
                          position={Position.Right}
                          id={handleId}
                          style={{ right: -6, top: "50%", transform: "translateY(-50%)", width: 8, height: 8 }}
                          className="bg-teal-500 hover:scale-125 transition-transform"
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
              {!hasRows && (
                <div className="text-[10px] text-muted-foreground/50 italic">
                  Sem itens configurados...
                </div>
              )}
            </div>
          );
        })()}

      {/* CTA URL (Link Button) */}
      {step.message_type === "cta_url" &&
        (() => {
          const buttonText = config?.action?.parameters?.display_text || "Acessar Link";
          const url = config?.action?.parameters?.url || "";
          const linkType = url ? getMediaType(url, "link") : "link";
          return (
            <div className="px-3 pb-3 space-y-1.5 border-t border-border/30 pt-2">
              <div className="bg-background border rounded px-2 py-1 text-[11px] flex items-center justify-between shadow-sm">
                <span className="font-medium truncate">{buttonText}</span>
                <span className="text-[9px] font-bold text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                  Link
                </span>
              </div>
              {url && (
                <div className="border rounded-lg overflow-hidden bg-muted/20 relative group">
                  {linkType === "image" && (
                    <img
                      src={url}
                      alt="Preview"
                      className="w-full h-24 object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  )}
                  {linkType === "video" && (
                    <div className="relative w-full h-24 bg-black/10 dark:bg-black/40 flex items-center justify-center">
                      <video src={url} className="w-full h-full object-cover" muted playsInline />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                        <Video className="w-6 h-6 text-white drop-shadow-md" />
                      </div>
                    </div>
                  )}
                  {linkType === "audio" && (
                    <div className="p-2 flex items-center gap-1.5 bg-purple-500/5 text-purple-600 dark:text-purple-400">
                      <Music className="w-4 h-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-semibold truncate">Link de Áudio</div>
                        <div className="text-[8px] text-muted-foreground truncate">
                          {url.split("/").pop()}
                        </div>
                      </div>
                    </div>
                  )}
                  {linkType === "document" && (
                    <div className="p-2 flex items-center gap-1.5 bg-blue-500/5 text-blue-600 dark:text-blue-400">
                      <FileText className="w-4 h-4 shrink-0 text-red-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-semibold truncate">Link de Arquivo</div>
                        <div className="text-[8px] text-muted-foreground truncate">
                          {url.split("/").pop()}
                        </div>
                      </div>
                    </div>
                  )}
                  {linkType === "link" && (
                    <div className="p-2 flex items-center gap-1.5 bg-indigo-500/5 text-indigo-600 dark:text-indigo-400">
                      <Link className="w-4 h-4 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-semibold truncate">
                          Pré-visualização do Link
                        </div>
                        <div className="text-[8px] text-muted-foreground truncate">{url}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

      {/* Product Card / Catalog Message */}
      {["product", "product_list", "catalog_message"].includes(step.message_type) &&
        (() => {
          const catalogId = config?.action?.catalog_id || "";
          const retailerId =
            config?.action?.product_retailer_id ||
            config?.action?.parameters?.thumbnail_product_retailer_id ||
            "";
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
      {step.message_type === "whatsapp_flow" &&
        (() => {
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

      {/* Control Node: Delay */}
      {step.message_type === "delay" &&
        (() => {
          const duration = config?.control?.duration || config?.duration || step.delay_seconds || 5;
          const unit = config?.control?.unit || config?.unit || "seconds";
          const unitMap: Record<string, string> = {
            seconds: "segundos",
            minutes: "minutos",
            hours: "horas",
          };
          return (
            <div className="px-3 pb-3 text-[11px] border-t border-border/30 pt-2 space-y-1 text-muted-foreground">
              <div className="flex items-center justify-between bg-sky-500/10 text-sky-700 dark:text-sky-300 px-2 py-1 rounded font-medium">
                <span>Tempo de espera:</span>
                <span className="font-bold">{duration} {unitMap[unit] || unit}</span>
              </div>
            </div>
          );
        })()}

      {/* Control Node: Condition */}
      {step.message_type === "condition" &&
        (() => {
          const ctrl = config?.control || config || {};
          const rules = ctrl.rules || [];
          const logic = ctrl.logic || "AND";
          const trueDest = getTargetLabel(ctrl.trueStepId);
          const falseDest = getTargetLabel(ctrl.falseStepId);
          return (
            <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2 text-[10px]">
              <div className="text-muted-foreground text-[10px]">
                {rules.length === 0 ? (
                  <span className="italic">Nenhuma regra configurada</span>
                ) : (
                  <span>{rules.length} regra(s) com operador <strong className="text-foreground">{logic}</strong></span>
                )}
              </div>
              <div className="space-y-1.5">
                {/* Branch Sim / Verdadeiro */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded px-2 py-1 flex items-center justify-between relative shadow-sm">
                  <span className="font-semibold text-[11px]">Sim (Verdadeiro)</span>
                  {trueDest && <span className="text-[9px] font-bold truncate max-w-[110px]">→ {trueDest}</span>}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id="condition_true"
                    style={{ right: -6, top: "50%", transform: "translateY(-50%)", width: 8, height: 8 }}
                    className="bg-emerald-500 hover:scale-125 transition-transform"
                  />
                </div>
                {/* Branch Nao / Falso */}
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 rounded px-2 py-1 flex items-center justify-between relative shadow-sm">
                  <span className="font-semibold text-[11px]">Não (Falso)</span>
                  {falseDest && <span className="text-[9px] font-bold truncate max-w-[110px]">→ {falseDest}</span>}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id="condition_false"
                    style={{ right: -6, top: "50%", transform: "translateY(-50%)", width: 8, height: 8 }}
                    className="bg-rose-500 hover:scale-125 transition-transform"
                  />
                </div>
              </div>
            </div>
          );
        })()}

      {/* Control Node: Randomizer */}
      {step.message_type === "randomizer" &&
        (() => {
          const ctrl = config?.control || config || {};
          const branches = ctrl.branches || [
            { id: "branch_a", label: "Caminho A", weight: 50 },
            { id: "branch_b", label: "Caminho B", weight: 50 },
          ];
          return (
            <div className="px-3 pb-3 space-y-1.5 border-t border-border/30 pt-2 text-[10px]">
              <div className="text-muted-foreground text-[10px] mb-1">Divisão de Tráfego (Teste A/B):</div>
              {branches.map((b: any, idx: number) => {
                const branchDest = getTargetLabel(b.nextStepId);
                const handleId = b.handleId || b.id || `branch_${idx}`;
                return (
                  <div
                    key={b.id || idx}
                    className="bg-violet-500/10 border border-violet-500/20 text-violet-700 dark:text-violet-300 rounded px-2 py-1 flex items-center justify-between relative shadow-sm"
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <span className="font-semibold text-[11px] truncate">{b.label || `Caminho ${idx + 1}`}</span>
                      <span className="text-[9px] font-bold opacity-75">({b.weight}%)</span>
                    </div>
                    {branchDest && <span className="text-[9px] font-bold truncate max-w-[90px]">→ {branchDest}</span>}
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={handleId}
                      style={{ right: -6, top: "50%", transform: "translateY(-50%)", width: 8, height: 8 }}
                      className="bg-violet-500 hover:scale-125 transition-transform"
                    />
                  </div>
                );
              })}
            </div>
          );
        })()}

      {/* Control Node: Save Variable */}
      {step.message_type === "save_variable" &&
        (() => {
          const ctrl = config?.control || config || {};
          const scope = ctrl.scope || "flow";
          const key = ctrl.key || "variavel";
          const value = ctrl.value || "";
          return (
            <div className="px-3 pb-3 text-[10px] border-t border-border/30 pt-2 space-y-1 text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>Escopo:</span>
                <span className="font-bold text-foreground capitalize">{scope === "flow" ? "Fluxo" : "Contato"}</span>
              </div>
              <div className="bg-muted/40 p-1.5 rounded font-mono text-[10px] text-foreground truncate">
                {key} = {value || '""'}
              </div>
            </div>
          );
        })()}

      {/* Control Node: HTTP Request */}
      {step.message_type === "http_request" &&
        (() => {
          const ctrl = config?.control || config || {};
          const method = (ctrl.method || "GET").toUpperCase();
          const url = ctrl.url || "https://api.exemplo.com";
          const successDest = getTargetLabel(ctrl.successStepId);
          const errorDest = getTargetLabel(ctrl.errorStepId);
          return (
            <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2 text-[10px]">
              <div className="bg-background border rounded px-2 py-1 flex items-center gap-1.5 font-mono text-[10px] truncate shadow-sm">
                <span className="font-bold text-rose-500">{method}</span>
                <span className="truncate text-foreground text-[9px]">{url}</span>
              </div>
              <div className="space-y-1.5">
                {/* Sucesso */}
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded px-2 py-1 flex items-center justify-between relative shadow-sm">
                  <span className="font-semibold text-[11px]">Sucesso (2xx)</span>
                  {successDest && <span className="text-[9px] font-bold truncate max-w-[110px]">→ {successDest}</span>}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id="http_success"
                    style={{ right: -6, top: "50%", transform: "translateY(-50%)", width: 8, height: 8 }}
                    className="bg-emerald-500 hover:scale-125 transition-transform"
                  />
                </div>
                {/* Erro */}
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 rounded px-2 py-1 flex items-center justify-between relative shadow-sm">
                  <span className="font-semibold text-[11px]">Falha / Erro</span>
                  {errorDest && <span className="text-[9px] font-bold truncate max-w-[110px]">→ {errorDest}</span>}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id="http_error"
                    style={{ right: -6, top: "50%", transform: "translateY(-50%)", width: 8, height: 8 }}
                    className="bg-rose-500 hover:scale-125 transition-transform"
                  />
                </div>
              </div>
            </div>
          );
        })()}

      {!["buttons", "list", "condition", "randomizer", "http_request"].includes(step.message_type) && (
        <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary" />
      )}
    </div>
  );
}
