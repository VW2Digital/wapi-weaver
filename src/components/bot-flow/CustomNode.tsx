import { Handle, Position } from "@xyflow/react";
import { MessageSquare, Image, MousePointerClick, Play, Hash, List } from "lucide-react";

export function CustomNode({ data, selected }: any) {
  const { step } = data;

  const getTypeIcon = () => {
    if (step.trigger_type === "start") return <Play className="w-4 h-4 text-green-500" />;
    if (step.trigger_type === "keyword") return <Hash className="w-4 h-4 text-blue-500" />;

    switch (step.message_type) {
      case "text":
        return <MessageSquare className="w-4 h-4" />;
      case "image":
        return <Image className="w-4 h-4" />;
      case "buttons":
      case "dynamic_buttons":
        return <MousePointerClick className="w-4 h-4" />;
      case "list":
        return <List className="w-4 h-4" />;
      default:
        return <MessageSquare className="w-4 h-4" />;
    }
  };

  const isStart = step.trigger_type === "start";

  return (
    <div
      className={`bg-card text-card-foreground border rounded-lg shadow-sm w-[280px] overflow-hidden flex flex-col transition-all ${
        selected ? "ring-2 ring-primary border-primary" : "border-border"
      } ${isStart ? "border-green-500/50" : ""}`}
    >
      {!isStart && (
        <Handle type="target" position={Position.Top} className="w-3 h-3 bg-muted-foreground" />
      )}

      <div className="bg-muted px-3 py-2 flex items-center justify-between border-b">
        <div className="flex items-center gap-2 font-medium text-sm">
          {getTypeIcon()}
          <span>
            {step.trigger_type === "start"
              ? "Início"
              : step.trigger_type === "keyword"
                ? `Palavra-chave: ${step.trigger_value}`
                : "Passo"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">ID: {step.step_order}</span>
      </div>

      <div className="p-3 text-sm line-clamp-3 text-muted-foreground">
        {step.message_content || "Sem conteúdo de texto..."}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-primary" />
    </div>
  );
}
