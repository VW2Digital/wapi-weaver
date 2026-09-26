import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, PhoneOff, PhoneCall, Loader2 } from "lucide-react";
import { manageCall } from "@/lib/profile.functions";
import { toast } from "sonner";
import { toWhatsAppSessionSdp, setWhatsAppCallSendersEnabled } from "@/components/calls/ActiveCallDialog";
import { toFriendlyError } from "@/lib/meta-errors";
import { getWebRtcIceServers } from "@/lib/webrtc-ice.functions";
import {
  createWhatsAppPeerConnection,
  FALLBACK_STUN_ICE_SERVERS,
  waitForIceGathering,
} from "@/lib/webrtc-ice-client";

export interface IncomingCallAcceptedPayload {
  peerConnection: RTCPeerConnection;
  localStream: MediaStream;
  remoteAudio: HTMLAudioElement;
  callId: string;
  phoneId: string;
  contactName: string;
  contactPhone: string;
  userInitiated?: boolean;
}

interface IncomingCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  contactPhone: string;
  callId: string;
  phoneId: string;
  sdpOffer?: string;
  onCallAccepted?: (session: IncomingCallAcceptedPayload) => void;
}

export function IncomingCallDialog({
  open,
  onOpenChange,
  contactName,
  contactPhone,
  callId,
  phoneId,
  sdpOffer,
  onCallAccepted,
}: IncomingCallDialogProps) {
  const [isAnswering, setIsAnswering] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const ringtoneAudioCtxRef = useRef<AudioContext | null>(null);
  const ringtoneIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const manageCallFn = useServerFn(manageCall);
  const fetchIceServers = useServerFn(getWebRtcIceServers);

  // Efeito sonoro de chamada recebida (Ringtone via Web Audio API)
  useEffect(() => {
    if (open) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          ringtoneAudioCtxRef.current = ctx;

          const playBeep = () => {
            if (ctx.state === "suspended") {
              ctx.resume().catch(() => {});
            }
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.setValueAtTime(480, ctx.currentTime + 0.1);

            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.2);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 1.2);
          };

          playBeep();
          ringtoneIntervalRef.current = setInterval(playBeep, 2500);
        }
      } catch (err) {
        console.warn("[CALL] Erro ao iniciar ringtone:", err);
      }
    } else {
      stopRingtone();
    }

    return () => {
      stopRingtone();
    };
  }, [open]);

  const stopRingtone = () => {
    if (ringtoneIntervalRef.current) {
      clearInterval(ringtoneIntervalRef.current);
      ringtoneIntervalRef.current = null;
    }
    if (ringtoneAudioCtxRef.current) {
      try {
        ringtoneAudioCtxRef.current.close();
      } catch {}
      ringtoneAudioCtxRef.current = null;
    }
  };

  // Rejeitar chamada
  const handleReject = async () => {
    setIsRejecting(true);
    stopRingtone();
    try {
      if (phoneId && callId) {
        await manageCallFn({
          data: {
            phoneId,
            action: "reject",
            callId,
          },
        });
      }
      toast.info("Chamada recusada.");
      onOpenChange(false);
    } catch (error) {
      console.error("[CALL] Erro ao rejeitar chamada:", error);
      onOpenChange(false);
    } finally {
      setIsRejecting(false);
    }
  };

  // Atender chamada
  const handleAnswer = async () => {
    setIsAnswering(true);
    stopRingtone();
    let remoteAudio: HTMLAudioElement | null = null;
    let pc: RTCPeerConnection | null = null;
    let stream: MediaStream | null = null;

    try {
      const playback = document.createElement("audio");
      remoteAudio = playback;
      playback.autoplay = true;
      playback.setAttribute("playsinline", "true");
      playback.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;";
      playback.muted = true;
      playback.volume = 1;
      document.body.appendChild(playback);

      // 1. Cria a conexão RTCPeerConnection com STUN + TURN
      const ice = await fetchIceServers().catch(() => ({
        iceServers: FALLBACK_STUN_ICE_SERVERS,
        turnEnabled: false,
      }));
      if (!ice.turnEnabled) {
        console.warn("[CALL][inbound] TURN não configurado. NAT simétrico tende a falhar com 138021/138023.");
      } else {
        console.info("[CALL][inbound] TURN habilitado", ice.iceServers.map((s) => s.urls));
      }
      const pcCreated = createWhatsAppPeerConnection(
        ice.iceServers.length ? ice.iceServers : FALLBACK_STUN_ICE_SERVERS,
        "inbound",
      );
      pc = pcCreated;

      // 2. Solicita acesso ao microfone com melhorias de áudio
      let captured: MediaStream | null = null;
      try {
        captured = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        stream = captured;
        const audioTrack = captured.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = false;
          pc.addTrack(audioTrack, captured);
        }
      } catch (micErr) {
        console.warn("[CALL] Microfone indisponível no atendimento:", micErr);
        toast.error("Microfone indisponível. A ligação será atendida só para ouvir, sem enviar áudio.");
        pc.addTransceiver("audio", { direction: "sendrecv" });
      }

      setWhatsAppCallSendersEnabled(pc, false);

      pc.addEventListener("track", (event) => {
        const stream = event.streams?.[0] ?? new MediaStream([event.track]);
        playback.srcObject = stream;
        void playback.play().catch(() => {});
      });

      // 3. Aplica o SDP Offer recebido da Meta
      if (sdpOffer) {
        const offerDesc = new RTCSessionDescription({
          type: "offer",
          sdp: sdpOffer,
        });
        await pc.setRemoteDescription(offerDesc);

        // 4. Cria a SDP Answer do navegador
        const answer = await pc.createAnswer();
        await pc.setLocalDescription({
          type: answer.type,
          sdp: toWhatsAppSessionSdp(answer.sdp || ""),
        });
        await waitForIceGathering(pc, 8000);

        const localDesc = pc.localDescription || answer;
        const answerSdp = toWhatsAppSessionSdp(localDesc?.sdp || "");
        if (!answerSdp) {
          throw new Error("Não foi possível gerar o SDP Answer para a Meta.");
        }

        const preAcceptRes = await manageCallFn({
          data: {
            phoneId,
            action: "pre_accept",
            callId,
            sdp: answerSdp,
            sdpType: "answer",
            opaqueCallbackData: callId.slice(0, 512),
          },
        });
        if (!preAcceptRes.ok) {
          console.warn("[CALL] pre_accept falhou, tentando accept com o mesmo SDP:", preAcceptRes.error);
        }

        const acceptRes = await manageCallFn({
          data: {
            phoneId,
            action: "accept",
            callId,
            sdp: answerSdp,
            sdpType: "answer",
            opaqueCallbackData: callId.slice(0, 512),
          },
        });
        if (!acceptRes.ok) {
          const friendly = toFriendlyError(acceptRes.data ?? acceptRes.error, "A Meta recusou o accept da chamada.");
          throw new Error([friendly.title, friendly.message, friendly.hint].filter(Boolean).join(" "));
        }

        setWhatsAppCallSendersEnabled(pc, true);
        stream?.getAudioTracks().forEach((track) => {
          track.enabled = true;
        });
        playback.muted = false;
        void playback.play().catch(() => {});

        toast.info("Chamada em atendimento. A voz confirma quando o ICE conectar.");

        if (onCallAccepted) {
          onCallAccepted({
            peerConnection: pc,
            localStream: stream ?? new MediaStream(),
            remoteAudio: playback,
            callId,
            phoneId,
            contactName: contactName || contactPhone,
            contactPhone,
            userInitiated: true,
          });
        }
        onOpenChange(false);
      } else {
        toast.error("Oferta SDP da Meta não chegou. Peça ao cliente para ligar de novo.");
        playback.remove();
        pc.close();
        stream?.getTracks().forEach((track) => track.stop());
      }
    } catch (error: any) {
      remoteAudio?.remove();
      stream?.getTracks().forEach((track) => track.stop());
      try {
        pc?.close();
      } catch {}
      console.error("[CALL] Erro ao atender chamada:", error);
      toast.error(error?.message || "Falha ao atender chamada.");
      setIsAnswering(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border rounded-2xl p-6 shadow-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Chamada Recebida</DialogTitle>
          <DialogDescription>Chamada de voz recebida pelo WhatsApp.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Topo / Animação de Chamada Recebida */}
          <div className="text-center space-y-3">
            <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="absolute inset-2 rounded-full bg-primary/30 animate-pulse" />
              <div className="relative h-16 w-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg">
                <PhoneCall className="h-8 w-8 animate-bounce" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <Badge
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/20 text-xs px-2 py-0.5 font-medium"
                >
                  Chamada Recebida no WhatsApp
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Ligacao iniciada pelo cliente: gratuita na Meta. Atender ou recusar ainda renova a
                janela de 24h de mensagens.
              </p>
              <h3 className="font-bold text-xl text-foreground font-display">
                {contactName || contactPhone}
              </h3>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{contactPhone}</p>
            </div>
          </div>

          {/* Botões de Ação: Recusar e Atender */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <Button
              variant="outline"
              size="lg"
              onClick={handleReject}
              disabled={isRejecting || isAnswering}
              className="h-14 rounded-xl border-destructive/30 hover:bg-destructive/10 text-destructive font-semibold flex items-center justify-center gap-2"
            >
              {isRejecting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <PhoneOff className="h-5 w-5" />
              )}
              <span>Recusar</span>
            </Button>

            <Button
              size="lg"
              onClick={handleAnswer}
              disabled={isAnswering || isRejecting}
              className="h-14 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
            >
              {isAnswering ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Phone className="h-5 w-5" />
              )}
              <span>Atender</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}