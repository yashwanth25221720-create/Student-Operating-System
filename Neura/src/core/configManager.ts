import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import {
  DEFAULT_QUOTA_LIMITS,
  DEFAULT_RETRY_POLICY,
  DEFAULT_ROUTING_POLICY,
  DEFAULT_ROUTING_WEIGHTS,
  type RuntimeConfig
} from "../config/defaultConfig";
import { PROVIDER_GUIDES } from "../config/providerCatalog";
import type { ProviderConfig } from "../types/provider";
import type { LogLevel } from "../utils/logger";
import { normalizeBaseUrl, parseNumber } from "../utils/validators";

export class ConfigManager {
  static load(cwd = process.cwd()): RuntimeConfig {
    dotenv.config({ path: path.join(cwd, ".env"), override: true });

    const optionalConfigPath = path.join(cwd, "neura.config.json");
    const fileConfig = fs.existsSync(optionalConfigPath)
      ? (JSON.parse(fs.readFileSync(optionalConfigPath, "utf8")) as Partial<RuntimeConfig>)
      : {};

    const envDefaults = {
      requestsPerMinute: parseNumber(process.env.NEURA_DEFAULT_RPM) ?? DEFAULT_QUOTA_LIMITS.requestsPerMinute,
      requestsPerDay: parseNumber(process.env.NEURA_DEFAULT_RPD) ?? DEFAULT_QUOTA_LIMITS.requestsPerDay,
      tokensPerMinute: parseNumber(process.env.NEURA_DEFAULT_TPM) ?? DEFAULT_QUOTA_LIMITS.tokensPerMinute,
      tokensPerDay: parseNumber(process.env.NEURA_DEFAULT_TPD) ?? DEFAULT_QUOTA_LIMITS.tokensPerDay
    };

    return {
      dbPath: process.env.NEURA_DB_PATH ?? fileConfig.dbPath ?? "./data/neura.sqlite",
      logLevel: (process.env.NEURA_LOG_LEVEL as LogLevel | undefined) ?? fileConfig.logLevel ?? "info",
      providers: fileConfig.providers ?? buildProviderConfigs(),
      routingWeights: { ...DEFAULT_ROUTING_WEIGHTS, ...(fileConfig.routingWeights ?? {}) },
      routingPolicy: { ...DEFAULT_ROUTING_POLICY, ...(fileConfig.routingPolicy ?? {}) },
      quotaDefaults: { ...envDefaults, ...(fileConfig.quotaDefaults ?? {}) },
      retryPolicy: { ...DEFAULT_RETRY_POLICY, ...(fileConfig.retryPolicy ?? {}) }
    };
  }
}

function buildProviderConfigs(): ProviderConfig[] {
  const appTitle = process.env.NEURA_APP_TITLE ?? "Neura Runtime";
  const appUrl = process.env.NEURA_APP_URL ?? "http://localhost";

  return PROVIDER_GUIDES.map((guide) => {
    const apiKey = readProviderKey(guide.keyEnvVar);
    const baseUrl = normalizeBaseUrl(process.env[guide.baseUrlEnvVar] ?? guide.defaultBaseUrl);
    const timeoutMs = parseNumber(process.env[`${guide.id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_TIMEOUT_MS`]) ?? 60000;

    return {
      id: guide.id,
      type: guide.type,
      displayName: guide.displayName,
      enabled: guide.supportsRuntime && isProviderEnabled(guide.id, guide.enabledEnvVar, apiKey),
      apiKey,
      baseUrl,
      timeoutMs: guide.category === "local" ? Math.max(timeoutMs, 120000) : timeoutMs,
      defaultHeaders: defaultHeadersForProvider(guide.id, appTitle, appUrl),
      freeTier: true,
      metadata: {
        appTitle,
        appUrl,
        category: guide.category,
        supportsRuntime: guide.supportsRuntime,
        modelDiscovery: guide.modelDiscovery,
        capabilities: guide.capabilities,
        keyUrl: guide.keyUrl,
        docsUrl: guide.docsUrl
      }
    } satisfies ProviderConfig;
  });
}

function readProviderKey(keyEnvVar: string | undefined): string | undefined {
  if (!keyEnvVar) {
    return undefined;
  }
  if (keyEnvVar === "GEMINI_API_KEY") {
    return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  }
  return process.env[keyEnvVar];
}

function isProviderEnabled(providerId: string, enabledEnvVar: string | undefined, apiKey: string | undefined): boolean {
  if (providerId === "ollama") {
    return process.env.OLLAMA_DISABLED !== "true";
  }
  if (enabledEnvVar) {
    return process.env[enabledEnvVar] === "true";
  }
  return Boolean(apiKey);
}

function defaultHeadersForProvider(providerId: string, appTitle: string, appUrl: string): Record<string, string> | undefined {
  if (providerId === "openrouter") {
    return {
      "HTTP-Referer": appUrl,
      "X-Title": appTitle
    };
  }
  return undefined;
}
