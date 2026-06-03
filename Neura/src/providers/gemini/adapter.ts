import type {
  GenerateRequest,
  GenerateResult,
  LLMMessage,
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

interface GeminiModel {
  name: string;
  baseModelId?: string;
  version?: string;
  displayName?: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
  supportedActions?: string[];
}

interface GeminiContent {
  role?: "user" | "model";
  parts: Array<Record<string, unknown>>;
}

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export class GeminiAdapter implements ProviderAdapter {
  readonly id: string;
  readonly type = "gemini" as const;
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
    await this.fetchJson<unknown>("/models", { method: "GET" });
    return true;
  }

  async getModels(): Promise<ModelMetadata[]> {
    const models: GeminiModel[] = [];
    let pageToken: string | undefined;

    do {
      const params = new URLSearchParams({ pageSize: "1000" });
      if (pageToken) {
        params.set("pageToken", pageToken);
      }
      const response = await this.fetchJson<{ models?: GeminiModel[]; nextPageToken?: string }>(`/models?${params}`, {
        method: "GET"
      });
      models.push(...(response.models ?? []));
      pageToken = response.nextPageToken;
    } while (pageToken);

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
      raw: { source: "provider_quota_is_project_tier_specific" },
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
      throw new ProviderError("No model was selected for Gemini generation", {
        providerId: this.id,
        code: "missing_model"
      });
    }

    const payload = buildGeminiPayload(request);
    const response = await this.fetchJson<GeminiGenerateResponse>(
      `/${model}:generateContent`,
      {
        method: "POST",
        body: JSON.stringify(payload)
      },
      request.signal
    );

    const text = extractGeminiText(response);
    return {
      requestId,
      providerId: this.id,
      modelId: model,
      text,
      usage: geminiUsage(response, request.messages, text),
      latencyMs: Date.now() - started,
      finishReason: response.candidates?.[0]?.finishReason,
      raw: response
    };
  }

  async stream(request: GenerateRequest, callbacks: StreamCallbacks): Promise<GenerateResult> {
    const requestId = createId("req");
    const started = Date.now();
    const model = request.model;
    if (!model) {
      throw new ProviderError("No model was selected for Gemini streaming", {
        providerId: this.id,
        code: "missing_model"
      });
    }

    const response = await this.rawFetch(
      `/${model}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        body: JSON.stringify(buildGeminiPayload(request))
      },
      request.signal
    );

    if (!response.body) {
      throw new ProviderError("Gemini returned an empty stream body", { providerId: this.id, status: response.status });
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let usage: TokenUsage | undefined;
    let finishReason: string | undefined;

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

        for (const line of dataLines) {
          if (!line) {
            continue;
          }
          const chunk = JSON.parse(line) as GeminiGenerateResponse;
          const token = extractGeminiText(chunk);
          if (token) {
            text += token;
            await callbacks.onToken?.(token);
          }
          finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
          if (chunk.usageMetadata) {
            usage = geminiUsage(chunk, request.messages, text);
            await callbacks.onUsage?.(usage);
          }
        }
      }
    }

    const result: GenerateResult = {
      requestId,
      providerId: this.id,
      modelId: model,
      text,
      usage: usage ?? fallbackUsage(request.messages, text),
      latencyMs: Date.now() - started,
      finishReason
    };
    await callbacks.onDone?.(result);
    return result;
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

  private mapModel(model: GeminiModel): ModelMetadata {
    const methods = model.supportedGenerationMethods ?? model.supportedActions ?? [];
    const id = model.name;
    const normalized = id.toLowerCase();
    const description = `${model.displayName ?? ""} ${model.description ?? ""}`.toLowerCase();
    const supportsGenerate = methods.includes("generateContent");
    const supportsEmbed = methods.includes("embedContent");
    const imageGeneration = /imagen|image|banana/.test(normalized) || /image generation|preview image|imagen/.test(description);
    const audio = /audio|tts|lyria/.test(normalized) || /audio|tts|music/.test(description);
    const vision =
      normalized.includes("vision") ||
      normalized.includes("gemini") ||
      imageGeneration ||
      model.description?.toLowerCase().includes("image") === true;
    const longContext = (model.inputTokenLimit ?? 0) >= 100000;

    return {
      id,
      providerId: this.id,
      displayName: model.displayName ?? model.baseModelId ?? model.name,
      contextWindow: model.inputTokenLimit,
      maxOutputTokens: model.outputTokenLimit,
      capabilities: {
        ...DEFAULT_MODEL_CAPABILITIES,
        text: supportsGenerate,
        vision,
        imageGeneration,
        audio,
        tools: supportsGenerate,
        embeddings: supportsEmbed,
        jsonMode: supportsGenerate,
        longContext
      },
      scores: {
        ...DEFAULT_CAPABILITY_SCORES,
        reasoning: normalized.includes("pro") ? 0.86 : 0.68,
        coding: normalized.includes("pro") ? 0.74 : 0.62,
        speed: normalized.includes("flash") ? 0.92 : 0.62,
        planning: normalized.includes("pro") ? 0.85 : 0.68,
        creativity: 0.72,
        vision: vision ? 0.9 : 0,
        imageGeneration: imageGeneration ? 0.9 : 0,
        tools: supportsGenerate ? 0.75 : 0,
        embeddings: supportsEmbed ? 0.9 : 0,
        longContext: Math.min(1, (model.inputTokenLimit ?? 0) / 1000000),
        costEfficiency: normalized.includes("flash") ? 0.95 : 0.78
      },
      pricing: { currency: "UNKNOWN" },
      freeTier: this.config.freeTier ?? true,
      reliability: 0.84,
      health: "unknown",
      quota: {},
      strengths: [...(vision ? ["vision"] : []), ...(imageGeneration ? ["image-generation"] : []), ...(audio ? ["audio"] : [])],
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
        const separator = path.includes("?") ? "&" : "?";
        const response = await fetch(`${this.baseUrl}${path}${separator}key=${encodeURIComponent(this.config.apiKey ?? "")}`, {
          ...init,
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": this.config.apiKey ?? "",
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
      const body = (await response.json()) as { error?: { message?: string; status?: string } };
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

function buildGeminiPayload(request: GenerateRequest): Record<string, unknown> {
  const systemText = request.messages
    .filter((message) => message.role === "system")
    .map(messageToText)
    .join("\n\n");

  const contents = request.messages.filter((message) => message.role !== "system").map(messageToGeminiContent);

  return {
    contents,
    systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
    generationConfig: {
      temperature: request.temperature,
      maxOutputTokens: request.maxTokens,
      responseMimeType: request.responseFormat === "json" ? "application/json" : undefined
    },
    tools: request.tools?.length
      ? [
          {
            functionDeclarations: request.tools.map((tool) => ({
              name: tool.function.name,
              description: tool.function.description,
              parameters: tool.function.parameters
            }))
          }
        ]
      : undefined
  };
}

function messageToGeminiContent(message: LLMMessage): GeminiContent {
  const role = message.role === "assistant" ? "model" : "user";
  if (typeof message.content === "string") {
    return { role, parts: [{ text: message.content }] };
  }

  return {
    role,
    parts: message.content.map((part) => {
      if (part.type === "image_url" && part.imageUrl) {
        if (part.imageUrl.startsWith("data:")) {
          const [metadata, data] = part.imageUrl.split(",", 2);
          const mimeType = metadata.match(/^data:(.*?);base64/)?.[1] ?? "image/png";
          return { inlineData: { mimeType, data } };
        }
        return { fileData: { fileUri: part.imageUrl } };
      }
      return { text: part.text ?? "" };
    })
  };
}

function extractGeminiText(response: GeminiGenerateResponse): string {
  return response.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
}

function geminiUsage(response: GeminiGenerateResponse, messages: LLMMessage[], text: string): TokenUsage {
  const promptTokens = response.usageMetadata?.promptTokenCount ?? estimateTokensFromMessages(messages);
  const completionTokens = response.usageMetadata?.candidatesTokenCount ?? Math.max(1, Math.ceil(text.length / 4));
  return {
    promptTokens,
    completionTokens,
    totalTokens: response.usageMetadata?.totalTokenCount ?? promptTokens + completionTokens
  };
}

function fallbackUsage(messages: LLMMessage[], text: string): TokenUsage {
  const promptTokens = estimateTokensFromMessages(messages);
  const completionTokens = Math.max(1, Math.ceil(text.length / 4));
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens
  };
}
