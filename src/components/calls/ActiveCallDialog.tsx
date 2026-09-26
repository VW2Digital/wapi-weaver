import { createContext, useCallback, useContext, useState, useEffect, useRef, type ReactNode } from "react";
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
  remoteAudio?: HTMLAudioElement | null;
};

type CallSignalPayload = {
  call_id?: string | null;
  call_event?: string | null;
  status?: string | null;
  sdp?: string | null;
  sdp_type?: string | null;
};

const recentCallSignals: Array<{ at: number; signal: CallSignalPayload }> = [];
const callSignalListeners = new Set<(signal: CallSignalPayload) => void>();

export function isUsableRemoteAnswer(sdp?: string | null, sdpType?: string | null) {
  if (!sdp?.trim()) return false;
  const type = (sdpType || "").toLowerCase();
  if (type === "offer") return false;
  if (/a=setup:actpass/i.test(sdp)) return false;
  if (type === "answer") return true;
  return /a=setup:(active|passive)/i.test(sdp);
}

export function isTerminalCallSignal(signal: CallSignalPayload, activeCallId: string) {
  if (!activeCallId || !signal.call_id || signal.call_id !== activeCallId) return false;
  const event = (signal.call_event || "").toLowerCase();
  const status = (signal.status || "").toLowerCase();
  if (event === "connect" || event === "accept" || event === "active" || event === "ringing" || event === "pre_accept") {
    return false;
  }
  return (
    event === "terminate" ||
    event === "reject" ||
    event === "ended" ||
    event === "rejected" ||
    event === "failed" ||
    status === "ended" ||
    status === "rejected" ||
    status === "failed"
  );
}

function rememberCallSignal(signal: CallSignalPayload) {
  const now = Date.now();
  recentCallSignals.push({ at: now, signal });
  while (recentCallSignals.length > 0 && now - recentCallSignals[0].at > 30000) {
    recentCallSignals.shift();
  }
  callSignalListeners.forEach((listener) => listener(signal));
}

const ActiveCallContext = createContext<{
  start: (session: ActiveCallSession) => void;
} | null>(null);

export function ActiveCallProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ActiveCallSession | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/chat/events");
    es.onmessage = (evt) => {
      if (!evt.data || evt.data === "connected" || evt.data === "ping") return;
      try {
        const payload = JSON.parse(evt.data);
        if (payload?.type === "call.signal") rememberCallSignal(payload);
      } catch {
        // evento que não é JSON de chamada
      }
    };
    return () => es.close();
  }, []);

  const start = useCallback((next: ActiveCallSession) => {
    setSession((prev) => {
      if (
        prev?.peerConnection &&
        next.peerConnection &&
        prev.peerConnection !== next.peerConnection
      ) {
        prev.localStream?.getTracks().forEach((track) => track.stop());
        try {
          prev.peerConnection.close();
        } catch {}
        prev.remoteAudio?.pause();
        prev.remoteAudio?.remove();
      }
      return next;
    });
  }, []);

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
          remoteAudio={session.remoteAudio}
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
  remoteAudio?: HTMLAudioElement | null;
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
  remoteAudio,
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
  const callIdRef = useRef(callId);
  const onOpenChangeRef = useRef(onOpenChange);
  const onCallEndedRef = useRef(onCallEnded);
  callIdRef.current = callId;
  onOpenChangeRef.current = onOpenChange;
  onCallEndedRef.current = onCallEnded;

  const playbackElement = () => remoteAudio || audioElementRef.current;

  const playRemoteStream = (stream: MediaStream) => {
    const audio = playbackElement();
    if (!audio) return;
    audio.muted = false;
    audio.volume = isSpeakerOn ? 1 : 0.2;
    audio.srcObject = stream;
    audio.autoplay = true;
    void audio
      .play()
      .then(() => setIsAudioConnected(true))
      .catch((err) => {
        console.warn("[CALL] Erro ao iniciar reprodução de áudio:", err);
      });
  };

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
      const stream = event.streams?.[0] ?? (event.track ? new MediaStream([event.track]) : null);
      if (stream) playRemoteStream(stream);
    };

    peerConnection.addEventListener("track", handleTrack);
    for (const receiver of peerConnection.getReceivers()) {
      if (receiver.track?.kind === "audio" && receiver.track.readyState === "live") {
        playRemoteStream(new MediaStream([receiver.track]));
      }
    }

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
        console.warn("[CALL WebRTC] Conexão de mídia instável. A chamada segue aberta.");
      }
    };

    peerConnection.addEventListener("iceconnectionstatechange", handleIceState);

    return () => {
      peerConnection.removeEventListener("track", handleTrack);
      peerConnection.removeEventListener("iceconnectionstatechange", handleIceState);
    };
  }, [peerConnection, remoteAudio]);

  // Aplica o SDP Answer desta chamada. Sinais de outras chamadas não desligam esta.
  useEffect(() => {
    if (!open || !peerConnection) return;

    const handleSignal = async (payload: CallSignalPayload) => {
      const activeId = callIdRef.current;
      if (payload.call_id && payload.call_id !== activeId) return;

      if (isTerminalCallSignal(payload, activeId)) {
        toast.info("A chamada foi finalizada.");
        cleanup();
        onOpenChangeRef.current(false);
        onCallEndedRef.current?.();
        return;
      }

      if (
        isUsableRemoteAnswer(payload.sdp, payload.sdp_type) &&
        (peerConnection.signalingState === "have-local-offer" ||
          peerConnection.signalingState === "have-local-pranswer")
      ) {
        try {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp: payload.sdp! }),
          );
          setIsAudioConnected(true);
        } catch (sdpErr) {
          console.error("[CALL WebRTC] Erro ao aplicar SDP Answer da Meta:", sdpErr);
        }
      }
    };

    for (const item of recentCallSignals) {
      if (Date.now() - item.at < 30000) void handleSignal(item.signal);
    }
    callSignalListeners.add(handleSignal);
    return () => {
      callSignalListeners.delete(handleSignal);
    };
  }, [open, peerConnection]);

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
    const audio = playbackElement();
    if (audio) {
      audio.volume = nextSpeaker ? 1.0 : 0.2;
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
    const audio = playbackElement();
    if (audio) {
      audio.srcObject = null;
      if (remoteAudio && audio === remoteAudio) {
        audio.pause();
        audio.remove();
      }
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
      <audio
        ref={audioElementRef}
        autoPlay
        playsInline
        className={remoteAudio ? "hidden" : "fixed h-px w-px opacity-0 pointer-events-none"}
      />
    </div>
  );

  if (typeof document === "undefined") return panel;
  return createPortal(panel, document.body);
}