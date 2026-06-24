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
      if (s.next_step_id && s.next_step_id !== "-999" && s.next_step_id !== "-997" && s.next_step_id !== "-998") {
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

      // 2. Conexões de botões interativos
      if (s.message_type === "buttons" && s.buttons_config) {
        try {
          const configObj = typeof s.buttons_config === "string" 
            ? JSON.parse(s.buttons_config) 
            : s.buttons_config;
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
                newEdges.push({
                  id: `e-${s.id}-${targetId}-btn-${btnIdx}`,
                  source: s.id,
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
          const configObj = typeof s.buttons_config === "string" 
            ? JSON.parse(s.buttons_config) 
            : s.buttons_config;
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
                  newEdges.push({
                    id: `e-${s.id}-${targetId}-list-${itemIdx}`,
                    source: s.id,
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
