import { Badge } from "@/components/ui/badge";
import { useNavigate } from "@tanstack/react-router";
import {
  User,
  Calendar,
  Sparkles,
  Settings,
  Plus,
  MessageCircle,
  MoreHorizontal,
  Mail,
  Phone,
  Clock,
  CheckSquare,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface Owner {
  id: string;
  display_name?: string;
  full_name?: string;
  email: string;
}

interface OpportunityTag {
  name: string;
  color: string;
}

interface OpportunityCustomFields {
  avatar_url?: string;
  photo_url?: string;
  photo?: string;
  picture?: string;
  image_url?: string;
  image?: string;
}

interface Opportunity {
  id: string;
  title: string;
  value: number;
  currency: string;
  status: string;
  stage_id: string;
  primary_contact_id?: string | null;
  temperature?: "cold" | "warm" | "hot";
  priority: "low" | "medium" | "high" | "urgent";
  expected_close_date?: string;
  primary_contact_name?: string;
  primary_contact_phone?: string;
  primary_contact_custom_fields?: OpportunityCustomFields | null;
  owner_user_id?: string;
  last_activity_at?: string;
  next_activity_at?: string;
  tags?: OpportunityTag[];
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
  owners: Owner[];
  onMoveOpportunity: (
    oppId: string,
    toStageId: string,
    beforeOppId?: string | null,
    afterOppId?: string | null,
  ) => void;
  onCardClick: (oppId: string) => void;
  onEditStage?: (stage: Stage) => void;
  onDeleteStage?: (stage: Stage) => void;
  onManageStages?: () => void;
  onAddStage?: () => void;
  onAddOpportunity?: (stageId: string) => void;
}

export function KanbanBoard({
  stages,
  opportunities,
  owners,
  onMoveOpportunity,
  onCardClick,
  onEditStage,
  onDeleteStage,
  onManageStages,
  onAddStage,
  onAddOpportunity,
}: KanbanBoardProps) {
  const navigate = useNavigate();
  const [dropIndicator, setDropIndicator] = useState<{
    stageId: string;
    beforeOppId?: string | null;
    afterOppId?: string | null;
  } | null>(null);

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

  const formatShortDate = (value?: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;

    return parsed.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  const openOpportunityChat = (
    e: React.MouseEvent<HTMLButtonElement>,
    contactId?: string | null,
    contactPhone?: string,
  ) => {
    e.stopPropagation();
    if (!contactPhone) return;

    navigate({
      to: "/chat",
      search: {
        contactId: contactId ?? undefined,
        phone: contactPhone,
      } satisfies { contactId?: string; phone?: string },
    });
  };

  const createOpenOpportunityChatHandler = (contactId?: string | null, contactPhone?: string) => {
    return (e: React.MouseEvent<HTMLButtonElement>) => {
      openOpportunityChat(e, contactId, contactPhone);
    };
  };

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (
    e: React.DragEvent,
    stageId: string,
    beforeOppId?: string | null,
    afterOppId?: string | null,
  ) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    if (id === beforeOppId || id === afterOppId) return;

    onMoveOpportunity(id, stageId, beforeOppId ?? null, afterOppId ?? null);
    setDropIndicator(null);
  };

  const handleDropZoneOver = (
    e: React.DragEvent,
    stageId: string,
    beforeOppId?: string | null,
    afterOppId?: string | null,
  ) => {
    e.preventDefault();
    setDropIndicator({ stageId, beforeOppId: beforeOppId ?? null, afterOppId: afterOppId ?? null });
  };

  const isActiveDropZone = (
    stageId: string,
    beforeOppId?: string | null,
    afterOppId?: string | null,
  ) =>
    dropIndicator?.stageId === stageId &&
    (dropIndicator?.beforeOppId ?? null) === (beforeOppId ?? null) &&
    (dropIndicator?.afterOppId ?? null) === (afterOppId ?? null);

  return (
    <div className="flex-1 flex gap-4 overflow-x-auto p-6 select-none bg-background/50 h-full">
      {stages.map((stage) => {
        const stageOops = opportunities.filter((o) => o.stage_id === stage.id);
        const stageTotal = stageOops.reduce((acc, o) => acc + (Number(o.value) || 0), 0);

        return (
          <div
            key={stage.id}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, stage.id)}
            className="flex flex-col w-[320px] shrink-0 rounded-xl bg-muted/10 border-x border-b border-t-[3px] border-x-transparent border-b-transparent p-3 h-full max-h-full"
            style={{ borderTopColor: stage.color || "#64748b" }}
          >
            {/* Stage Header */}
            <div className="flex flex-col mb-4 px-1 group/header">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[15px] text-foreground tracking-tight truncate">
                  {stage.name}
                </h3>
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover/header:opacity-100 transition-opacity">
                  {onAddOpportunity && (
                    <button
                      type="button"
                      onClick={() => onAddOpportunity(stage.id)}
                      className="p-1 rounded hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
                      title="Adicionar Oportunidade"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
                        title="Opções da Etapa"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {onEditStage && (
                        <DropdownMenuItem
                          onClick={() => onEditStage(stage)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4 text-muted-foreground" />
                          <span>Editar Etapa</span>
                        </DropdownMenuItem>
                      )}
                      {onAddOpportunity && (
                        <DropdownMenuItem
                          onClick={() => onAddOpportunity(stage.id)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Plus className="w-4 h-4 text-muted-foreground" />
                          <span>Nova Oportunidade</span>
                        </DropdownMenuItem>
                      )}
                      {onManageStages && (
                        <DropdownMenuItem
                          onClick={onManageStages}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Settings className="w-4 h-4 text-muted-foreground" />
                          <span>Gerenciar Etapas</span>
                        </DropdownMenuItem>
                      )}
                      {onDeleteStage && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onDeleteStage(stage)}
                            className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Excluir Etapa</span>
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <div className="text-xs text-muted-foreground font-medium mt-1">
                Total: {formatCurrency(stageTotal, "BRL")} - {stageOops.length} negócio{stageOops.length === 1 ? "" : "s"}
              </div>
            </div>

            {/* Stage Scrollable Area */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              <div
                onDragOver={(e) => handleDropZoneOver(e, stage.id, stageOops[0]?.id ?? null, null)}
                onDrop={(e) => handleDrop(e, stage.id, stageOops[0]?.id ?? null, null)}
                className={`h-2 rounded-full transition-all ${
                  isActiveDropZone(stage.id, stageOops[0]?.id ?? null, null)
                    ? "bg-primary/60"
                    : "bg-transparent"
                }`}
              />
              {stageOops.map((opp, idx) => {
                const nextActivityDate = opp.next_activity_at
                  ? new Date(opp.next_activity_at)
                  : null;
                const hasValidNextActivity =
                  !!nextActivityDate && !Number.isNaN(nextActivityDate.getTime());
                const isOverdue = hasValidNextActivity ? nextActivityDate < new Date() : false;
                const nextActivityLabel = formatShortDate(opp.next_activity_at);
                const nextOppId = stageOops[idx + 1]?.id ?? null;

                return (
                  <div key={opp.id}>
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, opp.id)}
                      onClick={() => onCardClick(opp.id)}
                      className="group relative cursor-pointer select-none rounded-xl border border-muted-foreground/10 bg-card p-4 hover:border-primary/50 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <div className="flex items-center gap-2 mb-3">
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
                                alt={opp.primary_contact_name || "Sem contato"}
                                className="w-6 h-6 rounded-full object-cover shrink-0 border border-muted-foreground/10"
                              />
                            );
                          }
                          const name = opp.primary_contact_name || "S";
                          const hash = name
                            .split("")
                            .reduce((acc, char) => acc + char.charCodeAt(0), 0);
                          const hue = hash % 360;
                          const avatarBg = `hsl(${hue}, 60%, 45%)`;
                          return (
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-semibold shrink-0"
                              style={{ backgroundColor: avatarBg }}
                            >
                              {name.slice(0, 1).toUpperCase()}
                            </div>
                          );
                        })()}
                        <div className="flex flex-col min-w-0">
                          <span
                            className="font-semibold text-sm text-foreground truncate"
                            title={opp.primary_contact_name || "Sem contato"}
                          >
                            {opp.primary_contact_name || "Sem contato"}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate" title={opp.title}>
                            {opp.title} • {formatCurrency(opp.value, opp.currency || "BRL")}
                          </span>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {opp.tags?.map((t) => (
                          <span
                            key={`${opp.id}-${t.name}-${t.color}`}
                            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${t.color}15`,
                              color: t.color,
                            }}
                          >
                            {t.name}
                          </span>
                        ))}
                        {opp.temperature && getTemperatureBadge(opp.temperature)}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${getPriorityColor(opp.priority).replace("border", "border-0")}`}>
                          {opp.priority}
                        </span>
                      </div>

                      {/* Card Footer: Icons and Indicators */}
                      <div className="flex items-center justify-between text-muted-foreground mt-auto pt-1">
                        <div className="flex items-center gap-1">
                          {opp.primary_contact_phone && (
                            <button
                              type="button"
                              onClick={createOpenOpportunityChatHandler(
                                opp.primary_contact_id,
                                opp.primary_contact_phone,
                              )}
                              className="p-1.5 rounded hover:bg-muted text-green-500 hover:text-green-600 transition-colors"
                              title="WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                            title="Telefone"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            className="p-1.5 rounded hover:bg-muted transition-colors"
                            title="E-mail"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-medium">
                          {nextActivityLabel && (
                            <div className={`flex items-center gap-1 ${isOverdue ? "text-red-500" : ""}`}>
                              <Clock className="w-3.5 h-3.5" />
                              <span>{nextActivityLabel}</span>
                            </div>
                          )}
                          {opp.tags && opp.tags.length > 0 && (
                            <div className="flex items-center gap-1">
                              <CheckSquare className="w-3.5 h-3.5" />
                              <span>{opp.tags.length}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div
                      onDragOver={(e) => handleDropZoneOver(e, stage.id, nextOppId, opp.id)}
                      onDrop={(e) => handleDrop(e, stage.id, nextOppId, opp.id)}
                      className={`mt-2 h-2 rounded-full transition-all ${
                        isActiveDropZone(stage.id, nextOppId, opp.id)
                          ? "bg-primary/60"
                          : "bg-transparent"
                      }`}
                    />
                  </div>
                );
              })}

              {stageOops.length === 0 && (
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
        <button
          type="button"
          onClick={onAddStage}
          className="flex h-[140px] w-[280px] shrink-0 self-start cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/20 bg-muted/5 p-6 text-center text-muted-foreground transition-all duration-200 hover:border-primary/50 hover:bg-muted/10 hover:text-foreground group"
        >
          <Plus className="w-5 h-5 mb-2 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="font-semibold text-sm">Adicionar Etapa</span>
          <span className="text-[11px] text-muted-foreground/60 mt-1">
            Crie uma nova coluna no funil
          </span>
        </button>
      )}
    </div>
  );
}
