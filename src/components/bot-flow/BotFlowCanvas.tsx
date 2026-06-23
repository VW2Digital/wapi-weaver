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
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const nodeTypes = useMemo(() => ({ custom: CustomNode }), []);

  // Sync props to state on mount/steps change
  useEffect(() => {
    const newNodes: Node[] = steps.map((s) => ({
      id: s.id,
      type: "custom",
      position: { x: s.position_x || 0, y: s.position_y || 0 },
      data: { step: s },
    }));

    const newEdges: Edge[] = steps
      .filter((s) => s.next_step_id)
      .map((s) => ({
        id: `e-${s.id}-${s.next_step_id}`,
        source: s.id,
        target: s.next_step_id,
        type: "smoothstep",
        animated: true,
      }));

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
        onNodeClick={(_, node) => onNodeClick(node.data.step)}
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
