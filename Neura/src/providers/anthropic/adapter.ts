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
  messageToText,
  normalizeBaseUrl,
  nowIso,
  parseRetryAfterMs,
  withTimeoutSignal
} from "../../utils/validators";

interface AnthropicModel {
  id: string;
  type: string;
  display_name?: string;
  created_at?: string;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicMessageResponse {
  id: string;
  type: string;
  role: string;
  content: AnthropicContentBlock[];
  model: string;
  stop_reason?: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicModelsResponse {
  data: AnthropicModel[];
}

interface AnthropicStreamEvent {
  type: string;
  message?: AnthropicMessageResponse;
  index?: number;
  content_block?: AnthropicContentBlock;
  delta?: { type?: string; text?: string; stop_reason?: string; stop_sequence?: string };
  usage?: { output_tokens: number };
}

const ANTHROPIC_VERSION = "2023-06-01";

const COMMON_CLAUDE_MODELS: AnthropicModel[] = [
  { id: "claude-sonnet-4-20250514", type: "model", display_name: "Claude Sonnet 4" },
  { id: "claude-3-5-sonnet-20241022", type: "model", display_name: "Claude 3.5 Sonnet" },
  { id: "claude-3-5-haiku-20241022", type: "model", display_name: "Claude 3.5 Haiku" },
  { id: "claude-3-opus-20240229", type: "model", display_name: "Claude 3 Opus" },
  { id: "claude-3-sonnet-20240229", type: "model", display_name: "Claude 3 Sonnet" },
  { id: "claude-3-haiku-20240307", type: "model", display_name: "Claude 3 Haiku" }
];

export class AnthropicAdapter implements ProviderAdapter {
  readonly id: string;
  readonly type = "anthropic-compatible" as const;
  readonly displayName: string;
  readonly config: ProviderConfig;
  private readonly baseUrl: string;

  constructor(config: ProviderConfig) {
    this.id = config.id;
    this.displayName = config.displayName;
    this.config = config;
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
  }

  async validateKey(): Promise<boolean> {
    // Use GET /v1/models which validates the key without consuming credits
    const response = await this.rawFetch("/v1/models", { method: "GET" });
    return response.ok;
  }

  async getModels(): Promise<ModelMetadata[]> {
    let models: AnthropicModel[] = [];
    try {
      const response = await this.fetchJson<AnthropicModelsResponse>("/v1/models", { method: "GET" });
      models = response.data ?? [];
    } catch {
      models = COMMON_CLAUDE_MODELS;
    }

    if (!models.length) {
      models = COMMON_CLAUDE_MODELS;
    }

    return models.map((model) => this.mapModel(model));
  }

  async getUsage(): Promise<TokenUsage | undefined> {
    return undefined;
  }

  async getQuota(): Promise<QuotaStatus> {
    return {
      providerId: this.id,
      windows: [],
      isExhausted: false,
      raw: { source: "anthropic_quota_is_api_key_tier_specific" },
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
      throw new ProviderError("No model was selected for Anthropic generation", {
        providerId: this.id,
        code: "missing_model"
      });
    }

    const payload = buildAnthropicPayload(request);
    const response = await this.fetchJson<AnthropicMessageResponse>(
      "/v1/messages",
      { method: "POST", body: JSON.stringify(payload) },
      request.signal
    );

    const text = response.content?.map((block) => block.text ?? "").join("") ?? "";
    return {
      requestId,
      providerId: this.id,
      modelId: response.model ?? model,
      text,
      usage: {
        promptTokens: response.usage?.input_tokens ?? estimateTokensFromMessages(request.messages),
        completionTokens: response.usage?.output_tokens ?? Math.max(1, Math.ceil(text.length / 4)),
        totalTokens:
          (response.usage?.input_tokens ?? estimateTokensFromMessages(request.messages)) +
          (response.usage?.output_tokens ?? Math.max(1, Math.ceil(text.length / 4)))
      },
      latencyMs: Date.now() - started,
      finishReason: response.stop_reason,
      raw: response
    };
  }

  async stream(request: GenerateRequest, callbacks: StreamCallbacks): Promise<GenerateResult> {
    const requestId = createId("req");
    const started = Date.now();
    const model = request.model;
    if (!model) {
      throw new ProviderError("No model was selected for Anthropic streaming", {
        providerId: this.id,
        code: "missing_model"
      });
    }

    const response = await this.rawFetch(
      "/v1/messages",
      {
        method: "POST",
        body: JSON.stringify({ ...buildAnthropicPayload(request), stream: true })
      },
      request.signal
    );

    if (!response.body) {
      throw new ProviderError("Anthropic returned an empty stream body", { providerId: this.id, status: response.status });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let inputTokens = estimateTokensFromMessages(request.messages);
    let outputTokens = 0;
    let finishReason: string | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6).trim();
        if (!data) continue;

        const event = JSON.parse(data) as AnthropicStreamEvent;

        switch (event.type) {
          case "content_block_delta":
            if (event.delta?.text) {
              text += event.delta.text;
              await callbacks.onToken?.(event.delta.text);
            }
            break;
          case "message_delta":
            if (event.delta?.stop_reason) {
              finishReason = event.delta.stop_reason;
            }
            if (event.usage?.output_tokens) {
              outputTokens = event.usage.output_tokens;
            }
            break;
          case "message_start":
            if (event.message?.usage?.input_tokens) {
              inputTokens = event.message.usage.input_tokens;
            }
            break;
        }
      }
    }

    const result: GenerateResult = {
      requestId,
      providerId: this.id,
      modelId: model,
      text,
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens || Math.max(1, Math.ceil(text.length / 4)),
        totalTokens: inputTokens + (outputTokens || Math.max(1, Math.ceil(text.length / 4)))
      },
      latencyMs: Date.now() - started,
      finishReason
    };
    await callbacks.onUsage?.(result.usage);
    await callbacks.onDone?.(result);
    return result;
  }

  supportsVision(modelId?: string): boolean {
    if (!modelId) return true;
    const id = modelId.toLowerCase();
    return id.includes("sonnet") || id.includes("opus");
  }

  supportsTools(modelId?: string): boolean {
    return true;
  }

  supportsEmbeddings(): boolean {
    return false;
  }

  private mapModel(model: AnthropicModel): ModelMetadata {
    const id = model.id;
    const normalized = id.toLowerCase();
    const displayName = model.display_name ?? model.id;
    const isOpus = normalized.includes("opus");
    const isSonnet = normalized.includes("sonnet");
    const isHaiku = normalized.includes("haiku");
    const isLatest = normalized.includes("2025") || normalized.includes("4-");
    const reasoning = isOpus ? 0.92 : isSonnet ? 0.82 : 0.7;
    const coding = isOpus ? 0.9 : isSonnet ? 0.85 : 0.68;
    const speed = isHaiku ? 0.92 : isSonnet ? 0.78 : 0.55;

    return {
      id,
      providerId: this.id,
      displayName,
      contextWindow: isLatest ? 200000 : isSonnet ? 200000 : 200000,
      maxOutputTokens: 8192,
      capabilities: {
        ...DEFAULT_MODEL_CAPABILITIES,
        vision: isSonnet || isOpus,
        tools: true,
        longContext: true
      },
      scores: {
        ...DEFAULT_CAPABILITY_SCORES,
        reasoning,
        coding,
        speed,
        planning: reasoning,
        creativity: 0.78,
        vision: isSonnet || isOpus ? 0.88 : 0.1,
        tools: 0.85,
        longContext: 0.9,
        costEfficiency: isHaiku ? 0.92 : isSonnet ? 0.72 : 0.45
      },
      pricing: { currency: "USD" },
      freeTier: false,
      reliability: 0.88,
      health: "unknown",
      quota: {},
      strengths: [
        ...(coding ? ["coding"] : []),
        ...(reasoning >= 0.82 ? ["reasoning"] : []),
        ...(speed >= 0.85 ? ["speed"] : []),
        ...(isSonnet || isOpus ? ["vision"] : []),
        "long-context"
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
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          headers: {
            "content-type": "application/json",
            "x-api-key": this.config.apiKey ?? "",
            "anthropic-version": ANTHROPIC_VERSION,
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
      const body = (await response.json()) as { error?: { message?: string } };
      detail = body.error?.message ?? detail;
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

function buildAnthropicPayload(request: GenerateRequest): Record<string, unknown> {
  const systemMessages = request.messages.filter((m) => m.role === "system");
  const nonSystemMessages = request.messages.filter((m) => m.role !== "system");

  const payload: Record<string, unknown> = {
    model: request.model,
    max_tokens: request.maxTokens ?? 4096,
    messages: nonSystemMessages.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: messageToText(m)
    })),
    temperature: request.temperature ?? 0.3
  };

  if (systemMessages.length > 0) {
    payload.system = systemMessages.map((m) => messageToText(m)).join("\n\n");
  }

  return payload;
}
