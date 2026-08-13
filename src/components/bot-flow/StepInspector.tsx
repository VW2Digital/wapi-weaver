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
import { Trash2, Plus, GripVertical, X, Upload, FileUp, FileText } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listWhatsAppFlows } from "@/lib/botflow.functions";
import { listTeams, listAllAgents } from "@/lib/assignment.functions";
import { toast } from "sonner";

export function StepInspector({
  selectedStep,
  handleUpdateStep,
  handleDeleteStep,
  steps,
  agentName = "Atendente",
  onClose,
}: any) {
  const [config, setConfig] = useState<any>({});
  const [mediaSourceTab, setMediaSourceTab] = useState<"upload" | "url">("upload");
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const listFlowsFn = useServerFn(listWhatsAppFlows);
  const flowsQuery = useQuery({
    queryKey: ["whatsappFlows"],
    queryFn: () => listFlowsFn(),
  });
  const flows = flowsQuery.data?.flows || [];

  const fetchTeamsFn = useServerFn(listTeams);
  const fetchAgentsFn = useServerFn(listAllAgents);

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: () => fetchTeamsFn(),
  });

  const agentsQuery = useQuery({
    queryKey: ["allAgents"],
    queryFn: () => fetchAgentsFn(),
  });

  const rebuildButtonId = (stepId: string, teamId: string, agentId: string) => {
    if (stepId === "none" || !stepId) return "";
    let newId = `step:${stepId}`;
    if (teamId) newId += `:team:${teamId}`;
    if (agentId) newId += `:agent:${agentId}`;
    return newId;
  };

  const generateHandleId = (prefix: string) =>
    `${prefix}_${Math.random().toString(36).substring(2, 10)}`;

  const getStepTitle = (step: any) => {
    if (!step) return "Passo";
    if (step.trigger_type === "start") return "Início";

    const isUUID = (val: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    if (step.trigger_type === "keyword" && step.trigger_value && !isUUID(step.trigger_value))
      return `Palavra-chave: ${step.trigger_value}`;
    if (step.trigger_type === "button" && step.trigger_value && !isUUID(step.trigger_value))
      return `Botão: ${step.trigger_value}`;
    if (step.trigger_type === "inactivity") return `Inatividade: ${step.trigger_value || "30"}m`;

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
              let selectedTeamId = "";
              let selectedAgentId = "";

              if (rawId.startsWith("step:")) {
                const parts = rawId.split(":");
                targetVal = parts[1] || "none";
                for (let i = 2; i < parts.length; i += 2) {
                  if (parts[i] === "team") selectedTeamId = parts[i + 1] || "";
                  else if (parts[i] === "agent") selectedAgentId = parts[i + 1] || "";
                }
              } else if (rawId) {
                // Suporte legado
                const isStep = steps.some((s: any) => s.id === rawId);
                if (isStep) targetVal = rawId;
                else if (rawId === "-999" || rawId === "-997") targetVal = rawId;
              }

              return (
                <div key={idx} className="space-y-2 bg-background/50 p-2.5 border rounded-md">
                  <div className="flex gap-1.5 items-center">
                    <span className="text-xs font-semibold text-muted-foreground w-4 text-center">
                      {idx + 1}
                    </span>

                    <Input
                      placeholder="Título"
                      className="flex-1 text-xs h-8"
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

                  <div className="grid grid-cols-3 gap-1.5">
                    {/* Destination Select */}
                    <div className="flex flex-col gap-0.5">
                      <Label className="text-[10px] text-muted-foreground">Destino</Label>
                      <Select
                        value={targetVal}
                        onValueChange={(val) => {
                          const newBtns = [...buttons];
                          const newId = rebuildButtonId(val, selectedTeamId, selectedAgentId);
                          newBtns[idx] = {
                            ...btn,
                            type: "reply",
                            reply: {
                              ...btn.reply,
                              id: newId,
                            },
                          };
                          updateConfig({
                            ...config,
                            action: { ...config.action, buttons: newBtns },
                          });
                        }}
                      >
                        <SelectTrigger className="text-[10px] h-7 px-1.5">
                          <SelectValue placeholder="Destino..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
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
                    </div>

                    {/* Team Select */}
                    <div className="flex flex-col gap-0.5">
                      <Label className="text-[10px] text-muted-foreground">Setor</Label>
                      <Select
                        value={selectedTeamId || "none"}
                        onValueChange={(val) => {
                          const newBtns = [...buttons];
                          const teamVal = val === "none" ? "" : val;
                          const newId = rebuildButtonId(targetVal, teamVal, selectedAgentId);
                          newBtns[idx] = {
                            ...btn,
                            type: "reply",
                            reply: {
                              ...btn.reply,
                              id: newId,
                            },
                          };
                          updateConfig({
                            ...config,
                            action: { ...config.action, buttons: newBtns },
                          });
                        }}
                      >
                        <SelectTrigger className="text-[10px] h-7 px-1.5">
                          <SelectValue placeholder="Setor..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {(teamsQuery.data ?? []).map((t: any) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Agent Select */}
                    <div className="flex flex-col gap-0.5">
                      <Label className="text-[10px] text-muted-foreground">Vendedor</Label>
                      <Select
                        value={selectedAgentId || "none"}
                        onValueChange={(val) => {
                          const newBtns = [...buttons];
                          const agentVal = val === "none" ? "" : val;
                          const newId = rebuildButtonId(targetVal, selectedTeamId, agentVal);
                          newBtns[idx] = {
                            ...btn,
                            type: "reply",
                            reply: {
                              ...btn.reply,
                              id: newId,
                            },
                          };
                          updateConfig({
                            ...config,
                            action: { ...config.action, buttons: newBtns },
                          });
                        }}
                      >
                        <SelectTrigger className="text-[10px] h-7 px-1.5">
                          <SelectValue placeholder="Responsável..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {(agentsQuery.data ?? []).map((a: any) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.full_name || a.display_name || a.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              );
            })}
            {buttons.length < 3 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  const newBtns = [
                    ...buttons,
                    { type: "reply", reply: { id: "", title: "" }, handleId: generateHandleId("btn") },
                  ];
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
                    let selectedTeamId = "";
                    let selectedAgentId = "";

                    if (rawId.startsWith("step:")) {
                      const parts = rawId.split(":");
                      targetVal = parts[1] || "none";
                      for (let i = 2; i < parts.length; i += 2) {
                        if (parts[i] === "team") selectedTeamId = parts[i + 1] || "";
                        else if (parts[i] === "agent") selectedAgentId = parts[i + 1] || "";
                      }
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
                        <div className="flex gap-2">
                          <Input
                            placeholder="Título da Linha"
                            className="text-xs h-8 flex-1"
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

                        {/* Grid: Destino, Setor, Vendedor */}
                        <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                          {/* Destination Select */}
                          <div className="flex flex-col gap-0.5">
                            <Label className="text-[10px] text-muted-foreground">Destino</Label>
                            <Select
                              value={targetVal}
                              onValueChange={(val) => {
                                const newSecs = [...sections];
                                const newId = rebuildButtonId(val, selectedTeamId, selectedAgentId);
                                newSecs[secIdx].rows[rowIdx].id = newId;
                                updateConfig({
                                  ...config,
                                  action: { ...config.action, sections: newSecs },
                                });
                              }}
                            >
                              <SelectTrigger className="text-[10px] h-7 px-1.5">
                                <SelectValue placeholder="Destino..." />
                              </SelectTrigger>
                              <SelectContent className="max-h-60 overflow-y-auto">
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
                          </div>

                          {/* Team Select */}
                          <div className="flex flex-col gap-0.5">
                            <Label className="text-[10px] text-muted-foreground">Setor</Label>
                            <Select
                              value={selectedTeamId || "none"}
                              onValueChange={(val) => {
                                const newSecs = [...sections];
                                const teamVal = val === "none" ? "" : val;
                                const newId = rebuildButtonId(targetVal, teamVal, selectedAgentId);
                                newSecs[secIdx].rows[rowIdx].id = newId;
                                updateConfig({
                                  ...config,
                                  action: { ...config.action, sections: newSecs },
                                });
                              }}
                            >
                              <SelectTrigger className="text-[10px] h-7 px-1.5">
                                <SelectValue placeholder="Setor..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nenhum</SelectItem>
                                {(teamsQuery.data ?? []).map((t: any) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Agent Select */}
                          <div className="flex flex-col gap-0.5">
                            <Label className="text-[10px] text-muted-foreground">Vendedor</Label>
                            <Select
                              value={selectedAgentId || "none"}
                              onValueChange={(val) => {
                                const newSecs = [...sections];
                                const agentVal = val === "none" ? "" : val;
                                const newId = rebuildButtonId(targetVal, selectedTeamId, agentVal);
                                newSecs[secIdx].rows[rowIdx].id = newId;
                                updateConfig({
                                  ...config,
                                  action: { ...config.action, sections: newSecs },
                                });
                              }}
                            >
                              <SelectTrigger className="text-[10px] h-7 px-1.5">
                                <SelectValue placeholder="Responsável..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Nenhum</SelectItem>
                                {(agentsQuery.data ?? []).map((a: any) => (
                                  <SelectItem key={a.id} value={a.id}>
                                    {a.full_name || a.display_name || a.email}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
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
                      newSecs[secIdx].rows.push({
                        id: "",
                        title: "",
                        description: "",
                        handleId: generateHandleId("row"),
                      });
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
              <SelectItem value="webhook">Gatilho por Webhook</SelectItem>
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

        {selectedStep.trigger_type === "webhook" && (
          <div className="space-y-3 border rounded-md p-3 bg-muted/20">
            <Label className="text-xs font-semibold">Condições do Webhook (AND)</Label>
            {(() => {
              let conditions: any[] = [];
              try {
                conditions = typeof selectedStep.trigger_value === "string"
                  ? JSON.parse(selectedStep.trigger_value || "[]")
                  : selectedStep.trigger_value || [];
                if (!Array.isArray(conditions)) conditions = [];
              } catch (e) {
                conditions = [];
              }

              const updateConditions = (newConds: any[]) => {
                handleUpdateStep("trigger_value", JSON.stringify(newConds));
              };

              return (
                <div className="space-y-2">
                  {conditions.map((cond: any, idx: number) => (
                    <div key={idx} className="flex gap-1.5 items-center bg-background p-1.5 border rounded-md">
                      <Input
                        placeholder="Campo"
                        className="text-[10px] h-7 px-1.5 flex-1"
                        value={cond.field || ""}
                        onChange={(e) => {
                          const newConds = [...conditions];
                          newConds[idx] = { ...cond, field: e.target.value };
                          updateConditions(newConds);
                        }}
                      />
                      <Select
                        value={cond.operator || "equals"}
                        onValueChange={(v) => {
                          const newConds = [...conditions];
                          newConds[idx] = { ...cond, operator: v };
                          updateConditions(newConds);
                        }}
                      >
                        <SelectTrigger className="text-[10px] h-7 w-20 px-1 shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="equals">Igual</SelectItem>
                          <SelectItem value="contains">Contém</SelectItem>
                          <SelectItem value="exists">Existe</SelectItem>
                        </SelectContent>
                      </Select>
                      {cond.operator !== "exists" && (
                        <Input
                          placeholder="Valor"
                          className="text-[10px] h-7 px-1.5 flex-1"
                          value={cond.value || ""}
                          onChange={(e) => {
                            const newConds = [...conditions];
                            newConds[idx] = { ...cond, value: e.target.value };
                            updateConditions(newConds);
                          }}
                        />
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 shrink-0 h-6 w-6"
                        onClick={() => {
                          const newConds = conditions.filter((_, i) => i !== idx);
                          updateConditions(newConds);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs h-7"
                    onClick={() => {
                      const newConds = [...conditions, { field: "", operator: "equals", value: "" }];
                      updateConditions(newConds);
                    }}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1 inline-block" /> Adicionar Condição
                  </Button>
                </div>
              );
            })()}
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
          <div className="space-y-3 border border-border rounded-xl p-3.5 bg-muted/20">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold font-display flex items-center gap-1.5 text-foreground">
                <Upload className="h-3.5 w-3.5 text-primary" /> Mídia da Mensagem
              </Label>

              <div className="flex bg-background rounded-lg p-0.5 border border-border">
                <button
                  type="button"
                  onClick={() => setMediaSourceTab("upload")}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all ${
                    mediaSourceTab === "upload"
                      ? "bg-primary text-primary-foreground font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Upload
                </button>
                <button
                  type="button"
                  onClick={() => setMediaSourceTab("url")}
                  className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all ${
                    mediaSourceTab === "url"
                      ? "bg-primary text-primary-foreground font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  URL Externa
                </button>
              </div>
            </div>

            {/* Tab 1: Upload de Arquivo Direto para o Servidor */}
            {mediaSourceTab === "upload" && (
              <div>
                <label className={`flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary/60 bg-card p-4 rounded-xl cursor-pointer transition-all group text-center shadow-xs ${isUploadingMedia ? "opacity-60 pointer-events-none" : ""}`}>
                  <FileUp className="h-6 w-6 text-primary group-hover:scale-110 transition-transform mb-1" />
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    {isUploadingMedia ? "Enviando arquivo..." : "Clique para fazer upload do arquivo"}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">
                    Imagens (PNG, JPG), Vídeos (MP4), Áudios (MP3) ou PDF (máx. 20MB)
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    disabled={isUploadingMedia}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 20 * 1024 * 1024) {
                        toast.error("O arquivo excede o limite de 20MB.");
                        return;
                      }
                      setIsUploadingMedia(true);
                      try {
                        const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
                        const uploadPath = `media/${crypto.randomUUID()}.${ext}`;

                        // Converte para base64 e envia como JSON para evitar
                        // o erro "Body has already been read" do TanStack Start
                        // com multipart/form-data
                        const arrayBuffer = await file.arrayBuffer();
                        const bytes = new Uint8Array(arrayBuffer);
                        let binary = "";
                        for (let i = 0; i < bytes.byteLength; i++) {
                          binary += String.fromCharCode(bytes[i]);
                        }
                        const fileData = btoa(binary);

                        const res = await fetch("/api/storage/upload", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ path: uploadPath, fileData }),
                          credentials: "include",
                        });
                        const json = await res.json();
                        if (!res.ok || !json.path) {
                          toast.error(json.error || "Falha ao enviar o arquivo.");
                          return;
                        }
                        // Salva o path relativo (ex: "<tenantId>/media/<uuid>.pdf")
                        // O executor converte para URL pública via resolveMediaReference
                        handleUpdateStep("media_url", `uploads/${json.path}`);
                        toast.success(`"${file.name}" enviado com sucesso!`);
                      } catch (err: any) {
                        toast.error(err?.message || "Erro ao enviar arquivo.");
                      } finally {
                        setIsUploadingMedia(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
            )}

            {/* Tab 2: URL Externa */}
            {mediaSourceTab === "url" && (
              <div className="space-y-1">
                <Input
                  value={selectedStep.media_url || ""}
                  onChange={(e) => handleUpdateStep("media_url", e.target.value)}
                  placeholder="https://sua-midia.com/imagem.png"
                  className="text-xs bg-background border-border text-foreground"
                />
              </div>
            )}

            {/* Live Media Preview Card */}
            {selectedStep.media_url && (
              <div className="relative border border-border bg-card rounded-lg p-2 flex items-center justify-between gap-2 overflow-hidden shadow-xs">
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  {selectedStep.media_url.startsWith("data:image") ||
                  selectedStep.media_url.match(/\.(jpeg|jpg|gif|png|webp)/i) ? (
                    <img
                      src={selectedStep.media_url.startsWith("data:") ? selectedStep.media_url : `/api/storage/file?path=${encodeURIComponent(selectedStep.media_url.replace(/^\/?(uploads\/)?/, ""))}`}
                      alt="Preview"
                      className="h-10 w-10 object-cover rounded-md shrink-0 border border-border"
                    />
                  ) : (
                    <div className="h-10 w-10 bg-primary/10 text-primary rounded-md flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                  )}

                  <div className="overflow-hidden">
                    <span className="text-xs font-semibold text-foreground truncate block">
                      Mídia Anexada
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate block">
                      {(() => {
                        const url = selectedStep.media_url as string;
                        if (url.startsWith("data:")) return url.slice(0, 35) + "...";
                        const parts = url.split("/");
                        return parts[parts.length - 1] || url.slice(0, 35);
                      })()}
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUpdateStep("media_url", "")}
                  className="h-7 text-xs text-destructive hover:bg-destructive/10 shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Remover
                </Button>
              </div>
            )}

            {selectedStep.message_type !== "audio" && (
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs text-muted-foreground">Legenda (Caption)</Label>
                <Input
                  value={selectedStep.media_caption || ""}
                  onChange={(e) => handleUpdateStep("media_caption", e.target.value)}
                  placeholder="Texto da legenda da mídia..."
                  className="text-xs bg-background border-border"
                />
              </div>
            )}
          </div>
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
