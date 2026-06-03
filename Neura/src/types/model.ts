export type HealthState = "unknown" | "healthy" | "degraded" | "unhealthy" | "cooling_down";

export interface ModelCapabilities {
  text: boolean;
  vision: boolean;
  tools: boolean;
  embeddings: boolean;
  imageGeneration: boolean;
  audio: boolean;
  reranking: boolean;
  streaming: boolean;
  local: boolean;
  jsonMode: boolean;
  longContext: boolean;
}

export interface CapabilityScores {
  reasoning: number;
  coding: number;
  speed: number;
  planning: number;
  creativity: number;
  vision: number;
  imageGeneration: number;
  tools: number;
  embeddings: number;
  longContext: number;
  reliability: number;
  costEfficiency: number;
}

export interface ModelPricing {
  promptPer1K?: number;
  completionPer1K?: number;
  request?: number;
  currency: "USD" | "UNKNOWN";
  raw?: unknown;
}

export interface ModelQuotaSnapshot {
  requestsRemaining?: number;
  tokensRemaining?: number;
  resetAt?: string;
  exhaustedUntil?: string;
}

export interface ModelMetadata {
  id: string;
  providerId: string;
  displayName: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  capabilities: ModelCapabilities;
  scores: CapabilityScores;
  pricing: ModelPricing;
  freeTier: boolean;
  latencyMs?: number;
  reliability: number;
  health: HealthState;
  quota: ModelQuotaSnapshot;
  strengths: string[];
  raw: unknown;
  updatedAt: string;
}

export const DEFAULT_MODEL_CAPABILITIES: ModelCapabilities = {
  text: true,
  vision: false,
  tools: false,
  embeddings: false,
  imageGeneration: false,
  audio: false,
  reranking: false,
  streaming: true,
  local: false,
  jsonMode: false,
  longContext: false
};

export const DEFAULT_CAPABILITY_SCORES: CapabilityScores = {
  reasoning: 0.5,
  coding: 0.5,
  speed: 0.5,
  planning: 0.5,
  creativity: 0.5,
  vision: 0,
  imageGeneration: 0,
  tools: 0,
  embeddings: 0,
  longContext: 0,
  reliability: 0.7,
  costEfficiency: 0.6
};
