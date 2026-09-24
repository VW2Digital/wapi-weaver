import { describe, expect, it } from "@jest/globals";
import {
  DS_AGENT_HISTORY_LIMIT,
  extractContactFacts,
  formatContactAgendaBlock,
  formatHistoryText,
  isWhatsAppReactionMessage,
  mergeContactFacts,
  selectRelevantKnowledge,
  takeLastHistory,
} from "../../src/lib/ds-agent-context.server";

describe("DS Agente conversation context", () => {
  it("keeps the last 20 messages", () => {
    const rows = Array.from({ length: 25 }, (_, i) => i + 1);
    expect(takeLastHistory(rows)).toEqual(Array.from({ length: 20 }, (_, i) => i + 6));
    expect(DS_AGENT_HISTORY_LIMIT).toBe(20);
  });

  it("formats chronological history", () => {
    const text = formatHistoryText([
      { direction: "incoming", body: "Oi, quero agendar" },
      { direction: "outgoing", body: "Claro, qual horário?" },
      { direction: "incoming", body: "Amanhã às 10" },
    ]);
    expect(text).toBe("Cliente: Oi, quero agendar\nAgente: Claro, qual horário?\nCliente: Amanhã às 10");
  });

  it("picks knowledge docs that match the current question", () => {
    const docs = [
      { title: "Cardápio", content: "Pizza margherita custa 49 reais." },
      { title: "Horários", content: "Atendemos de segunda a sábado das 9 às 18." },
      { title: "Entrega", content: "Frete grátis acima de 100 reais." },
    ];
    const picked = selectRelevantKnowledge(docs, "qual o horário de atendimento?");
    expect(picked[0]?.title).toBe("Horários");
  });

  it("learns emails and recent client statements", () => {
    const facts = extractContactFacts(
      "Cliente: Meu e-mail é  ana@loja.com\nAgente: ok\nCliente: quero o plano anual",
    );
    expect(facts.some((f) => f.includes("ana@loja.com"))).toBe(true);
    expect(facts.some((f) => /plano anual/i.test(f))).toBe(true);
    const merged = mergeContactFacts("- email:  ana@loja.com", ["cliente disse: quero o plano anual"]);
    expect(merged).toMatch(/plano anual/);
    expect(merged).toMatch(/ana@loja.com/);
  });

  it("labels a meeting scheduled yesterday as HOJE, not amanhã", () => {
    const clock = {
      isoDate: "2026-09-24",
      datePtBr: "24/09/2026",
      timePtBr: "10:51",
      weekdayPtBr: "quinta-feira",
      year: 2026,
      clockLine: "HOJE é quinta-feira, 24/09/2026 (2026-09-24), 10:51 (America/Sao_Paulo). O ano corrente é 2026.",
    };
    const block = formatContactAgendaBlock(clock, [
      { title: "Reunião Bliv", start_at: "2026-09-24 13:00:00" },
    ]);
    expect(block).toMatch(/HOJE/);
    expect(block).not.toMatch(/AMANHÃ 24\/09/);
    expect(block).toMatch(/nunca chame de reunião de amanhã/i);
  });

  it("detects WhatsApp reactions without treating normal text as emoji", () => {
    expect(isWhatsAppReactionMessage({ type: "reaction", body: "👍" })).toBe(true);
    expect(isWhatsAppReactionMessage({ type: "text", body: "❤️" })).toBe(true);
    expect(isWhatsAppReactionMessage({ type: "text", body: "Bom dia?" })).toBe(false);
    expect(isWhatsAppReactionMessage({ type: "text", body: "ok" })).toBe(false);
  });
});
