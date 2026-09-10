import { describe, expect, it } from "@jest/globals";
import {
  clampPauseTimeoutMinutes,
  evaluateInboundBotGate,
  toBool,
} from "@/lib/bot-conversation-orchestration.server";

describe("bot-conversation-orchestration gate", () => {
  it("clamps pause timeout to 1..1440 with default 30", () => {
    expect(clampPauseTimeoutMinutes(undefined)).toBe(30);
    expect(clampPauseTimeoutMinutes(0)).toBe(1);
    expect(clampPauseTimeoutMinutes(2000)).toBe(1440);
    expect(clampPauseTimeoutMinutes(45)).toBe(45);
  });

  it("respects manual_pause and AI exception", () => {
    expect(
      evaluateInboundBotGate({
        state: { manual_pause: 1, ai_agent_active: 0 },
        pauseTimeoutMinutes: 30,
        instanceBotActive: true,
      }).action,
    ).toBe("silence");

    expect(
      evaluateInboundBotGate({
        state: { manual_pause: 1, ai_agent_active: 1 },
        pauseTimeoutMinutes: 30,
        instanceBotActive: true,
      }).action,
    ).toBe("skip_bot_run_ai");
  });

  it("routes AI-active conversations to AI stage", () => {
    expect(
      evaluateInboundBotGate({
        state: { bot_active: 0, ai_agent_active: 1 },
        pauseTimeoutMinutes: 30,
        instanceBotActive: true,
      }).action,
    ).toBe("skip_bot_run_ai");

    // AI mode even when bot_active=1 (activateAi sets both)
    expect(
      evaluateInboundBotGate({
        state: { bot_active: 1, ai_agent_active: 1 },
        pauseTimeoutMinutes: 30,
        instanceBotActive: true,
      }).action,
    ).toBe("skip_bot_run_ai");
  });

  it("end-flow / handoff is_paused without until does NOT auto-recover immediately", () => {
    // -997 END_FLOW / -998 / -996 leave is_paused=1, bot_active=0, step empty
    const decision = evaluateInboundBotGate({
      state: {
        bot_active: 0,
        is_paused: 1,
        current_step_id: null,
        ai_agent_active: 0,
        last_interaction: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
      pauseTimeoutMinutes: 30,
      instanceBotActive: true,
    });
    expect(decision.action).toBe("silence");
    expect(decision.reason).toBe("HANDOFF_OR_END_WITHIN_TIMEOUT");
  });

  it("end-flow / handoff reactivates only after timeout", () => {
    const decision = evaluateInboundBotGate({
      state: {
        bot_active: 0,
        is_paused: 1,
        current_step_id: null,
        ai_agent_active: 0,
        last_interaction: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
      },
      pauseTimeoutMinutes: 30,
      instanceBotActive: true,
    });
    expect(decision.action).toBe("reactivate");
    expect(decision.reason).toBe("TIMEOUT_ELAPSED");
  });

  it("is_paused with future paused_until silences (CRM pause)", () => {
    const decision = evaluateInboundBotGate({
      state: {
        bot_active: 1,
        is_paused: 1,
        paused_until: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        ai_agent_active: 0,
      },
      pauseTimeoutMinutes: 30,
      instanceBotActive: true,
    });
    expect(decision.action).toBe("silence");
    expect(decision.reason).toBe("LEGACY_CRM_PAUSE");
  });

  it("reactivates after timeout and auto-recovers empty step only when NOT paused", () => {
    expect(
      evaluateInboundBotGate({
        state: { bot_active: 0, current_step_id: null, is_paused: 0 },
        pauseTimeoutMinutes: 30,
        instanceBotActive: true,
      }).action,
    ).toBe("reactivate");

    expect(
      evaluateInboundBotGate({
        state: {
          bot_active: 0,
          current_step_id: "step-1",
          is_paused: 0,
          last_interaction: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
        },
        pauseTimeoutMinutes: 30,
        instanceBotActive: true,
      }).action,
    ).toBe("reactivate");

    expect(
      evaluateInboundBotGate({
        state: {
          bot_active: 0,
          current_step_id: "step-1",
          is_paused: 0,
          last_interaction: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        },
        pauseTimeoutMinutes: 30,
        instanceBotActive: true,
      }).action,
    ).toBe("silence");
  });

  it("continues bot when active and not paused", () => {
    expect(
      evaluateInboundBotGate({
        state: { bot_active: 1, is_paused: 0, ai_agent_active: 0 },
        pauseTimeoutMinutes: 30,
        instanceBotActive: true,
      }).action,
    ).toBe("continue_bot");
  });

  it("toBool handles mysql-ish values", () => {
    expect(toBool(1)).toBe(true);
    expect(toBool("1")).toBe(true);
    expect(toBool(0)).toBe(false);
  });
});
