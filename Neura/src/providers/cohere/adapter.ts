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

interface CohereChatResponse {
  message?: {
    role?: string;
    content?: Array<{ type?: string; text?: string }>;
  };
  text?: string;
  generation_id?: string;
  finish_reason?: string;
  meta?: {
    tokens?: {
      input_tokens?: number;
      output_tokens?: number;
    };
    billed_units?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
  citations?: unknown[];
  documents?: unknown[];
}

interface CohereStreamChunk {
  event_type: string;
  text?: string;
  generation_id?: string;
  finish_reason?: string;
  response?: CohereChatResponse;
  meta?: CohereChatResponse["meta"];
}

interface CohereModel {
  name: string;
  endpoints?: string[];
  context_length?: number;
  description?: string;
  tokenizer?: string;
  supports_streaming?: boolean;
}

interface CohereModelsResponse {
  models: CohereModel[];
}

const COMMON_COHERE_MODELS: CohereModel[] = [
  { name: "command-r-plus-08-2024", endpoints: ["chat"], context_length: 128000 },
  { name: "command-r-08-2024", endpoints: ["chat"], context_length: 128000 },
  { name: "command-r-plus", endpoints: ["chat"], context_length: 128000 },
  { name: "command-r", endpoints: ["chat"], context_length: 128000 },
  { name: "command-light", endpoints: ["chat"], context_length: 4096 },
  { name: "command", endpoints: ["chat"], context_length: 4096 }
];

export class CohereAdapter implements ProviderAdapter {
  readonly id: string;
  readonly type = "cohere-compatible" as const;
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
    const response = await this.rawFetch("/v2/models", { method: "GET" });
    return response.ok;
  }

  async getModels(): Promise<ModelMetadata[]> {
    let models: CohereModel[] = [];
    try {
      const response = await this.fetchJson<CohereModelsResponse>("/v2/models", { method: "GET" });
      models = (response.models ?? []).filter((m) => m.endpoints?.includes("chat"));
    } catch {
      models = COMMON_COHERE_MODELS;
    }

    if (!models.length) {
      models = COMMON_COHERE_MODELS;
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
      raw: { source: "cohere_quota_is_api_key_tier_specific" },
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
      throw new ProviderError("No model was selected for Cohere generation", {
        providerId: this.id,
        code: "missing_model"
      });
    }

    const payload = buildCoherePayload(request);
    const response = await this.fetchJson<CohereChatResponse>(
      "/v2/chat",
      { method: "POST", body: JSON.stringify(payload) },
      request.signal
    );

    const text =
      response.message?.content?.map((c) => c.text ?? "").join("") ?? response.text ?? "";

    const inputTokens =
      response.meta?.tokens?.input_tokens ??
      response.meta?.billed_units?.input_tokens ??
      estimateTokensFromMessages(request.messages);
    const outputTokens =
      response.meta?.tokens?.output_tokens ??
      response.meta?.billed_units?.output_tokens ??
      Math.max(1, Math.ceil(text.length / 4));

    return {
      requestId,
      providerId: this.id,
      modelId: model,
      text,
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens
      },
      latencyMs: Date.now() - started,
      finishReason: response.finish_reason,
      raw: response
    };
  }

  async stream(request: GenerateRequest, callbacks: StreamCallbacks): Promise<GenerateResult> {
    const requestId = createId("req");
    const started = Date.now();
    const model = request.model;
    if (!model) {
      throw new ProviderError("No model was selected for Cohere streaming", {
        providerId: this.id,
        code: "missing_model"
      });
    }

    const response = await this.rawFetch(
      "/v2/chat",
      {
        method: "POST",
        body: JSON.stringify({ ...buildCoherePayload(request), stream: true })
      },
      request.signal
    );

    if (!response.body) {
      throw new ProviderError("Cohere returned an empty stream body", { providerId: this.id, status: response.status });
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
        if (!trimmed) continue;

        try {
          const chunk = JSON.parse(trimmed) as CohereStreamChunk;
          switch (chunk.event_type) {
            case "text-generation":
              if (chunk.text) {
                text += chunk.text;
                await callbacks.onToken?.(chunk.text);
              }
              break;
            case "stream-end":
              if (chunk.response) {
                text =
                  chunk.response.message?.content?.map((c) => c.text ?? "").join("") ??
                  chunk.response.text ??
                  text;
                finishReason = chunk.finish_reason ?? chunk.response.finish_reason;
                if (chunk.response.meta?.tokens) {
                  inputTokens = chunk.response.meta.tokens.input_tokens ?? inputTokens;
                  outputTokens = chunk.response.meta.tokens.output_tokens ?? outputTokens;
                }
              }
              break;
            case "stream-start":
              if (chunk.meta?.tokens) {
                inputTokens = chunk.meta.tokens.input_tokens ?? inputTokens;
              }
              break;
          }
        } catch {
          // skip malformed JSON lines
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

  supportsVision(): boolean {
    return false;
  }

  supportsTools(): boolean {
    return true;
  }

  supportsEmbeddings(): boolean {
    return true;
  }

  private mapModel(model: CohereModel): ModelMetadata {
    const id = model.name;
    const normalized = id.toLowerCase();
    const isPlus = normalized.includes("plus");
    const isLight = normalized.includes("light");
    const isR = normalized.includes("r-");
    const contextWindow = model.context_length ?? 4096;

    return {
      id,
      providerId: this.id,
      displayName: model.name,
      contextWindow,
      maxOutputTokens: 4096,
      capabilities: {
        ...DEFAULT_MODEL_CAPABILITIES,
        tools: true,
        embeddings: true,
        longContext: contextWindow >= 128000,
        reranking: true
      },
      scores: {
        ...DEFAULT_CAPABILITY_SCORES,
        reasoning: isR ? 0.8 : 0.7,
        coding: isR ? 0.68 : 0.58,
        speed: isLight ? 0.9 : 0.68,
        planning: isR ? 0.74 : 0.62,
        tools: 0.82,
        embeddings: 0.88,
        longContext: Math.min(1, contextWindow / 200000),
        costEfficiency: isLight ? 0.95 : isR ? 0.82 : 0.78
      },
      pricing: { currency: "USD" },
      freeTier: false,
      reliability: 0.84,
      health: "unknown",
      quota: {},
      strengths: [
        ...(isR ? ["reasoning", "rag"] : []),
        ...(isLight ? ["speed"] : []),
        "embeddings",
        "tools"
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
      const body = (await response.json()) as { message?: string; error?: string };
      detail = body.message ?? body.error ?? detail;
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

function buildCoherePayload(request: GenerateRequest): Record<string, unknown> {
  const systemMessages = request.messages.filter((m) => m.role === "system");
  const chatMessages = request.messages.filter((m) => m.role !== "system");

  const payload: Record<string, unknown> = {
    model: request.model,
    message: chatMessages.length > 0 ? getMessageText(chatMessages[chatMessages.length - 1]) : "",
    chat_history: chatMessages.slice(0, -1).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      message: getMessageText(m)
    })),
    temperature: request.temperature ?? 0.3,
    max_tokens: request.maxTokens ?? 4096
  };

  if (systemMessages.length > 0) {
    payload.preamble = systemMessages.map((m) => getMessageText(m)).join("\n\n");
  }

  if (request.responseFormat === "json") {
    payload.response_format = { type: "json_object" };
  }

  return payload;
}

function getMessageText(message: { role: string; content: string | Array<{ type: string; text?: string }> }): string {
  if (typeof message.content === "string") return message.content;
  return message.content.map((part) => part.text ?? "").join("\n");
}
