import { OpenAICompatibleAdapter } from "../openaiCompatible";
import type { ModelMetadata } from "../../types/model";
import { DEFAULT_CAPABILITY_SCORES, DEFAULT_MODEL_CAPABILITIES } from "../../types/model";
import type { ProviderConfig } from "../../types/provider";
import type { QuotaStatus } from "../../types/quota";
import { nowIso, parseNumber } from "../../utils/validators";

interface GenericModel {
  id: string;
  object?: string;
  name?: string;
  display_name?: string;
  owned_by?: string;
  created?: number;
  context_window?: number;
  context_length?: number;
  max_context_length?: number;
  max_model_len?: number;
  max_tokens?: number;
  max_output_tokens?: number;
  pricing?: unknown;
  capabilities?: Record<string, unknown>;
  permission?: unknown;
  [key: string]: unknown;
}

export class GenericOpenAIAdapter extends OpenAICompatibleAdapter {
  constructor(config: ProviderConfig) {
    super(config);
  }

  async validateKey(): Promise<boolean> {
    await this.fetchJson<unknown>("/models", { method: "GET" });
    return true;
  }

  async getModels(): Promise<ModelMetadata[]> {
    const response = await this.fetchJson<{ data?: GenericModel[]; models?: GenericModel[] }>("/models", { method: "GET" });
    return (response.data ?? response.models ?? []).filter((model) => typeof model.id === "string").map((model) => this.mapModel(model));
  }

  async getQuota(): Promise<QuotaStatus> {
    return {
      providerId: this.id,
      windows: [],
      isExhausted: false,
      raw: { source: "generic_openai_adapter_no_quota_endpoint" },
      updatedAt: nowIso()
    };
  }

  supportsVision(): boolean {
    return hasCatalogCapability(this.config, "vision");
  }

  supportsTools(): boolean {
    return hasCatalogCapability(this.config, "tools");
  }

  supportsEmbeddings(): boolean {
    return hasCatalogCapability(this.config, "embeddings");
  }

  private mapModel(model: GenericModel): ModelMetadata {
    const id = model.id;
    const text = `${id} ${model.name ?? ""} ${model.display_name ?? ""} ${model.owned_by ?? ""}`.toLowerCase();
    const contextWindow =
      parseNumber(model.context_window) ??
      parseNumber(model.context_length) ??
      parseNumber(model.max_context_length) ??
      parseNumber(model.max_model_len);
    const maxOutputTokens = parseNumber(model.max_output_tokens) ?? parseNumber(model.max_tokens);
    const providerCapabilities = Array.isArray(this.config.metadata?.capabilities)
      ? (this.config.metadata.capabilities as string[])
      : [];

    const vision = providerCapabilities.includes("vision") && /vision|vl|image|gpt-4o|gemini|pixtral|llava|qwen-vl/i.test(text);
    const imageGeneration = providerCapabilities.includes("image-generation") && /image|sdxl|flux|stable|dall|imagen|kandinsky/i.test(text);
    const embeddings = providerCapabilities.includes("embeddings") && /embed|embedding|bge|e5|gte|nomic/i.test(text);
    const tools = providerCapabilities.includes("tools") && !embeddings && !imageGeneration;
    const coding = /code|coder|codestral|qwen|deepseek|devstral|starcoder/i.test(text);
    const reasoning = /reason|r1|thinking|o1|o3|sonar|nemotron|grok|kimi/i.test(text);
    const speed = /flash|instant|turbo|mini|small|8b|7b|3b|fast/i.test(text);
    const longContext = (contextWindow ?? 0) >= 64000 || /128k|200k|1m|long/i.test(text);

    return {
      id,
      providerId: this.id,
      displayName: model.display_name ?? model.name ?? id,
      contextWindow,
      maxOutputTokens,
      capabilities: {
        ...DEFAULT_MODEL_CAPABILITIES,
        vision,
        imageGeneration,
        embeddings,
        tools,
        longContext,
        local: this.config.type === "local-openai-compatible"
      },
      scores: {
        ...DEFAULT_CAPABILITY_SCORES,
        reasoning: reasoning ? 0.86 : 0.58,
        coding: coding ? 0.86 : 0.56,
        speed: speed ? 0.88 : 0.62,
        planning: reasoning ? 0.78 : 0.56,
        vision: vision ? 0.82 : 0,
        imageGeneration: imageGeneration ? 0.85 : 0,
        tools: tools ? 0.7 : 0.15,
        embeddings: embeddings ? 0.9 : 0,
        longContext: Math.min(1, (contextWindow ?? 0) / 200000),
        costEfficiency: this.config.freeTier === false ? 0.45 : 0.88
      },
      pricing: { currency: "UNKNOWN", raw: model.pricing },
      freeTier: this.config.freeTier ?? true,
      reliability: this.config.type === "local-openai-compatible" ? 0.92 : 0.74,
      health: "unknown",
      quota: {},
      strengths: [
        ...(coding ? ["coding"] : []),
        ...(reasoning ? ["reasoning"] : []),
        ...(speed ? ["speed"] : []),
        ...(vision ? ["vision"] : []),
        ...(imageGeneration ? ["image-generation"] : []),
        ...(embeddings ? ["embeddings"] : []),
        ...(longContext ? ["long-context"] : []),
        ...(this.config.type === "local-openai-compatible" ? ["local"] : [])
      ],
      raw: model,
      updatedAt: nowIso()
    };
  }
}

function hasCatalogCapability(config: ProviderConfig, capability: string): boolean {
  return Array.isArray(config.metadata?.capabilities) && (config.metadata.capabilities as string[]).includes(capability);
}
