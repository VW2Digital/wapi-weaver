export type ContractProvenance =
  | "EXECUTED_MOCK"
  | "UNIT_TEST_PROVEN"
  | "STATIC_SOURCE_AUDIT"
  | "DOCUMENTATION_PROVEN"
  | "INFERRED"
  | "UNKNOWN";

export type DifferenceClassification =
  | "MATCH"
  | "EXPECTED_ARCHITECTURAL_DIFFERENCE"
  | "API_VARIANT_DIFFERENCE"
  | "INTENTIONAL_IMPROVEMENT"
  | "MIGRATION_RISK"
  | "UNKNOWN";

export type RiskLevel = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "BLOCKER";

export interface SafeOutboundContractDescriptor {
  provider: "whatsapp" | "instagram";
  apiVariant: string;
  method: string;
  host: string;
  graphVersionSource: string;
  senderNodeType: string;
  senderNodePlaceholder: string;
  recipientType: string;
  authorizationScheme: string;
  contentType: string;
  messageType: string;
  normalizedBody: Record<string, unknown>;
  responseMessageIdPath: string;
  successSemantics: "accepted" | "sent" | "delivered" | string;
  provenance: ContractProvenance;
}

export interface ContractDifference {
  field: string;
  current: unknown;
  next: unknown;
  classification: DifferenceClassification;
  risk: RiskLevel;
  explanation: string;
}

export interface ParityResult {
  overall: DifferenceClassification;
  risk: RiskLevel;
  differences: ContractDifference[];
  explanation: string;
}
