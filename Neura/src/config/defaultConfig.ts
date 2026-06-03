import type { ProviderConfig } from "../types/provider";
import type { QuotaDefaults } from "../types/quota";
import type { RoutingPolicy, RoutingWeights } from "../types/task";
import type { LogLevel } from "../utils/logger";
import type { RetryPolicy } from "../utils/retry";

export interface RuntimeConfig {
  dbPath: string;
  logLevel: LogLevel;
  providers: ProviderConfig[];
  routingWeights: RoutingWeights;
  routingPolicy: RoutingPolicy;
  quotaDefaults: QuotaDefaults;
  retryPolicy: RetryPolicy;
}

export const DEFAULT_ROUTING_WEIGHTS: RoutingWeights = {
  capability: 0.34,
  quota: 0.22,
  health: 0.16,
  latency: 0.1,
  reliability: 0.1,
  cost: 0.06,
  locality: 0.02
};

export const DEFAULT_ROUTING_POLICY: RoutingPolicy = {
  maxAttempts: 4,
  timeoutMs: 60000,
  preserveQuota: true,
  allowPaidModels: false,
  preferLocal: false
};

export const DEFAULT_QUOTA_LIMITS: QuotaDefaults = {
  requestsPerMinute: 20,
  requestsPerDay: 500,
  tokensPerMinute: 60000,
  tokensPerDay: 1000000
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  attempts: 2,
  baseDelayMs: 400,
  maxDelayMs: 6000,
  jitter: true
};
