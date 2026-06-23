import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Calendar,
  MessageSquare,
  AlertCircle,
  Sparkles,
  Settings,
  Plus,
  MessageCircle,
} from "lucide-react";

interface Contact {
  id: string;
  name: string;
}

interface Owner {
  id: string;
  display_name?: string;
  full_name?: string;
  email: string;
}

interface Opportunity {
  id: string;
  title: string;
  value: number;
  currency: string;
  status: string;
  stage_id: string;
  temperature?: "cold" | "warm" | "hot";
  priority: "low" | "medium" | "high" | "urgent";
  expected_close_date?: string;
  primary_contact_name?: string;
  primary_contact_phone?: string;
  primary_contact_custom_fields?: any;
  owner_user_id?: string;
  last_activity_at?: string;
  next_activity_at?: string;
  tags?: Array<{ name: string; color: string }>;
}

interface Stage {
  id: string;
  name: string;
  color?: string;
  probability_percent: number;
  total_value?: number;
  total_count?: number;
}

interface KanbanBoardProps {
  stages: Stage[];
  opportunities: Opportunity[];
  owners: any[];
  onMoveOpportunity: (
    oppId: string,
    toStageId: string,
    beforeOppId?: string | null,
    afterOppId?: string | null,
  ) => void;
  onCardClick: (oppId: string) => void;
  onEditStage?: (stage: Stage) => void;
  onAddStage?: () => void;
}

