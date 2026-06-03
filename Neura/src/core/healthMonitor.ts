import type { ProviderAdapter } from "../types/provider";
import { SQLiteStore } from "../database/sqlite";
import type { Logger } from "../utils/logger";
import type { ModelRegistry } from "./modelRegistry";

export class HealthMonitor {
  constructor(
    private readonly store: SQLiteStore,
    private readonly registry: ModelRegistry,
    private readonly logger: Logger
  ) {}

  async check(adapter: ProviderAdapter): Promise<void> {
    const health = await adapter.healthCheck();
    this.store.recordHealth(health);
    this.registry.setProviderHealth(adapter.id, health.healthy, health.latencyMs);
    this.logger.info("provider health checked", {
      component: "healthMonitor",
      providerId: adapter.id,
      healthy: health.healthy,
      latencyMs: health.latencyMs
    });
  }

  async checkAll(adapters: ProviderAdapter[]): Promise<void> {
    await Promise.all(adapters.map((adapter) => this.check(adapter)));
    this.registry.writeProviderCache();
  }
}
