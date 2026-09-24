import { describe, expect, it } from "@jest/globals";
import {
  DS_AGENT_HISTORY_LIMIT,
  extractContactFacts,
  formatHistoryText,
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
});
