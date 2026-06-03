import type { ModelMetadata } from "./model";
import type { QuotaStatus } from "./quota";
import type { TaskType } from "./task";
import type { TokenUsage } from "./usage";

export type ProviderType =
  | "openrouter"
  | "groq"
  | "gemini"
  | "nvidia"
  | "ollama"
  | "openai-compatible"
  | "local-openai-compatible"
  | "anthropic-compatible"
  | "cohere-compatible"
  | "huggingface-compatible"
  | "replicate-compatible"
  | "cloudflare-workers-ai"
  | "manual";
export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface MessageContentPart {
  type: "text" | "image_url";
  text?: string;
  imageUrl?: string;
}

export interface LLMMessage {
  role: MessageRole;
  content: string | MessageContentPart[];
  name?: string;
  toolCallId?: string;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface GenerateRequest {
  messages: LLMMessage[];
  model?: string;
  taskHint?: TaskType;
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  responseFormat?: "text" | "json";
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface GenerateResult {
  requestId: string;
  providerId: string;
  modelId: string;
  text: string;
  usage: TokenUsage;
  latencyMs: number;
  finishReason?: string;
  raw?: unknown;
}

export interface StreamCallbacks {
  onToken?: (token: string) => void | Promise<void>;
  onUsage?: (usage: TokenUsage) => void | Promise<void>;
  onDone?: (result: GenerateResult) => void | Promise<void>;
  onError?: (error: Error) => void | Promise<void>;
  onMetadata?: (metadata: Record<string, unknown>) => void | Promise<void>;
}

export interface ProviderHealth {
  providerId: string;
  healthy: boolean;
  latencyMs?: number;
  error?: string;
  checkedAt: string;
}

export interface ProviderConfig {
  id: string;
  type: ProviderType;
  displayName: string;
  enabled: boolean;
  apiKey?: string;
  baseUrl: string;
  timeoutMs: number;
  defaultHeaders?: Record<string, string>;
  freeTier?: boolean;
  metadata?: Record<string, unknown>;
}

export interface ProviderAdapter {
  readonly id: string;
  readonly type: ProviderType;
  readonly displayName: string;
  readonly config: ProviderConfig;

  validateKey(): Promise<boolean>;
  getModels(): Promise<ModelMetadata[]>;
  getUsage(): Promise<TokenUsage | undefined>;
  getQuota(): Promise<QuotaStatus>;
  healthCheck(): Promise<ProviderHealth>;
  generate(request: GenerateRequest): Promise<GenerateResult>;
  stream(request: GenerateRequest, callbacks: StreamCallbacks): Promise<GenerateResult>;
  supportsVision(modelId?: string): boolean;
  supportsTools(modelId?: string): boolean;
  supportsEmbeddings(modelId?: string): boolean;
}

export class ProviderError extends Error {
  public readonly providerId: string;
  public readonly status?: number;
  public readonly code?: string;
  public readonly retryAfterMs?: number;

  constructor(message: string, options: { providerId: string; status?: number; code?: string; retryAfterMs?: number }) {
    super(message);
    this.name = "ProviderError";
    this.providerId = options.providerId;
    this.status = options.status;
    this.code = options.code;
    this.retryAfterMs = options.retryAfterMs;
  }
}
