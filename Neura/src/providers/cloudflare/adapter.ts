import type {
  GenerateRequest,
  GenerateResult,
  ProviderAdapter,
  ProviderConfig,
  ProviderHealth,
  StreamCallbacks
} from "../../types/provider";
import { ProviderError } from "../../types/provider";
import type { ModelMetadata } from "../../types/model";
import { DEFAULT_CAPABILITY_SCORES, DEFAULT_MODEL_CAPABILITIES } from "../../types/model";
import type { QuotaStatus } from "../../types/quota";
import type { TokenUsage } from "../../types/usage";
import {
  createId,
  estimateTokensFromMessages,
  normalizeBaseUrl,
  nowIso,
  parseRetryAfterMs,
  withTimeoutSignal
} from "../../utils/validators";

interface CloudflareRunResponse {
  success: boolean;
  result?: {
    response?: string;
    text?: string;
    content?: string;
    outputs?: Array<{ text?: string }>;
  };
  errors?: Array<{ message?: string }>;
}

interface CloudflareModelSearchResponse {
  success: boolean;
  result?: Array<{
    id: string;
    name?: string;
    task?: { id?: string };
    capabilities?: string[];
    description?: string;
  }>;
}

const COMMON_CLOUDFLARE_MODELS = [
  { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", name: "Llama 3.3 70B Instruct" },
  { id: "@cf/meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B Instruct" },
  { id: "@cf/meta/llama-3.1-70b-instruct", name: "Llama 3.1 70B Instruct" },
  { id: "@cf/meta/llama-3.1-8b-instruct-fast", name: "Llama 3.1 8B Instruct Fast" },
  { id: "@cf/meta/llama-3.1-70b-instruct-fast", name: "Llama 3.1 70B Instruct Fast" },
  { id: "@cf/mistral/mistral-7b-instruct-v0.2-lora", name: "Mistral 7B Instruct" },
  { id: "@hf/thebloke/deepseek-coder-6.7b-instruct-awq", name: "DeepSeek Coder 6.7B" },
  { id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", name: "DeepSeek R1 Distill Qwen 32B" },
  { id: "@hf/microsoft/phi-3-mini-4k-instruct-gguf", name: "Phi-3 Mini 4K" },
  { id: "@cf/google/gemma-2b-it-lora", name: "Gemma 2B IT" },
  { id: "@cf/qwen/qwen2.5-7b-instruct", name: "Qwen 2.5 7B Instruct" },
  { id: "@cf/qwen/qwen2.5-72b-instruct", name: "Qwen 2.5 72B Instruct" },
  { id: "@hf/nousresearch/hermes-2-pro-mistral-7b", name: "Hermes 2 Pro Mistral 7B" },
  { id: "@cf/tinyllama/tinyllama-1.1b-chat-v1.0", name: "TinyLlama 1.1B Chat" },
];

const CHAT_TEXT_MODELS = new Set(COMMON_CLOUDFLARE_MODELS.map((m) => m.id));

export class CloudflareAdapter implements ProviderAdapter {
  readonly id: string;
  readonly type = "cloudflare-workers-ai" as const;
  readonly displayName: string;
  readonly config: ProviderConfig;
  private readonly baseUrl: string;
  private readonly accountId: string;

  constructor(config: ProviderConfig) {
    this.id = config.id;
    this.displayName = config.displayName;
    this.config = config;
    // Base URL expected: https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai
    // User configures this with their account ID in the URL
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    // Try to extract account_id from the base URL for model search
    const match = this.baseUrl.match(/\/accounts\/([^/]+)/);
    this.accountId = match?.[1] ?? "";
  }

  async validateKey(): Promise<boolean> {
    // Use GET to the base URL to validate the API token without consuming credits
    // Cloudflare returns:
    //   401 - invalid/expired API token
    //   403 - valid token but wrong account ID
    //   404 - valid token + correct account (no endpoint at base URL)
    //   405 - valid token + correct account (method not allowed at base)
    const testResponse = await fetch(`${this.baseUrl}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${this.config.apiKey ?? ""}`
      }
    });
    return testResponse.status !== 401 && testResponse.status !== 403;
  }

  async getModels(): Promise<ModelMetadata[]> {
    let models: Array<{ id: string; name?: string; task?: { id?: string } }> = [];

    // Try to fetch from the model search API if we have an account ID
    if (this.accountId) {
      try {
        const response = await this.fetchJson<CloudflareModelSearchResponse>(
          `/models/search?per_page=100`,
          { method: "GET" }
        );
        if (response.success && response.result) {
          models = response.result;
        }
      } catch {
        // fallback to hardcoded list
      }
    }

    if (!models.length) {
      models = COMMON_CLOUDFLARE_MODELS;
    }

    return models
      .filter((m) => CHAT_TEXT_MODELS.has(m.id) || !m.id || m.task?.id === "text-generation")
      .map((model) => this.mapModel(model));
  }

  async getUsage(): Promise<TokenUsage | undefined> {
    return undefined;
  }

  async getQuota(): Promise<QuotaStatus> {
    return {
      providerId: this.id,
      windows: [],
      isExhausted: false,
      raw: { source: "cloudflare_quota_is_account_tier_specific" },
      updatedAt: nowIso()
    };
  }

  async healthCheck(): Promise<ProviderHealth> {
    const started = Date.now();
    try {
      await this.validateKey();
      return {
        providerId: this.id,
        healthy: true,
        latencyMs: Date.now() - started,
        checkedAt: nowIso()
      };
    } catch (error) {
      return {
        providerId: this.id,
        healthy: false,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : String(error),
        checkedAt: nowIso()
      };
    }
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const requestId = createId("req");
    const started = Date.now();
    const model = request.model;
    if (!model) {
      throw new ProviderError("No model was selected for Cloudflare generation", {
        providerId: this.id,
        code: "missing_model"
      });
    }

    const payload = buildCloudflarePayload(request);
    const response = await this.fetchJson<CloudflareRunResponse>(
      `/run/${model}`,
      { method: "POST", body: JSON.stringify(payload) },
      request.signal
    );

    if (!response.success) {
      const error = response.errors?.[0]?.message ?? "Cloudflare API returned unsuccessful response";
      throw new ProviderError(error, { providerId: this.id, code: "api_error" });
    }

    const text =
      response.result?.response ??
      response.result?.text ??
      response.result?.content ??
      response.result?.outputs?.[0]?.text ??
      "";

    return {
      requestId,
      providerId: this.id,
      modelId: model,
      text,
      usage: {
        promptTokens: estimateTokensFromMessages(request.messages),
        completionTokens: Math.max(1, Math.ceil(text.length / 4)),
        totalTokens: estimateTokensFromMessages(request.messages) + Math.max(1, Math.ceil(text.length / 4))
      },
      latencyMs: Date.now() - started,
      finishReason: undefined,
      raw: response
    };
  }

  async stream(request: GenerateRequest, callbacks: StreamCallbacks): Promise<GenerateResult> {
    // Cloudflare Workers AI doesn't support standard SSE streaming for most models
    // Fall back to non-streaming generate
    const result = await this.generate(request);
    await callbacks.onToken?.(result.text);
    await callbacks.onUsage?.(result.usage);
    await callbacks.onDone?.(result);
    return result;
  }

  supportsVision(modelId?: string): boolean {
    if (!modelId) return false;
    const id = modelId.toLowerCase();
    return id.includes("vision") || id.includes("vl") || id.includes("multimodal") || id.includes("llava");
  }

  supportsTools(): boolean {
    return false;
  }

  supportsEmbeddings(): boolean {
    return false;
  }

  private mapModel(model: { id: string; name?: string; task?: { id?: string } }): ModelMetadata {
    const id = model.id;
    const normalized = id.toLowerCase();
    const displayName = model.name ?? id;
    const isLarge = normalized.includes("70b") || normalized.includes("72b");
    const isFast = normalized.includes("fast");
    const vision = this.supportsVision(id);
    const coding = normalized.includes("code") || normalized.includes("coder") || normalized.includes("deepseek");
    const speed = isFast ? 0.9 : isLarge ? 0.58 : 0.78;

    return {
      id,
      providerId: this.id,
      displayName,
      contextWindow: normalized.includes("32k") ? 32768 : normalized.includes("128k") ? 128000 : 8192,
      maxOutputTokens: undefined,
      capabilities: {
        ...DEFAULT_MODEL_CAPABILITIES,
        vision,
        local: false,
        longContext: normalized.includes("128k") || normalized.includes("1m")
      },
      scores: {
        ...DEFAULT_CAPABILITY_SCORES,
        reasoning: isLarge ? 0.72 : 0.52,
        coding: coding ? 0.8 : 0.52,
        speed,
        planning: isLarge ? 0.68 : 0.5,
        vision: vision ? 0.7 : 0,
        costEfficiency: 0.9
      },
      pricing: { currency: "USD" },
      freeTier: true,
      reliability: 0.72,
      health: "unknown",
      quota: {},
      strengths: [
        ...(coding ? ["coding"] : []),
        ...(isFast ? ["speed"] : []),
        ...(isLarge ? ["quality"] : []),
        "edge-deployed"
      ],
      raw: model,
      updatedAt: nowIso()
    };
  }

  private async fetchJson<T>(path: string, init: RequestInit, parentSignal?: AbortSignal): Promise<T> {
    const response = await this.rawFetch(path, init, parentSignal);
    return (await response.json()) as T;
  }

  private async rawFetch(path: string, init: RequestInit, parentSignal?: AbortSignal): Promise<Response> {
    return withTimeoutSignal(
      this.config.timeoutMs,
      async (signal) => {
        const response = await fetch(`${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
          ...init,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.config.apiKey ?? ""}`,
            ...(this.config.defaultHeaders ?? {}),
            ...(init.headers ?? {})
          },
          signal
        });

        if (!response.ok) {
          await this.throwProviderError(response);
        }
        return response;
      },
      parentSignal
    );
  }

  private async throwProviderError(response: Response): Promise<never> {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { errors?: Array<{ message?: string }> };
      detail = body.errors?.[0]?.message ?? detail;
    } catch {
      detail = await response.text().catch(() => detail);
    }

    throw new ProviderError(`${this.displayName} request failed: ${detail}`, {
      providerId: this.id,
      status: response.status,
      code: response.status === 429 ? "rate_limited" : `http_${response.status}`,
      retryAfterMs: parseRetryAfterMs(response.headers)
    });
  }
}

function buildCloudflarePayload(request: GenerateRequest): Record<string, unknown> {
  const messages = request.messages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: typeof m.content === "string" ? m.content : m.content.map((p) => p.text ?? "").join("\n")
  }));

  return {
    messages,
    temperature: request.temperature ?? 0.3,
    max_tokens: request.maxTokens ?? 4096
  };
}
