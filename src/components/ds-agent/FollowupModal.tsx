import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Clock, MessageSquare, Repeat, Calendar } from "lucide-react";

interface FollowupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddFollowup: (data: {
    name: string;
    message: string;
    type: "manual" | "generativo";
    recurrence: "unico" | "recorrente" | "diario";
    wait_amount: number;
    wait_unit: "minutos" | "horas" | "dias";
  }) => void;
}

export function FollowupModal({ isOpen, onClose, onAddFollowup }: FollowupModalProps) {
  const [tabMode, setTabMode] = useState<"manual" | "generativo">("manual");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [recurrence, setRecurrence] = useState<"unico" | "recorrente" | "diario">("unico");
  const [waitAmount, setWaitAmount] = useState(10);
  const [waitUnit, setWaitUnit] = useState<"minutos" | "horas" | "dias">("minutos");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !message.trim()) return;

    onAddFollowup({
      name: name.trim(),
      message: message.trim(),
      type: tabMode,
      recurrence,
      wait_amount: waitAmount,
      wait_unit: waitUnit,
    });

    setName("");
    setMessage("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] bg-card border-border text-card-foreground">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-display font-bold text-foreground">
              <Clock className="h-5 w-5 text-primary" />
              Novo Follow Up
            </DialogTitle>
          </DialogHeader>

          {/* Mode Selector Tabs */}
          <div className="flex border-b border-border mt-2">
            <button
              type="button"
              onClick={() => setTabMode("manual")}
              className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${
                tabMode === "manual"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => setTabMode("generativo")}
              className={`flex-1 py-2 text-sm font-semibold border-b-2 transition-colors ${
                tabMode === "generativo"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Generativo (IA)
            </button>
          </div>

          <div className="space-y-4 py-4">
            <p className="text-xs text-muted-foreground">
              {tabMode === "manual"
                ? "Esta mensagem será enviada exatamente como você escrever quando o lead ficar sem responder."
                : "A IA irá gerar uma mensagem contextual de acompanhamento adaptada à conversa atual do lead."}
            </p>

            <div className="space-y-2">
              <Label className="text-foreground font-medium">Nome do Follow Up</Label>
              <Input
                placeholder="Ex: Reengajamento 10 minutos"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-foreground font-medium">
                {tabMode === "manual" ? "Mensagem" : "Instruções do Follow Up Generativo"}
              </Label>
              <Textarea
                placeholder={
                  tabMode === "manual"
                    ? "Olá {{nome_lead}}, ainda está por aí? Posso te ajudar?"
                    : "Gere uma mensagem amigável perguntando se o lead deseja continuar a conversa..."
                }
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            {/* Recurrence Radio Cards */}
            <div className="space-y-2">
              <Label className="text-foreground font-medium">Tipo de Follow-Up</Label>
              <div className="grid grid-cols-3 gap-2">
                <div
                  onClick={() => setRecurrence("unico")}
                  className={`cursor-pointer rounded-lg border p-3 text-center transition-all ${
                    recurrence === "unico"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <MessageSquare className="h-4 w-4 mx-auto mb-1 text-primary" />
                  <p className="text-xs font-semibold">Único</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">1 vez por lead</p>
                </div>

                <div
                  onClick={() => setRecurrence("recorrente")}
                  className={`cursor-pointer rounded-lg border p-3 text-center transition-all ${
                    recurrence === "recorrente"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <Repeat className="h-4 w-4 mx-auto mb-1 text-primary" />
                  <p className="text-xs font-semibold">Recorrente</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Sem resposta</p>
                </div>

                <div
                  onClick={() => setRecurrence("diario")}
                  className={`cursor-pointer rounded-lg border p-3 text-center transition-all ${
                    recurrence === "diario"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <Calendar className="h-4 w-4 mx-auto mb-1 text-primary" />
                  <p className="text-xs font-semibold">Diário</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">1 vez por dia</p>
                </div>
              </div>
            </div>

            {/* Stepper Tempo de Espera */}
            <div className="space-y-2">
              <Label className="text-foreground font-medium">Tempo de Espera</Label>
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-lg border border-border bg-background p-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setWaitAmount((prev) => Math.max(1, prev - 1))}
                    className="h-8 w-8 text-foreground hover:bg-muted"
                  >
                    -
                  </Button>
                  <span className="w-12 text-center text-sm font-bold text-foreground">
                    {waitAmount}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setWaitAmount((prev) => prev + 1)}
                    className="h-8 w-8 text-foreground hover:bg-muted"
                  >
                    +
                  </Button>
                </div>

                <div className="flex rounded-lg border border-border bg-background p-1">
                  {(["minutos", "horas", "dias"] as const).map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setWaitUnit(unit)}
                      className={`px-3 py-1 text-xs font-medium capitalize rounded transition-colors ${
                        waitUnit === unit
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {unit}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-border bg-card text-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-brand-gradient text-white font-semibold shadow-md hover:opacity-95"
            >
              Adicionar Follow Up
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
