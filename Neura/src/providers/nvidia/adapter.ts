import { OpenAICompatibleAdapter } from "../openaiCompatible";
import type { ModelMetadata } from "../../types/model";
import { DEFAULT_CAPABILITY_SCORES, DEFAULT_MODEL_CAPABILITIES } from "../../types/model";
import type { ProviderConfig } from "../../types/provider";
import type { QuotaStatus } from "../../types/quota";
import { nowIso } from "../../utils/validators";

interface NvidiaModel {
  id: string;
  object?: string;
  owned_by?: string;
  root?: string;
  parent?: string;
  max_model_len?: number;
}

export class NvidiaAdapter extends OpenAICompatibleAdapter {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async validateKey(): Promise<boolean> {
    await this.fetchJson<unknown>("/models", { method: "GET" });
    return true;
  }

  async getModels(): Promise<ModelMetadata[]> {
    const response = await this.fetchJson<{ data?: NvidiaModel[] }>("/models", { method: "GET" });
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

  private mapModel(model: NvidiaModel): ModelMetadata {
    const id = model.id.toLowerCase();
    const contextWindow = model.max_model_len;
    const vision = id.includes("vision") || id.includes("vl") || id.includes("multimodal");
    const coding = id.includes("coder") || id.includes("qwen") || id.includes("deepseek");
    const reasoning = id.includes("reason") || id.includes("r1") || id.includes("nemotron");

    return {
      id: model.id,
      providerId: this.id,
      displayName: model.id,
      contextWindow,
      maxOutputTokens: undefined,
      capabilities: {
        ...DEFAULT_MODEL_CAPABILITIES,
        vision,
        tools: true,
        longContext: (contextWindow ?? 0) >= 64000
      },
      scores: {
        ...DEFAULT_CAPABILITY_SCORES,
        reasoning: reasoning ? 0.86 : 0.65,
        coding: coding ? 0.86 : 0.6,
        speed: 0.78,
        vision: vision ? 0.85 : 0,
        tools: 0.75,
        longContext: Math.min(1, (contextWindow ?? 0) / 131000),
        costEfficiency: this.config.freeTier === false ? 0.45 : 0.9
      },
      pricing: { currency: "UNKNOWN" },
      freeTier: this.config.freeTier ?? true,
      reliability: 0.78,
      health: "unknown",
      quota: {},
      strengths: reasoning ? ["reasoning"] : [],
      raw: model,
      updatedAt: nowIso()
    };
  }
}
