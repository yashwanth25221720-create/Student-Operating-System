import { ProviderError } from "../types/provider";

export interface RetryPolicy {
  attempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  attempts: 3,
  baseDelayMs: 300,
  maxDelayMs: 5000,
  jitter: true
};

export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  shouldRetry: (error: unknown) => boolean = isRetryableError
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= policy.attempts; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt >= policy.attempts || !shouldRetry(error)) {
        throw error;
      }

      const providerDelay = error instanceof ProviderError ? error.retryAfterMs : undefined;
      const delay = providerDelay ?? computeDelay(attempt, policy);
      await sleep(delay);
    }
  }

  throw lastError;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof ProviderError) {
    if (error.status === 429) {
      return true;
    }
    return typeof error.status === "number" && error.status >= 500;
  }
  return true;
}

export function computeDelay(attempt: number, policy: RetryPolicy): number {
  const exponential = Math.min(policy.maxDelayMs, policy.baseDelayMs * 2 ** (attempt - 1));
  if (!policy.jitter) {
    return exponential;
  }
  const jitter = Math.floor(Math.random() * Math.max(1, exponential * 0.25));
  return exponential + jitter;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
