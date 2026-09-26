import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, Mic, MicOff, PhoneOff, Volume2, VolumeX, Loader2, Radio, ChevronUp, ChevronDown } from "lucide-react";
import { manageCall } from "@/lib/profile.functions";
import { toast } from "sonner";

export type ActiveCallSession = {
  callId: string;
  phoneId: string;
  contactName: string;
  contactPhone: string;
  peerConnection: RTCPeerConnection | null;
  localStream: MediaStream | null;
};

const ActiveCallContext = createContext<{
  start: (session: ActiveCallSession) => void;
} | null>(null);

export function ActiveCallProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ActiveCallSession | null>(null);

  const start = (next: ActiveCallSession) => {
    setSession((prev) => {
      if (prev && prev.callId !== next.callId) {
        prev.localStream?.getTracks().forEach((track) => track.stop());
        try {
          prev.peerConnection?.close();
        } catch {}
      }
      return next;
    });
  };

  return (
    <ActiveCallContext.Provider value={{ start }}>
      {children}
      {session && (
        <ActiveCallDialog
          open
          onOpenChange={(isOpen) => {
            if (!isOpen) setSession(null);
          }}
          contactName={session.contactName}
          contactPhone={session.contactPhone}
          callId={session.callId}
          phoneId={session.phoneId}
          peerConnection={session.peerConnection}
          localStream={session.localStream}
          onCallEnded={() => setSession(null)}
        />
      )}
    </ActiveCallContext.Provider>
  );
}

export function useActiveCall() {
  const ctx = useContext(ActiveCallContext);
  if (!ctx) {
    throw new Error("useActiveCall precisa do ActiveCallProvider.");
  }
  return ctx;
}

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
  const [isAudioConnected, setIsAudioConnected] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentCallId, setCurrentCallId] = useState(callId);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const manageCallFn = useServerFn(manageCall);

  useEffect(() => {
    if (callId) setCurrentCallId(callId);
  }, [callId]);

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

    const handleTrack = (event: RTCTrackEvent) => {
      console.log("[CALL WebRTC] Faixa de áudio recebida:", event);
      if (event.streams && event.streams[0] && audioElementRef.current) {
        audioElementRef.current.srcObject = event.streams[0];
        audioElementRef.current
          .play()
          .then(() => {
            setIsAudioConnected(true);
            console.log("[CALL WebRTC] Reprodução de áudio iniciada!");
          })
          .catch((err) => {
            console.warn("[CALL] Erro ao iniciar reprodução de áudio:", err);
          });
      }
    };

    peerConnection.ontrack = handleTrack;

    // Monitora mudança no estado da conexão de gelo (ICE Connection State)
    const handleIceState = () => {
      console.log("[CALL WebRTC] ICE Connection State:", peerConnection.iceConnectionState);
      if (
        peerConnection.iceConnectionState === "connected" ||
        peerConnection.iceConnectionState === "completed"
      ) {
        setIsAudioConnected(true);
      } else if (
        peerConnection.iceConnectionState === "disconnected" ||
        peerConnection.iceConnectionState === "failed"
      ) {
        console.warn("[CALL WebRTC] Conexão de mídia WebRTC desconectada.");
      }
    };

    peerConnection.addEventListener("iceconnectionstatechange", handleIceState);

    return () => {
      peerConnection.removeEventListener("iceconnectionstatechange", handleIceState);
    };
  }, [peerConnection]);

  // Escuta o fluxo de eventos SSE (/api/chat/events) para receber a resposta SDP (Answer) da Meta em tempo real
  useEffect(() => {
    if (!open || !peerConnection) return;

    const es = new EventSource("/api/chat/events");

    es.onmessage = async (evt) => {
      try {
        if (!evt.data || evt.data === "connected" || evt.data === "ping") return;
        const payload = JSON.parse(evt.data);

        if (payload.type === "call.signal") {
          console.log("[CALL SSE] Sinalização recebida da Meta:", payload);
          if (payload.call_id) {
            setCurrentCallId(payload.call_id);
          }

          // Se a chamada foi terminada ou rejeitada
          if (
            payload.call_event === "terminate" ||
            payload.call_event === "reject" ||
            payload.status === "ended" ||
            payload.status === "rejected"
          ) {
            toast.info("A chamada foi finalizada.");
            cleanup();
            onOpenChange(false);
            onCallEnded?.();
            return;
          }

          // Se a Meta enviou o SDP Answer
          if (payload.sdp && peerConnection.signalingState === "have-local-offer") {
            try {
              const answerDesc = new RTCSessionDescription({
                type: (payload.sdp_type || "answer") as RTCSdpType,
                sdp: payload.sdp,
              });
              await peerConnection.setRemoteDescription(answerDesc);
              setIsAudioConnected(true);
              console.log("[CALL WebRTC] SDP Answer da Meta aplicado com sucesso via SSE!");
              toast.success("Áudio conectado!");
            } catch (sdpErr) {
              console.error("[CALL WebRTC] Erro ao aplicar SDP Answer da Meta:", sdpErr);
            }
          }
        }
      } catch (err) {
        console.warn("[CALL SSE] Erro ao interpretar evento:", err);
      }
    };

    return () => {
      es.close();
    };
  }, [open, peerConnection, onOpenChange, onCallEnded]);

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
    const targetCallId = currentCallId || callId;
    try {
      if (phoneId) {
        console.log("[CALL] Solicitando terminate na Meta:", { phoneId, callId: targetCallId, contactPhone });
        await manageCallFn({
          data: {
            phoneId,
            action: "terminate",
            callId: targetCallId,
            to: contactPhone,
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

  if (!open) return null;

  const panel = (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      <section
        role="region"
        aria-label="Chamada em andamento"
        className="pointer-events-auto fixed bottom-4 right-4 w-[min(100vw-2rem,22rem)] rounded-2xl border border-border bg-card p-3 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 rounded-full bg-emerald-600 text-white flex items-center justify-center">
            <Phone className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {contactName || contactPhone}
            </p>
            <p className="text-[11px] text-muted-foreground font-mono">
              {formatDuration(duration)} · {isAudioConnected ? "Voz conectada" : "Conectando"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setExpanded((value) => !value)}
            aria-label={expanded ? "Recolher chamada" : "Expandir chamada"}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleEndCall}
            disabled={isEnding}
            aria-label="Desligar"
          >
            {isEnding ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOff className="h-4 w-4" />}
          </Button>
        </div>

        {expanded && (
          <div className="mt-3 space-y-3">
            <div className="flex justify-center">
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-xs px-2 py-0.5 font-medium flex items-center gap-1.5"
              >
                <Radio className="h-3 w-3 animate-pulse text-emerald-500" />
                {isAudioConnected ? "Voz conectada" : "Conectando áudio..."}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-3">
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
                <span className="text-[11px] font-medium">
                  {isSpeakerOn ? "Viva-Voz On" : "Viva-Voz Off"}
                </span>
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
        )}
      </section>
      <audio ref={audioElementRef} autoPlay playsInline className="hidden" />
    </div>
  );

  if (typeof document === "undefined") return panel;
  return createPortal(panel, document.body);
}