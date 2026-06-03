import type { RetryPolicy } from "../utils/retry";
import { withRetry } from "../utils/retry";
import type { GenerateRequest, GenerateResult, StreamCallbacks } from "../types/provider";
import { ProviderError } from "../types/provider";
import type { ModelMetadata } from "../types/model";
import type { ModelCandidateScore, RoutingDecision, RoutingPolicy, TaskProfile } from "../types/task";
import type { UsageRecord } from "../types/usage";
import { SQLiteStore } from "../database/sqlite";
import type { Logger } from "../utils/logger";
import { createId, estimateTokensFromMessages, nowIso } from "../utils/validators";
import { ModelRegistry } from "./modelRegistry";
import { ProviderManager } from "./providerManager";
import { QuotaTracker } from "./quotaTracker";
import { ScoringEngine } from "./scoringEngine";
import { TaskClassifier } from "./taskClassifier";

export class Router {
  constructor(
    private readonly providerManager: ProviderManager,
    private readonly registry: ModelRegistry,
    private readonly quotaTracker: QuotaTracker,
    private readonly classifier: TaskClassifier,
    private readonly scoring: ScoringEngine,
    private readonly store: SQLiteStore,
    private readonly retryPolicy: RetryPolicy,
    private readonly policy: RoutingPolicy,
    private readonly logger: Logger
  ) {}

  route(request: GenerateRequest): RoutingDecision {
    const requestId = createId("route");
    const task = this.classifier.classify(request);
    const candidates = this.rankCandidates(request, task);
    const selected = candidates[0];
    if (!selected) {
      throw new Error("No route candidates are available. Run discovery or enable a provider.");
    }

    return {
      requestId,
      task,
      selectedProviderId: selected.providerId,
      selectedModelId: selected.modelId,
      candidates,
      reason: selected.reasons.join("; ") || "highest weighted score",
      createdAt: nowIso()
    };
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const task = this.classifier.classify(request);
    const candidates = this.rankCandidates(request, task);
    return this.executeFallbackChain(request, task, candidates, "generate");
  }

  async stream(request: GenerateRequest, callbacks: StreamCallbacks): Promise<GenerateResult> {
    const task = this.classifier.classify(request);
    const candidates = this.rankCandidates(request, task);
    return this.executeFallbackChain(request, task, candidates, "stream", callbacks);
  }

  rankCandidates(request: GenerateRequest, task?: TaskProfile): ModelCandidateScore[] {
    const profile = task ?? this.classifier.classify(request);
    const providerIds = new Set(this.providerManager.enabledAdapters().map((adapter) => adapter.id));
    const requestedModel = request.model ? parseRequestedModel(request.model, providerIds) : undefined;

    return this.registry
      .list()
      .filter((model) => {
        if (!this.providerManager.get(model.providerId)) {
          return false;
        }
        if (!this.policy.allowPaidModels && !model.freeTier && !model.capabilities.local) {
          return false;
        }
        if (requestedModel?.providerId && model.providerId !== requestedModel.providerId) {
          return false;
        }
        if (requestedModel?.modelId && model.id !== requestedModel.modelId) {
          return false;
        }
        return true;
      })
      .map((model) => this.scoring.score(model, profile, this.quotaTracker.check(model, profile)))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  private async executeFallbackChain(
    request: GenerateRequest,
    task: TaskProfile,
    candidates: ModelCandidateScore[],
    mode: "generate" | "stream",
    callbacks?: StreamCallbacks
  ): Promise<GenerateResult> {
    if (!candidates.length) {
      throw new Error(`No models can satisfy task ${task.type}`);
    }

    const attempts = candidates.slice(0, Math.max(this.policy.maxAttempts, 1));
    const routeRequestId = createId("route");
    let lastError: unknown;

    for (const candidate of attempts) {
      const model = this.registry.get(candidate.providerId, candidate.modelId);
      const adapter = this.providerManager.get(candidate.providerId);
      if (!model || !adapter) {
        continue;
      }

      const quota = this.quotaTracker.check(model, task);
      if (!quota.allowed) {
        this.logger.warn("candidate skipped by quota", {
          component: "router",
          providerId: candidate.providerId,
          modelId: candidate.modelId,
          reason: quota.reason
        });
        continue;
      }

      const started = Date.now();
      try {
        this.logger.info("routing request", {
          component: "router",
          providerId: candidate.providerId,
          modelId: candidate.modelId,
          taskType: task.type,
          score: candidate.score
        });

        const result = await withRetry(
          () =>
            mode === "stream"
              ? adapter.stream({ ...request, model: candidate.modelId }, callbacks ?? {})
              : adapter.generate({ ...request, model: candidate.modelId }),
          this.retryPolicy
        );

        this.quotaTracker.recordUsage(result);
        this.recordUsage({
          result,
          task,
          success: true
        });
        this.store.recordRouting({
          requestId: routeRequestId,
          taskType: task.type,
          selectedProviderId: candidate.providerId,
          selectedModelId: candidate.modelId,
          candidates,
          reason: candidate.reasons.join("; ") || "highest weighted score",
          success: true
        });
        return result;
      } catch (error) {
        lastError = error;
        const latencyMs = Date.now() - started;
        this.recordUsage({
          result: syntheticFailureResult(routeRequestId, candidate, request, latencyMs),
          task,
          success: false,
          errorCode: error instanceof ProviderError ? error.code : "runtime_error"
        });

        if (error instanceof ProviderError && error.code === "rate_limited") {
          this.quotaTracker.markCooldown(candidate.providerId, error.retryAfterMs ?? 60_000, error.message);
        }

        this.logger.warn("candidate failed; trying fallback", {
          component: "router",
          providerId: candidate.providerId,
          modelId: candidate.modelId,
          error
        });
        await callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    }

    this.store.recordRouting({
      requestId: routeRequestId,
      taskType: task.type,
      candidates,
      reason: "all fallback candidates failed",
      success: false,
      error: lastError instanceof Error ? lastError.message : String(lastError)
    });

    throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "All routing candidates failed"));
  }

  private recordUsage(input: { result: GenerateResult; task: TaskProfile; success: boolean; errorCode?: string }): void {
    const record: UsageRecord = {
      id: createId("usage"),
      requestId: input.result.requestId,
      providerId: input.result.providerId,
      modelId: input.result.modelId,
      taskType: input.task.type,
      promptTokens: input.result.usage.promptTokens,
      completionTokens: input.result.usage.completionTokens,
      totalTokens: input.result.usage.totalTokens,
      latencyMs: input.result.latencyMs,
      success: input.success,
      errorCode: input.errorCode,
      createdAt: nowIso()
    };
    this.store.recordUsage(record);
  }
}

function parseRequestedModel(input: string, providerIds: Set<string>): { providerId?: string; modelId: string } {
  const separator = input.indexOf(":");
  if (separator > 0) {
    const maybeProvider = input.slice(0, separator);
    const rest = input.slice(separator + 1);
    if (providerIds.has(maybeProvider) && rest) {
      return { providerId: maybeProvider, modelId: rest };
    }
  }
  return { modelId: input };
}

function syntheticFailureResult(
  requestId: string,
  candidate: ModelCandidateScore,
  request: GenerateRequest,
  latencyMs: number
): GenerateResult {
  const promptTokens = estimateTokensFromMessages(request.messages);
  return {
    requestId,
    providerId: candidate.providerId,
    modelId: candidate.modelId,
    text: "",
    usage: {
      promptTokens,
      completionTokens: 0,
      totalTokens: promptTokens
    },
    latencyMs
  };
}
