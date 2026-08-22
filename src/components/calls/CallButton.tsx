import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Phone, Loader2 } from "lucide-react";
import {
  enableCallingAPI,
  manageCall,
  sendCallPermissionRequest,
} from "@/lib/profile.functions";
import { ActiveCallDialog } from "@/components/calls/ActiveCallDialog";
import { toast } from "sonner";

interface CallButtonProps {
  phoneId: string;
  recipientPhone: string;
  contactName?: string | null;
  waId?: string | null;
  disabled?: boolean;
}

interface WebRtcCallSession {
  sdp: string;
  peerConnection: RTCPeerConnection;
  localStream: MediaStream | null;
}

async function generateSdpOffer(): Promise<WebRtcCallSession> {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ],
  });

  let localStream: MediaStream | null = null;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = true;
      pc.addTrack(track, localStream!);
    });
  } catch (micErr) {
    console.warn("[CALL] Não foi possível acessar microfone:", micErr);
    pc.addTransceiver("audio", { direction: "sendrecv" });
  }

  const offer = await pc.createOffer({
    offerToReceiveAudio: true,
  });
  await pc.setLocalDescription(offer);

  await new Promise<void>((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
    } else {
      const onStateChange = () => {
        if (pc.iceGatheringState === "complete") {
          pc.removeEventListener("icegatheringstatechange", onStateChange);
          resolve();
        }
      };
      pc.addEventListener("icegatheringstatechange", onStateChange);
      setTimeout(() => {
        pc.removeEventListener("icegatheringstatechange", onStateChange);
        resolve();
      }, 1500);
    }
  });

  const sdp = pc.localDescription?.sdp || offer.sdp || "";
  return { sdp, peerConnection: pc, localStream };
}

