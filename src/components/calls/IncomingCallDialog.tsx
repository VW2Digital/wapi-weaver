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

export interface IncomingCallAcceptedPayload {
  peerConnection: RTCPeerConnection;
  localStream: MediaStream;
  callId: string;
  phoneId: string;
  contactName: string;
  contactPhone: string;
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

    try {
      // 1. Cria a conexão RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
        ],
      });

      // 2. Solicita acesso ao microfone com melhorias de áudio
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        stream.getAudioTracks().forEach((track) => {
          track.enabled = true;
          pc.addTrack(track, stream!);
        });
      } catch (micErr) {
        console.warn("[CALL] Não foi possível obter microfone, continuando com transceiver:", micErr);
        pc.addTransceiver("audio", { direction: "sendrecv" });
      }

      // 3. Aplica o SDP Offer recebido da Meta
      if (sdpOffer) {
        const offerDesc = new RTCSessionDescription({
          type: "offer",
          sdp: sdpOffer,
        });
        await pc.setRemoteDescription(offerDesc);

        // 4. Cria a SDP Answer do navegador
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // 5. Aguarda gathering dos candidatos ICE
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === "complete") {
            resolve();
          } else {
            const onIceGather = () => {
              if (pc.iceGatheringState === "complete") {
                pc.removeEventListener("icegatheringstatechange", onIceGather);
                resolve();
              }
            };
            pc.addEventListener("icegatheringstatechange", onIceGather);
            setTimeout(() => {
              pc.removeEventListener("icegatheringstatechange", onIceGather);
              resolve();
            }, 1200);
          }
        });

        const localDesc = pc.localDescription || answer;

        // 6. Envia o pre_accept com a SDP Answer para a Meta
        if (localDesc?.sdp) {
          await manageCallFn({
            data: {
              phoneId,
              action: "pre_accept",
              callId,
              sdp: localDesc.sdp,
              sdpType: "answer",
            },
          });
        }

        // 7. Envia a confirmação de aceitação da chamada (accept) para a Meta
        await manageCallFn({
          data: {
            phoneId,
            action: "accept",
            callId,
          },
        });

        toast.success("Chamada atendida com sucesso!");

        // 8. Notifica o componente pai para abrir o modal de chamada ativa
        if (onCallAccepted && stream) {
          onCallAccepted({
            peerConnection: pc,
            localStream: stream,
            callId,
            phoneId,
            contactName: contactName || contactPhone,
            contactPhone,
          });
        }
        onOpenChange(false);
      } else {
        // Se por algum motivo o sdpOffer não veio no evento inicial, envia o accept direto
        await manageCallFn({
          data: {
            phoneId,
            action: "accept",
            callId,
          },
        });
        toast.success("Chamada atendida!");
        if (onCallAccepted && stream) {
          onCallAccepted({
            peerConnection: pc,
            localStream: stream,
            callId,
            phoneId,
            contactName: contactName || contactPhone,
            contactPhone,
          });
        }
        onOpenChange(false);
      }
    } catch (error: any) {
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