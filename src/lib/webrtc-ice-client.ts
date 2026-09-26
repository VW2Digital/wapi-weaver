import type { CallIceServer } from "@/lib/webrtc-ice.functions";

export const FALLBACK_STUN_ICE_SERVERS: CallIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

/** Must stay 0. A pool > 0 gathers ICE before setLocalDescription and Chrome fires 701. */
export const WHATSAPP_ICE_CANDIDATE_POOL_SIZE = 0;

export function isRecoverableIceCandidateError(errorCode?: number, errorText?: string): boolean {
  const text = String(errorText || "");
  if (errorCode === 701 && /address not associated with the desired network interface/i.test(text)) {
    return true;
  }
  if (errorCode === 701 && /stun binding request timed out/i.test(text)) {
    return true;
  }
  return false;
}

export function sdpHasUsableIceCandidates(sdp: string): boolean {
  return /a=candidate:/i.test(sdp || "");
}

export function readDiagnosticRelayOnly(): boolean {
  try {
    return typeof window !== "undefined" && window.sessionStorage.getItem("bliv_ice_relay_only") === "1";
  } catch {
    return false;
  }
}

export async function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 8000): Promise<void> {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
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
    setTimeout(finish, timeoutMs);
  });
}

export function attachWhatsAppIceDiagnostics(pc: RTCPeerConnection, label: string) {
  const logState = (reason: string) => {
    console.info(
      `[CALL][${label}] ${reason} iceConnectionState=${pc.iceConnectionState} connectionState=${pc.connectionState} gathering=${pc.iceGatheringState}`,
    );
  };
  pc.addEventListener("iceconnectionstatechange", () => logState("iceconnectionstatechange"));
  pc.addEventListener("connectionstatechange", () => logState("connectionstatechange"));
  pc.addEventListener("icegatheringstatechange", () => logState("icegatheringstatechange"));
  pc.addEventListener("icecandidate", (event) => {
    const candidate = event.candidate?.candidate || "";
    if (!candidate) {
      console.info(`[CALL][${label}] icecandidate end-of-candidates`);
      return;
    }
    const kind = /\srelay\s/i.test(candidate)
      ? "relay"
      : /\ssrflx\s/i.test(candidate)
        ? "srflx"
        : /\sprflx\s/i.test(candidate)
          ? "prflx"
          : "host";
    console.info(`[CALL][${label}] icecandidate type=${kind}`);
  });
  pc.addEventListener("icecandidateerror", (event) => {
    const err = event as RTCPeerConnectionIceErrorEvent;
    const recoverable = isRecoverableIceCandidateError(err.errorCode, err.errorText);
    const payload = {
      recoverable,
      errorCode: err.errorCode,
      errorText: err.errorText,
      url: err.url,
      iceConnectionState: pc.iceConnectionState,
      gathering: pc.iceGatheringState,
    };
    if (recoverable) {
      console.info(`[CALL][${label}] icecandidateerror recuperável`, payload);
      return;
    }
    console.warn(`[CALL][${label}] icecandidateerror`, payload);
  });
  pc.addEventListener("iceconnectionstatechange", () => {
    if (pc.iceConnectionState !== "connected" && pc.iceConnectionState !== "completed") return;
    void pc.getStats().then((stats) => {
      stats.forEach((report) => {
        if (report.type === "candidate-pair" && (report as { state?: string }).state === "succeeded") {
          console.info(`[CALL][${label}] selected ICE pair`, {
            localCandidateId: (report as { localCandidateId?: string }).localCandidateId,
            remoteCandidateId: (report as { remoteCandidateId?: string }).remoteCandidateId,
            state: (report as { state?: string }).state,
          });
        }
      });
    });
  });
  logState("created");
}

export function createWhatsAppPeerConnection(iceServers: CallIceServer[], label: string) {
  const diagnosticRelayOnly = readDiagnosticRelayOnly();
  if (diagnosticRelayOnly) {
    console.info(`[CALL][${label}] iceTransportPolicy=relay (diagnóstico via sessionStorage bliv_ice_relay_only)`);
  }
  const pc = new RTCPeerConnection({
    iceCandidatePoolSize: WHATSAPP_ICE_CANDIDATE_POOL_SIZE,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    iceTransportPolicy: diagnosticRelayOnly ? "relay" : "all",
    iceServers,
  });
  attachWhatsAppIceDiagnostics(pc, label);
  return pc;
}
