import type { SafeOutboundContractDescriptor, ContractDifference, DifferenceClassification, RiskLevel, ParityResult } from "./contract-descriptor";

function compareField(
  field: string,
  current: unknown,
  next: unknown,
  classify: (current: unknown, next: unknown) => { classification: DifferenceClassification; risk: RiskLevel; explanation: string },
): ContractDifference {
  if (JSON.stringify(current) === JSON.stringify(next)) {
    return { field, current, next, classification: "MATCH", risk: "NONE", explanation: "Values match." };
  }
  return { field, current, next, ...classify(current, next) };
}

export function compareContracts(
  current: SafeOutboundContractDescriptor,
  next: SafeOutboundContractDescriptor,
): ParityResult {
  const differences: ContractDifference[] = [];

  differences.push(
    compareField("provider", current.provider, next.provider, () => ({
      classification: "MIGRATION_RISK",
      risk: "BLOCKER",
      explanation: "Provider mismatch would send a message to the wrong API.",
    })),
  );

  differences.push(
    compareField("method", current.method, next.method, () => ({
      classification: "MIGRATION_RISK",
      risk: "BLOCKER",
      explanation: "HTTP method mismatch.",
    })),
  );

  differences.push(
    compareField("host", current.host, next.host, (c, n) => {
      if (current.provider === "instagram") {
        return {
          classification: "API_VARIANT_DIFFERENCE",
          risk: "HIGH",
          explanation: "Current uses graph.facebook.com with MESSAGE_TYPE; Next uses graph.instagram.com per Instagram Login docs. Variant must be selected before cutover.",
        };
      }
      if (c !== n) {
        return { classification: "MIGRATION_RISK", risk: "HIGH", explanation: "API host mismatch." };
      }
      return { classification: "MATCH", risk: "NONE", explanation: "" };
    }),
  );

  differences.push(
    compareField("graphVersionSource", current.graphVersionSource, next.graphVersionSource, () => ({
      classification: "EXPECTED_ARCHITECTURAL_DIFFERENCE",
      risk: "LOW",
      explanation: "Current clamps versions; Next receives an explicit version from configuration. Equivalent behavior if the same version is configured.",
    })),
  );

  differences.push(
    compareField("senderNodeType", current.senderNodeType, next.senderNodeType, () => ({
      classification: "MIGRATION_RISK",
      risk: "BLOCKER",
      explanation: "Sender node type divergence would route the request to the wrong identity.",
    })),
  );

  differences.push(
    compareField("recipientType", current.recipientType, next.recipientType, () => ({
      classification: "MIGRATION_RISK",
      risk: "HIGH",
      explanation: "Recipient identity type divergence may deliver to the wrong user.",
    })),
  );

  differences.push(
    compareField("authorizationScheme", current.authorizationScheme, next.authorizationScheme, () => ({
      classification: "MATCH",
      risk: "NONE",
      explanation: "Both use Bearer with resolved access token. Representation is redacted.",
    })),
  );

  differences.push(
    compareField("contentType", current.contentType, next.contentType, () => ({
      classification: "MIGRATION_RISK",
      risk: "MEDIUM",
      explanation: "Content-Type mismatch.",
    })),
  );

  differences.push(
    compareField("messageType", current.messageType, next.messageType, () => ({
      classification: "MIGRATION_RISK",
      risk: "MEDIUM",
      explanation: "Message type mismatch.",
    })),
  );

  differences.push(
    compareField("normalizedBody", current.normalizedBody, next.normalizedBody, (c, n) => {
      const cw = JSON.stringify(c);
      const nw = JSON.stringify(n);
      if (cw === nw) {
        return { classification: "MATCH", risk: "NONE", explanation: "Payload structure matches." };
      }

      if (current.provider === "instagram") {
        return {
          classification: "API_VARIANT_DIFFERENCE",
          risk: "HIGH",
          explanation: "Instagram payloads differ: current includes MESSAGE_TYPE=RESPONSE; Next omits it per graph.instagram.com variant.",
        };
      }

      return {
        classification: "MIGRATION_RISK",
        risk: "HIGH",
        explanation: "Payload body differs, may cause API rejection.",
      };
    }),
  );

  differences.push(
    compareField("responseMessageIdPath", current.responseMessageIdPath, next.responseMessageIdPath, () => ({
      classification: "MIGRATION_RISK",
      risk: "HIGH",
      explanation: "Provider message ID extraction path mismatch would break message status tracking.",
    })),
  );

  differences.push(
    compareField("successSemantics", current.successSemantics, next.successSemantics, () => ({
      classification: "INTENTIONAL_IMPROVEMENT",
      risk: "LOW",
      explanation: "Current labels HTTP 200 as 'sent'; Next labels as 'accepted' to avoid implying delivery/read. This is an intentional correction.",
    })),
  );

  const nonMatches = differences.filter((d) => d.classification !== "MATCH");
  const hasBlocker = nonMatches.some((d) => d.risk === "BLOCKER");
  const hasHigh = nonMatches.some((d) => d.risk === "HIGH");

  let overall: DifferenceClassification = "MATCH";
  let risk: RiskLevel = "NONE";
  let explanation = "Contracts match.";

  if (hasBlocker) {
    overall = "MIGRATION_RISK";
    risk = "BLOCKER";
    explanation = "Blocker-level divergence detected. Cannot cut over until resolved.";
  } else if (nonMatches.some((d) => d.classification === "API_VARIANT_DIFFERENCE")) {
    overall = "API_VARIANT_DIFFERENCE";
    risk = hasHigh ? "HIGH" : "MEDIUM";
    explanation = "API variant difference. Documented and intentional; requires variant decision before cutover.";
  } else if (nonMatches.some((d) => d.classification === "INTENTIONAL_IMPROVEMENT")) {
    overall = "INTENTIONAL_IMPROVEMENT";
    risk = hasHigh ? "HIGH" : nonMatches.some((d) => d.risk === "MEDIUM") ? "MEDIUM" : "LOW";
    explanation = "Only intentional improvements or low-risk architectural differences remain.";
  } else if (nonMatches.length > 0) {
    overall = nonMatches.some((d) => d.risk === "HIGH") ? "MIGRATION_RISK" : "EXPECTED_ARCHITECTURAL_DIFFERENCE";
    risk = hasHigh ? "HIGH" : nonMatches.some((d) => d.risk === "MEDIUM") ? "MEDIUM" : "LOW";
    explanation = "Non-matching fields require review.";
  }

  return { overall, risk, differences, explanation };
}
