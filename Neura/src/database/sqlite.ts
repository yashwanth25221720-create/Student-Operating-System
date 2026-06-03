import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SCHEMA_SQL } from "./schema";
import type { ModelMetadata } from "../types/model";
import type { ProviderConfig, ProviderHealth } from "../types/provider";
import type { QuotaStatus } from "../types/quota";
import type { ModelCandidateScore } from "../types/task";
import type { UsageRecord, UsageSummary } from "../types/usage";
import { createId, nowIso, safeJsonParse } from "../utils/validators";

interface ModelRow {
  id: string;
  model_id: string;
  provider_id: string;
  display_name: string;
  context_window?: number;
  max_output_tokens?: number;
  capabilities_json: string;
  pricing_json: string;
  free_tier: number;
  scores_json: string;
  health_state: ModelMetadata["health"];
  latency_ms?: number;
  reliability: number;
  requests_remaining?: number;
  tokens_remaining?: number;
  reset_at?: string;
  raw_json: string;
  updated_at: string;
}

interface QuotaRow {
  provider_id: string;
  model_id?: string;
  kind: "rpm" | "rpd" | "tpm" | "tpd";
  limit_value?: number;
  used_value?: number;
  remaining_value?: number;
  reset_at?: string;
  exhausted_until?: string;
  cooldown_until?: string;
  raw_json: string;
  updated_at: string;
}

export interface ProviderRecord {
  id: string;
  type: string;
  displayName: string;
  enabled: boolean;
  healthy: boolean;
  lastCheckedAt?: string;
  avgLatencyMs?: number;
  failureCount: number;
  metadata: Record<string, unknown>;
}

export class SQLiteStore {
  private readonly db: DatabaseSync;

