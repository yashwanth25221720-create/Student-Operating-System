import { OpenAICompatibleAdapter } from "../openaiCompatible";
import type { ModelMetadata } from "../../types/model";
import { DEFAULT_CAPABILITY_SCORES, DEFAULT_MODEL_CAPABILITIES } from "../../types/model";
import type { ProviderConfig } from "../../types/provider";
import type { QuotaStatus } from "../../types/quota";
import { nowIso, parseNumber } from "../../utils/validators";

interface OpenRouterModel {
  id: string;
  name?: string;
  description?: string;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  context_length?: number;
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
  };
  pricing?: {
    prompt?: string;
    completion?: string;
    request?: string;
  };
  supported_parameters?: string[];
}

export class OpenRouterAdapter extends OpenAICompatibleAdapter {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async validateKey(): Promise<boolean> {
    await this.fetchJson<unknown>("/key", { method: "GET" });
    return true;
  }

  async getModels(): Promise<ModelMetadata[]> {
    const response = await this.fetchJson<{ data?: OpenRouterModel[] }>("/models?output_modalities=all", { method: "GET" });
    const models = response.data ?? [];
    return models.map((model) => this.mapModel(model));
  }

  async getQuota(): Promise<QuotaStatus> {
    const raw = await this.fetchJson<Record<string, unknown>>("/key", { method: "GET" });
    const data = (raw.data ?? raw) as Record<string, unknown>;
    const limit = parseNumber(data.limit);
    const usage = parseNumber(data.usage);
    const remaining = limit !== undefined && usage !== undefined ? Math.max(0, limit - usage) : undefined;

    return {
      providerId: this.id,
      windows: [
        {
          kind: "tpd",
          limit,
          used: usage,
          remaining
        }
      ],
      isExhausted: remaining === 0,
      raw,
      updatedAt: nowIso()
    };
  }

  supportsVision(): boolean {
    return true;
  }

  supportsTools(): boolean {
    return true;
  }

  supportsEmbeddings(): boolean {
    return true;
  }

  private mapModel(model: OpenRouterModel): ModelMetadata {
    const inputModalities = model.architecture?.input_modalities ?? [];
    const outputModalities = model.architecture?.output_modalities ?? [];
    const supported = model.supported_parameters ?? [];
    const promptPrice = parseNumber(model.pricing?.prompt);
    const completionPrice = parseNumber(model.pricing?.completion);
    const requestPrice = parseNumber(model.pricing?.request);
    const freeTier =
      model.id.includes(":free") ||
      [promptPrice, completionPrice, requestPrice].every((value) => value === undefined || value === 0);

    return {
      id: model.id,
      providerId: this.id,
      displayName: model.name ?? model.id,
      contextWindow: model.top_provider?.context_length ?? model.context_length,
      maxOutputTokens: model.top_provider?.max_completion_tokens,
      capabilities: {
        ...DEFAULT_MODEL_CAPABILITIES,
        vision: inputModalities.includes("image"),
        embeddings: outputModalities.includes("embeddings"),
        tools: supported.includes("tools"),
        jsonMode: supported.includes("response_format"),
        longContext: (model.context_length ?? 0) >= 64000
      },
      scores: {
        ...DEFAULT_CAPABILITY_SCORES,
        costEfficiency: freeTier ? 1 : 0.35,
        longContext: Math.min(1, (model.context_length ?? 0) / 200000),
        tools: supported.includes("tools") ? 0.9 : 0.1,
        vision: inputModalities.includes("image") ? 0.9 : 0
      },
      pricing: {
        promptPer1K: promptPrice === undefined ? undefined : promptPrice * 1000,
        completionPer1K: completionPrice === undefined ? undefined : completionPrice * 1000,
        request: requestPrice,
        currency: promptPrice === undefined && completionPrice === undefined ? "UNKNOWN" : "USD",
        raw: model.pricing
      },
      freeTier,
      reliability: 0.75,
      health: "unknown",
      quota: {},
      strengths: [],
      raw: model,
      updatedAt: nowIso()
    };
  }
}
