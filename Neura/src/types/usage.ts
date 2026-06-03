export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface UsageRecord {
  id: string;
  requestId: string;
  providerId: string;
  modelId: string;
  taskType: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  success: boolean;
  errorCode?: string;
  createdAt: string;
}

export interface UsageSummary {
  providerId?: string;
  modelId?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  requestCount: number;
  successCount: number;
  failureCount: number;
}
