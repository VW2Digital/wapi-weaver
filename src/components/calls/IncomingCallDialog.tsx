import { useState, useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { manageCall } from "@/lib/profile.functions";

interface IncomingCallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  contactPhone: string;
  callId: string;
  phoneId: string;
  sdpOffer?: string;
}

export function IncomingCallDialog({
  open,
  onOpenChange,
  contactName,
  contactPhone,
  callId,
  phoneId,
  sdpOffer,
}: IncomingCallDialogProps) {
  const [isAnswering, setIsAnswering] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  const manageCallFn = useServerFn(manageCall);

  const handleReject = async () => {
    setIsRejecting(true);
    try {
      await manageCallFn({
        data: {
          phoneId,
          action: "reject",
          callId,
        },
      });
      onOpenChange(false);
    } catch (error) {
      console.error("[CALL] Erro ao rejeitar chamada:", error);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleAnswer = async () => {
    setIsAnswering(true);
    try {
      // Criar RTCPeerConnection
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      peerConnectionRef.current = peerConnection;

      // Solicitar microfone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Adicionar track de áudio
      stream.getAudioTracks().forEach((track) => {
        peerConnection.addTrack(track, stream);
      });

      // Configurar stream remoto para áudio recebido
      peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const audioElement = audioElementRef.current;
          if (audioElement) {
            audioElement.srcObject = event.streams[0];
            audioElement.play().catch((err) => {
              console.error("[CALL] Erro ao reproduzir áudio:", err);
            });
          }
        }
      };

      // Configurar SDP offer recebido
      if (sdpOffer) {
        const offerDesc = new RTCSessionDescription({
          type: "offer",
          sdp: sdpOffer,
        });
        await peerConnection.setRemoteDescription(offerDesc);

        // Criar answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Aguardar ICE gathering
        await new Promise<void>((resolve) => {
          if (peerConnection.iceGatheringState === "complete") {
            resolve();
          } else {
            peerConnection.onicegatheringstatechange = () => {
              if (peerConnection.iceGatheringState === "complete") {
                resolve();
              }
            };
          }
        });

        // Enviar pre_accept com SDP answer
        const localDesc = peerConnection.localDescription;
        if (localDesc) {
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

        // Aceitar a chamada
        await manageCallFn({
          data: {
            phoneId,
            action: "accept",
            callId,
          },
        });
      }
    } catch (error) {
      console.error("[CALL] Erro ao atender chamada:", error);
      setIsAnswering(false);
    }
  };

  const cleanup = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
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
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Chamada recebida
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                <Phone className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">{contactName}</h3>
                <p className="text-sm text-muted-foreground">{contactPhone}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                size="lg"
                onClick={handleReject}
                disabled={isRejecting || isAnswering}
                className="flex-1"
              >
                {isRejecting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <PhoneOff className="h-4 w-4 mr-2" />
                )}
                Recusar
              </Button>
              <Button
                size="lg"
                onClick={handleAnswer}
                disabled={isAnswering || isRejecting}
                className="flex-1"
              >
                {isAnswering ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Phone className="h-4 w-4 mr-2" />
                )}
                Atender
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <audio ref={audioElementRef} autoPlay playsInline className="hidden" />
    </>
  );
}