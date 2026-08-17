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
      case "buttons":
      case "dynamic_buttons":
      case "image_buttons": {
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

      case "poll": {
        const options = config?.action?.options || [];
        return (
          <div className="space-y-4 border rounded-md p-3 bg-muted/20 mt-2">
            <div>
              <Label className="text-sm font-semibold">Enquete / Escolha</Label>
              <p className="text-[11px] text-muted-foreground mt-1">
                A resposta é enviada como escolha interativa compatível com WhatsApp (máximo de 10 opções).
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Texto do botão</Label>
              <Input
                placeholder="Ex.: Escolher"
                value={config?.action?.button || "Escolher"}
                onChange={(event) => updateConfig({ ...config, action: { ...config.action, button: event.target.value } })}
              />
            </div>
            <div className="text-xs text-muted-foreground">Opções: {options.length} / 10</div>
            {options.map((option: any, index: number) => (
              <div key={option.handleId || index} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <Input
                  placeholder="Texto da opção"
                  maxLength={24}
                  value={option.title || ""}
                  onChange={(event) => {
                    const next = [...options];
                    next[index] = { ...next[index], title: event.target.value };
                    updateConfig({ ...config, action: { ...config.action, options: next } });
                  }}
                />
                <Input
                  placeholder="ID da resposta"
                  maxLength={200}
                  value={option.id || ""}
                  onChange={(event) => {
                    const next = [...options];
                    next[index] = { ...next[index], id: event.target.value };
                    updateConfig({ ...config, action: { ...config.action, options: next } });
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => updateConfig({ ...config, action: { ...config.action, options: options.filter((_: any, i: number) => i !== index) } })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {options.length < 10 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => updateConfig({
                  ...config,
                  action: { ...config.action, options: [...options, { id: `poll_${generateHandleId("option")}`, title: "", handleId: generateHandleId("poll") }] },
                })}
              >
                <Plus className="h-4 w-4 mr-2" /> Adicionar opção
              </Button>
            )}
          </div>
        );
      }

      case "pix": {
        const pix = config?.action || {};
        return (
          <div className="space-y-4 border rounded-md p-3 bg-muted/20 mt-2">
            <div>
              <Label className="text-sm font-semibold">Cobrança PIX</Label>
              <p className="text-[11px] text-muted-foreground mt-1">
                Envia uma mensagem com os dados de pagamento. Não é um tipo de mensagem nativo da Meta.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Valor (opcional)</Label>
              <Input
                placeholder="Ex.: R$ 49,90"
                value={pix.amount || ""}
                onChange={(event) => updateConfig({ ...config, action: { ...pix, amount: event.target.value } })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input
                placeholder="Ex.: Pagamento do pedido #123"
                value={pix.description || ""}
                onChange={(event) => updateConfig({ ...config, action: { ...pix, description: event.target.value } })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Chave PIX (opcional se informar o Copia e Cola)</Label>
              <Input
                placeholder="CPF, e-mail, telefone ou chave aleatória"
                value={pix.pixKey || ""}
                onChange={(event) => updateConfig({ ...config, action: { ...pix, pixKey: event.target.value } })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Código PIX Copia e Cola</Label>
              <Textarea
                value={pix.copyPaste || ""}
                onChange={(event) => updateConfig({ ...config, action: { ...pix, copyPaste: event.target.value } })}
                placeholder="Cole aqui o código PIX gerado pela sua instituição de pagamento"
                className="min-h-24 font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Informe o Copia e Cola ou uma chave PIX para salvar e enviar esta ação.</p>
            </div>
          </div>
        );
      }

      case "link_ai_agent": {
        const ai = config?.action || {};
        return (
          <div className="space-y-4 border rounded-md p-3 bg-muted/20 mt-2">
            <div>
              <Label className="text-sm font-semibold">Vincular Agente IA</Label>
              <p className="text-[11px] text-muted-foreground mt-1">
                Usa o Agente IA ativo configurado para este número do WhatsApp, incluindo a base de conhecimento e o prompt já cadastrados.
              </p>
            </div>
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-muted-foreground">
              Esta ação não envia um texto próprio: ela entrega a mensagem recebida ao Agente IA.
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Mensagem de contingência (opcional)</Label>
              <Textarea
                value={ai.fallback_text || ""}
                onChange={(event) => updateConfig({ ...config, action: { ...ai, fallback_text: event.target.value } })}
                placeholder="Ex.: Nosso assistente está indisponível. Um atendente continuará seu atendimento."
                className="min-h-20"
              />
              <p className="text-[10px] text-muted-foreground">Só será enviada se o Agente IA não puder responder.</p>
            </div>
          </div>
        );
      }

      case "transfer_chat": {
        const handoff = config?.action || {};
        return (
          <div className="space-y-4 border rounded-md p-3 bg-muted/20 mt-2">
            <div>
              <Label className="text-sm font-semibold">Transferir para atendimento</Label>
              <p className="text-[11px] text-muted-foreground mt-1">Atribui a conversa, pausa o bot e pode enviar uma confirmação ao contato.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Setor (opcional)</Label>
                <Select value={selectedStep.assign_team_id || "none"} onValueChange={(value) => handleUpdateStep("assign_team_id", value === "none" ? null : value)}>
                  <SelectTrigger><SelectValue placeholder="Sem setor" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Sem setor</SelectItem>{(teamsQuery.data ?? []).map((team: any) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Responsável (opcional)</Label>
                <Select value={selectedStep.assign_user_id || "none"} onValueChange={(value) => handleUpdateStep("assign_user_id", value === "none" ? null : value)}>
                  <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Sem responsável</SelectItem>{(agentsQuery.data ?? []).map((agent: any) => <SelectItem key={agent.id} value={agent.id}>{agent.full_name || agent.display_name || agent.email}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Pausar bot por (minutos)</Label>
              <Input type="number" min={1} max={10080} value={handoff.pause_minutes || 1440} onChange={(event) => updateConfig({ ...config, action: { ...handoff, pause_minutes: event.target.value } })} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Mensagem de confirmação (opcional)</Label>
              <Textarea value={selectedStep.handoff_message || ""} onChange={(event) => handleUpdateStep("handoff_message", event.target.value)} placeholder="Ex.: Um atendente continuará seu atendimento em instantes." className="min-h-20" />
            </div>
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

      case "product_list": {
        const action = config?.action || {};
        const sections = Array.isArray(action.sections) ? action.sections : [];
        const updateAction = (next: any) => updateConfig({ ...config, action: next });
        return (
          <div className="space-y-4 border rounded-md p-3 bg-muted/20 mt-2">
            <div>
              <Label className="text-sm font-semibold">Lista de Produtos</Label>
              <p className="text-[11px] text-muted-foreground mt-1">Exibe produtos do catálogo Meta em seções. O texto principal é configurado no corpo da mensagem.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label className="text-xs">Catalog ID</Label><Input placeholder="ID do catálogo Meta" value={action.catalog_id || ""} onChange={(event) => updateAction({ ...action, catalog_id: event.target.value })} /></div>
              <div className="space-y-2"><Label className="text-xs">Cabeçalho</Label><Input placeholder="Ex.: Ofertas para você" maxLength={60} value={action.header || ""} onChange={(event) => updateAction({ ...action, header: event.target.value })} /></div>
            </div>
            <div className="text-xs text-muted-foreground">Seções: {sections.length} / 10</div>
            {sections.map((section: any, sectionIndex: number) => {
              const products = Array.isArray(section.product_items) ? section.product_items : [];
              return (
                <div key={section.handleId || sectionIndex} className="space-y-2 rounded-md border bg-background p-3">
                  <div className="flex gap-2"><Input placeholder="Título da seção" value={section.title || ""} onChange={(event) => { const next = [...sections]; next[sectionIndex] = { ...next[sectionIndex], title: event.target.value }; updateAction({ ...action, sections: next }); }} /><Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => updateAction({ ...action, sections: sections.filter((_: any, i: number) => i !== sectionIndex) })}><Trash2 className="h-4 w-4" /></Button></div>
                  {products.map((product: any, productIndex: number) => <div key={product.handleId || productIndex} className="flex gap-2"><Input placeholder="Retailer ID / SKU do produto" value={product.product_retailer_id || ""} onChange={(event) => { const next = [...sections]; const nextProducts = [...products]; nextProducts[productIndex] = { ...nextProducts[productIndex], product_retailer_id: event.target.value }; next[sectionIndex] = { ...next[sectionIndex], product_items: nextProducts }; updateAction({ ...action, sections: next }); }} /><Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => { const next = [...sections]; next[sectionIndex] = { ...next[sectionIndex], product_items: products.filter((_: any, i: number) => i !== productIndex) }; updateAction({ ...action, sections: next }); }}><Trash2 className="h-4 w-4" /></Button></div>)}
                  {products.length < 30 && <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => { const next = [...sections]; next[sectionIndex] = { ...next[sectionIndex], product_items: [...products, { product_retailer_id: "", handleId: generateHandleId("product") }] }; updateAction({ ...action, sections: next }); }}><Plus className="h-4 w-4 mr-1" />Adicionar produto</Button>}
                </div>
              );
            })}
            {sections.length < 10 && <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => updateAction({ ...action, sections: [...sections, { title: "", product_items: [], handleId: generateHandleId("section") }] })}><Plus className="h-4 w-4 mr-2" />Adicionar seção</Button>}
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

      {/* Control Node: Delay */}
      case "delay": {
        const ctrl = config?.control || config || {};
        const duration = ctrl.duration || selectedStep.delay_seconds || 5;
        const unit = ctrl.unit || "seconds";
        return (
          <div className="space-y-4 border rounded-md p-3 bg-muted/20 mt-2">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <span>Configuração de Delay / Espera</span>
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Duração</Label>
                <Input
                  type="number"
                  min={1}
                  max={unit === "hours" ? 24 : unit === "minutes" ? 1440 : 86400}
                  value={duration}
                  onChange={(e) => {
                    const dur = Math.max(1, parseInt(e.target.value, 10) || 1);
                    updateConfig({
                      ...config,
                      control: { ...ctrl, duration: dur, unit },
                    });
                    handleUpdateStep("delay_seconds", unit === "hours" ? dur * 3600 : unit === "minutes" ? dur * 60 : dur);
                  }}
                  className="text-xs h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unidade</Label>
                <Select
                  value={unit}
                  onValueChange={(val) => {
                    updateConfig({
                      ...config,
                      control: { ...ctrl, duration, unit: val },
                    });
                    handleUpdateStep("delay_seconds", val === "hours" ? duration * 3600 : val === "minutes" ? duration * 60 : duration);
                  }}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seconds">Segundos</SelectItem>
                    <SelectItem value="minutes">Minutos</SelectItem>
                    <SelectItem value="hours">Horas (Máx 24h)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              O fluxo aguardará {duration} {unit === "hours" ? "hora(s)" : unit === "minutes" ? "minuto(s)" : "segundo(s)"} antes de prosseguir para o próximo passo.
            </div>
          </div>
        );
      }

      {/* Control Node: Condition */}
      case "condition": {
        const ctrl = config?.control || config || {};
        const rules = ctrl.rules || [];
        const logic = ctrl.logic || "AND";
        const trueStepId = ctrl.trueStepId || "";
        const falseStepId = ctrl.falseStepId || "";

        const updateConditionRules = (newRules: any[]) => {
          updateConfig({
            ...config,
            control: { ...ctrl, rules: newRules, logic, trueStepId, falseStepId },
          });
        };

        return (
          <div className="space-y-4 border rounded-md p-3 bg-muted/20 mt-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Regras Condicionais</Label>
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">Lógica:</Label>
                <Select
                  value={logic}
                  onValueChange={(val) => {
                    updateConfig({
                      ...config,
                      control: { ...ctrl, logic: val, rules, trueStepId, falseStepId },
                    });
                  }}
                >
                  <SelectTrigger className="text-xs h-7 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AND">E (AND)</SelectItem>
                    <SelectItem value="OR">OU (OR)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              {rules.map((rule: any, rIdx: number) => (
                <div key={rIdx} className="space-y-1.5 bg-background p-2 border rounded-md">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground">Regra #{rIdx + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        const newR = rules.filter((_: any, i: number) => i !== rIdx);
                        updateConditionRules(newR);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <Input
                      placeholder="Variável (ex: {{contact.name}} ou {{cpf}})"
                      className="text-xs h-7"
                      value={rule.left || ""}
                      onChange={(e) => {
                        const newR = [...rules];
                        newR[rIdx] = { ...rule, left: e.target.value };
                        updateConditionRules(newR);
                      }}
                    />
                    <Select
                      value={rule.operator || "equals"}
                      onValueChange={(op) => {
                        const newR = [...rules];
                        newR[rIdx] = { ...rule, operator: op };
                        updateConditionRules(newR);
                      }}
                    >
                      <SelectTrigger className="text-xs h-7">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equals">Igual a (==)</SelectItem>
                        <SelectItem value="not_equals">Diferente de (!=)</SelectItem>
                        <SelectItem value="contains">Contém</SelectItem>
                        <SelectItem value="not_contains">Não contém</SelectItem>
                        <SelectItem value="starts_with">Começa com</SelectItem>
                        <SelectItem value="ends_with">Termina com</SelectItem>
                        <SelectItem value="exists">Existe / Não vazio</SelectItem>
                        <SelectItem value="not_exists">Não existe / Vazio</SelectItem>
                        <SelectItem value="greater_than">Maior que (&gt;)</SelectItem>
                        <SelectItem value="greater_or_equal">Maior ou igual (&gt;=)</SelectItem>
                        <SelectItem value="less_than">Menor que (&lt;)</SelectItem>
                        <SelectItem value="less_or_equal">Menor ou igual (&lt;=)</SelectItem>
                        <SelectItem value="in">Está na lista (sep. por vírgula)</SelectItem>
                        <SelectItem value="not_in">Não está na lista</SelectItem>
                      </SelectContent>
                    </Select>
                    {!["exists", "not_exists", "is_empty", "not_empty"].includes(rule.operator) && (
                      <Input
                        placeholder="Valor de comparação (ex: 'sim', 10)"
                        className="text-xs h-7"
                        value={rule.right || ""}
                        onChange={(e) => {
                          const newR = [...rules];
                          newR[rIdx] = { ...rule, right: e.target.value };
                          updateConditionRules(newR);
                        }}
                      />
                    )}
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs h-7"
                onClick={() => {
                  updateConditionRules([
                    ...rules,
                    { left: "{{message.text}}", operator: "equals", right: "" },
                  ]);
                }}
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Regra
              </Button>
            </div>

            {/* Roteamento de Saída */}
            <div className="space-y-3 pt-3 border-t">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-emerald-600">Destino se Verdadeiro (Sim ✔)</Label>
                <Select
                  value={trueStepId || "none"}
                  onValueChange={(val) => {
                    updateConfig({
                      ...config,
                      control: { ...ctrl, rules, logic, trueStepId: val === "none" ? "" : val, falseStepId },
                    });
                  }}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
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

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-rose-600">Destino se Falso (Não ✖)</Label>
                <Select
                  value={falseStepId || "none"}
                  onValueChange={(val) => {
                    updateConfig({
                      ...config,
                      control: { ...ctrl, rules, logic, trueStepId, falseStepId: val === "none" ? "" : val },
                    });
                  }}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
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
          </div>
        );
      }

      {/* Control Node: Randomizer */}
      case "randomizer": {
        const ctrl = config?.control || config || {};
        const branches = ctrl.branches || [
          { id: "branch_a", label: "Caminho A", weight: 50 },
          { id: "branch_b", label: "Caminho B", weight: 50 },
        ];

        const updateBranches = (newBranches: any[]) => {
          updateConfig({
            ...config,
            control: { ...ctrl, branches: newBranches },
          });
        };

        const totalWeight = branches.reduce((acc: number, b: any) => acc + (Number(b.weight) || 0), 0);

        return (
          <div className="space-y-4 border rounded-md p-3 bg-muted/20 mt-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Divisão de Tráfego (Teste A/B)</Label>
              <span className={`text-xs font-bold ${totalWeight === 100 ? "text-emerald-600" : "text-amber-500"}`}>
                Total: {totalWeight}%
              </span>
            </div>

            <div className="space-y-2">
              {branches.map((b: any, bIdx: number) => (
                <div key={b.id || bIdx} className="space-y-1.5 bg-background p-2 border rounded-md">
                  <div className="flex items-center gap-1.5">
                    <Input
                      placeholder="Nome do Caminho"
                      className="text-xs h-7 flex-1"
                      value={b.label || ""}
                      onChange={(e) => {
                        const newB = [...branches];
                        newB[bIdx] = { ...b, label: e.target.value };
                        updateBranches(newB);
                      }}
                    />
                    <div className="flex items-center gap-1 w-20 shrink-0">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        className="text-xs h-7 px-1 text-center"
                        value={b.weight}
                        onChange={(e) => {
                          const newB = [...branches];
                          newB[bIdx] = { ...b, weight: parseInt(e.target.value, 10) || 0 };
                          updateBranches(newB);
                        }}
                      />
                      <span className="text-xs font-bold">%</span>
                    </div>
                    {branches.length > 2 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          const newB = branches.filter((_: any, i: number) => i !== bIdx);
                          updateBranches(newB);
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <Select
                    value={b.nextStepId || "none"}
                    onValueChange={(val) => {
                      const newB = [...branches];
                      newB[bIdx] = { ...b, nextStepId: val === "none" ? "" : val };
                      updateBranches(newB);
                    }}
                  >
                    <SelectTrigger className="text-xs h-7">
                      <SelectValue placeholder="Destino deste caminho..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
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
              ))}

              {branches.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-7"
                  onClick={() => {
                    const nextLetter = String.fromCharCode(65 + branches.length);
                    updateBranches([
                      ...branches,
                      {
                        id: `branch_${Math.random().toString(36).substring(2, 7)}`,
                        label: `Caminho ${nextLetter}`,
                        weight: 0,
                      },
                    ]);
                  }}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar Caminho
                </Button>
              )}
            </div>
          </div>
        );
      }

      {/* Control Node: Save Variable */}
      case "save_variable": {
        const ctrl = config?.control || config || {};
        const scope = ctrl.scope || "flow";
        const key = ctrl.key || "";
        const value = ctrl.value || "";

        return (
          <div className="space-y-4 border rounded-md p-3 bg-muted/20 mt-2">
            <Label className="text-sm font-semibold">Salvar Variável</Label>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Escopo</Label>
                <Select
                  value={scope}
                  onValueChange={(val) => {
                    updateConfig({
                      ...config,
                      control: { ...ctrl, scope: val, key, value },
                    });
                  }}
                >
                  <SelectTrigger className="text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flow">Fluxo (Persiste na sessão do bot)</SelectItem>
                    <SelectItem value="contact">Contato (Persiste no cadastro)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Nome da Variável / Chave</Label>
                <Input
                  placeholder={scope === "contact" ? "Ex: name, email, company, cpf" : "Ex: nome_digitado, saldo"}
                  className="text-xs h-8 font-mono"
                  value={key}
                  onChange={(e) => {
                    updateConfig({
                      ...config,
                      control: { ...ctrl, scope, key: e.target.value, value },
                    });
                  }}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Valor a Atribuir</Label>
                <Input
                  placeholder="Ex: {{message.text}}, {{http.response.id}} ou fixo"
                  className="text-xs h-8 font-mono"
                  value={value}
                  onChange={(e) => {
                    updateConfig({
                      ...config,
                      control: { ...ctrl, scope, key, value: e.target.value },
                    });
                  }}
                />
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Você pode reutilizar esta variável em passos seguintes usando a sintaxe <code className="text-primary font-bold">{"{{" + (key || "variavel") + "}}"}</code>.
            </div>
          </div>
        );
      }

      {/* Control Node: HTTP Request */}
      case "http_request": {
        const ctrl = config?.control || config || {};
        const method = ctrl.method || "POST";
        const url = ctrl.url || "";
        const bodyType = ctrl.bodyType || "json";
        const body = ctrl.body || "";
        const headers = ctrl.headers || [];
        const responseMappings = ctrl.responseMappings || [];
        const successStepId = ctrl.successStepId || "";
        const errorStepId = ctrl.errorStepId || "";
        const timeoutMs = ctrl.timeoutMs || 10000;

        const updateHttpConfig = (patch: any) => {
          updateConfig({
            ...config,
            control: {
              ...ctrl,
              method,
              url,
              bodyType,
              body,
              headers,
              responseMappings,
              successStepId,
              errorStepId,
              timeoutMs,
              ...patch,
            },
          });
        };

        return (
          <div className="space-y-4 border rounded-md p-3 bg-muted/20 mt-2">
            <Label className="text-sm font-semibold">Requisição HTTP (Webhook Externo)</Label>

            <div className="space-y-2">
              <div className="flex gap-1.5">
                <Select
                  value={method}
                  onValueChange={(val) => updateHttpConfig({ method: val })}
                >
                  <SelectTrigger className="text-xs h-8 w-24 shrink-0 font-bold text-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="PATCH">PATCH</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="https://api.exemplo.com/endpoint"
                  className="text-xs h-8 font-mono flex-1"
                  value={url}
                  onChange={(e) => updateHttpConfig({ url: e.target.value })}
                />
              </div>

              {/* Headers */}
              <div className="space-y-1.5 border-t pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Headers HTTP</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => {
                      updateHttpConfig({
                        headers: [...headers, { key: "", value: "" }],
                      });
                    }}
                  >
                    + Header
                  </Button>
                </div>
                {headers.map((h: any, hIdx: number) => (
                  <div key={hIdx} className="flex gap-1 items-center">
                    <Input
                      placeholder="Header (ex: Authorization)"
                      className="text-xs h-7 flex-1 font-mono"
                      value={h.key || ""}
                      onChange={(e) => {
                        const newH = [...headers];
                        newH[hIdx] = { ...h, key: e.target.value };
                        updateHttpConfig({ headers: newH });
                      }}
                    />
                    <Input
                      placeholder="Valor (ex: Bearer {{token}})"
                      className="text-xs h-7 flex-1 font-mono"
                      value={h.value || ""}
                      onChange={(e) => {
                        const newH = [...headers];
                        newH[hIdx] = { ...h, value: e.target.value };
                        updateHttpConfig({ headers: newH });
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => {
                        updateHttpConfig({
                          headers: headers.filter((_: any, i: number) => i !== hIdx),
                        });
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Corpo / Payload */}
              {!["GET", "DELETE"].includes(method) && (
                <div className="space-y-1.5 border-t pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Corpo da Requisição (Body)</Label>
                    <Select
                      value={bodyType}
                      onValueChange={(val) => updateHttpConfig({ bodyType: val })}
                    >
                      <SelectTrigger className="text-[10px] h-6 w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                        <SelectItem value="text">Texto</SelectItem>
                        <SelectItem value="form-urlencoded">Form URL Encoded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {bodyType !== "none" && (
                    <Textarea
                      placeholder='{\n  "telefone": "{{contact.phone}}",\n  "mensagem": "{{message.text}}"\n}'
                      className="text-xs font-mono min-h-[90px]"
                      value={body}
                      onChange={(e) => updateHttpConfig({ body: e.target.value })}
                    />
                  )}
                </div>
              )}

              {/* Mapeamento de Resposta para Variáveis */}
              <div className="space-y-1.5 border-t pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Mapear Resposta em Variáveis</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px]"
                    onClick={() => {
                      updateHttpConfig({
                        responseMappings: [...responseMappings, { path: "", variable: "" }],
                      });
                    }}
                  >
                    + Mapeamento
                  </Button>
                </div>
                {responseMappings.map((m: any, mIdx: number) => (
                  <div key={mIdx} className="flex gap-1 items-center">
                    <Input
                      placeholder="Caminho JSON (ex: data.id)"
                      className="text-xs h-7 flex-1 font-mono"
                      value={m.path || ""}
                      onChange={(e) => {
                        const newM = [...responseMappings];
                        newM[mIdx] = { ...m, path: e.target.value };
                        updateHttpConfig({ responseMappings: newM });
                      }}
                    />
                    <span className="text-xs font-bold text-muted-foreground">→</span>
                    <Input
                      placeholder="Variável (ex: user_id)"
                      className="text-xs h-7 flex-1 font-mono"
                      value={m.variable || ""}
                      onChange={(e) => {
                        const newM = [...responseMappings];
                        newM[mIdx] = { ...m, variable: e.target.value };
                        updateHttpConfig({ responseMappings: newM });
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => {
                        updateHttpConfig({
                          responseMappings: responseMappings.filter((_: any, i: number) => i !== mIdx),
                        });
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Roteamento de Saída */}
              <div className="space-y-3 pt-3 border-t">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-emerald-600">Passo de Sucesso (HTTP 2xx ✔)</Label>
                  <Select
                    value={successStepId || "none"}
                    onValueChange={(val) => updateHttpConfig({ successStepId: val === "none" ? "" : val })}
                  >
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
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

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-rose-600">Passo de Falha / Erro (✖)</Label>
                  <Select
                    value={errorStepId || "none"}
                    onValueChange={(val) => updateHttpConfig({ errorStepId: val === "none" ? "" : val })}
                  >
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
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
            </div>
          </div>
        );
      }

      default:
        return null;
    }
  };

  const isMedia = ["image", "video", "audio", "document", "buttons", "dynamic_buttons", "image_buttons", "list", "cta_url"].includes(
    selectedStep.message_type,
  );
  const isInteractive = [
    "button",
    "buttons",
    "list",
    "cta_url",
    "poll",
    "product",
    "product_list",
    "catalog_message",
    "whatsapp_flow",
  ].includes(selectedStep.message_type);

  const isControlNode = [
    "delay",
    "condition",
    "randomizer",
    "save_variable",
    "http_request",
  ].includes(selectedStep.message_type);
  const isInternalAction = ["pix", "link_ai_agent", "transfer_chat"].includes(selectedStep.message_type);

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
              <SelectItem value="image_buttons">Imagem com Botões</SelectItem>
              <SelectItem value="list">Lista Dinâmica</SelectItem>
              <SelectItem value="cta_url">Botão de Link (CTA)</SelectItem>
              <SelectItem value="poll">Enquete / Escolha</SelectItem>
              <SelectItem value="pix">Cobrança PIX</SelectItem>
              <SelectItem value="link_ai_agent">Vincular Agente IA</SelectItem>
              <SelectItem value="transfer_chat">Transferir para atendimento</SelectItem>
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
                    Imagens (PNG, JPG), Vídeos (MP4), Áudios (MP3) ou Documentos (PDF, DOCX, XLSX, TXT, etc. máx. 20MB)
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    disabled={isUploadingMedia}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip"
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

                        const res = await fetch("/api/storage/upload", {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/octet-stream",
                            "X-Upload-Path": uploadPath,
                          },
                          body: file,
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

        {!isControlNode && !isInternalAction && (
          <div className="space-y-2">
            <Label>Corpo da Mensagem (Texto)</Label>
            <Textarea
              value={selectedStep.message_content || ""}
              onChange={(e) => handleUpdateStep("message_content", e.target.value)}
              className="min-h-[100px]"
              placeholder="Digite a mensagem principal..."
            />
          </div>
        )}

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

        {!["condition", "randomizer", "http_request"].includes(selectedStep.message_type) && (
          <div className="space-y-2 pt-4 border-t">
            <Label>Próximo Passo (Fallback Automático)</Label>
            <div className="text-xs text-muted-foreground mb-2">
              Para onde ir após a conclusão deste passo?
            </div>
            <Select
              value={selectedStep.next_step_id || "none"}
              onValueChange={(v) => handleUpdateStep("next_step_id", v === "none" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum (Terminar ou aguarda resposta)</SelectItem>
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
        )}
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
