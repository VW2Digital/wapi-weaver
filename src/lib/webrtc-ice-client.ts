import type { CallIceServer } from "@/lib/webrtc-ice.functions";

export const FALLBACK_STUN_ICE_SERVERS: CallIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function attachWhatsAppIceDiagnostics(pc: RTCPeerConnection, label: string) {
  const logState = (reason: string) => {
    console.info(
      `[CALL][${label}] ${reason} iceConnectionState=${pc.iceConnectionState} connectionState=${pc.connectionState} gathering=${pc.iceGatheringState}`,
    );
  };
  pc.addEventListener("iceconnectionstatechange", () => logState("iceconnectionstatechange"));
  pc.addEventListener("connectionstatechange", () => logState("connectionstatechange"));
  pc.addEventListener("icegatheringstatechange", () => logState("icegatheringstatechange"));
  pc.addEventListener("icecandidateerror", (event) => {
    const err = event as RTCPeerConnectionIceErrorEvent;
    console.warn(`[CALL][${label}] icecandidateerror`, {
      errorCode: err.errorCode,
      errorText: err.errorText,
      url: err.url,
    });
  });
  pc.addEventListener("iceconnectionstatechange", () => {
    if (pc.iceConnectionState !== "connected" && pc.iceConnectionState !== "completed") return;
    void pc.getStats().then((stats) => {
      stats.forEach((report) => {
        if (report.type === "candidate-pair" && (report as { state?: string }).state === "succeeded") {
          console.info(`[CALL][${label}] selected ICE pair`, report);
        }
      });
    });
  });
  logState("created");
}

export function createWhatsAppPeerConnection(iceServers: CallIceServer[], label: string) {
  const pc = new RTCPeerConnection({
    iceCandidatePoolSize: 2,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    iceServers,
  });
  attachWhatsAppIceDiagnostics(pc, label);
  return pc;
}
