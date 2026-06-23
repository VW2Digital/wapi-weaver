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
import { Trash2, Plus, GripVertical } from "lucide-react";
import { useState, useEffect } from "react";

export function StepInspector({ selectedStep, handleUpdateStep, handleDeleteStep, steps, agentName = "Atendente" }: any) {
  const [config, setConfig] = useState<any>({});

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
                          id: val === "none" ? "" : `step:${val}` 
                        },
                      };
                      updateConfig({ ...config, action: { ...config.action, buttons: newBtns } });
                    }}
                  >
                    <SelectTrigger className="w-[105px] shrink-0 text-xs h-8">
                      <SelectValue placeholder="Destino..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      <SelectItem value="-999">
                        <span className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block mr-1"></span>
                          🤖 {agentName}
                        </span>
                      </SelectItem>
                      <SelectItem value="-997">Reiniciar</SelectItem>
                      {steps
                        .filter((s: any) => s.id !== selectedStep.id)
                        .map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>
                            #{s.step_order}
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
                        className="flex gap-2 items-center bg-background/50 p-2 border rounded-md relative group"
                      >
                        <div className="flex-1 space-y-1 min-w-0">
                          <Input
                            placeholder="Título da Linha"
                            className="text-xs h-7"
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
                          <Input
                            placeholder="Descrição (Opcional)"
                            className="text-[10px] h-6"
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
                        </div>

                        <span className="text-muted-foreground select-none text-xs">→</span>

                        <Select
                          value={targetVal}
                          onValueChange={(val) => {
                            const newSecs = [...sections];
                            newSecs[secIdx].rows[rowIdx].id =
                              val === "none" ? "" : `step:${val}`;
                            updateConfig({
                              ...config,
                              action: { ...config.action, sections: newSecs },
                            });
                          }}
                        >
                          <SelectTrigger className="w-[100px] shrink-0 text-[10px] h-7 px-2">
                            <SelectValue placeholder="Destino..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            <SelectItem value="-999">
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block mr-1"></span>
                                🤖 {agentName}
                              </span>
                            </SelectItem>
                            <SelectItem value="-997">Reiniciar</SelectItem>
                            {steps
                              .filter((s: any) => s.id !== selectedStep.id)
                              .map((s: any) => (
                                <SelectItem key={s.id} value={s.id}>
                                  #{s.step_order}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 shrink-0 h-7 w-7"
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
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
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

      default:
        return null;
    }
  };

  const isMedia = ["image", "video", "audio", "document", "buttons", "list", "cta_url"].includes(selectedStep.message_type);
  const isInteractive = ["button", "buttons", "list", "cta_url", "product", "product_list", "catalog_message"].includes(
    selectedStep.message_type,
  );

  return (
    <div className="w-80 border-l bg-card p-4 flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Editar Passo</h3>
        <Button variant="ghost" size="icon" onClick={handleDeleteStep}>
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>

      <div className="space-y-4 pb-12">
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
                    Passo {s.step_order} ({s.trigger_type})
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
