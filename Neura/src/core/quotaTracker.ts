import type { ModelMetadata } from "../types/model";
import type { ProviderAdapter } from "../types/provider";
import type { QuotaCheck, QuotaDefaults, QuotaStatus, QuotaWindow } from "../types/quota";
import type { TaskProfile } from "../types/task";
import type { GenerateResult } from "../types/provider";
import { SQLiteStore } from "../database/sqlite";
import type { Logger } from "../utils/logger";
import { nowIso } from "../utils/validators";

export class QuotaTracker {
  constructor(
    private readonly store: SQLiteStore,
    private readonly defaults: QuotaDefaults,
    private readonly logger: Logger
  ) {}

  async refresh(adapter: ProviderAdapter): Promise<void> {
    try {
      const status = await adapter.getQuota();
      this.store.upsertQuota(status.windows.length ? status : this.defaultStatus(adapter.id));
      this.logger.info("quota refreshed", { component: "quotaTracker", providerId: adapter.id });
    } catch (error) {
      this.store.upsertQuota(this.defaultStatus(adapter.id));
      this.logger.warn("quota refresh failed; using local defaults", {
        component: "quotaTracker",
        providerId: adapter.id,
        error
      });
    }
  }

  async refreshAll(adapters: ProviderAdapter[]): Promise<void> {
    await Promise.all(adapters.map((adapter) => this.refresh(adapter)));
  }

  check(model: ModelMetadata, task: TaskProfile): QuotaCheck {
    if (model.capabilities.local) {
      return { allowed: true, pressure: 0 };
    }

    const statuses = this.statusesFor(model.providerId, model.id);
    const now = Date.now();
    let pressure = task.preserveQuota ? 0.18 : 0.05;

    for (const status of statuses) {
      const cooldown = status.cooldownUntil ? Date.parse(status.cooldownUntil) : undefined;
      const exhausted = status.exhaustedUntil ? Date.parse(status.exhaustedUntil) : undefined;
      const blockedUntil = Math.max(cooldown ?? 0, exhausted ?? 0);
      if (blockedUntil > now) {
        return {
          allowed: false,
          reason: "provider cooling down or exhausted",
          waitMs: blockedUntil - now,
          pressure: 1
        };
      }

      for (const window of status.windows) {
        const expected = window.kind.startsWith("t") ? task.estimatedInputTokens + task.expectedOutputTokens : 1;
        if (window.remaining !== undefined && window.remaining < expected) {
          return {
            allowed: false,
            reason: `${window.kind} quota exhausted`,
            waitMs: resetWait(window),
            pressure: 1
          };
        }

        if (window.limit && window.remaining !== undefined) {
          const windowPressure = 1 - window.remaining / window.limit;
          const scarcityPressure = expected / Math.max(1, window.remaining);
          pressure = Math.max(pressure, windowPressure, scarcityPressure);
        }
      }
    }

    return { allowed: true, pressure: Math.min(1, pressure) };
  }

  recordUsage(result: GenerateResult): void {
    const statuses = this.statusesFor(result.providerId, result.modelId);
    const source = statuses.length ? statuses : [this.defaultStatus(result.providerId)];
    const updated = source.map((status) => ({
      ...status,
      windows: status.windows.map((window) => decrementWindow(window, result.usage.totalTokens)),
      updatedAt: nowIso()
    }));

    for (const status of updated) {
      this.store.upsertQuota(status);
    }
  }

  markCooldown(providerId: string, retryAfterMs: number, reason = "rate limited"): void {
    const status = this.defaultStatus(providerId);
    status.cooldownUntil = new Date(Date.now() + Math.max(1000, retryAfterMs)).toISOString();
    status.raw = { reason };
    this.store.upsertQuota(status);
    this.logger.warn("provider cooldown marked", {
      component: "quotaTracker",
      providerId,
      retryAfterMs,
      reason
    });
  }

  list(): QuotaStatus[] {
    return this.store.listQuotas();
  }

  private statusesFor(providerId: string, modelId?: string): QuotaStatus[] {
    const statuses = this.store
      .listQuotas()
      .filter((quota) => quota.providerId === providerId && (!quota.modelId || quota.modelId === modelId));
    return statuses.length ? statuses : [this.defaultStatus(providerId, modelId)];
  }

  private defaultStatus(providerId: string, modelId?: string): QuotaStatus {
    return {
      providerId,
      modelId,
      windows: [
        {
          kind: "rpm",
          limit: this.defaults.requestsPerMinute,
          used: 0,
          remaining: this.defaults.requestsPerMinute,
          resetAt: new Date(Date.now() + 60_000).toISOString()
        },
        {
          kind: "rpd",
          limit: this.defaults.requestsPerDay,
          used: 0,
          remaining: this.defaults.requestsPerDay,
          resetAt: nextUtcMidnight()
        },
        {
          kind: "tpm",
          limit: this.defaults.tokensPerMinute,
          used: 0,
          remaining: this.defaults.tokensPerMinute,
          resetAt: new Date(Date.now() + 60_000).toISOString()
        },
        {
          kind: "tpd",
          limit: this.defaults.tokensPerDay,
          used: 0,
          remaining: this.defaults.tokensPerDay,
          resetAt: nextUtcMidnight()
        }
      ],
      isExhausted: false,
      raw: { source: "local_default_quota_preservation" },
      updatedAt: nowIso()
    };
  }
}

function decrementWindow(window: QuotaWindow, totalTokens: number): QuotaWindow {
  const now = Date.now();
  if (window.resetAt && Date.parse(window.resetAt) <= now && window.limit !== undefined) {
    return {
      ...window,
      used: 0,
      remaining: window.limit,
      resetAt: window.kind.endsWith("m") ? new Date(now + 60_000).toISOString() : nextUtcMidnight()
    };
  }

  const amount = window.kind.startsWith("t") ? totalTokens : 1;
  const used = (window.used ?? 0) + amount;
  const remaining = window.remaining === undefined ? undefined : Math.max(0, window.remaining - amount);
  return { ...window, used, remaining };
}

function resetWait(window: QuotaWindow): number | undefined {
  return window.resetAt ? Math.max(0, Date.parse(window.resetAt) - Date.now()) : undefined;
}

function nextUtcMidnight(): string {
  const date = new Date();
  date.setUTCHours(24, 0, 0, 0);
  return date.toISOString();
}
