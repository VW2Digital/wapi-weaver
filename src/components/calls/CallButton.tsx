import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Phone, Loader2, PhoneIncoming, Link2 } from "lucide-react";
import {
  checkCallPermissions,
  enableCallingAPI,
  getWhatsAppCallDeepLink,
  manageCall,
  sendCallPermissionRequest,
  sendVoiceCallButtonMessage,
} from "@/lib/profile.functions";
import { isUsableRemoteAnswer, unwrapWhatsAppEmbeddedSdp, toWhatsAppSessionSdp, useActiveCall } from "@/components/calls/ActiveCallDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { toFriendlyError } from "@/lib/meta-errors";
import { getWebRtcIceServers } from "@/lib/webrtc-ice.functions";
import {
  createWhatsAppPeerConnection,
  FALLBACK_STUN_ICE_SERVERS,
} from "@/lib/webrtc-ice-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

async function generateSdpOffer(
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>,
): Promise<WebRtcCallSession> {
  const remoteAudio = document.createElement("audio");
  remoteAudio.autoplay = true;
  remoteAudio.setAttribute("playsinline", "true");
  remoteAudio.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;";
  document.body.appendChild(remoteAudio);
  void remoteAudio.play().catch(() => {});

  const pc = createWhatsAppPeerConnection(
    iceServers.length ? iceServers : FALLBACK_STUN_ICE_SERVERS,
    "outbound",
  );

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
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = true;
      pc.addTrack(audioTrack, localStream);
    }
  } catch (micErr) {
    console.warn("[CALL] Não foi possível acessar microfone:", micErr);
    pc.addTransceiver("audio", { direction: "sendrecv" });
  }

  const offer = await pc.createOffer({
    offerToReceiveAudio: true,
    voiceActivityDetection: true,
  });
  const constrainedOffer = {
    type: offer.type,
    sdp: toWhatsAppSessionSdp(offer.sdp || ""),
  };
  await pc.setLocalDescription(constrainedOffer);

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

  const sdp = toWhatsAppSessionSdp(pc.localDescription?.sdp || offer.sdp || "");
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
  const sendVoiceCallFn = useServerFn(sendVoiceCallButtonMessage);
  const getDeepLinkFn = useServerFn(getWhatsAppCallDeepLink);
  const checkPermFn = useServerFn(checkCallPermissions);
  const fetchIceServers = useServerFn(getWebRtcIceServers);

  const executeCall = async (targetPhone: string) => {
    setIsCalling(true);
    let session: WebRtcCallSession | null = null;

    try {
      // 1. Gera o SDP Offer WebRTC e conecta microfone
      try {
        const ice = await fetchIceServers();
        if (!ice.turnEnabled) {
          console.warn("[CALL][outbound] TURN não configurado (TURN_USERNAME/TURN_CREDENTIAL). NAT simétrico tende a falhar com 138021/138023.");
        } else {
          console.info("[CALL][outbound] TURN habilitado", ice.iceServers.map((s) => s.urls));
        }
        session = await generateSdpOffer(ice.iceServers);
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
          opaqueCallbackData: `bliv:${phoneId}:${String(targetPhone).slice(0, 80)}`,
        },
      });

      // Se a Calling API não estiver habilitada no número da empresa, tenta habilitar na Meta e retenta
      if (
        !callResult.ok &&
        (Number(toFriendlyError(callResult.data, "").code) === 138000 ||
          callResult.error?.toLowerCase().includes("calling api not enabled") ||
          callResult.error?.toLowerCase().includes("not enabled for calling") ||
          callResult.error?.includes("138000"))
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
              opaqueCallbackData: `bliv:${phoneId}:${String(targetPhone).slice(0, 80)}`,
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
                sdp: unwrapWhatsAppEmbeddedSdp(immediateAnswer).sdp || immediateAnswer,
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
          userInitiated: false,
        });
        toast.success(`Chamando ${contactName || targetPhone}...`);
        return true;
      }

      const errMsg = callResult.error || "";
      const friendly = toFriendlyError(callResult.data ?? errMsg, "Falha ao iniciar chamada.");
      const code = Number(friendly.code);

      if (code === 131055 || errMsg.toLowerCase().includes("sip") || errMsg.toLowerCase().includes("calling-related graph")) {
        toast.error(friendly.title || "SIP ligado neste numero.", {
          description:
            friendly.hint ||
            "Abra Configuracoes do telefone no WhatsApp e salve para desligar o SIP. A Bliv so liga via Graph no navegador.",
          duration: 14000,
        });
        releaseCallSession(session);
        return false;
      }

      if (code === 138017 || errMsg.toLowerCase().includes("can already call")) {
        toast.success("Permissao permanente ja existe. Tente Ligar agora.");
        releaseCallSession(session);
        return false;
      }

      if (code === 138006) {
        toast.error("O cliente ainda precisa autorizar chamadas da sua empresa.", {
          description: "Deseja enviar uma mensagem solicitando autorizacao?",
          action: {
            label: "Solicitar Permissao",
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

  const handleSendVoiceCallButton = async (targetPhone: string) => {
    setIsRequestingPerm(true);
    try {
      const res = await sendVoiceCallFn({
        data: {
          phoneId,
          to: targetPhone,
          displayText: "Ligar agora",
          payload: targetPhone.replace(/\D/g, "").slice(0, 512),
        },
      });
      if (!res.ok) {
        const errMsg = res.error || "";
        if (errMsg.includes("131026")) {
          toast.error("O WhatsApp do cliente esta desatualizado.", {
            description: "O botao de chamada exige um app recente (erro 131026).",
          });
          return;
        }
        toastCallMetaError((res as { data?: unknown }).data ?? errMsg, "Falha ao enviar botao de chamada.");
        return;
      }
      toast.success("Convite para ligar enviado no WhatsApp do cliente.");
    } catch (err: any) {
      toastCallMetaError(err, "Falha ao enviar botao de chamada.");
    } finally {
      setIsRequestingPerm(false);
    }
  };

  const handleCopyDeepLink = async () => {
    try {
      const res = await getDeepLinkFn({ data: { phoneId } });
      if (!res.ok || !res.data?.url) {
        toastCallMetaError(res.error, "Nao foi possivel montar o link wa.me/call.");
        return;
      }
      await navigator.clipboard.writeText(res.data.url);
      toast.success("Link de chamada copiado.", { description: res.data.url });
    } catch (err: any) {
      toastCallMetaError(err, "Falha ao copiar o deep link.");
    }
  };

  const handleCall = async () => {
    const targetPhone = waId || recipientPhone;
    if (!targetPhone) {
      toast.error("Número de telefone do contato não encontrado.");
      return;
    }

    setIsCalling(true);
    try {
      const permRes = await checkPermFn({
        data: {
          phoneId,
          recipientPhone: recipientPhone || targetPhone,
          waId: waId || undefined,
        },
      });
      const perm = permRes.ok ? permRes.data : null;
      if (perm && !perm.is_granted) {
        if (perm.can_send_request === false) {
          toast.error("Não é possível solicitar permissão agora.", {
            description: "A Meta limita a 1 pedido em 24h e 2 em 7 dias por cliente.",
            duration: 12000,
          });
          return;
        }
        toast.info("O cliente precisa autorizar ligacoes da empresa.", {
          description:
            "O pedido de permissao e cobrado como mensagem na WABA, nao como ligacao.",
        });
        await handleSendPermissionRequest(targetPhone);
        return;
      }
      if (perm?.is_granted && perm.can_start_call === false) {
        toast.error("Limite de chamadas conectadas atingido nas últimas 24 horas.");
        return;
      }
    } catch (permErr) {
      console.warn("[CALL] Falha ao consultar call_permissions, tentando discar:", permErr);
    } finally {
      setIsCalling(false);
    }

    await executeCall(targetPhone);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
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
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          disabled={disabled || isCalling || isRequestingPerm}
          onSelect={() => {
            void handleCall();
          }}
        >
          <Phone className="h-4 w-4" />
          Ligar agora
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={disabled || isCalling || isRequestingPerm}
          onSelect={() => {
            const targetPhone = waId || recipientPhone;
            if (!targetPhone) {
              toast.error("Numero do contato nao encontrado.");
              return;
            }
            void handleSendVoiceCallButton(targetPhone);
          }}
        >
          <PhoneIncoming className="h-4 w-4" />
          Enviar botao de chamada
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={disabled || isCalling || isRequestingPerm}
          onSelect={() => {
            void handleCopyDeepLink();
          }}
        >
          <Link2 className="h-4 w-4" />
          Copiar link wa.me/call
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}