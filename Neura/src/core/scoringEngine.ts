import type { ModelMetadata } from "../types/model";
import type { QuotaCheck } from "../types/quota";
import type { ModelCandidateScore, RoutingWeights, TaskProfile } from "../types/task";
import { clamp01 } from "../utils/validators";

export class ScoringEngine {
  constructor(private readonly weights: RoutingWeights) {}

  score(model: ModelMetadata, task: TaskProfile, quota: QuotaCheck): ModelCandidateScore {
    const reasons: string[] = [];
    const capability = this.capabilityScore(model, task, reasons);
    const health = healthScore(model.health);
    const latency = latencyScore(model.latencyMs, task);
    const reliability = clamp01(model.reliability * model.scores.reliability);
    const quotaScore = quota.allowed ? 1 - quota.pressure : 0;
    const cost = model.freeTier ? model.scores.costEfficiency : 0;
    const locality = model.capabilities.local ? 1 : task.preferLocal ? 0 : 0.2;

    if (!model.freeTier) reasons.push("paid model penalized");
    if (model.capabilities.local) reasons.push("local/offline");
    if (quota.pressure > 0.7) reasons.push("quota pressure high");
    if (model.health !== "healthy" && model.health !== "unknown") reasons.push(`health ${model.health}`);

    const score =
      capability * this.weights.capability +
      quotaScore * this.weights.quota +
      health * this.weights.health +
      latency * this.weights.latency +
      reliability * this.weights.reliability +
      cost * this.weights.cost +
      locality * this.weights.locality;

    return {
      providerId: model.providerId,
      modelId: model.id,
      score: clamp01(score),
      reasons
    };
  }

  private capabilityScore(model: ModelMetadata, task: TaskProfile, reasons: string[]): number {
    if (task.requiresVision && !model.capabilities.vision) {
      reasons.push("missing vision");
      return 0;
    }
    if (task.requiresTools && !model.capabilities.tools) {
      reasons.push("missing tools");
      return 0;
    }
    if (task.requiresEmbeddings && !model.capabilities.embeddings) {
      reasons.push("missing embeddings");
      return 0;
    }
    if (model.contextWindow && model.contextWindow < task.estimatedInputTokens + task.expectedOutputTokens) {
      reasons.push("context too small");
      return 0;
    }

    switch (task.type) {
      case "coding":
        reasons.push("coding fit");
        return weighted(model.scores.coding, 0.5, model.scores.reasoning, 0.25, model.scores.tools, 0.15, model.scores.speed, 0.1);
      case "reasoning":
        reasons.push("reasoning fit");
        return weighted(model.scores.reasoning, 0.55, model.scores.planning, 0.2, model.scores.longContext, 0.15, model.scores.speed, 0.1);
      case "planning":
        reasons.push("planning fit");
        return weighted(model.scores.planning, 0.45, model.scores.reasoning, 0.3, model.scores.longContext, 0.15, model.scores.creativity, 0.1);
      case "summarization":
        reasons.push("summary fit");
        return weighted(model.scores.longContext, 0.35, model.scores.speed, 0.35, model.scores.reasoning, 0.2, model.scores.costEfficiency, 0.1);
      case "vision":
        reasons.push("vision fit");
        return weighted(model.scores.vision, 0.55, model.scores.reasoning, 0.2, model.scores.speed, 0.15, model.scores.costEfficiency, 0.1);
      case "image_generation":
        reasons.push("image-generation fit");
        return model.capabilities.imageGeneration
          ? weighted(model.scores.imageGeneration, 0.55, model.scores.vision, 0.2, model.scores.speed, 0.15, model.scores.costEfficiency, 0.1)
          : 0;
      case "embeddings":
        reasons.push("embedding fit");
        return model.capabilities.embeddings ? Math.max(0.75, model.scores.embeddings) : 0;
      case "fast_chat":
        reasons.push("latency fit");
        return weighted(model.scores.speed, 0.55, model.scores.costEfficiency, 0.25, model.scores.reliability, 0.2, 0, 0);
      case "long_context":
        reasons.push("long-context fit");
        return weighted(model.scores.longContext, 0.55, model.scores.reasoning, 0.25, model.scores.speed, 0.1, model.scores.costEfficiency, 0.1);
      case "terminal_execution":
        reasons.push("tool/local fit");
        return weighted(model.scores.tools, 0.45, model.scores.coding, 0.3, model.capabilities.local ? 1 : 0.3, 0.15, model.scores.reasoning, 0.1);
    }
  }
}

function healthScore(health: ModelMetadata["health"]): number {
  switch (health) {
    case "healthy":
      return 1;
    case "unknown":
      return 0.75;
    case "degraded":
      return 0.45;
    case "cooling_down":
      return 0.1;
    case "unhealthy":
      return 0;
  }
}

function latencyScore(latencyMs: number | undefined, task: TaskProfile): number {
  if (!latencyMs) {
    return 0.7;
  }
  const denominator = task.latencyPreference === "lowest" ? 2500 : task.latencyPreference === "balanced" ? 8000 : 16000;
  return clamp01(1 - latencyMs / denominator);
}

function weighted(a: number, aw: number, b: number, bw: number, c: number, cw: number, d: number, dw: number): number {
  return clamp01(a * aw + b * bw + c * cw + d * dw);
}
