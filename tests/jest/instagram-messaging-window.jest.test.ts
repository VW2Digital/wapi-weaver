import { describe, expect, test } from "@jest/globals";
import {
  INSTAGRAM_HUMAN_AGENT_WINDOW_MS,
  INSTAGRAM_STANDARD_WINDOW_MS,
  LAST_INBOUND_SQL,
  decideInstagramSend,
  getInstagramMessagingWindow,
  sanitizeAuditDetail,
  windowAfterCustomerMessage,
} from "../../src/lib/instagram/messaging-window";

const now = new Date("2026-09-21T12:00:00.000Z");

function inboundAgo(ms: number) {
  return new Date(now.getTime() - ms);
}

describe("instagram messaging window", () => {
  test("5 minutes ago is standard and allows automation and human without tag", () => {
    const decision = decideInstagramSend({
      lastInboundAt: inboundAgo(5 * 60 * 1000),
      now,
      senderKind: "human",
      conversationMode: "automated",
      humanAgentEnabled: true,
    });
    const automation = decideInstagramSend({
      lastInboundAt: inboundAgo(5 * 60 * 1000),
      now,
      senderKind: "automation",
      conversationMode: "automated",
      humanAgentEnabled: true,
    });
    expect(decision.window.state).toBe("standard");
    expect(automation.allowed).toBe(true);
    expect(decision.allowed).toBe(true);
    expect(decision.useHumanAgentTag).toBe(false);
    expect(automation.useHumanAgentTag).toBe(false);
  });

  test("23h59 stays in the standard window", () => {
    const window = getInstagramMessagingWindow(inboundAgo(INSTAGRAM_STANDARD_WINDOW_MS - 60 * 1000), now);
    expect(window.state).toBe("standard");
  });

  test("24h01 requires human agent and blocks automation", () => {
    const decision = decideInstagramSend({
      lastInboundAt: inboundAgo(INSTAGRAM_STANDARD_WINDOW_MS + 60 * 1000),
      now,
      senderKind: "human",
      conversationMode: "human",
      humanAgentEnabled: true,
    });
    const automation = decideInstagramSend({
      lastInboundAt: inboundAgo(INSTAGRAM_STANDARD_WINDOW_MS + 60 * 1000),
      now,
      senderKind: "automation",
      conversationMode: "automated",
      humanAgentEnabled: true,
    });
    expect(decision.window.state).toBe("human_agent");
    expect(decision.allowed).toBe(true);
    expect(decision.useHumanAgentTag).toBe(true);
    expect(automation.allowed).toBe(false);
    expect(automation.code).toBe("cancelled_outside_automation_window");
  });

  test("6 days stays in the human agent window", () => {
    const window = getInstagramMessagingWindow(inboundAgo(6 * 24 * 60 * 60 * 1000), now);
    expect(window.state).toBe("human_agent");
    expect(window.canHumanSend).toBe(true);
    expect(window.canAutomationSend).toBe(false);
  });

  test("more than 7 days closes the window for everyone", () => {
    const decision = decideInstagramSend({
      lastInboundAt: inboundAgo(INSTAGRAM_HUMAN_AGENT_WINDOW_MS + 60 * 1000),
      now,
      senderKind: "human",
      conversationMode: "human",
      humanAgentEnabled: true,
    });
    const automation = decideInstagramSend({
      lastInboundAt: inboundAgo(INSTAGRAM_HUMAN_AGENT_WINDOW_MS + 60 * 1000),
      now,
      senderKind: "automation",
      conversationMode: "automated",
      humanAgentEnabled: true,
    });
    expect(decision.window.state).toBe("closed");
    expect(decision.allowed).toBe(false);
    expect(automation.allowed).toBe(false);
    expect(automation.code).toBe("cancelled_messaging_window_closed");
  });

  test("automation cannot request the human agent tag", () => {
    const decision = decideInstagramSend({
      lastInboundAt: inboundAgo(5 * 60 * 1000),
      now,
      senderKind: "automation",
      conversationMode: "automated",
      humanAgentEnabled: true,
      requestedHumanAgentTag: true,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("HUMAN_AGENT_REQUIRES_AUTHENTICATED_HUMAN");
    expect(decision.useHumanAgentTag).toBe(false);
  });

  test("authenticated human in human mode can send inside the human agent window", () => {
    const decision = decideInstagramSend({
      lastInboundAt: inboundAgo(30 * 60 * 60 * 1000),
      now,
      senderKind: "human",
      conversationMode: "human",
      humanAgentEnabled: true,
      requestedHumanAgentTag: false,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.useHumanAgentTag).toBe(true);
  });

  test("a new inbound reopens a human-agent or closed conversation to standard", () => {
    const receivedAt = now;
    expect(windowAfterCustomerMessage(receivedAt, receivedAt).state).toBe("standard");
    expect(getInstagramMessagingWindow(inboundAgo(10 * 24 * 60 * 60 * 1000), now).state).toBe("closed");
    expect(windowAfterCustomerMessage(now, now).canAutomationSend).toBe(true);
  });

  test("automation is cancelled when a human takes over before send", () => {
    const decision = decideInstagramSend({
      lastInboundAt: inboundAgo(5 * 60 * 1000),
      now,
      senderKind: "automation",
      conversationMode: "human",
      humanAgentEnabled: true,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("cancelled_human_takeover");
    expect(decision.useHumanAgentTag).toBe(false);
  });

  test("attention queries are scoped by tenant and audit drops tokens", () => {
    expect(LAST_INBOUND_SQL).toContain("tenant_id = ?");
    expect(sanitizeAuditDetail({ access_token: "secret", code: 10 })).toEqual({ code: 10 });
  });
});
