import { OpenAICompatibleAdapter } from "../openaiCompatible";
import type { ModelMetadata } from "../../types/model";
import { DEFAULT_CAPABILITY_SCORES, DEFAULT_MODEL_CAPABILITIES } from "../../types/model";
import type { ProviderConfig } from "../../types/provider";
import type { QuotaStatus } from "../../types/quota";
import { nowIso, parseNumber } from "../../utils/validators";

interface GroqModel {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
  context_window?: number;
  max_completion_tokens?: number;
}

export class GroqAdapter extends OpenAICompatibleAdapter {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async validateKey(): Promise<boolean> {
    await this.fetchJson<unknown>("/models", { method: "GET" });
    return true;
  }

  async getModels(): Promise<ModelMetadata[]> {
    const response = await this.fetchJson<{ data?: GroqModel[] }>("/models", { method: "GET" });
    return (response.data ?? []).map((model) => this.mapModel(model));
  }

  async getQuota(): Promise<QuotaStatus> {
    return {
      providerId: this.id,
      windows: [],
      isExhausted: false,
      raw: { source: "provider_does_not_expose_public_quota_endpoint" },
      updatedAt: nowIso()
    };
  }

  private mapModel(model: GroqModel): ModelMetadata {
    const contextWindow = parseNumber(model.context_window);
    const id = model.id.toLowerCase();
    const likelyToolCapable = id.includes("llama") || id.includes("qwen") || id.includes("compound");

    return {
      id: model.id,
      providerId: this.id,
      displayName: model.id,
      contextWindow,
      maxOutputTokens: parseNumber(model.max_completion_tokens),
      capabilities: {
        ...DEFAULT_MODEL_CAPABILITIES,
        tools: likelyToolCapable,
        longContext: (contextWindow ?? 0) >= 32000
      },
      scores: {
        ...DEFAULT_CAPABILITY_SCORES,
        speed: 0.95,
        coding: id.includes("qwen") || id.includes("coder") ? 0.85 : 0.6,
        reasoning: id.includes("deepseek") || id.includes("reasoning") ? 0.88 : 0.62,
        tools: likelyToolCapable ? 0.75 : 0.25,
        longContext: Math.min(1, (contextWindow ?? 0) / 131000),
        costEfficiency: 0.95
      },
      pricing: { currency: "UNKNOWN" },
      freeTier: this.config.freeTier ?? true,
      reliability: 0.82,
      health: "unknown",
      quota: {},
      strengths: ["low-latency"],
      raw: model,
      updatedAt: nowIso()
    };
  }
}
