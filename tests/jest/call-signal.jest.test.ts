import { describe, expect, test } from "@jest/globals";
import { isTerminalCallSignal, isUsableRemoteAnswer } from "../../src/components/calls/ActiveCallDialog";

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
});
