import { DEFAULT_ROUTING_POLICY, type RuntimeConfig } from "../config/defaultConfig";
import { SQLiteStore } from "../database/sqlite";
import type { GenerateRequest, GenerateResult, StreamCallbacks } from "../types/provider";
import { Logger } from "../utils/logger";
import { CapabilityAnalyzer } from "./capabilityAnalyzer";
import { ConfigManager } from "./configManager";
import { HealthMonitor } from "./healthMonitor";
import { ModelRegistry } from "./modelRegistry";
import { ProviderManager } from "./providerManager";
import { QuotaTracker } from "./quotaTracker";
import { Router } from "./router";
import { ScoringEngine } from "./scoringEngine";
import { TaskClassifier } from "./taskClassifier";

export class Orchestrator {
  readonly store: SQLiteStore;
  readonly logger: Logger;
  readonly registry: ModelRegistry;
  readonly providerManager: ProviderManager;
  readonly quotaTracker: QuotaTracker;
  readonly router: Router;
  readonly healthMonitor: HealthMonitor;
  readonly capabilityAnalyzer: CapabilityAnalyzer;

  private initialized = false;

  private constructor(private readonly config: RuntimeConfig) {
    this.logger = new Logger(config.logLevel, { component: "orchestrator" });
    this.store = new SQLiteStore(config.dbPath);
    this.registry = new ModelRegistry(this.store, this.logger.child({ component: "modelRegistry" }));
    this.providerManager = new ProviderManager(config.providers, this.store, this.logger.child({ component: "providerManager" }));
    this.quotaTracker = new QuotaTracker(this.store, config.quotaDefaults, this.logger.child({ component: "quotaTracker" }));
    this.capabilityAnalyzer = new CapabilityAnalyzer();
    this.healthMonitor = new HealthMonitor(this.store, this.registry, this.logger.child({ component: "healthMonitor" }));
    this.router = new Router(
      this.providerManager,
      this.registry,
      this.quotaTracker,
      new TaskClassifier(),
      new ScoringEngine(config.routingWeights),
      this.store,
      config.retryPolicy,
      { ...DEFAULT_ROUTING_POLICY, ...config.routingPolicy },
      this.logger.child({ component: "router" })
    );
  }

  static async create(config = ConfigManager.load()): Promise<Orchestrator> {
    const orchestrator = new Orchestrator(config);
    await orchestrator.initialize();
    return orchestrator;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await this.providerManager.initialize();
    await this.healthMonitor.checkAll(this.providerManager.enabledAdapters());
    await this.refreshModels();
    await this.quotaTracker.refreshAll(this.providerManager.enabledAdapters());
    this.registry.writeProviderCache();
    this.registry.writeQuotaCache();
    this.initialized = true;
  }

  async refreshModels(): Promise<number> {
    let count = 0;
    await Promise.all(
      this.providerManager.enabledAdapters().map(async (adapter) => {
        try {
          const models = this.capabilityAnalyzer.enrichMany(await adapter.getModels());
          this.registry.upsert(models);
          count += models.length;
        } catch (error) {
          this.logger.warn("model discovery failed", {
            component: "orchestrator",
            providerId: adapter.id,
            error
          });
        }
      })
    );
    return count;
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    await this.ensureModels();
    return this.router.generate(request);
  }

  async stream(request: GenerateRequest, callbacks: StreamCallbacks): Promise<GenerateResult> {
    await this.ensureModels();
    return this.router.stream(request, callbacks);
  }

  async route(request: GenerateRequest) {
    await this.ensureModels();
    return this.router.route(request);
  }

  status() {
    return {
      providers: this.providerManager.statuses(),
      models: this.registry.list(),
      quotas: this.quotaTracker.list(),
      usage: this.store.usageSummary()
    };
  }

  close(): void {
    this.store.close();
  }

  private async ensureModels(): Promise<void> {
    if (this.registry.list().length === 0) {
      await this.refreshModels();
    }
  }
}
