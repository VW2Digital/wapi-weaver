import { describe, expect, it } from "@jest/globals";
import {
  applyLeadName,
  assertFollowupWait,
  classifyFollowupSendError,
  decideFollowup,
  followupChannelDecision,
  resolveFollowupBody,
  waitToMs,
  type FollowupChatMessage,
  type FollowupRunRecord,
} from "../../src/lib/ds-agent-followup-decision";

const MINUTE = 60 * 1000;
const agentAt = Date.parse("2026-09-26T13:00:00.000Z");

function outgoing(id: string, createdAt: number, followupId?: string): FollowupChatMessage {
  return { id, direction: "outgoing", createdAt, type: "text", channel: "whatsapp", followupId: followupId || null };
}

function incoming(id: string, createdAt: number): FollowupChatMessage {
  return { id, direction: "incoming", createdAt, type: "text", channel: "whatsapp" };
}

describe("DS Agente follow-up decision", () => {
  it("sends a unique follow-up 5 minutes after the agent message", () => {
    const decision = decideFollowup({
      now: agentAt + 5 * MINUTE,
      followupId: "fu-1",
      sessionId: "session-1",
      active: true,
      recurrence: "unico",
      waitAmount: 5,
      waitUnit: "minutos",
      sessionStatus: "active",
      messages: [outgoing("agent-msg", agentAt)],
      runs: [],
    });
    expect(decision.action).toBe("send");
    if (decision.action === "send") expect(decision.cycleKey).toBe("agent-msg");
  });

  it("does not send before the wait elapses", () => {
    const decision = decideFollowup({
      now: agentAt + 4 * MINUTE,
      followupId: "fu-1",
      sessionId: "session-1",
      active: true,
      recurrence: "unico",
      waitAmount: 5,
      waitUnit: "minutos",
      sessionStatus: "active",
      messages: [outgoing("agent-msg", agentAt)],
      runs: [],
    });
    expect(decision).toMatchObject({ action: "skip", reason: "waiting" });
  });

  it("cancels when the lead replies before the dispatch", () => {
    const decision = decideFollowup({
      now: agentAt + 5 * MINUTE,
      followupId: "fu-1",
      sessionId: "session-1",
      active: true,
      recurrence: "unico",
      waitAmount: 5,
      waitUnit: "minutos",
      sessionStatus: "active",
      messages: [outgoing("agent-msg", agentAt), incoming("lead-msg", agentAt + 3 * MINUTE)],
      runs: [],
    });
    expect(decision).toMatchObject({ action: "cancel", reason: "customer_replied", cycleKey: "agent-msg" });
  });

  it("ignores reactions and status events when measuring silence", () => {
    const decision = decideFollowup({
      now: agentAt + 6 * MINUTE,
      followupId: "fu-1",
      sessionId: "session-1",
      active: true,
      recurrence: "unico",
      waitAmount: 5,
      waitUnit: "minutos",
      sessionStatus: "active",
      messages: [
        outgoing("agent-msg", agentAt),
        { id: "react", direction: "incoming", createdAt: agentAt + 6 * MINUTE, type: "reaction", channel: "whatsapp" },
        { id: "status", direction: "outgoing", createdAt: agentAt + 6 * MINUTE, type: "status", channel: "whatsapp" },
      ],
      runs: [],
    });
    expect(decision.action).toBe("send");
  });

  it("does not repeat a unique follow-up after a successful send", () => {
    const sent: FollowupRunRecord = {
      followupId: "fu-1",
      sessionId: "session-1",
      cycleKey: "agent-msg",
      status: "sent",
      createdAt: agentAt + 5 * MINUTE,
      attempt: 1,
    };
    const decision = decideFollowup({
      now: agentAt + 30 * MINUTE,
      followupId: "fu-1",
      sessionId: "session-1",
      active: true,
      recurrence: "unico",
      waitAmount: 5,
      waitUnit: "minutos",
      sessionStatus: "active",
      messages: [outgoing("agent-msg", agentAt), outgoing("fu-msg", agentAt + 5 * MINUTE, "fu-1")],
      runs: [sent],
    });
    expect(decision).toMatchObject({ action: "skip", reason: "already_sent" });
  });

  it("sends a recurring follow-up again after another full interval", () => {
    const firstSentAt = agentAt + 5 * MINUTE;
    const decision = decideFollowup({
      now: firstSentAt + 5 * MINUTE,
      followupId: "fu-1",
      sessionId: "session-1",
      active: true,
      recurrence: "recorrente",
      waitAmount: 5,
      waitUnit: "minutos",
      sessionStatus: "active",
      messages: [outgoing("agent-msg", agentAt), outgoing("fu-msg", firstSentAt, "fu-1")],
      runs: [
        {
          followupId: "fu-1",
          sessionId: "session-1",
          cycleKey: "agent-msg",
          status: "sent",
          createdAt: firstSentAt,
          attempt: 1,
        },
      ],
    });
    expect(decision.action).toBe("send");
    if (decision.action === "send") expect(decision.cycleKey).toBe("fu-msg");
  });

  it("sends a daily follow-up at most once per Sao Paulo day", () => {
    const sentAt = Date.parse("2026-09-26T04:00:00.000Z");
    const sameDay = Date.parse("2026-09-26T18:00:00.000Z");
    const nextDay = Date.parse("2026-09-27T15:00:00.000Z");
    const base = {
      followupId: "fu-1",
      sessionId: "session-1",
      active: true,
      recurrence: "diario" as const,
      waitAmount: 1,
      waitUnit: "horas",
      sessionStatus: "active",
      messages: [outgoing("agent-msg", sentAt - 2 * 60 * MINUTE), outgoing("fu-msg", sentAt, "fu-1")],
      runs: [
        {
          followupId: "fu-1",
          sessionId: "session-1",
          cycleKey: "agent-msg",
          status: "sent" as const,
          createdAt: sentAt,
          attempt: 1,
        },
      ],
    };
    expect(decideFollowup({ ...base, now: sameDay })).toMatchObject({ action: "skip", reason: "daily_limit" });
    expect(decideFollowup({ ...base, now: nextDay }).action).toBe("send");
  });

  it("cancels a paused or transferred session once", () => {
    const decision = decideFollowup({
      now: agentAt + 10 * MINUTE,
      followupId: "fu-1",
      sessionId: "session-1",
      active: true,
      recurrence: "unico",
      waitAmount: 5,
      waitUnit: "minutos",
      sessionStatus: "paused",
      messages: [outgoing("agent-msg", agentAt)],
      runs: [],
    });
    expect(decision).toMatchObject({ action: "cancel", reason: "session_closed" });
  });

  it("skips an inactive rule and does not reuse another session run", () => {
    expect(
      decideFollowup({
        now: agentAt + 10 * MINUTE,
        followupId: "fu-1",
        sessionId: "session-1",
        active: false,
        recurrence: "unico",
        waitAmount: 5,
        waitUnit: "minutos",
        sessionStatus: "active",
        messages: [outgoing("agent-msg", agentAt)],
        runs: [],
      }),
    ).toMatchObject({ action: "skip", reason: "inactive" });

    const otherSession: FollowupRunRecord = {
      followupId: "fu-1",
      sessionId: "session-other",
      cycleKey: "agent-msg",
      status: "sent",
      createdAt: agentAt,
      attempt: 1,
    };
    expect(
      decideFollowup({
        now: agentAt + 10 * MINUTE,
        followupId: "fu-1",
        sessionId: "session-1",
        active: true,
        recurrence: "unico",
        waitAmount: 5,
        waitUnit: "minutos",
        sessionStatus: "active",
        messages: [outgoing("agent-msg", agentAt)],
        runs: [otherSession],
      }).action,
    ).toBe("send");
  });

  it("retries a temporary failure and refuses a third retry", () => {
    const failed = (attempt: number, ageMinutes: number): FollowupRunRecord => ({
      followupId: "fu-1",
      sessionId: "session-1",
      cycleKey: "agent-msg",
      status: "failed",
      createdAt: agentAt + 5 * MINUTE + ageMinutes * MINUTE,
      attempt,
    });
    expect(
      decideFollowup({
        now: agentAt + 10 * MINUTE,
        followupId: "fu-1",
        sessionId: "session-1",
        active: true,
        recurrence: "unico",
        waitAmount: 5,
        waitUnit: "minutos",
        sessionStatus: "active",
        messages: [outgoing("agent-msg", agentAt)],
        runs: [failed(1, 0)],
      }).action,
    ).toBe("send");
    expect(
      decideFollowup({
        now: agentAt + 20 * MINUTE,
        followupId: "fu-1",
        sessionId: "session-1",
        active: true,
        recurrence: "unico",
        waitAmount: 5,
        waitUnit: "minutos",
        sessionStatus: "active",
        messages: [outgoing("agent-msg", agentAt)],
        runs: [failed(3, 0)],
      }),
    ).toMatchObject({ action: "skip", reason: "retries_exhausted" });
  });

  it("does not run a second worker while the first claim is fresh", () => {
    const decision = decideFollowup({
      now: agentAt + 6 * MINUTE,
      followupId: "fu-1",
      sessionId: "session-1",
      active: true,
      recurrence: "unico",
      waitAmount: 5,
      waitUnit: "minutos",
      sessionStatus: "active",
      messages: [outgoing("agent-msg", agentAt)],
      runs: [
        {
          followupId: "fu-1",
          sessionId: "session-1",
          cycleKey: "agent-msg",
          status: "processing",
          createdAt: agentAt + 5 * MINUTE,
          attempt: 1,
        },
      ],
    });
    expect(decision).toMatchObject({ action: "skip", reason: "in_progress" });
  });

  it("keeps a manual message exact and only replaces the lead name", () => {
    expect(applyLeadName("Olá {{nome_lead}}, ainda está por aí?", "Ana")).toBe("Olá Ana, ainda está por aí?");
    expect(applyLeadName("Olá {{nome_lead}}, ainda está por aí?", "")).toBe("Olá, ainda está por aí?");
    const manual = resolveFollowupBody({
      type: "manual",
      template: "Olá {{nome_lead}}, texto fixo.",
      leadName: "Ana",
      generated: "texto reescrito pela IA",
    });
    expect(manual).toEqual({ text: "Olá Ana, texto fixo.", source: "manual" });
    const generated = resolveFollowupBody({
      type: "generativo",
      template: "pergunte se ainda quer continuar",
      leadName: "Ana",
      generated: "Oi Ana, seguimos de onde paramos?",
    });
    expect(generated.source).toBe("generated");
    expect(generated.text).toBe("Oi Ana, seguimos de onde paramos?");
  });

  it("blocks Instagram and the WhatsApp 24 hour window instead of bypassing them", () => {
    expect(followupChannelDecision("instagram").ok).toBe(false);
    expect(followupChannelDecision("whatsapp")).toEqual({ ok: true, channel: "whatsapp" });
    expect(classifyFollowupSendError(400, JSON.stringify({ error: { code: 131047, message: "Re-engagement" } })).state).toBe(
      "blocked",
    );
  });

  it("converts minutes, hours and days and rejects an oversized wait", () => {
    expect(waitToMs(5, "minutos")).toBe(5 * MINUTE);
    expect(waitToMs(2, "horas")).toBe(2 * 60 * MINUTE);
    expect(waitToMs(1, "dias")).toBe(24 * 60 * MINUTE);
    expect(() => assertFollowupWait(31, "dias")).toThrow(/30/);
  });
});
