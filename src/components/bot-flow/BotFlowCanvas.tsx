import { useState, useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CustomNode } from "./CustomNode";
import { useTheme } from "@/hooks/use-theme";

interface BotFlowCanvasProps {
  steps: any[];
  onStepsChange: (steps: any[]) => void;
  onNodeClick: (step: any) => void;
}

export function BotFlowCanvas({ steps, onStepsChange, onNodeClick }: BotFlowCanvasProps) {
  const { theme } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  // Sync props to state on mount/steps change
  useEffect(() => {
    const newNodes: Node[] = steps.map((s) => ({
      id: s.id,
      type: "custom",
      position: { x: s.position_x || 0, y: s.position_y || 0 },
      data: { step: s, allSteps: steps },
    }));

    const newEdges: Edge[] = [];
    steps.forEach((s) => {
      // 1. Conexão automática/fallback
      if (
        s.next_step_id &&
        s.next_step_id !== "-999" &&
        s.next_step_id !== "-997" &&
        s.next_step_id !== "-998"
      ) {
        const targetExists = steps.some((step) => step.id === s.next_step_id);
        if (targetExists) {
          newEdges.push({
            id: `e-${s.id}-${s.next_step_id}`,
            source: s.id,
            target: s.next_step_id,
            type: "smoothstep",
            animated: true,
          });
        }
      }

      // 1b. Conexão de sucesso do WhatsApp Flow
      if (s.message_type === "whatsapp_flow" && s.buttons_config) {
        try {
          const configObj =
            typeof s.buttons_config === "string" ? JSON.parse(s.buttons_config) : s.buttons_config;
          const targetId = configObj?.next_step_on_success;
          if (targetId && targetId !== "-999" && targetId !== "-997" && targetId !== "-998") {
            const targetExists = steps.some((step) => step.id === targetId);
            if (targetExists) {
              newEdges.push({
                id: `e-${s.id}-${targetId}-flow-success`,
                source: s.id,
                target: targetId,
                type: "smoothstep",
                label: "Sucesso ✔",
                style: { stroke: "#10b981", strokeWidth: 2 },
                labelStyle: { fill: "#10b981", fontWeight: 600, fontSize: 10 },
                animated: true,
              });
            }
          }
        } catch (e) {
          // ignore
        }
      }

      // 2. Conexões de botões interativos
      if (s.message_type === "buttons" && s.buttons_config) {
        try {
          const configObj =
            typeof s.buttons_config === "string" ? JSON.parse(s.buttons_config) : s.buttons_config;
          const buttons = configObj?.action?.buttons || [];
          buttons.forEach((btn: any, btnIdx: number) => {
            const rawId = btn.reply?.id || "";
            let targetId = "";
            if (rawId.startsWith("step:")) {
              targetId = rawId.replace("step:", "");
            } else if (rawId) {
              const isStep = steps.some((step) => step.id === rawId);
              if (isStep) targetId = rawId;
            }

            if (targetId && targetId !== "-999" && targetId !== "-997" && targetId !== "-998") {
              const targetExists = steps.some((step) => step.id === targetId);
              if (targetExists) {
                const handleId = btn.handleId || btn.reply?.id || `btn-${btnIdx}`;
                newEdges.push({
                  id: `e-${s.id}-${targetId}-${handleId}`,
                  source: s.id,
                  sourceHandle: handleId,
                  target: targetId,
                  type: "smoothstep",
                  label: btn.reply?.title || `Botão ${btnIdx + 1}`,
                  style: { stroke: "#8b5cf6", strokeWidth: 2 },
                  labelStyle: { fill: "#8b5cf6", fontWeight: 600, fontSize: 10 },
                  animated: true,
                });
              }
            }
          });
        } catch (e) {
          // ignore
        }
      }

      // 3. Conexões de listas interativas
      if (s.message_type === "list" && s.buttons_config) {
        try {
          const configObj =
            typeof s.buttons_config === "string" ? JSON.parse(s.buttons_config) : s.buttons_config;
          const sections = configObj?.action?.sections || [];
          let itemIdx = 0;
          sections.forEach((sec: any) => {
            const rows = sec.rows || [];
            rows.forEach((row: any) => {
              const rawId = row.id || "";
              let targetId = "";
              if (rawId.startsWith("step:")) {
                targetId = rawId.replace("step:", "");
              } else if (rawId) {
                const isStep = steps.some((step) => step.id === rawId);
                if (isStep) targetId = rawId;
              }

              if (targetId && targetId !== "-999" && targetId !== "-997" && targetId !== "-998") {
                const targetExists = steps.some((step) => step.id === targetId);
                if (targetExists) {
                  const handleId = row.handleId || row.id || `row-${itemIdx}`;
                  newEdges.push({
                    id: `e-${s.id}-${targetId}-${handleId}`,
                    source: s.id,
                    sourceHandle: handleId,
                    target: targetId,
                    type: "smoothstep",
                    label: row.title || `Item ${itemIdx + 1}`,
                    style: { stroke: "#0d9488", strokeWidth: 2 }, // Teal color for list items
                    labelStyle: { fill: "#0d9488", fontWeight: 600, fontSize: 10 },
                    animated: true,
                  });
                }
              }
              itemIdx++;
            });
          });
        } catch (e) {
          // ignore
        }
      }

      // 4. Conexões de Condicional (condition_true e condition_false)
      if (s.message_type === "condition" && s.buttons_config) {
        try {
          const configObj =
            typeof s.buttons_config === "string" ? JSON.parse(s.buttons_config) : s.buttons_config;
          const ctrl = configObj?.control || configObj || {};
          if (ctrl.trueStepId && ctrl.trueStepId !== "-999" && ctrl.trueStepId !== "-997" && ctrl.trueStepId !== "-998") {
            const targetExists = steps.some((step) => step.id === ctrl.trueStepId);
            if (targetExists) {
              newEdges.push({
                id: `e-${s.id}-${ctrl.trueStepId}-condition-true`,
                source: s.id,
                sourceHandle: "condition_true",
                target: ctrl.trueStepId,
                type: "smoothstep",
                label: "Sim ✔",
                style: { stroke: "#10b981", strokeWidth: 2 },
                labelStyle: { fill: "#10b981", fontWeight: 600, fontSize: 10 },
                animated: true,
              });
            }
          }
          if (ctrl.falseStepId && ctrl.falseStepId !== "-999" && ctrl.falseStepId !== "-997" && ctrl.falseStepId !== "-998") {
            const targetExists = steps.some((step) => step.id === ctrl.falseStepId);
            if (targetExists) {
              newEdges.push({
                id: `e-${s.id}-${ctrl.falseStepId}-condition-false`,
                source: s.id,
                sourceHandle: "condition_false",
                target: ctrl.falseStepId,
                type: "smoothstep",
                label: "Não ✖",
                style: { stroke: "#f43f5e", strokeWidth: 2 },
                labelStyle: { fill: "#f43f5e", fontWeight: 600, fontSize: 10 },
                animated: true,
              });
            }
          }
        } catch (e) {
          // ignore
        }
      }

      // 5. Conexões de Randomizador (branches)
      if (s.message_type === "randomizer" && s.buttons_config) {
        try {
          const configObj =
            typeof s.buttons_config === "string" ? JSON.parse(s.buttons_config) : s.buttons_config;
          const ctrl = configObj?.control || configObj || {};
          const branches = ctrl.branches || [];
          branches.forEach((branch: any, bIdx: number) => {
            const targetId = branch.nextStepId;
            if (targetId && targetId !== "-999" && targetId !== "-997" && targetId !== "-998") {
              const targetExists = steps.some((step) => step.id === targetId);
              if (targetExists) {
                const handleId = branch.handleId || branch.id || `branch_${bIdx}`;
                newEdges.push({
                  id: `e-${s.id}-${targetId}-${handleId}`,
                  source: s.id,
                  sourceHandle: handleId,
                  target: targetId,
                  type: "smoothstep",
                  label: `${branch.label || `Caminho ${bIdx + 1}`} (${branch.weight}%)`,
                  style: { stroke: "#8b5cf6", strokeWidth: 2 },
                  labelStyle: { fill: "#8b5cf6", fontWeight: 600, fontSize: 10 },
                  animated: true,
                });
              }
            }
          });
        } catch (e) {
          // ignore
        }
      }

      // 6. Conexões de Requisição HTTP (http_success e http_error)
      if (s.message_type === "http_request" && s.buttons_config) {
        try {
          const configObj =
            typeof s.buttons_config === "string" ? JSON.parse(s.buttons_config) : s.buttons_config;
          const ctrl = configObj?.control || configObj || {};
          if (ctrl.successStepId && ctrl.successStepId !== "-999" && ctrl.successStepId !== "-997" && ctrl.successStepId !== "-998") {
            const targetExists = steps.some((step) => step.id === ctrl.successStepId);
            if (targetExists) {
              newEdges.push({
                id: `e-${s.id}-${ctrl.successStepId}-http-success`,
                source: s.id,
                sourceHandle: "http_success",
                target: ctrl.successStepId,
                type: "smoothstep",
                label: "Sucesso (2xx) ✔",
                style: { stroke: "#10b981", strokeWidth: 2 },
                labelStyle: { fill: "#10b981", fontWeight: 600, fontSize: 10 },
                animated: true,
              });
            }
          }
          if (ctrl.errorStepId && ctrl.errorStepId !== "-999" && ctrl.errorStepId !== "-997" && ctrl.errorStepId !== "-998") {
            const targetExists = steps.some((step) => step.id === ctrl.errorStepId);
            if (targetExists) {
              newEdges.push({
                id: `e-${s.id}-${ctrl.errorStepId}-http-error`,
                source: s.id,
                sourceHandle: "http_error",
                target: ctrl.errorStepId,
                type: "smoothstep",
                label: "Falha / Erro ✖",
                style: { stroke: "#f43f5e", strokeWidth: 2 },
                labelStyle: { fill: "#f43f5e", fontWeight: 600, fontSize: 10 },
                animated: true,
              });
            }
          }
        } catch (e) {
          // ignore
        }
      }
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [steps, setNodes, setEdges]);

  // Handle new connection drawn by user
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, type: "smoothstep", animated: true }, eds));
      // Update parent state
      const updatedSteps = steps.map((s) => {
        if (s.id === params.source) {
          if (params.sourceHandle) {
            let configObj: any = {};
            try {
              configObj =
                typeof s.buttons_config === "string"
                  ? JSON.parse(s.buttons_config)
                  : s.buttons_config || {};
            } catch (e) {
              configObj = {};
            }

            let updated = false;

            if (s.message_type === "buttons" && configObj?.action?.buttons) {
              configObj.action.buttons = configObj.action.buttons.map((btn: any, btnIdx: number) => {
                const hId = btn.handleId || btn.reply?.id || `btn-${btnIdx}`;
                if (hId === params.sourceHandle) {
                  updated = true;
                  return {
                    ...btn,
                    reply: {
                      ...btn.reply,
                      id: `step:${params.target}`,
                    },
                  };
                }
                return btn;
              });
            } else if (s.message_type === "list" && configObj?.action?.sections) {
              configObj.action.sections = configObj.action.sections.map((sec: any) => {
                if (sec.rows) {
                  sec.rows = sec.rows.map((row: any, rIdx: number) => {
                    const hId = row.handleId || row.id || `row-${rIdx}`;
                    if (hId === params.sourceHandle) {
                      updated = true;
                      return {
                        ...row,
                        id: `step:${params.target}`,
                      };
                    }
                    return row;
                  });
                }
                return sec;
              });
            } else if (s.message_type === "condition") {
              const ctrl = configObj?.control || configObj || {};
              if (params.sourceHandle === "condition_true") {
                ctrl.trueStepId = params.target;
                updated = true;
              } else if (params.sourceHandle === "condition_false") {
                ctrl.falseStepId = params.target;
                updated = true;
              }
              configObj.control = ctrl;
            } else if (s.message_type === "randomizer") {
              const ctrl = configObj?.control || configObj || {};
              const branches = ctrl.branches || [];
              ctrl.branches = branches.map((b: any, bIdx: number) => {
                const hId = b.handleId || b.id || `branch_${bIdx}`;
                if (hId === params.sourceHandle) {
                  updated = true;
                  return { ...b, nextStepId: params.target };
                }
                return b;
              });
              configObj.control = ctrl;
            } else if (s.message_type === "http_request") {
              const ctrl = configObj?.control || configObj || {};
              if (params.sourceHandle === "http_success") {
                ctrl.successStepId = params.target;
                updated = true;
              } else if (params.sourceHandle === "http_error") {
                ctrl.errorStepId = params.target;
                updated = true;
              }
              configObj.control = ctrl;
            }

            if (updated) {
              return {
                ...s,
                buttons_config: configObj,
              };
            }
          }

          return { ...s, next_step_id: params.target };
        }
        return s;
      });
      onStepsChange(updatedSteps);
    },
    [setEdges, steps, onStepsChange],
  );

  // Sync positions when node drag stops
  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      const updatedSteps = steps.map((s) => {
        if (s.id === node.id) {
          return { ...s, position_x: node.position.x, position_y: node.position.y };
        }
        return s;
      });
      onStepsChange(updatedSteps);
    },
    [steps, onStepsChange],
  );

  return (
    <div className="w-full h-full bg-background relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node: any) => onNodeClick(node.data?.step)}
        fitView
        colorMode={theme === "dark" ? "dark" : "light"}
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
