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
  });

  it("reactivates after timeout and auto-recovers empty step", () => {
    expect(
      evaluateInboundBotGate({
        state: { bot_active: 0, current_step_id: null },
        pauseTimeoutMinutes: 30,
        instanceBotActive: true,
      }).action,
    ).toBe("reactivate");

    expect(
      evaluateInboundBotGate({
        state: {
          bot_active: 0,
          current_step_id: "step-1",
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
          last_interaction: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        },
        pauseTimeoutMinutes: 30,
        instanceBotActive: true,
      }).action,
    ).toBe("silence");
  });

  it("toBool handles mysql-ish values", () => {
    expect(toBool(1)).toBe(true);
    expect(toBool("1")).toBe(true);
    expect(toBool(0)).toBe(false);
  });
});
