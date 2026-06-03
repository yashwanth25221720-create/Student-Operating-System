export type TaskType =
  | "coding"
  | "reasoning"
  | "planning"
  | "summarization"
  | "vision"
  | "image_generation"
  | "embeddings"
  | "fast_chat"
  | "long_context"
  | "terminal_execution";

export type LatencyPreference = "lowest" | "balanced" | "quality_first";
export type QualityPreference = "economy" | "balanced" | "best";

export interface TaskProfile {
  type: TaskType;
  priority: number;
  requiresVision: boolean;
  requiresTools: boolean;
  requiresEmbeddings: boolean;
  preferLocal: boolean;
  estimatedInputTokens: number;
  expectedOutputTokens: number;
  latencyPreference: LatencyPreference;
  qualityPreference: QualityPreference;
  preserveQuota: boolean;
}

export interface RoutingWeights {
  capability: number;
  quota: number;
  health: number;
  latency: number;
  reliability: number;
  cost: number;
  locality: number;
}

export interface RoutingPolicy {
  maxAttempts: number;
  timeoutMs: number;
  preserveQuota: boolean;
  allowPaidModels: boolean;
  preferLocal: boolean;
}

export interface RoutingDecision {
  requestId: string;
  task: TaskProfile;
  selectedProviderId: string;
  selectedModelId: string;
  candidates: ModelCandidateScore[];
  reason: string;
  createdAt: string;
}

export interface ModelCandidateScore {
  providerId: string;
  modelId: string;
  score: number;
  reasons: string[];
}
