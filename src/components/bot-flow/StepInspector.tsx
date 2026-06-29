import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, GripVertical, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listWhatsAppFlows } from "@/lib/botflow.functions";

export function StepInspector({
  selectedStep,
  handleUpdateStep,
  handleDeleteStep,
  steps,
  agentName = "Atendente",
  onClose,
}: any) {
  const [config, setConfig] = useState<any>({});

  const listFlowsFn = useServerFn(listWhatsAppFlows);
  const flowsQuery = useQuery({
    queryKey: ["whatsappFlows"],
    queryFn: () => listFlowsFn(),
  });
  const flows = flowsQuery.data?.flows || [];

  const getStepTitle = (step: any) => {
    if (!step) return "Passo";
    if (step.trigger_type === "start") return "Início";

    const isUUID = (val: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    if (step.trigger_type === "keyword" && step.trigger_value && !isUUID(step.trigger_value))
      return `Palavra-chave: ${step.trigger_value}`;
    if (step.trigger_type === "button" && step.trigger_value && !isUUID(step.trigger_value))
      return `Botão: ${step.trigger_value}`;
    if (step.trigger_type === "inactivity")
      return `Inatividade: ${step.trigger_value || "30"}m`;

    const text = String(step.message_content || "").trim();
    if (text) {
      return text.length > 28 ? `${text.slice(0, 28)}...` : text;
    }

    const typeMap: Record<string, string> = {
      text: "Mensagem de texto",
      image: "Imagem",
      video: "Vídeo",
      audio: "Áudio",
      document: "Documento",
      buttons: "Botões",
      dynamic_buttons: "Botões dinâmicos",
      list: "Lista",
      cta_url: "Botão de link",
      product: "Produto",
      product_list: "Lista de produtos",
      catalog_message: "Catálogo",
    };

    return typeMap[step.message_type] || "Passo";
  };

  const getStepOptionLabel = (step: any) => `#${step.step_order} · ${getStepTitle(step)}`;

  const renderStepTargetItem = (step: any) => (
    <span className="truncate">{getStepOptionLabel(step)}</span>
  );

  useEffect(() => {
    try {
      const parsed =
        typeof selectedStep.buttons_config === "string"
          ? JSON.parse(selectedStep.buttons_config || "{}")
          : selectedStep.buttons_config || {};
      setConfig(parsed);
    } catch (e) {
      setConfig({});
    }
  }, [selectedStep.id, selectedStep.buttons_config]);

  const updateConfig = (newConfig: any) => {
    setConfig(newConfig);
    handleUpdateStep("buttons_config", newConfig);
  };

  const renderConfigFields = () => {
    switch (selectedStep.message_type) {
      case "buttons": {
        const buttons = config?.action?.buttons || [];
        return (
          <div className="space-y-4 border rounded-md p-3 bg-muted/20 mt-2">
            <Label className="text-sm font-semibold">Botões Interativos (Até 3)</Label>
            {buttons.map((btn: any, idx: number) => {
              const rawId = btn.reply?.id || "";
              let targetVal = "none";
              if (rawId.startsWith("step:")) {
                targetVal = rawId.replace("step:", "");
              } else if (rawId) {
                // Suporte legado
                const isStep = steps.some((s: any) => s.id === rawId);
                if (isStep) targetVal = rawId;
                else if (rawId === "-999" || rawId === "-997") targetVal = rawId;
              }

              return (
                <div
                  key={idx}
                  className="flex gap-1.5 items-center bg-background/50 p-2 border rounded-md"
                >
                  <span className="text-xs font-semibold text-muted-foreground w-4 text-center">
                    {idx + 1}
                  </span>

                  <Input
                    placeholder="Título"
                    className="flex-1 min-w-[70px] text-xs h-8"
                    value={btn.reply?.title || ""}
                    onChange={(e) => {
                      const newBtns = [...buttons];
                      newBtns[idx] = {
                        ...btn,
                        type: "reply",
                        reply: { ...btn.reply, title: e.target.value },
                      };
                      updateConfig({ ...config, action: { ...config.action, buttons: newBtns } });
                    }}
                  />

                  <span className="text-muted-foreground select-none text-xs">→</span>

                  <Select
                    value={targetVal}
                    onValueChange={(val) => {
                      const newBtns = [...buttons];
                      newBtns[idx] = {
                        ...btn,
                        type: "reply",
                        reply: {
                          ...btn.reply,
                          id: val === "none" ? "" : `step:${val}`,
                        },
                      };
                      updateConfig({ ...config, action: { ...config.action, buttons: newBtns } });
                    }}
                  >
                    <SelectTrigger className="flex-1 min-w-[120px] text-xs h-8">
                      <SelectValue placeholder="Destino..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      <SelectItem value="-999">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block mr-1"></span>
                          {agentName}
                        </span>
                      </SelectItem>
                      <SelectItem value="-997">Reiniciar</SelectItem>
                      {steps
                        .filter((s: any) => s.id !== selectedStep.id)
                        .map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>
                            {renderStepTargetItem(s)}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 shrink-0 h-8 w-8"
                    onClick={() => {
                      const newBtns = buttons.filter((_: any, i: number) => i !== idx);
                      updateConfig({ ...config, action: { ...config.action, buttons: newBtns } });
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
            {buttons.length < 3 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  const newBtns = [...buttons, { type: "reply", reply: { id: "", title: "" } }];
                  updateConfig({ ...config, action: { ...config.action, buttons: newBtns } });
                }}
              >
                <Plus className="w-4 h-4 mr-2" /> Adicionar Botão
              </Button>
            )}
          </div>
        );
      }

      case "list": {
        const sections = config?.action?.sections || [{ title: "Seção 1", rows: [] }];
        return (
          <div className="space-y-4 border rounded-md p-3 bg-muted/20 mt-2">
            <Label className="text-sm font-semibold">Lista Interativa (Até 10 itens)</Label>
            <div className="space-y-2">
              <Label className="text-xs">Texto do Botão que abre a lista</Label>
              <Input
                placeholder="Ex: Ver opções"
                value={config?.action?.button || ""}
                onChange={(e) =>
                  updateConfig({ ...config, action: { ...config.action, button: e.target.value } })
                }
              />
            </div>

            {sections.map((sec: any, secIdx: number) => (
              <div key={secIdx} className="border p-2 rounded-md bg-background space-y-3">
                <Input
                  placeholder="Título da Seção (ex: Atendimento)"
                  value={sec.title || ""}
                  onChange={(e) => {
                    const newSecs = [...sections];
                    newSecs[secIdx].title = e.target.value;
                    updateConfig({ ...config, action: { ...config.action, sections: newSecs } });
                  }}
                />
                <div className="space-y-2 pl-4 border-l-2">
                  {(sec.rows || []).map((row: any, rowIdx: number) => {
                    const rawId = row.id || "";
                    let targetVal = "none";
                    if (rawId.startsWith("step:")) {
                      targetVal = rawId.replace("step:", "");
                    } else if (rawId) {
                      const isStep = steps.some((s: any) => s.id === rawId);
                      if (isStep) targetVal = rawId;
                      else if (rawId === "-999" || rawId === "-997") targetVal = rawId;
                    }

                    return (
                      <div
                        key={rowIdx}
                        className="space-y-2 bg-background/50 p-2.5 border rounded-md relative"
                      >
                        {/* Linha 1: Título */}
                        <Input
                          placeholder="Título da Linha"
                          className="text-xs h-8"
                          value={row.title || ""}
                          onChange={(e) => {
                            const newSecs = [...sections];
                            newSecs[secIdx].rows[rowIdx].title = e.target.value;
                            updateConfig({
                              ...config,
                              action: { ...config.action, sections: newSecs },
                            });
                          }}
                        />

                        {/* Linha 2: Descrição */}
                        <Input
                          placeholder="Descrição (Opcional)"
                          className="text-xs h-8"
                          value={row.description || ""}
                          onChange={(e) => {
                            const newSecs = [...sections];
                            newSecs[secIdx].rows[rowIdx].description = e.target.value;
                            updateConfig({
                              ...config,
                              action: { ...config.action, sections: newSecs },
                            });
                          }}
                        />

                        {/* Linha 3: Destino (Select) + Excluir */}
                        <div className="flex gap-2 items-center">
                          <Select
                            value={targetVal}
                            onValueChange={(val) => {
                              const newSecs = [...sections];
                              newSecs[secIdx].rows[rowIdx].id = val === "none" ? "" : `step:${val}`;
                              updateConfig({
                                ...config,
                                action: { ...config.action, sections: newSecs },
                              });
                            }}
                          >
                            <SelectTrigger className="flex-1 text-xs h-8">
                              <SelectValue placeholder="Destino..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Nenhum</SelectItem>
                              <SelectItem value="-999">
                                <span className="flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block mr-1"></span>
                                  {agentName}
                                </span>
                              </SelectItem>
                              <SelectItem value="-997">Reiniciar</SelectItem>
                              {steps
                                .filter((s: any) => s.id !== selectedStep.id)
                                .map((s: any) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {renderStepTargetItem(s)}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 shrink-0 h-8 w-8"
                            onClick={() => {
                              const newSecs = [...sections];
                              newSecs[secIdx].rows = newSecs[secIdx].rows.filter(
                                (_: any, i: number) => i !== rowIdx,
                              );
                              updateConfig({
                                ...config,
                                action: { ...config.action, sections: newSecs },
                              });
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs w-full mt-1"
                    onClick={() => {
                      const newSecs = [...sections];
                      if (!newSecs[secIdx].rows) newSecs[secIdx].rows = [];
                      newSecs[secIdx].rows.push({ id: "", title: "", description: "" });
                      updateConfig({ ...config, action: { ...config.action, sections: newSecs } });
                    }}
                  >
                    + Adicionar Linha
                  </Button>
                </div>
              </div>
            ))}
            {sections.length < 10 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  const newSecs = [...sections, { title: "Nova Seção", rows: [] }];
                  updateConfig({ ...config, action: { ...config.action, sections: newSecs } });
                }}
              >
                <Plus className="w-4 h-4 mr-2" /> Adicionar Seção
              </Button>
            )}
          </div>
        );
      }

      case "cta_url": {
        return (
          <div className="space-y-4 border rounded-md p-3 bg-muted/20 mt-2">
            <Label className="text-sm font-semibold">Botão de Link</Label>
            <div className="space-y-2">
              <Label className="text-xs">Texto do Botão</Label>
              <Input
                placeholder="Ex: Acessar Site"
                value={config?.action?.parameters?.display_text || ""}
                onChange={(e) =>
                  updateConfig({
                    ...config,
                    action: {
                      ...config.action,
                      name: "cta_url",
                      parameters: { ...config.action?.parameters, display_text: e.target.value },
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">URL (Link)</Label>
              <Input
                placeholder="Ex: https://google.com"
                type="url"
                value={config?.action?.parameters?.url || ""}
                onChange={(e) =>
                  updateConfig({
                    ...config,
                    action: {
                      ...config.action,
                      name: "cta_url",
                      parameters: { ...config.action?.parameters, url: e.target.value },
                    },
                  })
                }
              />
            </div>
          </div>
        );
      }

      case "product": {
        return (
          <div className="space-y-4 border rounded-md p-3 bg-muted/20 mt-2">
            <Label className="text-sm font-semibold">Produto Único</Label>
            <div className="space-y-2">
              <Label className="text-xs">Catalog ID</Label>
              <Input
                placeholder="ID do Catálogo na Meta"
                value={config?.action?.catalog_id || ""}
                onChange={(e) =>
                  updateConfig({
                    ...config,
                    action: { ...config.action, catalog_id: e.target.value },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">SKU do Produto (Retailer ID)</Label>
              <Input
                placeholder="Ex: SKU_001"
                value={config?.action?.product_retailer_id || ""}
                onChange={(e) =>
                  updateConfig({
                    ...config,
                    action: { ...config.action, product_retailer_id: e.target.value },
                  })
                }
              />
            </div>
          </div>
        );
      }

      case "catalog_message": {
        return (
          <div className="space-y-4 border rounded-md p-3 bg-muted/20 mt-2">
            <Label className="text-sm font-semibold">Catálogo Completo</Label>
            <div className="space-y-2">
              <Label className="text-xs">SKU da Capa (Opcional)</Label>
              <Input
                placeholder="Ex: SKU_CAPA"
                value={config?.action?.parameters?.thumbnail_product_retailer_id || ""}
                onChange={(e) =>
                  updateConfig({
                    ...config,
                    action: {
                      name: "catalog_message",
                      parameters: { thumbnail_product_retailer_id: e.target.value },
                    },
                  })
                }
              />
            </div>
          </div>
        );
      }

      case "whatsapp_flow": {
        const flowId = config?.flow_id || "";
        const flowName = config?.flow_name || "";
        const flowCta = config?.flow_cta || config?.cta || "Abrir Formulário";
        const successStepId = config?.next_step_on_success || "";

        return (
          <div className="space-y-4 border rounded-md p-3 bg-muted/20 mt-2">
            <Label className="text-sm font-semibold">Configuração do Flow</Label>

            {/* Seleção do Flow */}
            <div className="space-y-2">
              <Label className="text-xs">Selecionar WhatsApp Flow</Label>
              {flows.length > 0 ? (
                <Select
                  value={flowId || "none"}
                  onValueChange={(val) => {
                    const selected = flows.find((f: any) => f.flow_id === val);
                    updateConfig({
                      ...config,
                      flow_id: val === "none" ? "" : val,
                      flow_name: selected ? selected.flow_name : "",
                    });
                  }}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder="Escolha o fluxo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum (Digitar ID)</SelectItem>
                    {flows.map((f: any) => (
                      <SelectItem key={f.id} value={f.flow_id}>
                        {f.flow_name} ({f.flow_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="text-[10px] text-muted-foreground italic mb-1">
                  Nenhum flow importado no painel. Insira o ID manualmente abaixo:
                </div>
              )}
            </div>

            {/* Digitar ID manualmente se necessário */}
            <div className="space-y-2">
              <Label className="text-xs">ID do Flow (Meta Business)</Label>
              <Input
                placeholder="Ex: 789123456"
                className="text-xs h-8 font-mono"
                value={flowId}
                onChange={(e) => {
                  updateConfig({
                    ...config,
                    flow_id: e.target.value,
                  });
                }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Nome do Flow</Label>
              <Input
                placeholder="Ex: Cadastro de Cliente"
                className="text-xs h-8"
                value={flowName}
                onChange={(e) => {
                  updateConfig({
                    ...config,
                    flow_name: e.target.value,
                  });
                }}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Texto do Botão (CTA)</Label>
              <Input
                placeholder="Ex: Preencher Cadastro"
                className="text-xs h-8"
                value={flowCta}
                onChange={(e) => {
                  updateConfig({
                    ...config,
                    flow_cta: e.target.value,
                  });
                }}
              />
            </div>

            {/* Próximo Passo após preenchimento */}
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs font-semibold text-green-600 flex items-center gap-1">
                <span>Passo de Sucesso (Ao Finalizar)</span>
              </Label>
              <Select
                value={successStepId || "none"}
                onValueChange={(val) => {
                  updateConfig({
                    ...config,
                    next_step_on_success: val === "none" ? "" : val,
                  });
                }}
              >
                <SelectTrigger className="text-xs h-8">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (Terminar fluxo)</SelectItem>
                  {steps
                    .filter((s: any) => s.id !== selectedStep.id)
                    .map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {renderStepTargetItem(s)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const isMedia = ["image", "video", "audio", "document", "buttons", "list", "cta_url"].includes(
    selectedStep.message_type,
  );
  const isInteractive = [
    "button",
    "buttons",
    "list",
    "cta_url",
    "product",
    "product_list",
    "catalog_message",
    "whatsapp_flow",
  ].includes(selectedStep.message_type);

  return (
    <div className="w-[400px] shrink-0 border-l bg-card flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">Editar Passo</h3>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} title="Fechar Painel">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <Label>Gatilho (Trigger)</Label>
          <Select
            value={selectedStep.trigger_type}
            onValueChange={(v) => handleUpdateStep("trigger_type", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="start">Início (Start)</SelectItem>
              <SelectItem value="keyword">Palavra-chave</SelectItem>
              <SelectItem value="button">Resposta de Botão / Lista</SelectItem>
              <SelectItem value="inactivity">Inatividade</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(selectedStep.trigger_type === "keyword" || selectedStep.trigger_type === "button") && (
          <div className="space-y-2">
            <Label>
              {selectedStep.trigger_type === "keyword"
                ? "Palavra-chave"
                : "ID do Botão/Lista (Retorno)"}
            </Label>
            <Input
              value={selectedStep.trigger_value || ""}
              onChange={(e) => handleUpdateStep("trigger_value", e.target.value)}
              placeholder={
                selectedStep.trigger_type === "keyword" ? "Ex: menu, comprar" : "Ex: btn_sim, op_1"
              }
            />
          </div>
        )}

        {selectedStep.trigger_type === "inactivity" && (
          <div className="space-y-2">
            <Label>Tempo Limite de Inatividade (Minutos)</Label>
            <Input
              type="number"
              min={1}
              value={selectedStep.trigger_value || "30"}
              onChange={(e) => handleUpdateStep("trigger_value", e.target.value)}
              placeholder="Ex: 30"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label>Tipo de Mensagem</Label>
          <Select
            value={selectedStep.message_type}
            onValueChange={(v) => handleUpdateStep("message_type", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Texto</SelectItem>
              <SelectItem value="image">Imagem</SelectItem>
              <SelectItem value="audio">Áudio</SelectItem>
              <SelectItem value="video">Vídeo</SelectItem>
              <SelectItem value="document">Documento</SelectItem>
              <SelectItem value="buttons">Botões de Resposta</SelectItem>
              <SelectItem value="list">Lista Dinâmica</SelectItem>
              <SelectItem value="cta_url">Botão de Link (CTA)</SelectItem>
              <SelectItem value="whatsapp_flow">WhatsApp Flow</SelectItem>
              <SelectItem value="product">Produto Único</SelectItem>
              <SelectItem value="product_list">Lista de Produtos</SelectItem>
              <SelectItem value="catalog_message">Catálogo Completo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isMedia && (
          <>
            <div className="space-y-2">
              <Label>URL da Mídia (ou ID)</Label>
              <Input
                value={selectedStep.media_url || ""}
                onChange={(e) => handleUpdateStep("media_url", e.target.value)}
                placeholder="https://..."
              />
            </div>
            {selectedStep.message_type !== "audio" && (
              <div className="space-y-2">
                <Label>Legenda (Caption)</Label>
                <Input
                  value={selectedStep.media_caption || ""}
                  onChange={(e) => handleUpdateStep("media_caption", e.target.value)}
                  placeholder="Texto da mídia..."
                />
              </div>
            )}
          </>
        )}

        <div className="space-y-2">
          <Label>Corpo da Mensagem (Texto)</Label>
          <Textarea
            value={selectedStep.message_content || ""}
            onChange={(e) => handleUpdateStep("message_content", e.target.value)}
            className="min-h-[100px]"
            placeholder="Digite a mensagem principal..."
          />
        </div>

        {isInteractive && (
          <div className="space-y-2">
            <Label>Rodapé (Opcional)</Label>
            <Input
              value={selectedStep.footer_text || ""}
              onChange={(e) => handleUpdateStep("footer_text", e.target.value)}
              placeholder="Texto pequeno no rodapé..."
            />
          </div>
        )}

        {renderConfigFields()}

        <div className="space-y-2 pt-4 border-t">
          <Label>Próximo Passo (Fallback Automático)</Label>
          <div className="text-xs text-muted-foreground mb-2">
            Se for uma mensagem sem botões, ou se o usuário não clicar em nada, para onde ir?
          </div>
          <Select
            value={selectedStep.next_step_id || "none"}
            onValueChange={(v) => handleUpdateStep("next_step_id", v === "none" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum (Aguarda resposta livre)</SelectItem>
              <SelectItem value="-999">Transferir p/ Atendente</SelectItem>
              <SelectItem value="-997">Reiniciar (Start)</SelectItem>
              {steps
                .filter((s: any) => s.id !== selectedStep.id)
                .map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {renderStepTargetItem(s)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="p-4 border-t bg-muted/10 shrink-0">
        <Button
          variant="destructive"
          className="w-full flex items-center justify-center gap-2"
          onClick={handleDeleteStep}
        >
          <Trash2 className="w-4 h-4" />
          Excluir Passo
        </Button>
      </div>
    </div>
  );
}
