import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Mic, MicOff, PhoneOff, Volume2, VolumeX, Loader2, Radio } from "lucide-react";
import { manageCall } from "@/lib/profile.functions";
import { toast } from "sonner";

interface ActiveCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  contactPhone: string;
  callId: string;
  phoneId: string;
  peerConnection?: RTCPeerConnection | null;
  localStream?: MediaStream | null;
  onCallEnded?: () => void;
}

export function ActiveCallDialog({
  open,
  onOpenChange,
  contactName,
  contactPhone,
  callId,
  phoneId,
  peerConnection,
  localStream,
  onCallEnded,
}: ActiveCallDialogProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isEnding, setIsEnding] = useState(false);
  const [duration, setDuration] = useState(0);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const manageCallFn = useServerFn(manageCall);

  // Timer de duração da chamada em segundos
  useEffect(() => {
    if (open) {
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setDuration(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [open]);

  // Conectar stream de áudio remoto do peerConnection ao elemento de áudio
  useEffect(() => {
    if (!peerConnection) return;

    peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0] && audioElementRef.current) {
        audioElementRef.current.srcObject = event.streams[0];
        audioElementRef.current.play().catch((err) => {
          console.warn("[CALL] Erro ao iniciar reprodução de áudio:", err);
        });
      }
    };
  }, [peerConnection]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Alternar Mudo (Microfone local)
  const toggleMute = () => {
    const nextMuted = !isMuted;
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    if (peerConnection) {
      peerConnection.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === "audio") {
          sender.track.enabled = !nextMuted;
        }
      });
    }
    setIsMuted(nextMuted);
    if (nextMuted) {
      toast.info("Microfone silenciado.");
    } else {
      toast.info("Microfone ativado.");
    }
  };

  // Alternar Viva-Voz (Volume / Alto-falante)
  const toggleSpeaker = () => {
    const nextSpeaker = !isSpeakerOn;
    if (audioElementRef.current) {
      audioElementRef.current.volume = nextSpeaker ? 1.0 : 0.2;
    }
    setIsSpeakerOn(nextSpeaker);
    if (nextSpeaker) {
      toast.info("Viva-voz ativado.");
    } else {
      toast.info("Viva-voz desativado (volume reduzido).");
    }
  };

  // Desligar / Encerrar chamada
  const handleEndCall = async () => {
    setIsEnding(true);
    try {
      if (callId && phoneId) {
        await manageCallFn({
          data: {
            phoneId,
            action: "terminate",
            callId,
          },
        });
      }
      toast.success("Chamada encerrada.");
    } catch (error) {
      console.error("[CALL] Erro ao encerrar chamada na Meta:", error);
    } finally {
      cleanup();
      setIsEnding(false);
      onOpenChange(false);
      onCallEnded?.();
    }
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peerConnection) {
      try {
        peerConnection.close();
      } catch {}
    }
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => {
        if (!isOpen && !isEnding) {
          handleEndCall();
        }
      }}>
        <DialogContent className="sm:max-w-md bg-card border-border rounded-2xl p-6 shadow-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Chamada em Andamento</DialogTitle>
            <DialogDescription>Controles de voz da chamada em andamento.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Header da Chamada */}
            <div className="text-center space-y-3">
              <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                <div className="absolute inset-2 rounded-full bg-emerald-500/30 animate-pulse" />
                <div className="relative h-16 w-16 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-lg">
                  <Phone className="h-8 w-8" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs px-2 py-0.5 font-medium flex items-center gap-1.5">
                    <Radio className="h-3 w-3 animate-pulse text-emerald-500" />
                    Em chamada ativa
                  </Badge>
                </div>
                <h3 className="font-bold text-xl text-foreground font-display">{contactName || contactPhone}</h3>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{contactPhone}</p>
              </div>

              {/* Timer da Chamada */}
              <div className="text-3xl font-mono font-semibold tracking-wider text-foreground bg-background/50 border border-border/60 py-2 px-4 rounded-xl inline-block shadow-inner">
                {formatDuration(duration)}
              </div>
            </div>

            {/* Ações / Controles da Chamada */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              {/* Botão Mudo */}
              <Button
                variant="outline"
                size="lg"
                onClick={toggleMute}
                disabled={isEnding}
                className={`flex flex-col items-center justify-center h-20 rounded-xl transition-all ${
                  isMuted
                    ? "bg-destructive/10 border-destructive text-destructive hover:bg-destructive/20"
                    : "bg-background border-border text-foreground hover:bg-accent"
                }`}
              >
                {isMuted ? (
                  <MicOff className="h-5 w-5 mb-1 text-destructive" />
                ) : (
                  <Mic className="h-5 w-5 mb-1" />
                )}
                <span className="text-[11px] font-medium">{isMuted ? "Mutado" : "Mudo"}</span>
              </Button>

              {/* Botão Viva-Voz */}
              <Button
                variant="outline"
                size="lg"
                onClick={toggleSpeaker}
                disabled={isEnding}
                className={`flex flex-col items-center justify-center h-20 rounded-xl transition-all ${
                  isSpeakerOn
                    ? "bg-primary/10 border-primary text-primary hover:bg-primary/20"
                    : "bg-background border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {isSpeakerOn ? (
                  <Volume2 className="h-5 w-5 mb-1 text-primary" />
                ) : (
                  <VolumeX className="h-5 w-5 mb-1 text-muted-foreground" />
                )}
                <span className="text-[11px] font-medium">{isSpeakerOn ? "Viva-Voz On" : "Viva-Voz Off"}</span>
              </Button>

              {/* Botão Desligar */}
              <Button
                variant="destructive"
                size="lg"
                onClick={handleEndCall}
                disabled={isEnding}
                className="flex flex-col items-center justify-center h-20 rounded-xl bg-destructive hover:bg-destructive/90 text-white shadow-md transition-all active:scale-95"
              >
                {isEnding ? (
                  <Loader2 className="h-5 w-5 animate-spin mb-1" />
                ) : (
                  <PhoneOff className="h-5 w-5 mb-1" />
                )}
                <span className="text-[11px] font-bold">Desligar</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Elemento de reprodução de áudio WebRTC */}
      <audio ref={audioElementRef} autoPlay playsInline className="hidden" />
    </>
  );
}