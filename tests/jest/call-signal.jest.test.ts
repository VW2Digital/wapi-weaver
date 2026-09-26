import { describe, expect, test } from "@jest/globals";
import { isTerminalCallSignal, isUsableRemoteAnswer, applyWhatsAppCallingSdpConstraints, countWhatsAppCallingPulses, toWhatsAppSessionSdp, whatsappSdpHasDtlsFingerprint } from "../../src/components/calls/ActiveCallDialog";
import { extractCallSdp, resolveWhatsAppCallDirection } from "../../src/routes/api/public/whatsapp-webhook";
import { mapWhatsAppCallingError, toFriendlyError } from "../../src/lib/meta-errors";

const OFFER = "v=0\r\na=setup:actpass\r\n";
const ANSWER = "v=0\r\na=setup:active\r\n";

describe("sinal de chamada", () => {
  test("não desliga a chamada atual quando outra chamada encerra", () => {
    expect(
      isTerminalCallSignal(
        { call_id: "outra", call_event: "terminate", status: "ended" },
        "esta",
      ),
    ).toBe(false);
  });

  test("não desliga quando o outro lado atende", () => {
    expect(
      isTerminalCallSignal(
        { call_id: "esta", call_event: "connect", status: "incoming" },
        "esta",
      ),
    ).toBe(false);
    expect(
      isTerminalCallSignal(
        { call_id: "esta", call_event: "status", status: "ACCEPTED" },
        "esta",
      ),
    ).toBe(false);
  });

  test("desliga só o término da mesma chamada", () => {
    expect(
      isTerminalCallSignal(
        { call_id: "esta", call_event: "terminate", status: "ended" },
        "esta",
      ),
    ).toBe(true);
  });

  test("ignora um offer ecoado como se fosse answer", () => {
    expect(isUsableRemoteAnswer(OFFER, "answer")).toBe(false);
    expect(isUsableRemoteAnswer(ANSWER, "answer")).toBe(true);
  });

  test("connect USER_INITIATED ou SDP offer é chamada recebida", () => {
    expect(resolveWhatsAppCallDirection({ direction: "USER_INITIATED", event: "connect" })).toBe("inbound");
    expect(
      resolveWhatsAppCallDirection({ event: "connect", session: { sdp_type: "offer" } }),
    ).toBe("inbound");
    expect(
      resolveWhatsAppCallDirection({
        direction: "BUSINESS_INITIATED",
        event: "connect",
        session: { sdp_type: "answer" },
      }),
    ).toBe("outbound");
  });

  test("desembrulha SDP JSON de connection.webrtc", () => {
    const wrapped = JSON.stringify({ sdp: ANSWER, type: "answer" });
    expect(isUsableRemoteAnswer(wrapped)).toBe(true);
    expect(
      extractCallSdp({
        connection: { webrtc: { sdp: wrapped } },
      }),
    ).toEqual({ sdp: ANSWER, sdpType: "answer" });
  });

  test("call_created SIP nao e tratado como offer WebRTC", () => {
    expect(resolveWhatsAppCallDirection({ event: "call_created", session: {} })).toBe("outbound");
  });

  test("traduz codigos oficiais da Calling API", () => {
    expect(mapWhatsAppCallingError({ code: 138006 })?.title).toMatch(/permissao/i);
    expect(mapWhatsAppCallingError({ code: 138000 })?.title).toMatch(/desligada/i);
    expect(mapWhatsAppCallingError({ code: 131055 })?.title).toMatch(/SIP/i);
    expect(mapWhatsAppCallingError({ code: 138021 })?.hint).toMatch(/RTP/i);
    expect(toFriendlyError({ error: { code: 138007, message: "Connect Timeout" } }).code).toBe(138007);
  });

  test("SDP de sessao usa CRLF e fingerprint DTLS", () => {
    const raw = ["v=0", "m=audio 9 UDP/TLS/RTP/SAVPF 111", "a=fingerprint:sha-256 AA", ""].join("\n");
    const session = toWhatsAppSessionSdp(raw);
    expect(session).toContain("\r\n");
    expect(whatsappSdpHasDtlsFingerprint(session)).toBe(true);
  });

  test("pulsos de 6s arredondam fracao para cima", () => {
    expect(countWhatsAppCallingPulses(56)).toBe(10);
    expect(countWhatsAppCallingPulses(6)).toBe(1);
    expect(countWhatsAppCallingPulses(0)).toBe(0);
  });

  test("SDP de chamada usa ptime 20 ms e DTMF 8 kHz", () => {
    const raw = [
      "v=0",
      "m=audio 9 UDP/TLS/RTP/SAVPF 111 126",
      "a=rtpmap:111 opus/48000/2",
      "a=rtpmap:126 telephone-event/48000",
      "a=ptime:40",
      "",
    ].join("\r\n");
    const next = applyWhatsAppCallingSdpConstraints(raw);
    expect(next).toMatch(/a=ptime:20/);
    expect(next).toMatch(/a=maxptime:20/);
    expect(next).toMatch(/telephone-event\/8000/);
  });
});
