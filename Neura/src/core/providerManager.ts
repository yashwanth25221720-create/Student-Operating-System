import { AnthropicAdapter, CohereAdapter, CloudflareAdapter, GeminiAdapter, GenericOpenAIAdapter, GroqAdapter, NvidiaAdapter, OllamaAdapter, OpenRouterAdapter } from "../providers";
import type { ProviderAdapter, ProviderConfig } from "../types/provider";
import { SQLiteStore } from "../database/sqlite";
import type { Logger } from "../utils/logger";

export interface ProviderRuntimeStatus {
  id: string;
  displayName: string;
  type: string;
  enabled: boolean;
  registered: boolean;
  healthy?: boolean;
  lastCheckedAt?: string;
  avgLatencyMs?: number;
  failureCount?: number;
}

export class ProviderManager {
  private readonly adapters = new Map<string, ProviderAdapter>();

  constructor(
    private readonly configs: ProviderConfig[],
    private readonly store: SQLiteStore,
    private readonly logger: Logger
  ) {
    this.registerConfiguredProviders();
  }

  get(providerId: string): ProviderAdapter | undefined {
    return this.adapters.get(providerId);
  }

  enabledAdapters(): ProviderAdapter[] {
    return [...this.adapters.values()];
  }

  async initialize(): Promise<void> {
    await Promise.all(
      this.enabledAdapters().map(async (adapter) => {
        try {
          const valid = await adapter.validateKey();
          this.store.upsertProvider(adapter.config, valid);
          this.logger.info("provider validated", { component: "providerManager", providerId: adapter.id, valid });
        } catch (error) {
          this.store.upsertProvider(adapter.config, false);
          this.logger.warn("provider validation failed", {
            component: "providerManager",
            providerId: adapter.id,
            error
          });
        }
      })
    );
  }

  async discoverProviderModels(providerId: string): Promise<ProviderAdapter | undefined> {
    return this.adapters.get(providerId);
  }

  statuses(): ProviderRuntimeStatus[] {
    const persisted = new Map(this.store.listProviders().map((provider) => [provider.id, provider]));
    return this.configs.map((config) => {
      const row = persisted.get(config.id);
      return {
        id: config.id,
        displayName: config.displayName,
        type: config.type,
        enabled: config.enabled,
        registered: this.adapters.has(config.id),
        healthy: row?.healthy,
        lastCheckedAt: row?.lastCheckedAt,
        avgLatencyMs: row?.avgLatencyMs,
        failureCount: row?.failureCount
      };
    });
  }

  private registerConfiguredProviders(): void {
    for (const config of this.configs) {
      this.store.upsertProvider(config, false);
      if (!config.enabled) {
        continue;
      }

      const adapter = createAdapter(config);
      if (adapter) {
        this.adapters.set(adapter.id, adapter);
      }
    }
  }
}

function createAdapter(config: ProviderConfig): ProviderAdapter | undefined {
  switch (config.type) {
    case "openrouter":
      return new OpenRouterAdapter(config);
    case "groq":
      return new GroqAdapter(config);
    case "gemini":
      return new GeminiAdapter(config);
    case "nvidia":
      return new NvidiaAdapter(config);
    case "ollama":
      return new OllamaAdapter(config);
    case "openai-compatible":
    case "local-openai-compatible":
    case "huggingface-compatible":
      return new GenericOpenAIAdapter(config);
    case "anthropic-compatible":
      return new AnthropicAdapter(config);
    case "cohere-compatible":
      return new CohereAdapter(config);
    case "cloudflare-workers-ai":
      return new CloudflareAdapter(config);
    case "replicate-compatible":
    case "manual":
      return undefined;
  }
}

export { createAdapter };
