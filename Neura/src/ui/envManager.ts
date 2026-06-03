import fs from "node:fs";
import path from "node:path";
import { PROVIDER_GUIDES } from "../config/providerCatalog";

export interface EnvSnapshot {
  envPath: string;
  providers: Record<
    string,
    {
      keyEnvVar?: string;
      keyConfigured: boolean;
      maskedKey?: string;
      baseUrlEnvVar: string;
      baseUrl?: string;
      enabled: boolean;
    }
  >;
}

export interface ProviderEnvUpdate {
  providerId: string;
  apiKey?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export class EnvManager {
  private readonly envPath: string;

  constructor(private readonly cwd = process.cwd()) {
    this.envPath = path.join(cwd, ".env");
  }

  snapshot(): EnvSnapshot {
    const env = this.readEnv();
    const providers: EnvSnapshot["providers"] = {};

    for (const guide of PROVIDER_GUIDES) {
      const key = guide.keyEnvVar ? env[guide.keyEnvVar] : undefined;
      providers[guide.id] = {
        keyEnvVar: guide.keyEnvVar,
        keyConfigured: Boolean(key),
        maskedKey: key ? maskSecret(key) : undefined,
        baseUrlEnvVar: guide.baseUrlEnvVar,
        baseUrl: env[guide.baseUrlEnvVar] ?? guide.defaultBaseUrl,
        enabled: providerEnabled(guide.id, guide.enabledEnvVar, env, Boolean(key))
      };
    }

    return {
      envPath: this.envPath,
      providers
    };
  }

  updateProvider(update: ProviderEnvUpdate): EnvSnapshot {
    const guide = PROVIDER_GUIDES.find((item) => item.id === update.providerId);
    if (!guide) {
      throw new Error(`Unknown provider: ${update.providerId}`);
    }

    const env = this.readEnv();
    if (guide.keyEnvVar && update.apiKey !== undefined && update.apiKey.trim() !== "") {
      env[guide.keyEnvVar] = update.apiKey.trim();
      process.env[guide.keyEnvVar] = env[guide.keyEnvVar];
    }

    if (update.baseUrl !== undefined && update.baseUrl.trim() !== "") {
      env[guide.baseUrlEnvVar] = update.baseUrl.trim();
      process.env[guide.baseUrlEnvVar] = env[guide.baseUrlEnvVar];
    }

    if (update.enabled !== undefined) {
      if (guide.id === "ollama") {
        env.OLLAMA_DISABLED = update.enabled ? "false" : "true";
        process.env.OLLAMA_DISABLED = env.OLLAMA_DISABLED;
      } else if (guide.enabledEnvVar) {
        env[guide.enabledEnvVar] = update.enabled ? "true" : "false";
        process.env[guide.enabledEnvVar] = env[guide.enabledEnvVar];
      }
    }

    this.writeEnv(env);
    return this.snapshot();
  }

  private readEnv(): Record<string, string> {
    if (!fs.existsSync(this.envPath)) {
      return {};
    }

    const env: Record<string, string> = {};
    const content = fs.readFileSync(this.envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const separator = trimmed.indexOf("=");
      if (separator < 0) {
        continue;
      }
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
      env[key] = value;
    }
    return env;
  }

  private writeEnv(env: Record<string, string>): void {
    const providerKeys = PROVIDER_GUIDES.flatMap((guide) => [
      guide.keyEnvVar,
      guide.baseUrlEnvVar,
      guide.enabledEnvVar,
      guide.id === "ollama" ? "OLLAMA_DISABLED" : undefined
    ]).filter((key): key is string => Boolean(key));

    const orderedKeys = [
      ...providerKeys,
      "NEURA_DB_PATH",
      "NEURA_LOG_LEVEL",
      "NEURA_APP_TITLE",
      "NEURA_APP_URL",
      "NEURA_DEFAULT_RPM",
      "NEURA_DEFAULT_RPD",
      "NEURA_DEFAULT_TPM",
      "NEURA_DEFAULT_TPD"
    ];
    const emitted = new Set<string>();
    const lines = [
      "# Neura local runtime configuration",
      "# Secrets stay on this machine. Do not commit this file.",
      ""
    ];

    for (const key of orderedKeys) {
      if (env[key] !== undefined) {
        lines.push(`${key}=${escapeEnvValue(env[key])}`);
        emitted.add(key);
      }
    }

    for (const key of Object.keys(env).sort()) {
      if (!emitted.has(key)) {
        lines.push(`${key}=${escapeEnvValue(env[key])}`);
      }
    }

    fs.writeFileSync(this.envPath, `${lines.join("\n")}\n`, "utf8");
  }
}

function maskSecret(value: string): string {
  if (value.length <= 8) {
    return "configured";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function providerEnabled(
  providerId: string,
  enabledEnvVar: string | undefined,
  env: Record<string, string>,
  keyConfigured: boolean
): boolean {
  if (providerId === "ollama") {
    return env.OLLAMA_DISABLED !== "true";
  }
  if (enabledEnvVar) {
    return env[enabledEnvVar] === "true";
  }
  return keyConfigured;
}

function escapeEnvValue(value: string): string {
  if (/[\s#"'`]/.test(value)) {
    return JSON.stringify(value);
  }
  return value;
}
