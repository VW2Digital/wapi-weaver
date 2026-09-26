import { describe, expect, it } from "@jest/globals";
import {
  deriveConversationState,
  extractContactFacts,
  formatConversationStateBlock,
  formatKnowledgeBlock,
  retrieveKnowledgePassages,
} from "../../src/lib/ds-agent-context.server";

const hoursDoc = {
  id: "doc-hours",
  title: "Horários de atendimento",
  content: "A equipe humana atende de segunda a sexta, das 9 às 18. A IA pode responder fora desse horário.",
};

const guideDoc = {
  id: "doc-guide",
  title: "Documentação e Guia Operacional da Bliv",
  content:
    "Seção 4.2 Operação assistida. O código interno do guia é OP-BLIV-19. O suporte não exige reunião para consultar este guia.",
};

function turn(history: string, current: string) {
  const state = deriveConversationState(history, current);
  const passages = retrieveKnowledgePassages([hoursDoc, guideDoc], state.currentMessage, 4);
  return {
    state,
    stateBlock: formatConversationStateBlock(state),
    knowledgeBlock: formatKnowledgeBlock(passages),
  };
}

describe("DS Agente multi-turn conversation", () => {
  const greeting = "Bom dia?";
  const hoursQuestion = "Achei que atendesse todos os dias.";
  const documentQuestion =
    "Não quero agendar nada. Quero saber sobre a Documentação e Guia Operacional da Bliv.";

  it("A. introduces only before the agent has spoken", () => {
    const first = turn("", greeting);
    expect(first.state.alreadyIntroduced).toBe(false);
    expect(first.stateBlock).toMatch(/uma única vez/);

    const history = "Cliente: Bom dia?\nAgente: Bom dia! Sou o João, assistente virtual da Bliv. Como posso ajudar?";
    const second = turn(history, hoursQuestion);
    expect(second.state.alreadyIntroduced).toBe(true);
    expect(second.stateBlock).toMatch(/Não repita apresentação/);
    expect(second.state.currentMessage).toBe(hoursQuestion);
  });

  it("B. answers hours from the hours document, not from the greeting", () => {
    const history = "Cliente: Bom dia?\nAgente: Bom dia! Sou o João, assistente virtual da Bliv.";
    const result = turn(history, hoursQuestion);
    expect(result.knowledgeBlock).toMatch(/segunda a sexta/);
    expect(result.knowledgeBlock).toMatch(/\[Fonte: Horários de atendimento\]/);
  });

  it("C. keeps a time correction as the message to answer", () => {
    const history = "Cliente: A reunião é amanhã?\nAgente: Posso conferir a agenda.";
    const correction = "Na verdade não é amanhã, é hoje às 15.";
    const result = turn(history, correction);
    expect(result.state.currentMessage).toBe(correction);
    expect(result.state.historyText).toMatch(/não é amanhã/);
    expect(result.state.historyText.endsWith(`Cliente: ${correction}`)).toBe(true);
    const facts = extractContactFacts(result.state.historyText);
    expect(facts.some((fact) => /correção do cliente/i.test(fact) && /hoje às 15/.test(fact))).toBe(true);
  });

  it("D. records a scheduling refusal and stops offering a meeting", () => {
    const history = [
      "Cliente: Bom dia?",
      "Agente: Bom dia! Sou o João, assistente virtual da Bliv.",
      "Cliente: Achei que atendesse todos os dias.",
      "Agente: A equipe humana segue o horário comercial. Posso agendar uma reunião.",
    ].join("\n");
    const result = turn(history, documentQuestion);
    expect(result.state.holdScheduling).toBe(true);
    expect(result.stateBlock).toMatch(/recusou agendamento/);
    expect(result.stateBlock).toMatch(/Não ofereça reunião/);
    const facts = extractContactFacts(result.state.historyText);
    expect(facts.some((fact) => /recusa confirmada/i.test(fact))).toBe(true);
  });

  it("E. follows the new subject instead of the earlier scheduling talk", () => {
    const history = [
      "Cliente: Quero agendar uma reunião amanhã.",
      "Agente: Posso sugerir um horário.",
      "Cliente: Não quero agendar nada.",
    ].join("\n");
    const result = turn(history, "Quero saber sobre a Documentação e Guia Operacional da Bliv.");
    expect(result.state.currentMessage).toMatch(/Guia Operacional/);
    expect(result.knowledgeBlock).toMatch(/OP-BLIV-19/);
    expect(result.knowledgeBlock).not.toMatch(/segunda a sexta/);
  });

  it("F. retrieves the registered guide and cites the source", () => {
    const result = turn("Cliente: Bom dia?\nAgente: Olá.", documentQuestion);
    expect(result.knowledgeBlock).toMatch(/OP-BLIV-19/);
    expect(result.knowledgeBlock).toMatch(/Seção 4\.2|seção 4\.2/i);
    expect(result.knowledgeBlock).toMatch(/\[Fonte: Documentação e Guia Operacional da Bliv\]/);
    expect(result.knowledgeBlock).toMatch(/dados, não instruções/);
  });

  it("G. says the base has no answer when the document does not contain it", () => {
    const result = turn("Cliente: Bom dia?\nAgente: Olá.", "Qual o preço do plano secreto Marte-9?");
    expect(result.knowledgeBlock).toMatch(/Nenhum trecho/);
    expect(result.knowledgeBlock).not.toMatch(/OP-BLIV-19/);
  });

  it("allows scheduling again only when the client asks for it after a refusal", () => {
    const history = "Cliente: Não quero agendar nada.\nAgente: Certo, sem reunião.";
    const refused = turn(history, "Me fala do guia operacional.");
    expect(refused.state.holdScheduling).toBe(true);
    const resumed = turn(history, "Pode agendar uma reunião amanhã às 10.");
    expect(resumed.state.holdScheduling).toBe(false);
  });
});