  constructor(private readonly dbPath: string) {
    const absolutePath = path.resolve(dbPath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    this.db = new DatabaseSync(absolutePath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  migrate(): void {
    this.transaction(() => {
      for (const statement of SCHEMA_SQL) {
        this.db.exec(statement);
      }
    });
  }

  upsertProvider(config: ProviderConfig, healthy = false): void {
    this.db
      .prepare(
        `INSERT INTO providers (id, type, display_name, enabled, healthy, metadata_json)
         VALUES (@id, @type, @displayName, @enabled, @healthy, @metadataJson)
         ON CONFLICT(id) DO UPDATE SET
           type = excluded.type,
           display_name = excluded.display_name,
           enabled = excluded.enabled,
           healthy = excluded.healthy,
           metadata_json = excluded.metadata_json`
      )
      .run(sqlParams({
        id: config.id,
        type: config.type,
        displayName: config.displayName,
        enabled: config.enabled ? 1 : 0,
        healthy: healthy ? 1 : 0,
        metadataJson: JSON.stringify(config.metadata ?? {})
      }));
  }

  recordHealth(health: ProviderHealth): void {
    this.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO health_events (id, provider_id, healthy, latency_ms, error, checked_at)
           VALUES (@id, @providerId, @healthy, @latencyMs, @error, @checkedAt)`
        )
        .run(sqlParams({
          id: createId("health"),
          providerId: health.providerId,
          healthy: health.healthy ? 1 : 0,
          latencyMs: health.latencyMs,
          error: health.error,
          checkedAt: health.checkedAt
        }));

      this.db
        .prepare(
          `UPDATE providers
           SET healthy = @healthy,
               last_checked_at = @checkedAt,
               avg_latency_ms = COALESCE((avg_latency_ms + @latencyMs) / 2, @latencyMs),
               failure_count = CASE WHEN @healthy = 1 THEN 0 ELSE failure_count + 1 END
           WHERE id = @providerId`
        )
        .run(sqlParams({
          providerId: health.providerId,
          healthy: health.healthy ? 1 : 0,
          checkedAt: health.checkedAt,
          latencyMs: health.latencyMs ?? null
        }));
    });
  }

  listProviders(): ProviderRecord[] {
    const rows = this.db
      .prepare(
        `SELECT
          id,
          type,
          display_name AS displayName,
          enabled,
          healthy,
          last_checked_at AS lastCheckedAt,
          avg_latency_ms AS avgLatencyMs,
          failure_count AS failureCount,
          metadata_json AS metadataJson
        FROM providers
        ORDER BY id`
      )
      .all() as Array<{
      id: string;
      type: string;
      displayName: string;
      enabled: number;
      healthy: number;
      lastCheckedAt?: string;
      avgLatencyMs?: number;
      failureCount: number;
      metadataJson: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      displayName: row.displayName,
      enabled: row.enabled === 1,
      healthy: row.healthy === 1,
      lastCheckedAt: row.lastCheckedAt ?? undefined,
      avgLatencyMs: row.avgLatencyMs ?? undefined,
      failureCount: row.failureCount,
      metadata: safeJsonParse(row.metadataJson, {})
    }));
  }

  upsertModels(models: ModelMetadata[]): void {
    const statement = this.db.prepare(
      `INSERT INTO models (
        id, model_id, provider_id, display_name, context_window, max_output_tokens,
        capabilities_json, pricing_json, free_tier, scores_json, health_state,
        latency_ms, reliability, requests_remaining, tokens_remaining, reset_at,
        raw_json, updated_at
      )
      VALUES (
        @id, @modelId, @providerId, @displayName, @contextWindow, @maxOutputTokens,
        @capabilitiesJson, @pricingJson, @freeTier, @scoresJson, @healthState,
        @latencyMs, @reliability, @requestsRemaining, @tokensRemaining, @resetAt,
        @rawJson, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        context_window = excluded.context_window,
        max_output_tokens = excluded.max_output_tokens,
        capabilities_json = excluded.capabilities_json,
        pricing_json = excluded.pricing_json,
        free_tier = excluded.free_tier,
        scores_json = excluded.scores_json,
        health_state = excluded.health_state,
        latency_ms = excluded.latency_ms,
        reliability = excluded.reliability,
        requests_remaining = excluded.requests_remaining,
        tokens_remaining = excluded.tokens_remaining,
        reset_at = excluded.reset_at,
        raw_json = excluded.raw_json,
        updated_at = excluded.updated_at`
    );

    this.transaction(() => {
      for (const model of models) {
        statement.run(sqlParams({
          id: `${model.providerId}:${model.id}`,
          modelId: model.id,
          providerId: model.providerId,
          displayName: model.displayName,
          contextWindow: model.contextWindow ?? null,
          maxOutputTokens: model.maxOutputTokens ?? null,
          capabilitiesJson: JSON.stringify(model.capabilities),
          pricingJson: JSON.stringify(model.pricing),
          freeTier: model.freeTier ? 1 : 0,
          scoresJson: JSON.stringify(model.scores),
          healthState: model.health,
          latencyMs: model.latencyMs ?? null,
          reliability: model.reliability,
          requestsRemaining: model.quota.requestsRemaining ?? null,
          tokensRemaining: model.quota.tokensRemaining ?? null,
          resetAt: model.quota.resetAt ?? null,
          rawJson: JSON.stringify(model.raw ?? {}),
          updatedAt: model.updatedAt
        }));
      }
    });
  }

  listModels(): ModelMetadata[] {
    const rows = this.db.prepare("SELECT * FROM models ORDER BY provider_id, display_name").all() as unknown as ModelRow[];
    return rows.map(rowToModel);
  }

  getModel(providerId: string, modelId: string): ModelMetadata | undefined {
    const row = this.db
      .prepare("SELECT * FROM models WHERE provider_id = ? AND model_id = ?")
      .get(providerId, modelId) as ModelRow | undefined;
    return row ? rowToModel(row) : undefined;
  }

  updateProviderModelHealth(providerId: string, healthState: ModelMetadata["health"], latencyMs?: number): void {
    this.db
      .prepare(
        `UPDATE models
         SET health_state = @healthState,
             latency_ms = COALESCE(@latencyMs, latency_ms),
             updated_at = @updatedAt
         WHERE provider_id = @providerId`
      )
      .run(sqlParams({
        providerId,
        healthState,
        latencyMs: latencyMs ?? null,
        updatedAt: nowIso()
      }));
  }

  upsertQuota(status: QuotaStatus): void {
    const statement = this.db.prepare(
      `INSERT INTO quotas (
        id, provider_id, model_id, kind, limit_value, used_value, remaining_value,
        reset_at, exhausted_until, cooldown_until, raw_json, updated_at
      )
      VALUES (
        @id, @providerId, @modelId, @kind, @limitValue, @usedValue, @remainingValue,
        @resetAt, @exhaustedUntil, @cooldownUntil, @rawJson, @updatedAt
      )
      ON CONFLICT(id) DO UPDATE SET
        limit_value = excluded.limit_value,
        used_value = excluded.used_value,
        remaining_value = excluded.remaining_value,
        reset_at = excluded.reset_at,
        exhausted_until = excluded.exhausted_until,
        cooldown_until = excluded.cooldown_until,
        raw_json = excluded.raw_json,
        updated_at = excluded.updated_at`
    );

    this.transaction(() => {
      for (const window of status.windows) {
        statement.run(sqlParams({
          id: quotaId(status.providerId, status.modelId, window.kind),
          providerId: status.providerId,
          modelId: status.modelId ?? null,
          kind: window.kind,
          limitValue: window.limit ?? null,
          usedValue: window.used ?? null,
          remainingValue: window.remaining ?? null,
          resetAt: window.resetAt ?? null,
          exhaustedUntil: status.exhaustedUntil ?? null,
          cooldownUntil: status.cooldownUntil ?? null,
          rawJson: JSON.stringify(status.raw ?? {}),
          updatedAt: status.updatedAt
        }));
      }
    });
  }

  listQuotas(): QuotaStatus[] {
    const rows = this.db.prepare("SELECT * FROM quotas ORDER BY provider_id, model_id, kind").all() as unknown as QuotaRow[];
    const grouped = new Map<string, QuotaStatus>();

    for (const row of rows) {
      const key = `${row.provider_id}:${row.model_id ?? ""}`;
      const existing =
        grouped.get(key) ??
        ({
          providerId: row.provider_id,
          modelId: row.model_id ?? undefined,
          windows: [],
          isExhausted: Boolean(row.exhausted_until && Date.parse(row.exhausted_until) > Date.now()),
          exhaustedUntil: row.exhausted_until,
          cooldownUntil: row.cooldown_until,
          raw: safeJsonParse(row.raw_json, {}),
          updatedAt: row.updated_at
        } satisfies QuotaStatus);

      existing.windows.push({
        kind: row.kind,
        limit: row.limit_value ?? undefined,
        used: row.used_value ?? undefined,
        remaining: row.remaining_value ?? undefined,
        resetAt: row.reset_at ?? undefined
      });
      grouped.set(key, existing);
    }

    return [...grouped.values()];
  }

  recordUsage(record: UsageRecord): void {
    this.db
      .prepare(
        `INSERT INTO usage_events (
          id, request_id, provider_id, model_id, task_type, prompt_tokens,
          completion_tokens, total_tokens, latency_ms, success, error_code, created_at
        )
        VALUES (
          @id, @requestId, @providerId, @modelId, @taskType, @promptTokens,
          @completionTokens, @totalTokens, @latencyMs, @success, @errorCode, @createdAt
        )`
      )
      .run(sqlParams({
        ...record,
        success: record.success ? 1 : 0,
        errorCode: record.errorCode ?? null
      }));
  }

  usageSummary(): UsageSummary[] {
    return this.db
      .prepare(
        `SELECT
          provider_id AS providerId,
          model_id AS modelId,
          SUM(prompt_tokens) AS promptTokens,
          SUM(completion_tokens) AS completionTokens,
          SUM(total_tokens) AS totalTokens,
          COUNT(*) AS requestCount,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successCount,
          SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failureCount
        FROM usage_events
        GROUP BY provider_id, model_id
        ORDER BY totalTokens DESC`
      )
      .all() as unknown as UsageSummary[];
  }

  recordRouting(input: {
    requestId: string;
    taskType: string;
    selectedProviderId?: string;
    selectedModelId?: string;
    candidates: ModelCandidateScore[];
    reason: string;
    success: boolean;
    error?: string;
  }): void {
    this.db
      .prepare(
        `INSERT INTO routing_history (
          id, request_id, task_type, selected_provider_id, selected_model_id,
          candidates_json, reason, success, error, created_at
        )
        VALUES (
          @id, @requestId, @taskType, @selectedProviderId, @selectedModelId,
          @candidatesJson, @reason, @success, @error, @createdAt
        )`
      )
      .run(sqlParams({
        id: createId("route"),
        requestId: input.requestId,
        taskType: input.taskType,
        selectedProviderId: input.selectedProviderId ?? null,
        selectedModelId: input.selectedModelId ?? null,
        candidatesJson: JSON.stringify(input.candidates),
        reason: input.reason,
        success: input.success ? 1 : 0,
        error: input.error ?? null,
        createdAt: nowIso()
      }));
  }

  private transaction(callback: () => void): void {
    this.db.exec("BEGIN");
    try {
      callback();
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

function rowToModel(row: ModelRow): ModelMetadata {
  return {
    id: row.model_id,
    providerId: row.provider_id,
    displayName: row.display_name,
    contextWindow: row.context_window ?? undefined,
    maxOutputTokens: row.max_output_tokens ?? undefined,
    capabilities: safeJsonParse(row.capabilities_json, {
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
    }),
    pricing: safeJsonParse(row.pricing_json, { currency: "UNKNOWN" }),
    freeTier: row.free_tier === 1,
    scores: safeJsonParse(row.scores_json, {
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
    }),
    latencyMs: row.latency_ms ?? undefined,
    reliability: row.reliability,
    health: row.health_state,
    quota: {
      requestsRemaining: row.requests_remaining ?? undefined,
      tokensRemaining: row.tokens_remaining ?? undefined,
      resetAt: row.reset_at ?? undefined
    },
    strengths: [],
    raw: safeJsonParse(row.raw_json, {}),
    updatedAt: row.updated_at
  };
}

function quotaId(providerId: string, modelId: string | undefined, kind: string): string {
  return `${providerId}:${modelId ?? "provider"}:${kind}`;
}

function sqlParams(input: Record<string, unknown>): any {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value === undefined ? null : value]));
}
