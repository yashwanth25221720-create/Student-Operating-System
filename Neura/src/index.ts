#!/usr/bin/env node
export { Orchestrator } from "./core/orchestrator";
export { ConfigManager } from "./core/configManager";
export type { RuntimeConfig } from "./config/defaultConfig";
export type { GenerateRequest, GenerateResult, ProviderAdapter, ProviderConfig, StreamCallbacks } from "./types/provider";
export type { ModelMetadata } from "./types/model";
export type { QuotaStatus } from "./types/quota";
export type { TaskProfile, TaskType, RoutingDecision } from "./types/task";

import { runCli } from "./cli/commands";

if (require.main === module) {
  runCli().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
