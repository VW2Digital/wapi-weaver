import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Phone, Loader2 } from "lucide-react";
import {
  enableCallingAPI,
  manageCall,
  sendCallPermissionRequest,
} from "@/lib/profile.functions";
import { isUsableRemoteAnswer, useActiveCall } from "@/components/calls/ActiveCallDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toFriendlyError } from "@/lib/meta-errors";

function toastCallMetaError(raw: unknown, fallback: string) {
  const friendly = toFriendlyError(raw, fallback);
  toast.error(friendly.title, {
    description: [friendly.message, friendly.hint].filter(Boolean).join(" "),
    duration: 14000,
  });
}

interface CallButtonProps {
  phoneId: string;
  recipientPhone: string;
  contactName?: string | null;
  waId?: string | null;
  disabled?: boolean;
  className?: string;
  iconOnly?: boolean;
}

interface WebRtcCallSession {
  sdp: string;
  peerConnection: RTCPeerConnection;
  localStream: MediaStream | null;
  remoteAudio: HTMLAudioElement;
}

async function generateSdpOffer(): Promise<WebRtcCallSession> {
  const remoteAudio = document.createElement("audio");
  remoteAudio.autoplay = true;
  remoteAudio.setAttribute("playsinline", "true");
  remoteAudio.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;";
  document.body.appendChild(remoteAudio);
  void remoteAudio.play().catch(() => {});

  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
    ],
  });

  remoteAudio.muted = false;
  remoteAudio.volume = 1;
  pc.addEventListener("track", (event) => {
    const stream = event.streams?.[0] ?? new MediaStream([event.track]);
    remoteAudio.srcObject = stream;
    remoteAudio.muted = false;
    void remoteAudio.play().catch(() => {});
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
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      pc.removeEventListener("icegatheringstatechange", onStateChange);
      resolve();
    };
    const onStateChange = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    pc.addEventListener("icegatheringstatechange", onStateChange);
    // A Meta precisa dos candidatos ICE no SDP. 1,5s cortava o STUN e a chamada caía ao atender.
    setTimeout(finish, 6000);
  });

  const sdp = pc.localDescription?.sdp || offer.sdp || "";
  return { sdp, peerConnection: pc, localStream, remoteAudio };
}

function releaseCallSession(session: WebRtcCallSession | null) {
  session?.localStream?.getTracks().forEach((track) => track.stop());
  try {
    session?.peerConnection.close();
  } catch {}
  if (session?.remoteAudio) {
    session.remoteAudio.srcObject = null;
    session.remoteAudio.pause();
    session.remoteAudio.remove();
  }
}

export function CallButton({
  phoneId,
  recipientPhone,
  contactName,
  waId,
  disabled = false,
  className,
  iconOnly = false,
}: CallButtonProps) {
  const [isCalling, setIsCalling] = useState(false);
  const [isRequestingPerm, setIsRequestingPerm] = useState(false);

  // Estado da chamada ativa em andamento
  const { start: startActiveCall } = useActiveCall();

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
          callResult.callId ||
          callResult.data?.calls?.[0]?.id ||
          callResult.data?.id ||
          callResult.data?.call_id ||
          `call_${Date.now()}`;

        // Se a Meta retornou o SDP Answer imediatamente na resposta
        const immediateAnswer =
          callResult.data?.session?.sdp ||
          callResult.data?.sdp ||
          callResult.data?.calls?.[0]?.session?.sdp;
        const immediateType =
          callResult.data?.session?.sdp_type ||
          callResult.data?.sdp_type ||
          callResult.data?.calls?.[0]?.session?.sdp_type;

        if (
          session?.peerConnection &&
          isUsableRemoteAnswer(immediateAnswer, immediateType) &&
          session.peerConnection.signalingState === "have-local-offer"
        ) {
          try {
            await session.peerConnection.setRemoteDescription(
              new RTCSessionDescription({
                type: "answer",
                sdp: immediateAnswer,
              }),
            );
          } catch (sdpErr) {
            console.warn("[CALL] Erro ao aplicar SDP Answer imediato:", sdpErr);
          }
        }

        // Abre o diálogo da chamada ativa com controles de Viva-voz, Mudo e Desligar
        startActiveCall({
          callId,
          phoneId,
          contactName: contactName || targetPhone,
          contactPhone: targetPhone,
          peerConnection: session?.peerConnection || null,
          localStream: session?.localStream || null,
          remoteAudio: session?.remoteAudio || null,
        });
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
        releaseCallSession(session);
        return false;
      }

      toastCallMetaError(callResult.data ?? errMsg, "Falha ao iniciar chamada.");
      releaseCallSession(session);
      return false;
    } catch (error: any) {
      console.error("[CALL] Erro ao iniciar chamada:", error);
      toastCallMetaError(error, "Falha ao iniciar chamada.");
      releaseCallSession(session);
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

        toastCallMetaError((res as { data?: unknown }).data ?? errMsg, "Falha ao enviar solicitação de permissão.");
        return;
      }

      toast.success("Solicitação de chamada enviada no WhatsApp do cliente!");
    } catch (err: any) {
      console.error("[CALL] Erro ao enviar solicitação de permissão:", err);
      toastCallMetaError(err, "Erro ao solicitar permissão.");
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
        size={iconOnly ? "icon" : "sm"}
        className={cn(
          iconOnly
            ? "h-10 w-10 rounded-full bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground shadow-none border-0 shrink-0"
            : "h-8 sm:h-8.5 px-3 sm:px-3.5 rounded-xl text-xs font-semibold bg-[#ff3366] hover:bg-[#e02453] active:scale-95 text-white shadow-sm border-0 gap-1.5 inline-flex items-center justify-center shrink-0 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        )}
        title={contactName ? `Ligar para ${contactName}` : "Ligar"}
      >
        {isCalling || isRequestingPerm ? (
          <Loader2 className={cn("animate-spin", iconOnly ? "h-5 w-5" : "h-3.5 w-3.5 text-white")} />
        ) : (
          <Phone className={cn(iconOnly ? "h-5 w-5" : "h-3.5 w-3.5 text-white")} />
        )}
        {!iconOnly && <span>Ligar</span>}
      </Button>
    </>
  );
}