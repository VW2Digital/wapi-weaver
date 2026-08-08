import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarEventItem } from "./CalendarEventCard";
import {
  Calendar,
  Clock,
  User,
  Users,
  Bot,
  MapPin,
  Video,
  ExternalLink,
  Edit3,
  Trash2,
  XCircle,
  CheckCircle2,
  FileText,
  AlertTriangle,
} from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

interface CalendarEventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEventItem | null;
  onEdit: (event: CalendarEventItem) => void;
  onCancelEvent: (eventId: string) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
  onStatusChange: (eventId: string, newStatus: string) => Promise<void>;
}

export function CalendarEventDetailsModal({
  isOpen,
  onClose,
  event,
  onEdit,
  onCancelEvent,
  onDeleteEvent,
  onStatusChange,
}: CalendarEventDetailsModalProps) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  if (!event) return null;

  const startDate = new Date(event.start_at);
  const endDate = new Date(event.end_at);

  const formattedDate = format(startDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const formattedTime = event.all_day
    ? "Dia Inteiro"
    : `${format(startDate, "HH:mm")} às ${format(endDate, "HH:mm")}`;

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "confirmado":
        return <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Confirmado</Badge>;
      case "concluido":
        return <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">Concluído</Badge>;
      case "cancelado":
        return <Badge variant="outline" className="border-destructive text-destructive">Cancelado</Badge>;
      case "nao_compareceu":
        return <Badge variant="outline" className="border-amber-500 text-amber-600">Não Compareceu</Badge>;
      default:
        return <Badge variant="secondary">Agendado</Badge>;
    }
  };

  const handleCancel = async () => {
    try {
      setLoading(true);
      await onCancelEvent(event.id);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      await onDeleteEvent(event.id);
      setConfirmDelete(false);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="text-lg font-display font-bold text-foreground truncate">
              {event.title}
            </DialogTitle>
            {getStatusBadge(event.status)}
          </div>
        </DialogHeader>

        <div className="space-y-4 text-xs pt-1">
          {/* Date & Time */}
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20">
            <Calendar className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-semibold text-foreground capitalize">{formattedDate}</div>
              <div className="text-muted-foreground flex items-center gap-1 font-mono text-[11px]">
                <Clock className="h-3 w-3" />
                {formattedTime}
              </div>
            </div>
          </div>

          {/* Contact Card with "Ver Contato" button */}
          {event.contact_id && (
            <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
                  Contato Vinculado
                </span>
                <div className="font-semibold text-foreground">
                  {event.contact_name || "Contato do CRM"}
                </div>
                {event.contact_phone && (
                  <div className="text-muted-foreground font-mono">{event.contact_phone}</div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  navigate({ to: "/contacts" });
                }}
                className="h-8 text-xs border-primary/30 text-primary hover:bg-primary/10 gap-1.5"
              >
                <span>Ver Contato</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Responsible, Team & Agent */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-muted-foreground">
            {event.responsible_name && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  <strong className="text-foreground">Responsável:</strong> {event.responsible_name}
                </span>
              </div>
            )}

            {event.team_name && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                <span>
                  <strong className="text-foreground">Equipe:</strong> {event.team_name}
                </span>
              </div>
            )}

            {event.agent_name && (
              <div className="flex items-center gap-2 col-span-2">
                <Bot className="h-4 w-4 text-primary shrink-0" />
                <span>
                  <strong className="text-foreground">DS Agent:</strong> {event.agent_name}
                </span>
              </div>
            )}
          </div>

          {/* Location & Meeting URL */}
          {(event.location || event.meeting_url) && (
            <div className="space-y-2 pt-1 border-t border-border/60">
              {event.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{event.location}</span>
                </div>
              )}
              {event.meeting_url && (
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-primary shrink-0" />
                  <a
                    href={event.meeting_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline truncate flex items-center gap-1 font-medium"
                  >
                    <span>Entrar na reunião</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="space-y-1 pt-1 border-t border-border/60">
              <span className="font-semibold text-foreground flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Observações
              </span>
              <p className="text-muted-foreground leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border/40 whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}

          {/* Confirmation Alert for Soft Delete */}
          {confirmDelete && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-destructive font-semibold text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Tem certeza que deseja excluir este evento?</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                O evento será removido da agenda mas permanecerá no histórico (soft delete).
              </p>
              <div className="flex items-center gap-2 justify-end pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                  className="h-7 text-xs border-border"
                >
                  Não, voltar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={loading}
                  className="h-7 text-xs font-semibold"
                >
                  Sim, excluir
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border">
          {/* Quick status actions */}
          <div className="flex items-center gap-1">
            {event.status !== "concluido" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onStatusChange(event.id, "concluido")}
                className="h-8 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 gap-1"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Concluir</span>
              </Button>
            )}
            {event.status !== "cancelled" && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={loading}
                className="h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 gap-1"
              >
                <XCircle className="h-3.5 w-3.5" />
                <span>Cancelar</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onEdit(event);
              }}
              className="h-8 text-xs border-border gap-1"
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span>Editar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="h-8 text-xs border-destructive/40 text-destructive hover:bg-destructive/10 gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Excluir</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
