/// <reference types="jest" />
import { evaluateBotActivation } from "@/lib/messaging/services/bot-lifecycle.service";

describe("evaluateBotActivation", () => {
  it("is active when a builder flow is active and no conversation state exists", () => {
    const decision = evaluateBotActivation({
      legacySettings: [],
      builderFlows: [{ is_active: 1 }],
      conversationState: null,
    });
    expect(decision.active).toBe(true);
    expect(decision.reason).toBe("BOT_ACTIVE");
  });

  it("is active when a legacy setting is active", () => {
    const decision = evaluateBotActivation({
      legacySettings: [{ is_active: true }],
      builderFlows: [],
      conversationState: null,
    });
    expect(decision.active).toBe(true);
    expect(decision.reason).toBe("BOT_ACTIVE");
  });

  it("is inactive when no active flow or setting", () => {
    const decision = evaluateBotActivation({
      legacySettings: [{ is_active: 0 }],
      builderFlows: [{ is_active: false }],
      conversationState: null,
    });
    expect(decision.active).toBe(false);
    expect(decision.reason).toBe("NO_ACTIVE_FLOW");
  });

  it("is inactive when conversation bot_active is 0", () => {
    const decision = evaluateBotActivation({
      legacySettings: [],
      builderFlows: [{ is_active: 1 }],
      conversationState: { bot_active: 0, is_paused: 0, paused_until: null },
    });
    expect(decision.active).toBe(false);
    expect(decision.reason).toBe("CONVERSATION_BOT_INACTIVE");
  });

  it("is inactive when conversation is paused with a future paused_until", () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const decision = evaluateBotActivation({
      legacySettings: [],
      builderFlows: [{ is_active: 1 }],
      conversationState: { bot_active: 1, is_paused: 1, paused_until: future },
    });
    expect(decision.active).toBe(false);
    expect(decision.reason).toBe("CONVERSATION_PAUSED");
  });

  it("is active when conversation pause expired", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const decision = evaluateBotActivation({
      legacySettings: [],
      builderFlows: [{ is_active: 1 }],
      conversationState: { bot_active: 1, is_paused: 1, paused_until: past },
    });
    expect(decision.active).toBe(true);
    expect(decision.reason).toBe("BOT_ACTIVE");
  });

  it("is active when a builder flow is active and conversation is active", () => {
    const decision = evaluateBotActivation({
      legacySettings: [{ is_active: 0 }],
      builderFlows: [{ is_active: true }, { is_active: false }],
      conversationState: { bot_active: 1, is_paused: 0, paused_until: null },
    });
    expect(decision.active).toBe(true);
    expect(decision.reason).toBe("BOT_ACTIVE");
  });

  it("is inactive when all builder flows are inactive", () => {
    const decision = evaluateBotActivation({
      legacySettings: [],
      builderFlows: [{ is_active: 0 }, { is_active: 0 }],
      conversationState: { bot_active: 1, is_paused: 0, paused_until: null },
    });
    expect(decision.active).toBe(false);
    expect(decision.reason).toBe("NO_ACTIVE_FLOW");
  });
});
