import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "@jest/globals";

const chatSource = readFileSync(resolve("src/routes/_app/chat.tsx"), "utf8");
const stylesSource = readFileSync(resolve("src/styles.css"), "utf8");

function extractFunction(name: string) {
  const start = chatSource.indexOf(`function ${name}(`);
  expect(start).toBeGreaterThan(-1);
  const nextFn = chatSource.indexOf("\nfunction ", start + 1);
  return chatSource.slice(start, nextFn === -1 ? undefined : nextFn);
}

describe("chat bubble contrast tokens", () => {
  it("defines semantic bubble tokens for light and dark themes", () => {
    for (const token of [
      "--bubble-outgoing-bg",
      "--bubble-outgoing-fg",
      "--bubble-outgoing-muted",
      "--bubble-outgoing-border",
      "--bubble-incoming-bg",
      "--bubble-incoming-fg",
      "--bubble-incoming-muted",
      "--bubble-incoming-border",
      "--bubble-control",
      "--bubble-control-hover",
      "--bubble-track",
      "--bubble-track-played",
      "--bubble-thumb",
      "--bubble-surface",
      "--bubble-action",
      "--bubble-divider",
      "--bubble-ink",
      "--bubble-muted-ink",
    ]) {
      expect(stylesSource).toContain(token);
    }
    expect(stylesSource).toContain(".wa-bubble-outgoing");
    expect(stylesSource).toContain(".wa-bubble-incoming");
  });

  it("does not paint audio or document controls with hardcoded white ink", () => {
    const voice = extractFunction("ChatVoiceMessage");
    const document = extractFunction("ChatDocumentCard");
    for (const forbidden of ["text-white", "bg-white", "fill-white", "text-white/"]) {
      expect(voice).not.toContain(forbidden);
      expect(document).not.toContain(forbidden);
    }
    expect(voice).toContain("--bubble-control");
    expect(voice).toContain("--bubble-track-played");
    expect(document).toContain("text-current");
  });

  it("keeps audio unavailable copy on a theme-aware muted token", () => {
    expect(chatSource).toContain("Áudio indisponível");
    expect(chatSource).not.toContain("text-xs text-white/70");
  });

  it("does not hardcode WhatsApp dark palette on interactive lists", () => {
    const listSource = readFileSync(
      resolve("src/components/whatsapp-list-message-preview.tsx"),
      "utf8",
    );
    for (const forbidden of ["#e9edef", "#8696a0", "#2a3942", "#384147", "#00a884"]) {
      expect(listSource).not.toContain(forbidden);
    }
    expect(listSource).toContain("--bubble-surface");
    expect(listSource).toContain("--bubble-action");
    expect(listSource).toContain("--bubble-muted-ink");
  });

  it("gives quoted replies a theme-aware surface and a wider bubble floor", () => {
    expect(chatSource).toContain("function ChatQuotedReply");
    expect(chatSource).toContain("min-w-[13rem] sm:min-w-[16.5rem] shrink-0");
    expect(stylesSource).toContain(".wa-bubble-outgoing:has(.wa-quote-reply)");
    expect(chatSource).toContain("Ir para a mensagem original");
    expect(stylesSource).toContain(".wa-quote-reply");
    expect(stylesSource).toContain("var(--bubble-surface)");
    expect(stylesSource).not.toMatch(/\.wa-quote-reply-outgoing[\s\S]{0,80}#e9edef/);
  });
});
