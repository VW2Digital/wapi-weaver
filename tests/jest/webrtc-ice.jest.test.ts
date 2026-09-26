import { describe, expect, it } from "@jest/globals";
import {
  WHATSAPP_ICE_CANDIDATE_POOL_SIZE,
  isRecoverableIceCandidateError,
  sdpHasUsableIceCandidates,
} from "@/lib/webrtc-ice-client";

describe("WhatsApp Cloud Calling ICE", () => {
  it("does not pre-gather ICE before setLocalDescription", () => {
    expect(WHATSAPP_ICE_CANDIDATE_POOL_SIZE).toBe(0);
  });

  it("treats Chrome 701 network-interface mismatch as recoverable", () => {
    expect(
      isRecoverableIceCandidateError(701, "Address not associated with the desired network interface."),
    ).toBe(true);
    expect(isRecoverableIceCandidateError(701, "STUN binding request timed out.")).toBe(true);
    expect(isRecoverableIceCandidateError(701, "TURN allocate failed")).toBe(false);
    expect(isRecoverableIceCandidateError(403, "Forbidden")).toBe(false);
  });

  it("requires ICE candidates in the SDP sent to Meta", () => {
    expect(sdpHasUsableIceCandidates("v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n")).toBe(false);
    expect(
      sdpHasUsableIceCandidates(
        "v=0\r\na=candidate:1 1 udp 2122260223 192.168.0.2 54321 typ host\r\n",
      ),
    ).toBe(true);
  });
});