export function KanbanBoard({
  stages,
  opportunities,
  owners,
  onMoveOpportunity,
  onCardClick,
  onEditStage,
  onAddStage,
}: KanbanBoardProps) {
  const getOwnerName = (ownerId?: string) => {
    if (!ownerId) return "Sem responsável";
    const found = owners.find((o) => o.id === ownerId);
    return (
      found?.display_name || found?.full_name || found?.email?.split("@")[0] || "Sem responsável"
    );
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "low":
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
      case "medium":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      case "high":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "urgent":
        return "bg-rose-500/10 text-rose-400 border-rose-500/20";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  const getTemperatureBadge = (t?: string) => {
    switch (t) {
      case "cold":
        return (
          <Badge
            variant="outline"
            className="bg-sky-500/10 text-sky-400 border-sky-500/20 font-normal"
          >
            Frio
          </Badge>
        );
      case "warm":
        return (
          <Badge
            variant="outline"
            className="bg-orange-500/10 text-orange-400 border-orange-500/20 font-normal"
          >
            Morno
          </Badge>
        );
      case "hot":
        return (
          <Badge
            variant="outline"
            className="bg-red-500/10 text-red-400 border-red-500/20 font-normal"
          >
            Quente
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatCurrency = (val: number, cur: string) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: cur || "BRL",
    }).format(val);
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;

    // Direct drop to stage column without before/after card
    onMoveOpportunity(id, stageId, null, null);
  };

  return (
    <div className="flex-1 flex gap-4 overflow-x-auto p-6 select-none bg-background/50 h-full">
      {stages.map((stage) => {
        const stageOpps = opportunities.filter((o) => o.stage_id === stage.id);
        const stageTotal = stageOpps.reduce((acc, o) => acc + (Number(o.value) || 0), 0);

        return (
          <div
            key={stage.id}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.id)}
            className="flex flex-col w-[320px] shrink-0 rounded-2xl bg-muted/30 border border-muted-foreground/10 p-3 h-full max-h-full"
          >
            {/* Stage Header */}
            <div className="flex items-center justify-between mb-3 px-1 group/header">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: stage.color || "#64748b" }}
                />
                <span
                  className="font-semibold text-sm tracking-wide truncate max-w-[120px]"
                  title={stage.name}
                >
                  {stage.name}
                </span>
                <span className="text-xs text-muted-foreground bg-muted-foreground/10 px-2 py-0.5 rounded-full shrink-0">
                  {stageOpps.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="text-xs font-semibold text-muted-foreground">
                  {formatCurrency(stageTotal, "BRL")}
                </div>
                {onEditStage && (
                  <button
                    onClick={() => onEditStage(stage)}
                    className="p-1 rounded hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/header:opacity-100 focus:opacity-100"
                    title="Editar Etapa"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Stage Scrollable Area */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {stageOpps.map((opp) => {
                const isOverdue =
                  opp.next_activity_at && new Date(opp.next_activity_at) < new Date();

                return (
                  <div
                    key={opp.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, opp.id)}
                    onClick={() => onCardClick(opp.id)}
                    className="group relative cursor-pointer select-none rounded-xl border border-muted-foreground/10 bg-card p-4 hover:border-primary/50 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    {/* Tags */}
                    {opp.tags && opp.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {opp.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium border"
                            style={{
                              backgroundColor: `${t.color}15`,
                              borderColor: `${t.color}30`,
                              color: t.color,
                            }}
                          >
                            {t.name}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Card Title */}
                    <h4 className="font-semibold text-sm text-foreground tracking-tight group-hover:text-primary transition-colors mb-1 line-clamp-1">
                      {opp.title}
                    </h4>

                    {/* Contact & Value */}
                    <div className="flex items-center justify-between text-xs mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        {opp.primary_contact_name ? (
                          <>
                            {/* Avatar */}
                            {(() => {
                              const cf = opp.primary_contact_custom_fields || {};
                              const avatarUrl =
                                cf.avatar_url ||
                                cf.photo_url ||
                                cf.photo ||
                                cf.picture ||
                                cf.image_url ||
                                cf.image;
                              if (avatarUrl) {
                                return (
                                  <img
                                    src={avatarUrl}
                                    alt={opp.primary_contact_name}
                                    className="w-5 h-5 rounded-full object-cover shrink-0 border border-muted-foreground/10"
                                  />
                                );
                              }
                              // Fallback colored avatar
                              const hash = opp.primary_contact_name
                                .split("")
                                .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                              const hue = hash % 360;
                              const avatarBg = `hsl(${hue}, 60%, 45%)`;
                              return (
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] text-white font-semibold shrink-0"
                                  style={{ backgroundColor: avatarBg }}
                                >
                                  {opp.primary_contact_name.slice(0, 1).toUpperCase()}
                                </div>
                              );
                            })()}

                            <span
                              className="text-muted-foreground font-medium truncate max-w-[110px]"
                              title={opp.primary_contact_name}
                            >
                              {opp.primary_contact_name}
                            </span>

                            {opp.primary_contact_phone && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `/chat?phone=${opp.primary_contact_phone}`;
                                }}
                                className="p-1 rounded hover:bg-muted text-green-500 hover:text-green-600 transition-colors shrink-0"
                                title="Conversar no WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5 fill-green-500/10" />
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground/60 italic">Sem contato</span>
                        )}
                      </div>

                      <span className="font-semibold text-foreground shrink-0">
                        {formatCurrency(opp.value, opp.currency || "BRL")}
                      </span>
                    </div>

                    <div className="h-[1px] bg-muted-foreground/10 w-full mb-3" />

                    {/* Card Footer */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[90px]">
                          {getOwnerName(opp.owner_user_id)}
                        </span>
                      </div>

                      {/* Right side indicators */}
                      <div className="flex items-center gap-2">
                        {opp.next_activity_at && (
                          <div
                            className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${isOverdue ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-green-500/10 text-green-500"}`}
                          >
                            <Calendar className="w-3 h-3" />
                            <span>
                              {new Date(opp.next_activity_at).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                              })}
                            </span>
                          </div>
                        )}
                        {opp.temperature && getTemperatureBadge(opp.temperature)}
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase ${getPriorityColor(opp.priority)}`}
                        >
                          {opp.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {stageOpps.length === 0 && (
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-muted-foreground/10 rounded-xl py-8 px-4 text-center text-muted-foreground/60 h-32">
                  <Sparkles className="w-5 h-5 mb-1 opacity-45" />
                  <span className="text-xs">Arraste cards aqui</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {onAddStage && (
        <div
          onClick={onAddStage}
          className="flex flex-col w-[280px] shrink-0 rounded-2xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 bg-muted/5 hover:bg-muted/10 transition-all duration-200 cursor-pointer items-center justify-center p-6 text-center text-muted-foreground hover:text-foreground h-[140px] shrink-0 self-start group"
        >
          <Plus className="w-5 h-5 mb-2 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="font-semibold text-sm">Adicionar Etapa</span>
          <span className="text-[11px] text-muted-foreground/60 mt-1">
            Crie uma nova coluna no funil
          </span>
        </div>
      )}
    </div>
  );
}
