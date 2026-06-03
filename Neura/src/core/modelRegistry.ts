import fs from "node:fs";
import path from "node:path";
import type { ModelMetadata } from "../types/model";
import { SQLiteStore } from "../database/sqlite";
import type { Logger } from "../utils/logger";

export class ModelRegistry {
  private readonly storageDir: string;

  constructor(
    private readonly store: SQLiteStore,
    private readonly logger: Logger,
    storageDir = path.resolve(process.cwd(), "src", "storage")
  ) {
    this.storageDir = storageDir;
    fs.mkdirSync(this.storageDir, { recursive: true });
  }

  upsert(models: ModelMetadata[]): void {
    if (!models.length) {
      return;
    }
    this.store.upsertModels(models);
    this.writeModelCache();
    this.logger.info("model registry updated", { component: "modelRegistry", count: models.length });
  }

  list(): ModelMetadata[] {
    return this.store.listModels();
  }

  get(providerId: string, modelId: string): ModelMetadata | undefined {
    return this.store.getModel(providerId, modelId);
  }

  setProviderHealth(providerId: string, healthy: boolean, latencyMs?: number): void {
    this.store.updateProviderModelHealth(providerId, healthy ? "healthy" : "unhealthy", latencyMs);
    this.writeModelCache();
  }

  writeProviderCache(): void {
    const providers = this.store.listProviders();
    fs.writeFileSync(path.join(this.storageDir, "providers.json"), JSON.stringify(providers, null, 2));
  }

  writeQuotaCache(): void {
    const quotas = this.store.listQuotas();
    fs.writeFileSync(path.join(this.storageDir, "quotas.json"), JSON.stringify(quotas, null, 2));
  }

  private writeModelCache(): void {
    fs.writeFileSync(path.join(this.storageDir, "models.json"), JSON.stringify(this.list(), null, 2));
  }
}
