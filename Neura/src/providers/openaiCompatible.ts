import type {
  GenerateRequest,
  GenerateResult,
  ProviderAdapter,
  ProviderConfig,
  ProviderHealth,
  ProviderType,
  StreamCallbacks
} from "../types/provider";
import { ProviderError } from "../types/provider";
import type { ModelMetadata } from "../types/model";
import type { QuotaStatus } from "../types/quota";
import type { TokenUsage } from "../types/usage";
import {
  createId,
  estimateTokensFromMessages,
  normalizeBaseUrl,
  nowIso,
  parseRetryAfterMs,
  withTimeoutSignal
} from "../utils/validators";

interface ChatCompletionResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: { content?: string };
    text?: string;
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface ChatCompletionChunk {
  model?: string;
  choices?: Array<{
    delta?: { content?: string };
    text?: string;
    finish_reason?: string;
  }>;
  usage?: ChatCompletionResponse["usage"];
}

export abstract class OpenAICompatibleAdapter implements ProviderAdapter {
  readonly id: string;
  readonly type: ProviderType;
  readonly displayName: string;
  readonly config: ProviderConfig;
  protected readonly baseUrl: string;

  protected constructor(config: ProviderConfig) {
    this.id = config.id;
    this.type = config.type;
    this.displayName = config.displayName;
    this.config = config;
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
  }

  abstract validateKey(): Promise<boolean>;
  abstract getModels(): Promise<ModelMetadata[]>;
  abstract getQuota(): Promise<QuotaStatus>;

  async getUsage(): Promise<TokenUsage | undefined> {
    return undefined;
  }

  async healthCheck(): Promise<ProviderHealth> {
    const started = Date.now();
    try {
      await this.fetchJson<unknown>("/models", { method: "GET" });
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
      throw new ProviderError("No model was selected for generation", { providerId: this.id, code: "missing_model" });
    }

    const body = {
      model,
      messages: toOpenAiMessages(request.messages),
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      tools: request.tools,
      stream: false,
      response_format: request.responseFormat === "json" ? { type: "json_object" } : undefined
    };

    const response = await this.fetchJson<ChatCompletionResponse>(
      "/chat/completions",
      {
        method: "POST",
        body: JSON.stringify(stripUndefined(body))
      },
      request.signal
    );

    const text = response.choices?.[0]?.message?.content ?? response.choices?.[0]?.text ?? "";
    const usage = normalizeUsage(response.usage, estimateTokensFromMessages(request.messages), text);

    return {
      requestId,
      providerId: this.id,
      modelId: response.model ?? model,
      text,
      usage,
      latencyMs: Date.now() - started,
      finishReason: response.choices?.[0]?.finish_reason,
      raw: response
    };
  }

  async stream(request: GenerateRequest, callbacks: StreamCallbacks): Promise<GenerateResult> {
    const requestId = createId("req");
    const started = Date.now();
    const model = request.model;
    if (!model) {
      throw new ProviderError("No model was selected for streaming", { providerId: this.id, code: "missing_model" });
    }

    const response = await this.rawFetch(
      "/chat/completions",
      {
        method: "POST",
        body: JSON.stringify(
          stripUndefined({
            model,
            messages: toOpenAiMessages(request.messages),
            temperature: request.temperature,
            max_tokens: request.maxTokens,
            tools: request.tools,
            stream: true,
            stream_options: { include_usage: true },
            response_format: request.responseFormat === "json" ? { type: "json_object" } : undefined
          })
        )
      },
      request.signal
    );

    if (!response.body) {
      throw new ProviderError("Provider returned an empty stream body", { providerId: this.id, status: response.status });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let finishReason: string | undefined;
    let streamedUsage: TokenUsage | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        const dataLines = event
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim());

        for (const data of dataLines) {
          if (!data || data === "[DONE]") {
            continue;
          }
          const chunk = JSON.parse(data) as ChatCompletionChunk;
          const token = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.text ?? "";
          if (token) {
            text += token;
            await callbacks.onToken?.(token);
          }
          finishReason = chunk.choices?.[0]?.finish_reason ?? finishReason;
          if (chunk.usage) {
            streamedUsage = normalizeUsage(chunk.usage, estimateTokensFromMessages(request.messages), text);
            await callbacks.onUsage?.(streamedUsage);
          }
        }
      }
    }

    const result: GenerateResult = {
      requestId,
      providerId: this.id,
      modelId: model,
      text,
      usage: streamedUsage ?? normalizeUsage(undefined, estimateTokensFromMessages(request.messages), text),
      latencyMs: Date.now() - started,
      finishReason
    };
    await callbacks.onDone?.(result);
    return result;
  }

  supportsVision(): boolean {
    return false;
  }

  supportsTools(): boolean {
    return false;
  }

  supportsEmbeddings(): boolean {
    return false;
  }

  protected async fetchJson<T>(path: string, init: RequestInit, parentSignal?: AbortSignal): Promise<T> {
    const response = await this.rawFetch(path, init, parentSignal);
    return (await response.json()) as T;
  }

  protected async rawFetch(path: string, init: RequestInit, parentSignal?: AbortSignal): Promise<Response> {
    return withTimeoutSignal(
      this.config.timeoutMs,
      async (signal) => {
        const response = await fetch(`${this.baseUrl}${path}`, {
          ...init,
          headers: this.headers(init.headers),
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

  protected headers(extra?: HeadersInit): HeadersInit {
    return {
      "content-type": "application/json",
      authorization: `Bearer ${this.config.apiKey ?? ""}`,
      ...(this.config.defaultHeaders ?? {}),
      ...(extra ?? {})
    };
  }

  protected async throwProviderError(response: Response): Promise<never> {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { error?: { message?: string; code?: string }; message?: string };
      detail = body.error?.message ?? body.message ?? detail;
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

export function normalizeUsage(
  usage: ChatCompletionResponse["usage"] | undefined,
  promptEstimate: number,
  text: string
): TokenUsage {
  const completionEstimate = Math.max(1, Math.ceil(text.length / 4));
  const promptTokens = usage?.prompt_tokens ?? promptEstimate;
  const completionTokens = usage?.completion_tokens ?? completionEstimate;
  return {
    promptTokens,
    completionTokens,
    totalTokens: usage?.total_tokens ?? promptTokens + completionTokens
  };
}

export function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function toOpenAiMessages(messages: GenerateRequest["messages"]): Array<Record<string, unknown>> {
  return messages.map((message) => ({
    role: message.role,
    name: message.name,
    tool_call_id: message.toolCallId,
    content:
      typeof message.content === "string"
        ? message.content
        : message.content.map((part) =>
            part.type === "image_url"
              ? { type: "image_url", image_url: { url: part.imageUrl } }
              : { type: "text", text: part.text ?? "" }
          )
  }));
}
