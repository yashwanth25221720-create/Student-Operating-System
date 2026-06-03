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

interface OllamaTagResponse {
  models?: OllamaModel[];
}

interface OllamaModel {
  name: string;
  model?: string;
  modified_at?: string;
  size?: number;
  digest?: string;
  details?: {
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface OllamaChatResponse {
  model?: string;
  message?: {
    role?: string;
    content?: string;
  };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
}

export class OllamaAdapter implements ProviderAdapter {
  readonly id: string;
  readonly type = "ollama" as const;
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
    await this.fetchJson<unknown>("/api/tags", { method: "GET" });
    return true;
  }

  async getModels(): Promise<ModelMetadata[]> {
    const response = await this.fetchJson<OllamaTagResponse>("/api/tags", { method: "GET" });
    return (response.models ?? []).map((model) => this.mapModel(model));
  }

  async getUsage(): Promise<TokenUsage | undefined> {
    return undefined;
  }

  async getQuota(): Promise<QuotaStatus> {
    return {
      providerId: this.id,
      windows: [],
      isExhausted: false,
      raw: { source: "local_runtime_no_remote_quota" },
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
      throw new ProviderError("No model was selected for Ollama generation", {
        providerId: this.id,
        code: "missing_model"
      });
    }

    const response = await this.fetchJson<OllamaChatResponse>(
      "/api/chat",
      {
        method: "POST",
        body: JSON.stringify({
          model,
          messages: toOllamaMessages(request),
          stream: false,
          tools: request.tools,
          format: request.responseFormat === "json" ? "json" : undefined,
          options: {
            temperature: request.temperature,
            num_predict: request.maxTokens
          }
        })
      },
      request.signal
    );

    const text = response.message?.content ?? "";
    return {
      requestId,
      providerId: this.id,
      modelId: response.model ?? model,
      text,
      usage: {
        promptTokens: response.prompt_eval_count ?? estimateTokensFromMessages(request.messages),
        completionTokens: response.eval_count ?? Math.max(1, Math.ceil(text.length / 4)),
        totalTokens:
          (response.prompt_eval_count ?? estimateTokensFromMessages(request.messages)) +
          (response.eval_count ?? Math.max(1, Math.ceil(text.length / 4)))
      },
      latencyMs: Date.now() - started,
      finishReason: response.done_reason,
      raw: response
    };
  }

  async stream(request: GenerateRequest, callbacks: StreamCallbacks): Promise<GenerateResult> {
    const requestId = createId("req");
    const started = Date.now();
    const model = request.model;
    if (!model) {
      throw new ProviderError("No model was selected for Ollama streaming", {
        providerId: this.id,
        code: "missing_model"
      });
    }

    const response = await this.rawFetch(
      "/api/chat",
      {
        method: "POST",
        body: JSON.stringify({
          model,
          messages: toOllamaMessages(request),
          stream: true,
          tools: request.tools,
          format: request.responseFormat === "json" ? "json" : undefined,
          options: {
            temperature: request.temperature,
            num_predict: request.maxTokens
          }
        })
      },
      request.signal
    );

    if (!response.body) {
      throw new ProviderError("Ollama returned an empty stream body", { providerId: this.id, status: response.status });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let promptTokens = estimateTokensFromMessages(request.messages);
    let completionTokens = 0;
    let finishReason: string | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        const chunk = JSON.parse(line) as OllamaChatResponse;
        const token = chunk.message?.content ?? "";
        if (token) {
          text += token;
          await callbacks.onToken?.(token);
        }
        if (chunk.prompt_eval_count !== undefined) {
          promptTokens = chunk.prompt_eval_count;
        }
        if (chunk.eval_count !== undefined) {
          completionTokens = chunk.eval_count;
        }
        finishReason = chunk.done_reason ?? finishReason;
      }
    }

    const result: GenerateResult = {
      requestId,
      providerId: this.id,
      modelId: model,
      text,
      usage: {
        promptTokens,
        completionTokens: completionTokens || Math.max(1, Math.ceil(text.length / 4)),
        totalTokens: promptTokens + (completionTokens || Math.max(1, Math.ceil(text.length / 4)))
      },
      latencyMs: Date.now() - started,
      finishReason
    };
    await callbacks.onUsage?.(result.usage);
    await callbacks.onDone?.(result);
    return result;
  }

  supportsVision(modelId?: string): boolean {
    return modelId ? /llava|bakllava|vision|vl|gemma3/i.test(modelId) : true;
  }

  supportsTools(modelId?: string): boolean {
    return modelId ? /llama3|qwen|mistral|command|tools/i.test(modelId) : true;
  }

  supportsEmbeddings(modelId?: string): boolean {
    return modelId ? /embed|embedding|nomic/i.test(modelId) : true;
  }

  private mapModel(model: OllamaModel): ModelMetadata {
    const id = model.model ?? model.name;
    const normalized = id.toLowerCase();
    const families = model.details?.families ?? [model.details?.family].filter(Boolean);
    const vision = this.supportsVision(id);
    const embeddings = this.supportsEmbeddings(id);
    const tools = this.supportsTools(id);
    const parameterSize = model.details?.parameter_size ?? "";
    const largeModel = /70b|72b|120b|405b/i.test(parameterSize) || /70b|72b|120b|405b/i.test(id);

    return {
      id,
      providerId: this.id,
      displayName: id,
      contextWindow: undefined,
      maxOutputTokens: undefined,
      capabilities: {
        ...DEFAULT_MODEL_CAPABILITIES,
        vision,
        tools,
        embeddings,
        local: true,
        longContext: /32k|64k|128k|long/i.test(id)
      },
      scores: {
        ...DEFAULT_CAPABILITY_SCORES,
        reasoning: largeModel ? 0.78 : 0.58,
        coding: /coder|code|qwen|deepseek/i.test(id) ? 0.82 : 0.56,
        speed: largeModel ? 0.45 : 0.74,
        planning: largeModel ? 0.72 : 0.55,
        vision: vision ? 0.7 : 0,
        tools: tools ? 0.6 : 0.15,
        longContext: /32k|64k|128k|long/i.test(id) ? 0.75 : 0.3,
        costEfficiency: 1
      },
      pricing: { currency: "USD", promptPer1K: 0, completionPer1K: 0, request: 0 },
      freeTier: true,
      reliability: 0.95,
      health: "unknown",
      quota: {},
      strengths: ["offline", ...(families.filter((item): item is string => typeof item === "string"))],
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
    const detail = await response.text().catch(() => response.statusText);
    throw new ProviderError(`${this.displayName} request failed: ${detail || response.statusText}`, {
      providerId: this.id,
      status: response.status,
      code: response.status === 429 ? "rate_limited" : `http_${response.status}`,
      retryAfterMs: parseRetryAfterMs(response.headers)
    });
  }
}

function toOllamaMessages(request: GenerateRequest): Array<Record<string, unknown>> {
  return request.messages.map((message) => {
    if (typeof message.content === "string") {
      return {
        role: message.role === "tool" ? "user" : message.role,
        content: message.content
      };
    }

    const images = message.content
      .filter((part) => part.type === "image_url" && part.imageUrl?.startsWith("data:"))
      .map((part) => part.imageUrl?.split(",", 2)[1])
      .filter((value): value is string => Boolean(value));

    return {
      role: message.role === "tool" ? "user" : message.role,
      content: message.content.map((part) => part.text ?? "").join("\n"),
      images: images.length ? images : undefined
    };
  });
}