export function CallButton({
  phoneId,
  recipientPhone,
  contactName,
  waId,
  disabled = false,
}: CallButtonProps) {
  const [isCalling, setIsCalling] = useState(false);
  const [isRequestingPerm, setIsRequestingPerm] = useState(false);

  // Estado da chamada ativa em andamento
  const [activeCallOpen, setActiveCallOpen] = useState(false);
  const [activeCallSession, setActiveCallSession] = useState<{
    callId: string;
    phoneId: string;
    contactName: string;
    contactPhone: string;
    peerConnection: RTCPeerConnection | null;
    localStream: MediaStream | null;
  } | null>(null);

  const enableCallingFn = useServerFn(enableCallingAPI);
  const manageCallFn = useServerFn(manageCall);
  const sendPermReqFn = useServerFn(sendCallPermissionRequest);

  const executeCall = async (targetPhone: string) => {
    setIsCalling(true);
    let session: WebRtcCallSession | null = null;

    try {
      // 1. Gera o SDP Offer WebRTC e conecta microfone
      try {
        session = await generateSdpOffer();
      } catch (err: any) {
        console.warn("[CALL] Erro ao instanciar WebRTC:", err);
      }

      const sdpOffer = session?.sdp || "";

      // 2. Dispara a chamada na Meta
      let callResult = await manageCallFn({
        data: {
          phoneId,
          action: "connect",
          to: targetPhone,
          sdp: sdpOffer || undefined,
          sdpType: sdpOffer ? "offer" : undefined,
        },
      });

      // Se a Calling API não estiver habilitada no número da empresa, tenta habilitar na Meta e retenta
      if (
        !callResult.ok &&
        (callResult.error?.toLowerCase().includes("calling api not enabled") ||
          callResult.error?.toLowerCase().includes("not enabled for calling"))
      ) {
        toast.info("Habilitando Calling API no seu número WhatsApp na Meta...");
        const enableRes = await enableCallingFn({ data: { phoneId } });
        if (enableRes.ok) {
          toast.success("Calling API habilitada! Discando...");
          callResult = await manageCallFn({
            data: {
              phoneId,
              action: "connect",
              to: targetPhone,
              sdp: sdpOffer || undefined,
              sdpType: sdpOffer ? "offer" : undefined,
            },
          });
        }
      }

      if (callResult.ok) {
        const callId =
          callResult.data?.id ||
          callResult.data?.call_id ||
          `call_${Date.now()}`;

        // Se a Meta retornou o SDP Answer imediatamente na resposta
        const immediateAnswer =
          callResult.data?.session?.sdp ||
          callResult.data?.sdp ||
          callResult.data?.calls?.[0]?.session?.sdp;

        if (immediateAnswer && session?.peerConnection) {
          try {
            await session.peerConnection.setRemoteDescription(
              new RTCSessionDescription({
                type: "answer",
                sdp: immediateAnswer,
              }),
            );
            console.log("[CALL] SDP Answer imediato da Meta aplicado com sucesso!");
          } catch (sdpErr) {
            console.warn("[CALL] Erro ao aplicar SDP Answer imediato:", sdpErr);
          }
        }

        // Abre o diálogo da chamada ativa com controles de Viva-voz, Mudo e Desligar
        setActiveCallSession({
          callId,
          phoneId,
          contactName: contactName || targetPhone,
          contactPhone: targetPhone,
          peerConnection: session?.peerConnection || null,
          localStream: session?.localStream || null,
        });
        setActiveCallOpen(true);
        toast.success(`Chamando ${contactName || targetPhone}...`);
        return true;
      }

      const errMsg = callResult.error || "";

      // Se a Meta informar que a conta comercial JÁ PODE ligar (código 138017)
      if (errMsg.includes("138017") || errMsg.toLowerCase().includes("can already call")) {
        toast.success("Permissão ativa na Meta!");
      }

      // Se Meta indicar que falta permissão
      if (
        (errMsg.toLowerCase().includes("permission") ||
          errMsg.includes("138016") ||
          errMsg.includes("138000")) &&
        !errMsg.includes("138017")
      ) {
        toast.error("O cliente ainda precisa autorizar chamadas da sua empresa.", {
          description: "Deseja enviar uma mensagem solicitando autorização?",
          action: {
            label: "Solicitar Permissão",
            onClick: () => handleSendPermissionRequest(targetPhone),
          },
        });
        session?.localStream?.getTracks().forEach((t) => t.stop());
        session?.peerConnection.close();
        return false;
      }

      toast.error(errMsg || "Falha ao iniciar chamada.");
      session?.localStream?.getTracks().forEach((t) => t.stop());
      session?.peerConnection.close();
      return false;
    } catch (error: any) {
      console.error("[CALL] Erro ao iniciar chamada:", error);
      toast.error(error?.message || "Falha ao iniciar chamada.");
      session?.localStream?.getTracks().forEach((t) => t.stop());
      session?.peerConnection?.close();
      return false;
    } finally {
      setIsCalling(false);
    }
  };

  const handleSendPermissionRequest = async (targetPhone: string) => {
    setIsRequestingPerm(true);
    try {
      const res = await sendPermReqFn({
        data: {
          phoneId,
          to: targetPhone,
        },
      });

      if (!res.ok) {
        const errMsg = res.error || "";
        if (errMsg.includes("138017") || errMsg.toLowerCase().includes("can already call")) {
          toast.success("Permissão confirmada na Meta! Iniciando chamada...");
          await executeCall(targetPhone);
          return;
        }

        toast.error(errMsg || "Falha ao enviar solicitação de permissão.");
        return;
      }

      toast.success("Solicitação de chamada enviada no WhatsApp do cliente!");
    } catch (err: any) {
      console.error("[CALL] Erro ao enviar solicitação de permissão:", err);
      toast.error(err?.message || "Erro ao solicitar permissão.");
    } finally {
      setIsRequestingPerm(false);
    }
  };

  const handleCall = async () => {
    const targetPhone = waId || recipientPhone;
    if (!targetPhone) {
      toast.error("Número de telefone do contato não encontrado.");
      return;
    }
    await executeCall(targetPhone);
  };

  return (
    <>
      <Button
        onClick={handleCall}
        disabled={disabled || isCalling || isRequestingPerm}
        size="sm"
        variant="outline"
        className="h-8 px-3 rounded-full text-xs font-medium border-border gap-1.5 inline-flex items-center"
      >
        {isCalling || isRequestingPerm ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Phone className="h-3.5 w-3.5" />
        )}
        <span>Ligar</span>
      </Button>

      {/* Interface Completa da Chamada em Execução */}
      {activeCallSession && (
        <ActiveCallDialog
          open={activeCallOpen}
          onOpenChange={(isOpen) => {
            setActiveCallOpen(isOpen);
            if (!isOpen) setActiveCallSession(null);
          }}
          contactName={activeCallSession.contactName}
          contactPhone={activeCallSession.contactPhone}
          callId={activeCallSession.callId}
          phoneId={activeCallSession.phoneId}
          peerConnection={activeCallSession.peerConnection}
          localStream={activeCallSession.localStream}
          onCallEnded={() => {
            setActiveCallSession(null);
          }}
        />
      )}
    </>
  );
}