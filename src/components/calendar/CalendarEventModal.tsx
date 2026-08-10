import React from "react";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarEventItem } from "./CalendarEventCard";
import { AlertCircle } from "lucide-react";

interface EventFormValues {
  title: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  contact_id: string;
  responsible_user_id: string;
  team_id: string;
  ds_agent_id: string;
  event_type: string;
  status: string;
  location: string;
  meeting_url: string;
  color: string;
  reminder_minutes: string;
}

interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  eventToEdit?: CalendarEventItem | null;
  initialSlot?: { start: Date; end: Date } | null;
  initialDate?: Date;
  initialStartTime?: string;
  initialEndTime?: string;
  isSubmitting?: boolean;
  auxData: {
    contacts?: Array<{ id: string; name: string | null; phone_e164: string | null }>;
    users: Array<{ id: string; display_name: string | null; full_name: string | null }>;
    teams: Array<{ id: string; name: string }>;
    agents: Array<{ id: string; name: string }>;
  };
}

export function CalendarEventModal({
  isOpen,
  onClose,
  onSubmit,
  eventToEdit,
  initialSlot,
  initialDate,
  initialStartTime,
  initialEndTime,
  isSubmitting,
  auxData,
}: CalendarEventModalProps) {
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const effectiveDate = initialSlot?.start || initialDate;
  const effectiveStart = initialSlot ? format(initialSlot.start, "HH:mm") : initialStartTime;
  const effectiveEnd = initialSlot ? format(initialSlot.end, "HH:mm") : initialEndTime;

  const defaultDateStr = eventToEdit?.start_at
    ? format(new Date(eventToEdit.start_at), "yyyy-MM-dd")
    : effectiveDate
    ? format(effectiveDate, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  const defaultStartStr = eventToEdit?.start_at
    ? format(new Date(eventToEdit.start_at), "HH:mm")
    : effectiveStart || "09:00";

  const defaultEndStr = eventToEdit?.end_at
    ? format(new Date(eventToEdit.end_at), "HH:mm")
    : effectiveEnd || "10:00";

  const form = useForm<EventFormValues>({
    defaultValues: {
      title: eventToEdit?.title || "",
      description: eventToEdit?.description || "",
      date: defaultDateStr,
      start_time: defaultStartStr,
      end_time: defaultEndStr,
      all_day: Boolean(eventToEdit?.all_day),
      contact_id: eventToEdit?.contact_id || "none",
      responsible_user_id: eventToEdit?.responsible_user_id || "none",
      team_id: eventToEdit?.team_id || "none",
      ds_agent_id: eventToEdit?.ds_agent_id || "none",
      event_type: eventToEdit?.event_type || "reuniao",
      status: eventToEdit?.status || "agendado",
      location: eventToEdit?.location || "",
      meeting_url: eventToEdit?.meeting_url || "",
      color: eventToEdit?.color || "#7C3AED",
      reminder_minutes: eventToEdit?.reminder_minutes ? String(eventToEdit.reminder_minutes) : "30",
    },
  });

  React.useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      const dateStr = eventToEdit?.start_at
        ? format(new Date(eventToEdit.start_at), "yyyy-MM-dd")
        : initialDate
        ? format(initialDate, "yyyy-MM-dd")
        : format(new Date(), "yyyy-MM-dd");

      const startStr = eventToEdit?.start_at
        ? format(new Date(eventToEdit.start_at), "HH:mm")
        : initialStartTime || "09:00";

      const endStr = eventToEdit?.end_at
        ? format(new Date(eventToEdit.end_at), "HH:mm")
        : initialEndTime || "10:00";

      form.reset({
        title: eventToEdit?.title || "",
        description: eventToEdit?.description || "",
        date: dateStr,
        start_time: startStr,
        end_time: endStr,
        all_day: Boolean(eventToEdit?.all_day),
        contact_id: eventToEdit?.contact_id || "none",
        responsible_user_id: eventToEdit?.responsible_user_id || "none",
        team_id: eventToEdit?.team_id || "none",
        ds_agent_id: eventToEdit?.ds_agent_id || "none",
        event_type: eventToEdit?.event_type || "reuniao",
        status: eventToEdit?.status || "agendado",
        location: eventToEdit?.location || "",
        meeting_url: eventToEdit?.meeting_url || "",
        color: eventToEdit?.color || "#7C3AED",
        reminder_minutes: eventToEdit?.reminder_minutes ? String(eventToEdit.reminder_minutes) : "30",
      });
    }
  }, [isOpen, eventToEdit, initialDate, initialStartTime, initialEndTime]);

  const handleSubmit = async (values: any) => {
    if (!values.title?.trim()) {
      setErrorMsg("O título é obrigatório");
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      const startAtIso = `${values.date}T${values.start_time}:00.000Z`;
      const endAtIso = `${values.date}T${values.end_time}:00.000Z`;

      await onSubmit({
        id: eventToEdit?.id,
        title: values.title.trim(),
        description: values.description?.trim() || null,
        start_at: startAtIso,
        end_at: endAtIso,
        all_day: values.all_day,
        contact_id: !values.contact_id || values.contact_id === "none" ? null : values.contact_id,
        responsible_user_id: !values.responsible_user_id || values.responsible_user_id === "none" ? null : values.responsible_user_id,
        team_id: !values.team_id || values.team_id === "none" ? null : values.team_id,
        ds_agent_id: !values.ds_agent_id || values.ds_agent_id === "none" ? null : values.ds_agent_id,
        event_type: values.event_type,
        status: values.status,
        location: values.location?.trim() || null,
        meeting_url: values.meeting_url?.trim() || null,
        color: values.color,
        reminder_minutes: values.reminder_minutes ? Number(values.reminder_minutes) : null,
      });

      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao salvar evento");
    } finally {
      setLoading(false);
    }
  };

  const colors = [
    "#7C3AED", // Purple
    "#2563EB", // Blue
    "#059669", // Emerald
    "#D97706", // Amber
    "#DB2777", // Pink
    "#4F46E5", // Indigo
    "#E11D48", // Rose
    "#4B5563", // Gray
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-base font-display font-bold text-foreground">
            {eventToEdit ? "Editar Evento da Agenda" : "Criar Novo Evento"}
          </DialogTitle>
        </DialogHeader>

        {errorMsg && (
          <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 text-xs pt-1">
          {/* Title */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Título do Evento *</Label>
            <Input
              {...form.register("title")}
              placeholder="Ex: Reunião de alinhamento comercial"
              className="h-9 text-xs bg-background border-border"
            />
          </div>

          {/* Date and Time Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Data *</Label>
              <Input
                type="date"
                {...form.register("date")}
                className="h-9 text-xs bg-background border-border"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Hora Inicial *</Label>
              <Input
                type="time"
                {...form.register("start_time")}
                className="h-9 text-xs bg-background border-border"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Hora Final *</Label>
              <Input
                type="time"
                {...form.register("end_time")}
                className="h-9 text-xs bg-background border-border"
              />
            </div>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20">
            <Label htmlFor="all_day" className="text-xs cursor-pointer font-medium">
              Evento de dia inteiro
            </Label>
            <Switch
              id="all_day"
              checked={form.watch("all_day")}
              onCheckedChange={(val) => form.setValue("all_day", val)}
            />
          </div>

          {/* Type & Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tipo de Evento</Label>
              <Select
                value={form.watch("event_type")}
                onValueChange={(val) => form.setValue("event_type", val)}
              >
                <SelectTrigger className="h-9 text-xs bg-background border-border">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-xs">
                  <SelectItem value="reuniao">Reunião</SelectItem>
                  <SelectItem value="consulta">Consulta</SelectItem>
                  <SelectItem value="retorno">Retorno</SelectItem>
                  <SelectItem value="ligacao">Ligação</SelectItem>
                  <SelectItem value="tarefa">Tarefa</SelectItem>
                  <SelectItem value="followup">Follow-up</SelectItem>
                  <SelectItem value="demonstracao">Demonstração</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Status</Label>
              <Select
                value={form.watch("status")}
                onValueChange={(val) => form.setValue("status", val)}
              >
                <SelectTrigger className="h-9 text-xs bg-background border-border">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-xs">
                  <SelectItem value="agendado">Agendado</SelectItem>
                  <SelectItem value="confirmado">Confirmado</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                  <SelectItem value="nao_compareceu">Não Compareceu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Contact & Responsible User */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Contato Vinculado</Label>
              <Select
                value={form.watch("contact_id")}
                onValueChange={(val) => form.setValue("contact_id", val === "none" ? "" : val)}
              >
                <SelectTrigger className="h-9 text-xs bg-background border-border">
                  <SelectValue placeholder="Selecione um contato" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-xs max-h-48">
                  <SelectItem value="none">Nenhum contato</SelectItem>
                  {auxData.contacts?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name || c.phone_e164 || "Contato sem nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Usuário Responsável</Label>
              <Select
                value={form.watch("responsible_user_id")}
                onValueChange={(val) => form.setValue("responsible_user_id", val === "none" ? "" : val)}
              >
                <SelectTrigger className="h-9 text-xs bg-background border-border">
                  <SelectValue placeholder="Selecione um responsável" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-xs max-h-48">
                  <SelectItem value="none">Nenhum responsável</SelectItem>
                  {auxData.users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.display_name || u.full_name || "Usuário"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Team & DS Agent */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Equipe</Label>
              <Select
                value={form.watch("team_id")}
                onValueChange={(val) => form.setValue("team_id", val === "none" ? "" : val)}
              >
                <SelectTrigger className="h-9 text-xs bg-background border-border">
                  <SelectValue placeholder="Selecione uma equipe" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-xs">
                  <SelectItem value="none">Nenhuma equipe</SelectItem>
                  {auxData.teams.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">DS Agent</Label>
              <Select
                value={form.watch("ds_agent_id")}
                onValueChange={(val) => form.setValue("ds_agent_id", val === "none" ? "" : val)}
              >
                <SelectTrigger className="h-9 text-xs bg-background border-border">
                  <SelectValue placeholder="Selecione um agente" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-xs">
                  <SelectItem value="none">Nenhum agente</SelectItem>
                  {auxData.agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Location & Meeting URL */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Localização</Label>
              <Input
                {...form.register("location")}
                placeholder="Ex: Sala de Reuniões 02 / Presencial"
                className="h-9 text-xs bg-background border-border"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Link da Reunião (Google Meet / Zoom)</Label>
              <Input
                {...form.register("meeting_url")}
                placeholder="https://meet.google.com/abc-defg-hij"
                className="h-9 text-xs bg-background border-border"
              />
            </div>
          </div>

          {/* Color & Reminder */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Cor de Destaque</Label>
              <div className="flex items-center gap-2 pt-1">
                {colors.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => form.setValue("color", c)}
                    style={{ backgroundColor: c }}
                    className={`h-6 w-6 rounded-full transition-transform ${
                      form.watch("color") === c ? "ring-2 ring-primary ring-offset-2 scale-110" : "opacity-80 hover:opacity-100"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Lembrete Antecipado</Label>
              <Select
                value={form.watch("reminder_minutes")}
                onValueChange={(val) => form.setValue("reminder_minutes", val)}
              >
                <SelectTrigger className="h-9 text-xs bg-background border-border">
                  <SelectValue placeholder="Lembrete" />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border text-xs">
                  <SelectItem value="10">10 minutos antes</SelectItem>
                  <SelectItem value="30">30 minutos antes</SelectItem>
                  <SelectItem value="60">1 hora antes</SelectItem>
                  <SelectItem value="1440">1 dia antes</SelectItem>
                  <SelectItem value="0">Sem lembrete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Descrição / Observações</Label>
            <Textarea
              {...form.register("description")}
              placeholder="Detalhes adicionais sobre a pauta da reunião..."
              className="h-20 text-xs bg-background border-border resize-none"
            />
          </div>

          <DialogFooter className="pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-9 text-xs border-border"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-9 text-xs font-semibold bg-primary text-primary-foreground"
            >
              {loading ? "Salvando..." : eventToEdit ? "Salvar Alterações" : "Criar Evento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
