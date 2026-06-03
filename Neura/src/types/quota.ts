export type QuotaWindowKind = "rpm" | "rpd" | "tpm" | "tpd";

export interface QuotaWindow {
  kind: QuotaWindowKind;
  limit?: number;
  used?: number;
  remaining?: number;
  resetAt?: string;
}

export interface QuotaStatus {
  providerId: string;
  modelId?: string;
  windows: QuotaWindow[];
  isExhausted: boolean;
  exhaustedUntil?: string;
  cooldownUntil?: string;
  raw?: unknown;
  updatedAt: string;
}

export interface QuotaCheck {
  allowed: boolean;
  reason?: string;
  waitMs?: number;
  pressure: number;
}

export interface QuotaDefaults {
  requestsPerMinute: number;
  requestsPerDay: number;
  tokensPerMinute: number;
  tokensPerDay: number;
}
