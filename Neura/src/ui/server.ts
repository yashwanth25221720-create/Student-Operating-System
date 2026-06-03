import http from "node:http";
import { URL } from "node:url";
import { ConfigManager } from "../core/configManager";
import { Orchestrator } from "../core/orchestrator";
import { createAdapter } from "../core/providerManager";
import { findProviderGuide, PROVIDER_GUIDES, type ProviderGuide } from "../config/providerCatalog";
import type { ModelMetadata } from "../types/model";
import type { GenerateRequest, LLMMessage, ProviderConfig } from "../types/provider";
import type { TaskType } from "../types/task";
import { normalizeBaseUrl, parseNumber } from "../utils/validators";
import { EnvManager, type ProviderEnvUpdate } from "./envManager";

export interface UiServerOptions {
  host: string;
  port: number;
  cwd?: string;
}

const CORE_PROVIDER_IDS = [
  "ollama",
  "openrouter",
  "groq",
  "gemini",
  "openai",
  "github-models",
  "cerebras",
  "deepseek",
  "mistral",
  "together",
  "fireworks",
  "lmstudio"
] as const;

const TASK_PRESETS: Array<{
  id: TaskType;
  label: string;
  prompt: string;
  summary: string;
}> = [
  {
    id: "coding",
    label: "Coding",
    prompt: "Implement a typed TypeScript cache with expiry and explain the tradeoffs.",
    summary: "Prioritizes coding score, reasoning, tools, and reliability."
  },
  {
    id: "image_generation",
    label: "Image Generation",
    prompt: "Create a production-ready hero image prompt for a futuristic personal AI operating system.",
    summary: "Compares image-capable providers and flags adapters that still need image output support."
  },
  {
    id: "vision",
    label: "Vision",
    prompt: "Analyze an app screenshot and list the highest-impact UX improvements.",
    summary: "Requires vision support and favors multimodal models."
  },
  {
    id: "fast_chat",
    label: "Fast Chat",
    prompt: "Answer briefly: what is the next step to configure this AI router?",
    summary: "Favors speed, free-tier preservation, and low latency."
  },
  {
    id: "long_context",
    label: "Long Context",
    prompt: "Summarize a large repository architecture and identify risk areas.",
    summary: "Favors large context windows and stable quota."
  },
  {
    id: "embeddings",
    label: "Embeddings",
    prompt: "Route semantic search indexing for a codebase knowledge base.",
    summary: "Requires embedding support when discovered."
  }
];

export async function startUiServer(options: UiServerOptions): Promise<http.Server> {
  const cwd = options.cwd ?? process.cwd();
  const envManager = new EnvManager(cwd);
  let runtime = await createRuntime(cwd);

  const server = http.createServer(async (request, response) => {
    try {
      if (!request.url) {
        sendJson(response, 404, { error: "Missing URL" });
        return;
      }

      const url = new URL(request.url, `http://${options.host}:${options.port}`);

      if (request.method === "GET" && url.pathname === "/") {
        sendHtml(response, renderInterface());
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/bootstrap") {
        const status = runtime.status();
        sendJson(response, 200, {
          guides: PROVIDER_GUIDES,
          coreProviderIds: CORE_PROVIDER_IDS,
          taskPresets: TASK_PRESETS,
          env: envManager.snapshot(),
          readiness: getReadiness(status),
          status
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/status") {
        const status = runtime.status();
        sendJson(response, 200, {
          env: envManager.snapshot(),
          readiness: getReadiness(status),
          status
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/providers") {
        const body = (await readJson(request)) as ProviderEnvUpdate;
        const env = envManager.updateProvider(body);
        runtime.close();
        runtime = await createRuntime(cwd);
        const status = runtime.status();
        sendJson(response, 200, {
          ok: true,
          env,
          readiness: getReadiness(status),
          status
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/test-provider") {
        const body = (await readJson(request)) as ProviderEnvUpdate;
        const result = await testProvider(body);
        sendJson(response, result.ok ? 200 : 400, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/discover") {
        const count = await runtime.refreshModels();
        const status = runtime.status();
        sendJson(response, 200, {
          ok: true,
          count,
          readiness: getReadiness(status),
          status
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/route") {
        const body = (await readJson(request)) as { prompt?: string; task?: TaskType; model?: string };
        if (!body.prompt?.trim()) {
          sendJson(response, 400, { error: "Prompt is required" });
          return;
        }
        const decision = await runtime.route({
          messages: [{ role: "user", content: body.prompt }],
          taskHint: body.task,
          model: body.model
        });
        sendJson(response, 200, { ok: true, decision });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/battle") {
        const body = (await readJson(request)) as { prompt?: string; task?: TaskType; model?: string };
        const result = await runBattleground(runtime, body);
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/chat") {
        const body = (await readJson(request)) as {
          prompt?: string;
          messages?: LLMMessage[];
          task?: TaskType;
          model?: string;
          temperature?: number;
        };
        const result = await runChat(runtime, body);
        sendJson(response, 200, result);
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      sendJson(response, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  server.on("close", () => runtime.close());
  return server;
}

async function createRuntime(cwd: string): Promise<Orchestrator> {
  const config = ConfigManager.load(cwd);
  config.logLevel = "silent";
  return Orchestrator.create(config);
}

async function runChat(
  runtime: Orchestrator,
  body: { prompt?: string; messages?: LLMMessage[]; task?: TaskType; model?: string; temperature?: number }
): Promise<Record<string, unknown>> {
  const status = runtime.status();
  const readiness = getReadiness(status);
  const prompt = body.prompt?.trim();
  const messages: LLMMessage[] =
    Array.isArray(body.messages) && body.messages.length ? body.messages : prompt ? [{ role: "user" as const, content: prompt }] : [];

  if (!messages.length) {
    throw new Error("Prompt is required");
  }

  if (!readiness.readyForChat) {
    throw new Error("Connect a runtime-ready API key or local Ollama/LM Studio model, then run Discover Models before chatting.");
  }

  if (body.task === "image_generation") {
    const battle = await runBattleground(runtime, { prompt: prompt ?? "Image generation routing", task: "image_generation", model: body.model });
    return {
      ok: false,
      mode: "route-only",
      message: "Image generation models can be compared here, but binary image output adapters are not enabled in this runtime yet.",
      battle
    };
  }

  const request: GenerateRequest = {
    messages,
    taskHint: body.task,
    model: body.model,
    temperature: body.temperature ?? 0.3
  };

  const decision = await runtime.route(request);
  const result = await runtime.generate(request);
  return {
    ok: true,
    decision,
    result,
    readiness: getReadiness(runtime.status())
  };
}

async function runBattleground(
  runtime: Orchestrator,
  body: { prompt?: string; task?: TaskType; model?: string }
): Promise<Record<string, unknown>> {
  const task = body.task ?? "coding";
  const preset = TASK_PRESETS.find((item) => item.id === task);
  const prompt = body.prompt?.trim() || preset?.prompt || "Compare models for this project task.";
  const decision = await runtime.route({
    messages: [{ role: "user", content: prompt }],
    taskHint: task,
    model: body.model
  });
  const status = runtime.status();
  const models = new Map(status.models.map((model) => [`${model.providerId}:${model.id}`, model]));
  const quotas = status.quotas;

  const candidates = decision.candidates.slice(0, 12).map((candidate, index) => {
    const model = models.get(`${candidate.providerId}:${candidate.modelId}`);
    const guide = findProviderGuide(candidate.providerId);
    return {
      rank: index + 1,
      ...candidate,
      displayName: model?.displayName ?? candidate.modelId,
      providerName: guide?.displayName ?? candidate.providerId,
      capabilities: model?.capabilities,
      scores: model?.scores,
      contextWindow: model?.contextWindow,
      latencyMs: model?.latencyMs,
      freeTier: model?.freeTier,
      health: model?.health,
      quota: quotaSummary(quotas, candidate.providerId, candidate.modelId),
      pros: prosFor(model, guide),
      cons: consFor(model, guide)
    };
  });

  return {
    ok: true,
    prompt,
    task,
    decision,
    candidates
  };
}

async function testProvider(update: ProviderEnvUpdate): Promise<Record<string, unknown> & { ok: boolean }> {
  const guide = findProviderGuide(update.providerId);
  if (!guide) {
    return { ok: false, error: `Unknown provider: ${update.providerId}` };
  }

  if (!guide.supportsRuntime) {
    return {
      ok: false,
      providerId: guide.id,
      displayName: guide.displayName,
      supported: false,
      message: "This provider can be saved in the catalog, but it does not have a runtime adapter yet."
    };
  }

  const config = providerConfigFromGuide(guide, update);
  const adapter = createAdapter(config);
  if (!adapter) {
    return {
      ok: false,
      providerId: guide.id,
      displayName: guide.displayName,
      supported: false,
      message: "No adapter is registered for this provider type yet."
    };
  }

  try {
    const started = Date.now();
    await adapter.validateKey();
    const health = {
      providerId: adapter.id,
      healthy: true,
      latencyMs: Date.now() - started,
      checkedAt: new Date().toISOString()
    };
    let modelCount: number | undefined;
    try {
      modelCount = (await adapter.getModels()).length;
    } catch {
      modelCount = undefined;
    }

    return {
      ok: health.healthy,
      providerId: guide.id,
      displayName: guide.displayName,
      supported: true,
      health,
      modelCount,
      message: "Key and endpoint validated."
    };
  } catch (error) {
    return {
      ok: false,
      providerId: guide.id,
      displayName: guide.displayName,
      supported: true,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function providerConfigFromGuide(guide: ProviderGuide, update: ProviderEnvUpdate): ProviderConfig {
  const key = update.apiKey || (guide.keyEnvVar ? process.env[guide.keyEnvVar] : undefined);
  const baseUrl = normalizeBaseUrl(update.baseUrl || process.env[guide.baseUrlEnvVar] || guide.defaultBaseUrl);
  return {
    id: guide.id,
    type: guide.type,
    displayName: guide.displayName,
    enabled: true,
    apiKey: key,
    baseUrl,
    timeoutMs: parseNumber(process.env[`${guide.id.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_TIMEOUT_MS`]) ?? 60000,
    defaultHeaders:
      guide.id === "openrouter"
        ? {
            "HTTP-Referer": process.env.NEURA_APP_URL ?? "http://localhost",
            "X-Title": process.env.NEURA_APP_TITLE ?? "Neura Runtime"
          }
        : undefined,
    freeTier: true,
    metadata: {
      category: guide.category,
      supportsRuntime: guide.supportsRuntime,
      modelDiscovery: guide.modelDiscovery,
      capabilities: guide.capabilities,
      keyUrl: guide.keyUrl,
      docsUrl: guide.docsUrl
    }
  };
}

function getReadiness(status: ReturnType<Orchestrator["status"]>) {
  const runtimeReadyProviders = status.providers.filter((provider) => provider.enabled && provider.registered && provider.healthy);
  const chatModels = status.models.filter((model) => model.capabilities.text && model.health !== "unhealthy");
  const localModels = chatModels.filter((model) => model.capabilities.local);
  const cloudModels = chatModels.filter((model) => !model.capabilities.local);
  const coreProviders = status.providers.filter((provider) => CORE_PROVIDER_IDS.includes(provider.id as (typeof CORE_PROVIDER_IDS)[number]));

  return {
    hasRuntimeProvider: runtimeReadyProviders.length > 0,
    readyForChat: chatModels.length > 0,
    runtimeReadyProviders: runtimeReadyProviders.map((provider) => provider.id),
    chatModelCount: chatModels.length,
    localModelCount: localModels.length,
    cloudModelCount: cloudModels.length,
    coreConfiguredCount: coreProviders.filter((provider) => provider.enabled).length,
    nextStep:
      chatModels.length > 0
        ? "Chat and battleground are ready."
        : runtimeReadyProviders.length > 0
          ? "Run Discover Models to populate the model registry."
          : "Add one core API key or connect a local Ollama/LM Studio runtime."
  };
}

function quotaSummary(quotas: ReturnType<Orchestrator["status"]>["quotas"], providerId: string, modelId: string) {
  const matching = quotas.filter((quota) => quota.providerId === providerId && (!quota.modelId || quota.modelId === modelId));
  const windows = matching.flatMap((quota) => quota.windows);
  const requestWindow = windows.find((window) => window.kind === "rpd") ?? windows.find((window) => window.kind === "rpm");
  const tokenWindow = windows.find((window) => window.kind === "tpd") ?? windows.find((window) => window.kind === "tpm");
  return {
    requestsRemaining: requestWindow?.remaining,
    requestLimit: requestWindow?.limit,
    tokensRemaining: tokenWindow?.remaining,
    tokenLimit: tokenWindow?.limit,
    resetAt: requestWindow?.resetAt ?? tokenWindow?.resetAt
  };
}

function prosFor(model: ModelMetadata | undefined, guide: ProviderGuide | undefined): string[] {
  const pros = new Set<string>();
  if (model?.freeTier) pros.add("free-tier candidate");
  if (model?.capabilities.local) pros.add("offline/local");
  if ((model?.scores.speed ?? 0) >= 0.8) pros.add("fast responses");
  if ((model?.scores.coding ?? 0) >= 0.75) pros.add("strong coding fit");
  if ((model?.scores.reasoning ?? 0) >= 0.75) pros.add("strong reasoning fit");
  if (model?.capabilities.vision) pros.add("vision capable");
  if (model?.capabilities.imageGeneration) pros.add("image generation capable");
  if (model?.capabilities.longContext) pros.add("long context");
  if (guide?.capabilities.includes("gateway")) pros.add("gateway flexibility");
  return [...pros].slice(0, 5);
}

function consFor(model: ModelMetadata | undefined, guide: ProviderGuide | undefined): string[] {
  const cons = new Set<string>();
  if (!guide?.supportsRuntime) cons.add("adapter needed");
  if (!model) cons.add("not discovered yet");
  if (model && !model.freeTier) cons.add("may cost credits");
  if ((model?.latencyMs ?? 0) > 10000) cons.add("observed latency high");
  if (model?.health === "degraded" || model?.health === "unhealthy") cons.add(`health ${model.health}`);
  if (!model?.capabilities.tools && guide?.capabilities.includes("tools")) cons.add("tool support not confirmed");
  return [...cons].slice(0, 5);
}

async function readJson(request: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
}

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendHtml(response: http.ServerResponse, html: string): void {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(html);
}

function renderInterface(): string {
  return String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Neura Runtime Console</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f7fb;
        --surface: rgba(255, 255, 255, 0.92);
        --surface-strong: #ffffff;
        --ink: #111827;
        --muted: #607086;
        --line: #d7e0ea;
        --accent: #0f766e;
        --accent-2: #2563eb;
        --accent-3: #7c3aed;
        --ok: #15803d;
        --warn: #b45309;
        --danger: #b91c1c;
        --shadow: 0 18px 48px rgba(15, 23, 42, 0.10);
        --radius: 8px;
        --glow-teal: rgba(15, 118, 110, 0.3);
        --glow-blue: rgba(37, 99, 235, 0.25);
        --particle-opacity: 0.5;
      }

      [data-theme="dark"] {
        color-scheme: dark;
        --bg: #0b1120;
        --surface: rgba(30, 41, 59, 0.85);
        --surface-strong: #1e293b;
        --ink: #e2e8f0;
        --muted: #94a3b8;
        --line: #334155;
        --accent: #14b8a6;
        --accent-2: #60a5fa;
        --accent-3: #a78bfa;
        --ok: #22c55e;
        --warn: #f59e0b;
        --danger: #ef4444;
        --shadow: 0 18px 48px rgba(0, 0, 0, 0.45);
        --glow-teal: rgba(20, 184, 166, 0.25);
        --glow-blue: rgba(96, 165, 250, 0.2);
        --particle-opacity: 0.35;
      }

      * { box-sizing: border-box; }
            body {
        margin: 0;
        min-height: 100vh;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 12% 10%, var(--glow-teal), transparent 28%),
          radial-gradient(circle at 86% 4%, var(--glow-blue), transparent 30%),
          var(--bg);
        transition: background 0.4s ease, color 0.3s ease;
      }

      canvas#particles {
        position: fixed;
        inset: 0;
        z-index: 0;
        pointer-events: none;
        opacity: var(--particle-opacity);
        transition: opacity 0.6s ease;
      }

      .app, .toast, .overlay { position: relative; z-index: 1; }

      button, input, select, textarea { font: inherit; }
      a { color: var(--accent); font-weight: 700; text-decoration: none; }

      .app {
        display: grid;
        grid-template-columns: 264px minmax(0, 1fr);
        min-height: 100vh;
      }

      .sidebar {
        position: sticky;
        top: 0;
        height: 100vh;
        padding: 22px 16px;
        background: #0f172a;
        color: #f8fafc;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 22px;
      }

      .mark {
        width: 38px;
        height: 38px;
        border-radius: 8px;
        background: linear-gradient(135deg, #14b8a6, #60a5fa);
        animation: pulseMark 4s ease-in-out infinite;
      }

      @keyframes pulseMark {
        0%, 100% { transform: scale(1); filter: saturate(1); }
        50% { transform: scale(1.04); filter: saturate(1.25); }
      }

      .brand strong { display: block; font-size: 16px; }
      .brand span { color: #cbd5e1; font-size: 12px; }

      .nav { display: grid; gap: 6px; }
      .nav button {
        width: 100%;
        border: 0;
        border-radius: var(--radius);
        padding: 10px 12px;
        color: #cbd5e1;
        background: transparent;
        text-align: left;
        cursor: pointer;
        transition: background 160ms ease, color 160ms ease, transform 160ms ease;
      }
      .nav button:hover { transform: translateX(2px); }
      .nav button.active, .nav button:hover { background: #1e293b; color: #ffffff; }

      .side-note {
        margin-top: 22px;
        padding-top: 14px;
        border-top: 1px solid rgba(255,255,255,0.12);
        color: #cbd5e1;
        font-size: 12px;
        line-height: 1.45;
      }

      .main { min-width: 0; padding: 26px; }

      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        margin-bottom: 18px;
      }

      h1 { margin: 0; font-size: 27px; letter-spacing: 0; }
      .subtitle { color: var(--muted); margin-top: 4px; }

      .actions, .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }

      .button {
        border: 1px solid var(--line);
        border-radius: var(--radius);
        min-height: 40px;
        padding: 9px 12px;
        background: var(--surface-strong);
        color: var(--ink);
        cursor: pointer;
        transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease;
      }
      .button:hover { transform: translateY(-1px); box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12); }
      .button.primary { background: var(--accent); border-color: var(--accent); color: #ffffff; }
      .button.blue { background: var(--accent-2); border-color: var(--accent-2); color: #ffffff; }
      .button.ghost { background: transparent; }

      .section { display: none; animation: riseIn 220ms ease both; }
      .section.active { display: block; }
      @keyframes riseIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

      .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .grid.three { grid-template-columns: repeat(3, minmax(0, 1fr)); }

      .card, .panel {
        background: var(--surface);
        border: 1px solid rgba(215, 224, 234, 0.9);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        backdrop-filter: blur(10px);
      }
      .card { padding: 16px; }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);
        gap: 14px;
        margin-bottom: 14px;
      }

      .readiness {
        min-height: 214px;
        background: linear-gradient(135deg, rgba(15,118,110,0.96), rgba(37,99,235,0.92));
        color: white;
        overflow: hidden;
        position: relative;
      }
      .readiness::after {
        content: "";
        position: absolute;
        width: 260px;
        height: 260px;
        right: -90px;
        top: -110px;
        border-radius: 999px;
        border: 48px solid rgba(255,255,255,0.08);
        animation: slowSpin 16s linear infinite;
      }
      @keyframes slowSpin { to { transform: rotate(360deg); } }

      .readiness h2, .card h2, .card h3 { margin: 0; letter-spacing: 0; }
      .readiness h2 { font-size: 28px; max-width: 640px; }
      .readiness p { color: rgba(255,255,255,0.85); max-width: 720px; }
      .metric-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
      .metric { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); border-radius: var(--radius); padding: 10px; }
      .metric strong { display: block; font-size: 22px; }
      .metric span { color: rgba(255,255,255,0.78); font-size: 12px; }

      .status-pill, .tag {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 4px 8px;
        font-size: 12px;
        font-weight: 750;
        background: #eef3f7;
        color: #475569;
        white-space: nowrap;
      }
      .status-pill.ok, .tag.ok { background: #dcfce7; color: var(--ok); }
      .status-pill.warn, .tag.warn { background: #fef3c7; color: var(--warn); }
      .status-pill.bad, .tag.bad { background: #fee2e2; color: var(--danger); }
      .tag.blue { background: #dbeafe; color: #1d4ed8; }
      .tag.purple { background: #ede9fe; color: #6d28d9; }

      .tag-row { display: flex; gap: 6px; flex-wrap: wrap; margin: 10px 0; }
      .note { color: var(--muted); font-size: 13px; line-height: 1.45; }

      .provider-card { transition: transform 170ms ease, box-shadow 170ms ease; }
      .provider-card:hover { transform: translateY(-2px); }
      .provider-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
      .provider-name { font-weight: 800; font-size: 17px; }

      .field { display: grid; gap: 6px; margin-top: 10px; }
      label { color: var(--muted); font-size: 12px; font-weight: 800; text-transform: uppercase; }
      input, select, textarea {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        min-height: 40px;
        padding: 10px 11px;
        background: #ffffff;
        color: var(--ink);
        outline: none;
        transition: border-color 140ms ease, box-shadow 140ms ease;
      }
      input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(15,118,110,0.14); }
      textarea { min-height: 104px; resize: vertical; }

      .task-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
      .task-button {
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: #ffffff;
        padding: 12px;
        text-align: left;
        cursor: pointer;
        transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
      }
      .task-button:hover, .task-button.active { transform: translateY(-2px); border-color: var(--accent); box-shadow: var(--shadow); }
      .task-button strong { display: block; margin-bottom: 4px; }

      .chat-layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 14px; }
      .chat-window {
        display: grid;
        grid-template-rows: minmax(260px, 1fr) auto;
        min-height: 560px;
      }
      .messages { padding: 16px; overflow: auto; display: grid; gap: 12px; align-content: start; }
      .message { max-width: 86%; border-radius: var(--radius); padding: 12px; line-height: 1.45; white-space: pre-wrap; }
      .message.user { justify-self: end; background: #dbeafe; }
      .message.assistant { justify-self: start; background: #ecfdf5; }
      .message.system { justify-self: center; max-width: 100%; background: #f8fafc; color: var(--muted); }
      .composer { padding: 12px; border-top: 1px solid var(--line); }

      .arena-list { display: grid; gap: 10px; }
      .arena-card {
        display: grid;
        grid-template-columns: 48px minmax(0, 1fr) 150px;
        gap: 12px;
        align-items: center;
        padding: 12px;
        background: #ffffff;
        border: 1px solid var(--line);
        border-radius: var(--radius);
      }
      .rank {
        width: 38px;
        height: 38px;
        border-radius: var(--radius);
        display: grid;
        place-items: center;
        background: #0f172a;
        color: #ffffff;
        font-weight: 800;
      }
      .bar { height: 8px; background: #e5e7eb; border-radius: 999px; overflow: hidden; margin-top: 8px; }
      .bar span { display: block; height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent-2)); border-radius: 999px; }

      .toolbar { display: grid; grid-template-columns: 1fr 220px 220px; gap: 10px; margin-bottom: 14px; }
      .table-wrap { overflow: auto; border: 1px solid var(--line); border-radius: var(--radius); background: #ffffff; }
      table { width: 100%; min-width: 760px; border-collapse: collapse; }
      th, td { padding: 11px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
      th { color: var(--muted); font-size: 12px; text-transform: uppercase; background: #f8fafc; }
      tr:last-child td { border-bottom: 0; }

      .usage-grid { align-items: start; }
      .usage-panel {
        background: var(--surface);
        border: 1px solid rgba(215, 224, 234, 0.9);
        border-radius: var(--radius);
        box-shadow: var(--shadow);
        backdrop-filter: blur(10px);
        overflow: hidden;
      }
      .usage-panel-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 15px 16px;
        border-bottom: 1px solid var(--line);
        background: linear-gradient(135deg, rgba(15, 118, 110, 0.10), rgba(37, 99, 235, 0.08));
      }
      .usage-panel-head h2 { margin: 0; font-size: 18px; }
      .usage-panel-head .note { margin-top: 3px; }
      .usage-count {
        min-width: 54px;
        border-radius: var(--radius);
        padding: 8px 10px;
        text-align: center;
        background: #0f172a;
        color: #ffffff;
        font-weight: 800;
      }
      .usage-count span { display: block; color: #cbd5e1; font-size: 10px; font-weight: 700; text-transform: uppercase; }
      .quota-list, .usage-list { display: grid; gap: 10px; padding: 12px; }
      .quota-card {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 12px;
        padding: 13px;
        border: 1px solid var(--line);
        border-left: 5px solid #94a3b8;
        border-radius: var(--radius);
        background: #ffffff;
      }
      .quota-card.ok { border-left-color: var(--ok); background: linear-gradient(90deg, rgba(21, 128, 61, 0.10), #ffffff 55%); }
      .quota-card.watch { border-left-color: var(--warn); background: linear-gradient(90deg, rgba(180, 83, 9, 0.12), #ffffff 55%); }
      .quota-card.low, .quota-card.empty { border-left-color: var(--danger); background: linear-gradient(90deg, rgba(185, 28, 28, 0.11), #ffffff 55%); }
      .quota-title, .usage-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-weight: 850; }
      .quota-owner, .usage-owner { color: var(--muted); font-size: 12px; margin-top: 3px; word-break: break-word; }
      .quota-meter {
        height: 10px;
        margin-top: 10px;
        overflow: hidden;
        border-radius: 999px;
        background: #e2e8f0;
      }
      .quota-meter span {
        display: block;
        height: 100%;
        min-width: 4px;
        border-radius: 999px;
        background: var(--accent);
      }
      .quota-meter span.watch { background: var(--warn); }
      .quota-meter span.low, .quota-meter span.empty { background: var(--danger); }
      .quota-numbers { min-width: 112px; text-align: right; }
      .quota-numbers strong { display: block; font-size: 20px; }
      .quota-numbers span { color: var(--muted); font-size: 12px; }
      .quota-reset { margin-top: 6px; color: var(--muted); font-size: 12px; }
      .usage-metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        padding: 12px 12px 0;
      }
      .usage-metric {
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: 11px;
        background: #ffffff;
      }
      .usage-metric:nth-child(1) { border-color: #bfdbfe; background: #eff6ff; }
      .usage-metric:nth-child(2) { border-color: #bbf7d0; background: #ecfdf5; }
      .usage-metric:nth-child(3) { border-color: #fed7aa; background: #fff7ed; }
      .usage-metric strong { display: block; font-size: 20px; }
      .usage-metric span { color: var(--muted); font-size: 12px; }
      .usage-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 124px;
        gap: 12px;
        padding: 13px;
        border: 1px solid var(--line);
        border-radius: var(--radius);
        background: linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(124, 58, 237, 0.06) 46%, #ffffff 46%);
      }
      .usage-bar {
        display: grid;
        grid-template-columns: var(--prompt-share, 50%) 1fr;
        height: 9px;
        margin-top: 10px;
        overflow: hidden;
        border-radius: 999px;
        background: #e2e8f0;
      }
      .usage-bar span:first-child { background: var(--accent-2); }
      .usage-bar span:last-child { background: var(--accent-3); }
      .usage-side { text-align: right; }
      .usage-side strong { display: block; font-size: 18px; }
      .usage-side span { color: var(--muted); font-size: 12px; }
      .usage-empty {
        margin: 12px;
        padding: 16px;
        border: 1px dashed rgba(37, 99, 235, 0.35);
        border-radius: var(--radius);
        background: rgba(37, 99, 235, 0.07);
        color: var(--muted);
      }

      .empty { padding: 18px; border: 1px dashed var(--line); border-radius: var(--radius); color: var(--muted); background: rgba(255,255,255,0.72); }
      .toast { position: fixed; right: 18px; bottom: 18px; display: none; max-width: min(440px, calc(100vw - 36px)); padding: 12px 14px; border-radius: var(--radius); background: #0f172a; color: #ffffff; box-shadow: var(--shadow); }
      .toast.show { display: block; animation: riseIn 180ms ease both; }
      pre { margin: 0; padding: 14px; overflow: auto; border-radius: var(--radius); background: #0f172a; color: #e5e7eb; min-height: 180px; }

      /* Free/Paid badges */
      .badge-free { display: inline-block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 8px; border-radius: 4px; background: #059669; color: #fff; }
      .badge-paid { display: inline-block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 2px 8px; border-radius: 4px; background: #d97706; color: #fff; }
      .badge-free-lg { font-size: 12px; padding: 4px 12px; }
      .badge-paid-lg { font-size: 12px; padding: 4px 12px; }

      /* Key URL button */
      .key-btn { display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 6px; padding: 8px 14px; font-size: 13px; font-weight: 700; cursor: pointer; background: #0f766e; color: #fff; text-decoration: none; transition: transform 140ms ease, box-shadow 140ms ease; }
      .key-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 14px rgba(15,118,110,0.25); }
      .key-btn.external { background: #1d4ed8; }
      .key-btn.external:hover { box-shadow: 0 6px 14px rgba(29,78,216,0.25); }

      /* Onboarding overlay */
      .overlay { position: fixed; inset: 0; z-index: 1000; display: none; align-items: center; justify-content: center; background: rgba(15,23,42,0.72); backdrop-filter: blur(6px); }
      .overlay.show { display: flex; }
      .overlay-card { max-width: 560px; width: calc(100% - 32px); max-height: 90vh; overflow: auto; background: #fff; border-radius: 12px; box-shadow: 0 24px 64px rgba(0,0,0,0.25); padding: 32px; animation: riseIn 240ms ease both; }
      .overlay-card h2 { margin: 0 0 6px; font-size: 24px; }
      .overlay-card .sub { color: #607086; margin: 0 0 20px; font-size: 14px; line-height: 1.5; }
      .overlay-providers { display: grid; gap: 10px; }
      .overlay-provider { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; padding: 14px; border: 1px solid #d7e0ea; border-radius: 8px; transition: border-color 160ms ease, box-shadow 160ms ease; }
      .overlay-provider:hover { border-color: #0f766e; box-shadow: 0 4px 12px rgba(15,23,42,0.08); }
      .overlay-provider strong { display: block; font-size: 15px; }
      .overlay-provider span { font-size: 12px; color: #607086; }
      .overlay-provider .key-btn { font-size: 12px; padding: 6px 12px; }
      .overlay-divider { text-align: center; color: #94a3b8; font-size: 12px; font-weight: 700; text-transform: uppercase; margin: 12px 0; }
      .overlay-input-area { margin-top: 14px; }
      .overlay-input-area .field { margin-top: 0; }
      .overlay-input-area .row { margin-top: 10px; }

      /* Dark mode toggle */
      .theme-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 8px;
        padding: 8px 12px;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: var(--radius);
        background: transparent;
        color: #cbd5e1;
        cursor: pointer;
        font-size: 13px;
        transition: background 160ms ease, border-color 160ms ease;
      }
      .theme-toggle:hover { background: #1e293b; border-color: rgba(255,255,255,0.25); }
      .theme-toggle .icon { font-size: 16px; }

      /* Key Guide */
      .guide-hero {
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
        color: #f8fafc;
        padding: 32px;
        border-radius: 12px;
        margin-bottom: 20px;
        position: relative;
        overflow: hidden;
      }
      .guide-hero::after {
        content: "";
        position: absolute;
        width: 320px;
        height: 320px;
        right: -100px;
        top: -120px;
        border-radius: 999px;
        background: radial-gradient(circle, rgba(20,184,166,0.15), transparent 70%);
        animation: slowSpin 20s linear infinite;
      }
      .guide-hero h2 { margin: 0 0 6px; font-size: 28px; }
      .guide-hero p { color: #94a3b8; margin: 0 0 8px; max-width: 700px; line-height: 1.6; }

      .guide-section { margin-bottom: 22px; }
      .guide-section h3 {
        margin: 0 0 12px;
        font-size: 18px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--ink);
      }
      .guide-section h3 .icon { font-size: 20px; }

      .guide-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 14px; }

      .guide-card {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        padding: 20px;
        transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
      }
      .guide-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(15,23,42,0.12); border-color: var(--accent); }
      .guide-card h4 { margin: 0 0 4px; font-size: 16px; display: flex; align-items: center; gap: 8px; }
      .guide-card .meta { color: var(--muted); font-size: 12px; margin-bottom: 10px; }
      .guide-card .desc { font-size: 13px; line-height: 1.5; color: var(--ink); margin-bottom: 12px; }
      .guide-card .key-info { font-size: 12px; color: var(--muted); }
      .guide-card .key-info code {
        background: #1e293b;
        color: #e2e8f0;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
      }

      .code-block {
        background: #0f172a;
        border-radius: var(--radius);
        padding: 16px;
        overflow-x: auto;
        position: relative;
        margin: 10px 0;
      }
      .code-block pre {
        margin: 0;
        padding: 0;
        background: transparent;
        color: #e2e8f0;
        font-size: 13px;
        line-height: 1.6;
        min-height: auto;
      }
      .code-block .lang-tag {
        position: absolute;
        top: 8px;
        right: 10px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        color: #64748b;
        background: rgba(255,255,255,0.06);
        padding: 2px 8px;
        border-radius: 4px;
      }

      .best-practice {
        display: grid;
        grid-template-columns: 28px 1fr;
        gap: 10px;
        padding: 14px;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: var(--radius);
        margin-bottom: 10px;
        transition: transform 160ms ease, border-color 160ms ease;
      }
      .best-practice:hover { transform: translateX(4px); border-color: var(--accent); }
      .best-practice .bp-icon { font-size: 20px; line-height: 1.4; }
      .best-practice strong { display: block; font-size: 14px; }
      .best-practice p { margin: 2px 0 0; font-size: 13px; color: var(--muted); line-height: 1.5; }

      .provider-category-tabs {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 16px;
      }
      .provider-category-tabs button {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 6px 14px;
        font-size: 12px;
        font-weight: 700;
        background: var(--surface);
        color: var(--muted);
        cursor: pointer;
        transition: all 160ms ease;
      }
      .provider-category-tabs button:hover { border-color: var(--accent); color: var(--accent); }
      .provider-category-tabs button.active { background: var(--accent); color: #fff; border-color: var(--accent); }

      /* Staggered animation */
      .stagger > * {
        opacity: 0;
        transform: translateY(12px);
        animation: riseIn 300ms ease forwards;
      }
      .stagger > *:nth-child(1) { animation-delay: 40ms; }
      .stagger > *:nth-child(2) { animation-delay: 80ms; }
      .stagger > *:nth-child(3) { animation-delay: 120ms; }
      .stagger > *:nth-child(4) { animation-delay: 160ms; }
      .stagger > *:nth-child(5) { animation-delay: 200ms; }
      .stagger > *:nth-child(6) { animation-delay: 240ms; }
      .stagger > *:nth-child(7) { animation-delay: 280ms; }
      .stagger > *:nth-child(8) { animation-delay: 320ms; }
      .stagger > *:nth-child(9) { animation-delay: 360ms; }
      .stagger > *:nth-child(10) { animation-delay: 400ms; }

      @media (max-width: 1100px) {
        .hero, .chat-layout { grid-template-columns: 1fr; }
        .grid.three, .task-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .usage-grid { grid-template-columns: 1fr; }
      }
      @media (max-width: 820px) {
        .app { grid-template-columns: 1fr; }
        .sidebar { position: static; height: auto; }
        .main { padding: 18px; }
        .topbar { align-items: flex-start; flex-direction: column; }
        .grid, .grid.three, .task-grid, .toolbar, .metric-row { grid-template-columns: 1fr; }
        .usage-metrics, .usage-row, .quota-card { grid-template-columns: 1fr; }
        .quota-numbers, .usage-side { text-align: left; }
        .arena-card { grid-template-columns: 40px minmax(0, 1fr); }
        .arena-card > div:last-child { grid-column: 2; }
      }
    </style>
  </head>
  <body>
    <canvas id="particles"></canvas>
    <div class="app">
      <aside class="sidebar">
        <div class="brand">
          <div class="mark" aria-hidden="true"></div>
          <div><strong>Neura Console</strong><span>AI allocation runtime</span></div>
        </div>
        <nav class="nav">
          <button class="active" data-section="control">Control Room</button>
          <button data-section="keys">Core Keys</button>
          <button data-section="chat">Chat Lab</button>
          <button data-section="battle">Battleground</button>
          <button data-section="models">Models</button>
          <button data-section="usage">Usage Limits</button>
          <button data-section="catalog">Provider Catalog</button>
          <button data-section="guide">📖 Key Guide</button>
        </nav>
        <button class="theme-toggle" id="themeToggle"><span class="icon" id="themeIcon">🌙</span> <span id="themeLabel">Dark Mode</span></button>
        <div class="side-note">Start with a <strong>free</strong> API key (Gemini, Groq, GitHub Models) or a local model (Ollama/LM Studio). Then discover models and test routing.</div>
      </aside>

      <main class="main">
        <div class="topbar">
          <div>
            <h1 id="sectionTitle">Control Room</h1>
            <div class="subtitle" id="sectionSubtitle">Core setup, project task routing, and live model readiness.</div>
          </div>
          <div class="actions">
            <button class="button" id="refreshButton">Refresh</button>
            <button class="button primary" id="discoverButton">Discover Models</button>
          </div>
        </div>

        <section class="section active" id="control">
          <div class="hero">
            <div class="card readiness">
              <span class="status-pill" id="enginePill">Checking</span>
              <h2 id="engineTitle">Connect an understanding engine</h2>
              <p id="engineSubtitle">Use a main API key or a local Ollama/LM Studio model so Neura can classify tasks and route requests.</p>
              <div class="metric-row">
                <div class="metric"><strong id="metricProviders">0</strong><span>ready providers</span></div>
                <div class="metric"><strong id="metricModels">0</strong><span>chat models</span></div>
                <div class="metric"><strong id="metricLocal">0</strong><span>local models</span></div>
                <div class="metric"><strong id="metricCloud">0</strong><span>cloud models</span></div>
              </div>
            </div>
            <div class="card">
              <h2>Project Mode</h2>
              <p class="note">Pick what you are building. The battleground compares speed, capability, quota pressure, and reliability.</p>
              <div class="task-grid" id="taskTiles"></div>
            </div>
          </div>
          <div class="grid">
            <div class="card">
              <h2>Main API Keys</h2>
              <p class="note">These are the practical first keys. The full catalog is still available later.</p>
              <div class="grid" id="quickKeyCards"></div>
            </div>
            <div class="card">
              <h2>Recommended Now</h2>
              <div id="quickBattle" class="arena-list"></div>
            </div>
          </div>
        </section>

        <section class="section" id="keys">
          <div class="grid" id="coreKeyCards"></div>
        </section>

        <section class="section" id="chat">
          <div class="chat-layout">
            <div class="panel chat-window">
              <div class="messages" id="messages"></div>
              <div class="composer">
                <div class="field">
                  <label for="chatPrompt">Message</label>
                  <textarea id="chatPrompt" placeholder="Ask the selected runtime to solve a task."></textarea>
                </div>
                <div class="row" style="margin-top:10px">
                  <button class="button primary" id="sendChatButton">Send</button>
                  <button class="button" id="clearChatButton">Clear</button>
                </div>
              </div>
            </div>
            <div class="card">
              <h2>Chat Settings</h2>
              <div class="field">
                <label for="chatTask">Task</label>
                <select id="chatTask"></select>
              </div>
              <div class="field">
                <label for="chatModel">Optional model</label>
                <input id="chatModel" placeholder="provider:model or model id" />
              </div>
              <div class="field">
                <label for="temperature">Temperature</label>
                <input id="temperature" type="number" min="0" max="2" step="0.1" value="0.3" />
              </div>
              <div id="chatMeta" class="note" style="margin-top:14px"></div>
            </div>
          </div>
        </section>

        <section class="section" id="battle">
          <div class="card">
            <h2>Model Battleground</h2>
            <div class="row">
              <div class="field" style="min-width:240px; flex:1">
                <label for="battleTask">Task</label>
                <select id="battleTask"></select>
              </div>
              <div class="field" style="min-width:260px; flex:2">
                <label for="battlePrompt">Project prompt</label>
                <input id="battlePrompt" placeholder="Describe your project requirement" />
              </div>
              <button class="button blue" id="runBattleButton" style="margin-top:24px">Run Battle</button>
            </div>
          </div>
          <div style="height:14px"></div>
          <div id="battleResults" class="arena-list"></div>
        </section>

        <section class="section" id="models">
          <div id="modelsView"></div>
        </section>

        <section class="section" id="usage">
          <div class="grid usage-grid">
            <div id="quotasView"></div>
            <div id="usageView"></div>
          </div>
        </section>

        <section class="section" id="catalog">
          <div class="toolbar">
            <input id="providerSearch" placeholder="Search all providers, capabilities, or categories" />
            <select id="categoryFilter"><option value="">All categories</option></select>
            <select id="runtimeFilter">
              <option value="">All providers</option>
              <option value="ready">Runtime ready</option>
              <option value="manual">Key storage only</option>
              <option value="configured">Configured keys</option>
            </select>
          </div>
          <div class="grid" id="providerCards"></div>
        </section>

        <section class="section" id="guide">
          <div class="guide-hero">
            <h2>🔑 API Key Guide</h2>
            <p>Everything you need to know about API keys: what they are, how they work, where to get them, and how to integrate them into your projects. Learn the best practices for securing and managing your AI provider credentials.</p>
          </div>

          <div class="guide-section">
            <h3><span class="icon">💡</span> What Are API Keys?</h3>
            <div class="guide-grid" id="guideWhatIs"></div>
          </div>

          <div class="guide-section">
            <h3><span class="icon">🛠️</span> How to Integrate API Keys in Your Code</h3>
            <div id="guideIntegration"></div>
          </div>

          <div class="guide-section">
            <h3><span class="icon">🔐</span> Security Best Practices</h3>
            <div id="guideBestPractices"></div>
          </div>

          <div class="guide-section">
            <h3><span class="icon">🌐</span> Provider-by-Provider Key Guide</h3>
            <div class="provider-category-tabs" id="guideProviderTabs"></div>
            <div class="guide-grid stagger" id="guideProviders"></div>
          </div>
        </section>
      </main>
    </div>
    <div class="toast" id="toast"></div>
    <div class="overlay" id="onboardingOverlay">
      <div class="overlay-card">
        <div class="mark" style="width:48px;height:48px;margin-bottom:14px"></div>
        <h2>Welcome to Neura</h2>
        <p class="sub">Your AI model routing console. Start by connecting a free API key or a local model, then discover and compare models across providers.</p>
        <div class="overlay-providers" id="onboardingProviders"></div>
        <div class="overlay-divider">or paste any API key</div>
        <div class="overlay-input-area">
          <div class="field">
            <label for="onboardingKey">API Key</label>
            <input id="onboardingKey" type="password" placeholder="Paste your Gemini, Groq, or other API key" autocomplete="off" />
          </div>
          <div class="field">
            <label for="onboardingKeyProvider">Provider</label>
            <select id="onboardingKeyProvider"></select>
          </div>
          <div class="row">
            <button class="button primary" id="onboardingSaveButton">Connect &amp; Get Started</button>
            <button class="button ghost" id="onboardingSkipButton">Show full console</button>
          </div>
        </div>
      </div>
    </div>

    <script>
      const state = {
        guides: [],
        coreProviderIds: [],
        taskPresets: [],
        env: null,
        readiness: null,
        status: null,
        filters: { query: "", category: "", runtime: "" },
        activeTask: "coding",
        messages: []
      };
      const titles = {
        control: ["Control Room", "Core setup, project task routing, and live model readiness."],
        keys: ["Core Keys", "Main API keys and local runtimes for the first working engine."],
        chat: ["Chat Lab", "Talk to the routed model and inspect provider, model, and token usage."],
        battle: ["Battleground", "Compare models for speed, capability, limits, pros, and cons."],
        models: ["Models", "Discovered models and what each one supports."],
        usage: ["Usage Limits", "Tracked quota windows, cooldowns, and token usage."],
        catalog: ["Provider Catalog", "All providers, including future adapter candidates."],
        guide: ["API Key Guide", "Learn about API keys, integration, security, and each provider's setup."]
      };

      document.querySelectorAll(".nav button").forEach((button) => {
        button.addEventListener("click", () => showSection(button.dataset.section));
      });
      document.getElementById("refreshButton").addEventListener("click", load);
      document.getElementById("discoverButton").addEventListener("click", discover);
      document.getElementById("sendChatButton").addEventListener("click", sendChat);
      document.getElementById("onboardingSaveButton").addEventListener("click", onboardingSave);
      document.getElementById("onboardingSkipButton").addEventListener("click", () => document.getElementById("onboardingOverlay").classList.remove("show"));
      document.getElementById("clearChatButton").addEventListener("click", () => { state.messages = []; renderMessages(); });
      document.getElementById("runBattleButton").addEventListener("click", runBattle);
      document.getElementById("providerSearch").addEventListener("input", (event) => { state.filters.query = event.target.value.toLowerCase(); renderCatalog(); });
      document.getElementById("categoryFilter").addEventListener("change", (event) => { state.filters.category = event.target.value; renderCatalog(); });
      document.getElementById("runtimeFilter").addEventListener("change", (event) => { state.filters.runtime = event.target.value; renderCatalog(); });
      document.getElementById("themeToggle").addEventListener("click", toggleTheme);

      document.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target.closest("[data-action]") : null;
        if (!target) return;
        const action = target.dataset.action;
        if (action === "select-task") selectTask(target.dataset.task);
        if (action === "save-provider") saveProvider(target.dataset.provider);
        if (action === "test-provider") testProvider(target.dataset.provider);
        if (action === "guide-tab") switchGuideTab(target.dataset.tab);
      });

      async function load() {
        const data = await request("/api/bootstrap");
        state.guides = data.guides;
        state.coreProviderIds = data.coreProviderIds;
        state.taskPresets = data.taskPresets;
        state.env = data.env;
        state.readiness = data.readiness;
        state.status = data.status;
        hydrateTaskSelects();
        renderCategoryOptions();
        renderAll();
        checkOnboarding();
      }

      function renderAll() {
        renderReadiness();
        renderTaskTiles();
        renderCoreKeys();
        renderCatalog();
        renderModels();
        renderQuotas();
        renderUsage();
        renderMessages();
        runQuickBattle();
      }

      function showSection(id) {
        document.querySelectorAll(".nav button").forEach((item) => item.classList.toggle("active", item.dataset.section === id));
        document.querySelectorAll(".section").forEach((item) => item.classList.toggle("active", item.id === id));
        document.getElementById("sectionTitle").textContent = titles[id][0];
        document.getElementById("sectionSubtitle").textContent = titles[id][1];
        if (id === "guide") renderKeyGuide();
      }

      async function discover() {
        toast("Discovering models...");
        const data = await request("/api/discover", { method: "POST" });
        state.status = data.status;
        state.readiness = data.readiness;
        renderAll();
        toast("Discovery complete: " + data.count + " models refreshed.");
      }

      async function saveProvider(providerId) {
        const apiKeyInput = document.getElementById(providerId + "-key");
        const baseUrlInput = document.getElementById(providerId + "-baseUrl");
        const enabledInput = document.getElementById(providerId + "-enabled");
        const data = await request("/api/providers", {
          method: "POST",
          body: JSON.stringify({
            providerId,
            apiKey: apiKeyInput ? apiKeyInput.value : undefined,
            baseUrl: baseUrlInput ? baseUrlInput.value : undefined,
            enabled: enabledInput ? enabledInput.checked : undefined
          })
        });
        state.env = data.env;
        state.status = data.status;
        state.readiness = data.readiness;
        renderAll();
        toast("Saved " + providerId + ".");
      }

      async function testProvider(providerId) {
        const apiKeyInput = document.getElementById(providerId + "-key");
        const baseUrlInput = document.getElementById(providerId + "-baseUrl");
        const enabledInput = document.getElementById(providerId + "-enabled");
        const resultNode = document.getElementById(providerId + "-test-result");
        if (resultNode) resultNode.textContent = "Testing...";
        try {
          const data = await request("/api/test-provider", {
            method: "POST",
            body: JSON.stringify({
              providerId,
              apiKey: apiKeyInput ? apiKeyInput.value : undefined,
              baseUrl: baseUrlInput ? baseUrlInput.value : undefined,
              enabled: enabledInput ? enabledInput.checked : undefined
            })
          });
          const message = data.message + (data.modelCount !== undefined ? " Models visible: " + data.modelCount + "." : "");
          if (resultNode) resultNode.textContent = message;
          toast(message);
        } catch (error) {
          if (resultNode) resultNode.textContent = error.message;
          toast(error.message);
        }
      }

      async function sendChat() {
        const input = document.getElementById("chatPrompt");
        const prompt = input.value.trim();
        if (!prompt) return;
        const task = document.getElementById("chatTask").value;
        const model = document.getElementById("chatModel").value.trim();
        const temperature = Number(document.getElementById("temperature").value || "0.3");
        state.messages.push({ role: "user", content: prompt });
        input.value = "";
        renderMessages();
        document.getElementById("chatMeta").textContent = "Routing...";
        try {
          const data = await request("/api/chat", {
            method: "POST",
            body: JSON.stringify({ messages: state.messages, task, model: model || undefined, temperature })
          });
          if (data.result) {
            state.messages.push({ role: "assistant", content: data.result.text });
            document.getElementById("chatMeta").textContent = data.result.providerId + " / " + data.result.modelId + " - " + data.result.usage.totalTokens + " tokens";
          } else {
            state.messages.push({ role: "assistant", content: data.message || "Route-only result returned." });
            document.getElementById("chatMeta").textContent = "Route-only";
          }
          if (data.readiness) state.readiness = data.readiness;
          renderMessages();
        } catch (error) {
          state.messages.push({ role: "system", content: error.message });
          renderMessages();
          document.getElementById("chatMeta").textContent = error.message;
        }
      }

      async function runBattle() {
        const task = document.getElementById("battleTask").value;
        const prompt = document.getElementById("battlePrompt").value.trim();
        const host = document.getElementById("battleResults");
        host.innerHTML = '<div class="empty">Running comparison...</div>';
        try {
          const data = await request("/api/battle", {
            method: "POST",
            body: JSON.stringify({ task, prompt })
          });
          host.innerHTML = renderArena(data.candidates);
        } catch (error) {
          host.innerHTML = '<div class="empty">' + escapeHtml(error.message) + '</div>';
        }
      }

      async function runQuickBattle() {
        if (!state.readiness?.readyForChat) {
          document.getElementById("quickBattle").innerHTML = '<div class="empty">Connect an API key or local model, then discover models.</div>';
          return;
        }
        try {
          const preset = state.taskPresets.find((item) => item.id === state.activeTask) || state.taskPresets[0];
          const data = await request("/api/battle", {
            method: "POST",
            body: JSON.stringify({ task: preset.id, prompt: preset.prompt })
          });
          document.getElementById("quickBattle").innerHTML = renderArena(data.candidates.slice(0, 4));
        } catch (error) {
          document.getElementById("quickBattle").innerHTML = '<div class="empty">' + escapeHtml(error.message) + '</div>';
        }
      }

      function renderReadiness() {
        const r = state.readiness || {};
        const ready = Boolean(r.readyForChat);
        const pill = document.getElementById("enginePill");
        pill.textContent = ready ? "Ready" : r.hasRuntimeProvider ? "Discover models" : "Needs engine";
        pill.className = "status-pill " + (ready ? "ok" : r.hasRuntimeProvider ? "warn" : "bad");
        document.getElementById("engineTitle").textContent = ready ? "Runtime is ready for chat and routing" : "Connect an understanding engine";
        document.getElementById("engineSubtitle").textContent = r.nextStep || "Add one core API key or connect Ollama.";
        document.getElementById("metricProviders").textContent = (r.runtimeReadyProviders || []).length;
        document.getElementById("metricModels").textContent = r.chatModelCount || 0;
        document.getElementById("metricLocal").textContent = r.localModelCount || 0;
        document.getElementById("metricCloud").textContent = r.cloudModelCount || 0;
      }

      function renderTaskTiles() {
        const host = document.getElementById("taskTiles");
        host.innerHTML = state.taskPresets.map((preset) => (
          '<button class="task-button ' + (state.activeTask === preset.id ? "active" : "") + '" data-action="select-task" data-task="' + escapeAttr(preset.id) + '">' +
          '<strong>' + escapeHtml(preset.label) + '</strong><span class="note">' + escapeHtml(preset.summary) + '</span></button>'
        )).join("");
      }

      function selectTask(task) {
        if (!task) return;
        state.activeTask = task;
        document.getElementById("chatTask").value = task;
        document.getElementById("battleTask").value = task;
        const preset = state.taskPresets.find((item) => item.id === task);
        if (preset) document.getElementById("battlePrompt").value = preset.prompt;
        renderTaskTiles();
        runQuickBattle();
      }

      function hydrateTaskSelects() {
        const options = state.taskPresets.map((preset) => '<option value="' + preset.id + '">' + escapeHtml(preset.label) + '</option>').join("");
        document.getElementById("chatTask").innerHTML = options;
        document.getElementById("battleTask").innerHTML = options;
        document.getElementById("chatTask").value = state.activeTask;
        document.getElementById("battleTask").value = state.activeTask;
        const preset = state.taskPresets.find((item) => item.id === state.activeTask);
        if (preset && !document.getElementById("battlePrompt").value) document.getElementById("battlePrompt").value = preset.prompt;
      }

      function checkOnboarding() {
        const hasKeys = Object.values(state.env.providers).some((p) => p.keyConfigured || p.enabled);
        if (!hasKeys && state.guides.length) {
          renderOnboarding();
          document.getElementById("onboardingOverlay").classList.add("show");
        }
      }

      function renderOnboarding() {
        const freeProviders = state.guides.filter((g) => g.supportsRuntime && g.keyEnvVar).slice(0, 8);
        const host = document.getElementById("onboardingProviders");
        host.innerHTML = freeProviders.map((guide) =>
          '<div class="overlay-provider">' +
          '<div><strong>' + escapeHtml(guide.displayName) + '</strong><span>' + escapeHtml(guide.id) + ' &bull; ' + (guide.capabilities || []).slice(0, 4).join(", ") + '</span></div>' +
          '<div class="row" style="gap:6px">' +
          (guide.keyUrl ? '<a class="key-btn" href="' + escapeAttr(guide.keyUrl) + '" target="_blank" rel="noreferrer">Get Free Key</a>' : '') +
          '</div></div>'
        ).join("");
        const select = document.getElementById("onboardingKeyProvider");
        select.innerHTML = freeProviders.map((g) => '<option value="' + escapeAttr(g.id) + '">' + escapeHtml(g.displayName) + '</option>').join("");
      }

      async function onboardingSave() {
        const providerId = document.getElementById("onboardingKeyProvider").value;
        const apiKey = document.getElementById("onboardingKey").value.trim();
        if (!apiKey) { toast("Please paste an API key"); return; }
        const keyInput = document.getElementById(providerId + "-key");
        if (keyInput) keyInput.value = apiKey;
        await saveProvider(providerId);
        document.getElementById("onboardingOverlay").classList.remove("show");
        toast("API key saved! Run Discover Models to find available models.");
      }

      function freeBadge(free) {
        if (free) return '<span class="badge-free">FREE</span>';
        if (free === false) return '<span class="badge-paid">PAID</span>';
        return '';
      }

      function renderCoreKeys() {
        const coreGuides = state.coreProviderIds.map((id) => state.guides.find((guide) => guide.id === id)).filter(Boolean);
        const quick = coreGuides.slice(0, 6);
        document.getElementById("quickKeyCards").innerHTML = quick.map(renderProviderCardCompact).join("");
        document.getElementById("coreKeyCards").innerHTML = coreGuides.map(renderProviderCard).join("");
      }

      function renderCatalog() {
        const host = document.getElementById("providerCards");
        const visible = state.guides.filter(providerVisible);
        host.innerHTML = visible.length ? visible.map(renderProviderCard).join("") : '<div class="empty">No providers match the current filters.</div>';
      }

      function renderProviderCardCompact(guide) {
        const env = state.env.providers[guide.id] || {};
        const status = providerStatus(guide.id);
        return '<div class="card provider-card">' +
          '<div class="provider-head"><div><div class="provider-name">' + escapeHtml(guide.displayName) + '</div><div class="note">' + escapeHtml(guide.keyEnvVar || "Local runtime") + '</div></div>' +
          '<div class="row" style="gap:6px">' + freeBadge(guide.freeTier) + statusPill(status, guide) + '</div></div>' +
          '<div class="tag-row">' + guide.capabilities.slice(0, 4).map((cap) => '<span class="tag blue">' + escapeHtml(cap) + '</span>').join("") + '</div>' +
          (guide.keyUrl ? '<div class="row" style="margin:8px 0"><a class="key-btn" href="' + escapeAttr(guide.keyUrl) + '" target="_blank" rel="noreferrer">Get API Key &rarr;</a></div>' : '') +
          inputFields(guide, env) +
          '<div class="row" style="margin-top:10px"><button class="button primary" data-action="save-provider" data-provider="' + escapeAttr(guide.id) + '">Save</button><button class="button" data-action="test-provider" data-provider="' + escapeAttr(guide.id) + '">Test</button></div>' +
          '<div class="test-result" id="' + guide.id + '-test-result"></div></div>';
      }

      function renderProviderCard(guide) {
        const env = state.env.providers[guide.id] || {};
        const status = providerStatus(guide.id);
        return '<article class="card provider-card">' +
          '<div class="provider-head"><div><div class="provider-name">' + escapeHtml(guide.displayName) + '</div><div class="note">' + label(guide.category) + ' - ' + escapeHtml(guide.keyEnvVar || "No API key required") + '</div></div>' +
          '<div class="row" style="gap:6px">' + freeBadge(guide.freeTier) + statusPill(status, guide) + '</div></div>' +
          '<div class="tag-row"><span class="tag ' + (guide.supportsRuntime ? "ok" : "warn") + '">' + (guide.supportsRuntime ? "runtime ready" : "key storage") + '</span><span class="tag">' + escapeHtml(guide.type) + '</span>' +
          guide.capabilities.slice(0, 8).map((cap) => '<span class="tag blue">' + escapeHtml(cap) + '</span>').join("") + '</div>' +
          '<div class="row" style="margin:8px 0;gap:8px">' +
          (guide.keyUrl ? '<a class="key-btn" href="' + escapeAttr(guide.keyUrl) + '" target="_blank" rel="noreferrer">Get Free API Key &rarr;</a>' : '') +
          '<a class="button" href="' + escapeAttr(guide.docsUrl) + '" target="_blank" rel="noreferrer">Docs</a></div>' +
          '<p class="note">' + escapeHtml(guide.instructions.join(" ")) + '</p>' +
          inputFields(guide, env) +
          '<p class="note">' + escapeHtml(guide.notes.join(" ")) + '</p>' +
          '<div class="row"><button class="button primary" data-action="save-provider" data-provider="' + escapeAttr(guide.id) + '">Save</button><button class="button" data-action="test-provider" data-provider="' + escapeAttr(guide.id) + '">Test Key</button><span class="note">Local .env</span></div>' +
          '<div class="test-result" id="' + guide.id + '-test-result"></div></article>';
      }

      function inputFields(guide, env) {
        const keyField = guide.keyEnvVar
          ? '<div class="field"><label>API key</label><input id="' + guide.id + '-key" type="password" placeholder="' + escapeAttr(env.keyConfigured ? "Configured: " + env.maskedKey : "Paste " + guide.keyEnvVar) + '" autocomplete="off" /></div>'
          : '<div class="row" style="margin-top:10px"><label style="display:flex; align-items:center; gap:8px; text-transform:none; font-size:14px"><input id="' + guide.id + '-enabled" type="checkbox" ' + (env.enabled ? "checked" : "") + ' style="width:18px; min-height:18px" />Enable ' + escapeHtml(guide.displayName) + '</label></div>';
        return keyField + '<div class="field"><label>Base URL</label><input id="' + guide.id + '-baseUrl" value="' + escapeAttr(env.baseUrl || guide.defaultBaseUrl) + '" /></div>';
      }

      function renderMessages() {
        const host = document.getElementById("messages");
        if (!state.messages.length) {
          host.innerHTML = '<div class="message system">Connect one engine, discover models, then send a test message.</div>';
          return;
        }
        host.innerHTML = state.messages.map((message) => '<div class="message ' + escapeAttr(message.role) + '">' + escapeHtml(message.content) + '</div>').join("");
        host.scrollTop = host.scrollHeight;
      }

      function renderArena(candidates) {
        if (!candidates || !candidates.length) return '<div class="empty">No candidates yet. Discover models first.</div>';
        return candidates.map((candidate) => {
          const score = Math.round((candidate.score || 0) * 100);
          const speed = Math.round(((candidate.scores && candidate.scores.speed) || 0) * 100);
          const pros = (candidate.pros || []).join(", ") || "general fit";
          const cons = (candidate.cons || []).join(", ") || "no major local warning";
          const quota = candidate.quota && candidate.quota.requestsRemaining !== undefined
            ? candidate.quota.requestsRemaining + " requests left"
            : "quota unknown";
          const free = candidate.freeTier ? '<span class="badge-free">FREE</span>' : '<span class="badge-paid">PAID</span>';
          return '<div class="arena-card">' +
            '<div class="rank">' + candidate.rank + '</div>' +
            '<div><strong>' + escapeHtml(candidate.providerName) + ' / ' + escapeHtml(candidate.displayName) + ' ' + free + '</strong>' +
            '<div class="note">Pros: ' + escapeHtml(pros) + '</div><div class="note">Cons: ' + escapeHtml(cons) + '</div>' +
            '<div class="tag-row"><span class="tag ok">fit ' + score + '</span><span class="tag blue">speed ' + speed + '</span><span class="tag">' + escapeHtml(quota) + '</span></div>' +
            '<div class="bar"><span style="width:' + score + '%"></span></div></div>' +
            '<div class="note">Context: ' + (candidate.contextWindow || "unknown") + '<br>Health: ' + escapeHtml(candidate.health || "unknown") + '</div>' +
          '</div>';
        }).join("");
      }

      function renderModels() {
        const models = state.status.models || [];
        const host = document.getElementById("modelsView");
        if (!models.length) {
          host.innerHTML = '<div class="empty">No models discovered yet. Add a core key or local model, then use Discover Models.</div>';
          return;
        }
        host.innerHTML = '<div class="table-wrap"><table><thead><tr><th>Provider</th><th>Model</th><th>Cost</th><th>Best For</th><th>Context</th><th>Capabilities</th><th>Health</th></tr></thead><tbody>' +
          models.map((model) => '<tr><td>' + escapeHtml(model.providerId) + '</td><td>' + escapeHtml(model.displayName || model.id) + '</td><td>' + (model.freeTier ? '<span class="badge-free">FREE</span>' : '<span class="badge-paid">PAID</span>') + '</td><td>' + (modelStrengths(model).join(", ") || "general") + '</td><td>' + (model.contextWindow || "unknown") + '</td><td>' + capabilities(model).join(", ") + '</td><td>' + escapeHtml(model.health) + '</td></tr>').join("") +
          '</tbody></table></div>';
      }

      function renderQuotas() {
        const quotas = state.status.quotas || [];
        const host = document.getElementById("quotasView");
        if (!quotas.length) {
          host.innerHTML = '<article class="usage-panel"><div class="usage-panel-head"><div><h2>Quota Pressure</h2><div class="note">Limits by provider and reset window.</div></div><div class="usage-count">0<span>windows</span></div></div><div class="usage-empty">No quota records yet.</div></article>';
          return;
        }
        const windows = quotas.flatMap((quota) => quota.windows.map((window) => ({ quota, window })));
        host.innerHTML =
          '<article class="usage-panel"><div class="usage-panel-head"><div><h2>Quota Pressure</h2><div class="note">Limits by provider and reset window.</div></div><div class="usage-count">' + windows.length + '<span>windows</span></div></div>' +
          '<div class="quota-list">' +
          windows.map(({ quota, window }) => renderQuotaWindow(quota, window)).join("") +
          '</div></article>';
      }

      function renderUsage() {
        const usage = state.status.usage || [];
        const host = document.getElementById("usageView");
        if (!usage.length) {
          host.innerHTML = '<article class="usage-panel"><div class="usage-panel-head"><div><h2>Usage History</h2><div class="note">Requests, tokens, and success rate.</div></div><div class="usage-count">0<span>calls</span></div></div><div class="usage-empty">No usage events recorded yet.</div></article>';
          return;
        }
        const totals = usage.reduce((sum, item) => ({
          requests: sum.requests + (item.requestCount || 0),
          tokens: sum.tokens + (item.totalTokens || 0),
          successes: sum.successes + (item.successCount || 0),
          failures: sum.failures + (item.failureCount || 0)
        }), { requests: 0, tokens: 0, successes: 0, failures: 0 });
        const successRate = totals.requests ? Math.round((totals.successes / totals.requests) * 100) : 0;
        host.innerHTML =
          '<article class="usage-panel"><div class="usage-panel-head"><div><h2>Usage History</h2><div class="note">Requests, tokens, and success rate.</div></div><div class="usage-count">' + formatNumber(totals.requests) + '<span>calls</span></div></div>' +
          '<div class="usage-metrics">' +
            '<div class="usage-metric"><strong>' + formatNumber(totals.tokens) + '</strong><span>total tokens</span></div>' +
            '<div class="usage-metric"><strong>' + successRate + '%</strong><span>success rate</span></div>' +
            '<div class="usage-metric"><strong>' + formatNumber(totals.failures) + '</strong><span>failed calls</span></div>' +
          '</div>' +
          '<div class="usage-list">' + usage.map(renderUsageRow).join("") + '</div></article>';
      }

      function renderQuotaWindow(quota, window) {
        const percent = quotaPercent(window);
        const level = quotaLevel(percent, quota.isExhausted);
        const owner = quota.modelId ? quota.providerId + " / " + quota.modelId : quota.providerId;
        const remaining = window.remaining ?? "unknown";
        const limit = window.limit ?? "unknown";
        const width = percent === null ? 100 : Math.max(0, Math.min(100, percent));
        const labelText = quotaWindowLabel(window.kind);
        return '<div class="quota-card ' + level + '">' +
          '<div><div class="quota-title">' + escapeHtml(labelText) + statusTag(level, quotaStatusText(level)) + '</div>' +
          '<div class="quota-owner">' + escapeHtml(owner) + '</div>' +
          '<div class="quota-meter"><span class="' + level + '" style="width:' + width + '%"></span></div>' +
          '<div class="quota-reset">resets ' + escapeHtml(resetText(window.resetAt)) + '</div></div>' +
          '<div class="quota-numbers"><strong>' + formatNumber(remaining) + '</strong><span>of ' + formatNumber(limit) + ' left</span></div>' +
        '</div>';
      }

      function renderUsageRow(item) {
        const requestCount = item.requestCount || 0;
        const successRate = requestCount ? Math.round(((item.successCount || 0) / requestCount) * 100) : 0;
        const status = item.failureCount ? (successRate >= 80 ? "watch" : "low") : "ok";
        const promptShare = item.totalTokens ? Math.round(((item.promptTokens || 0) / item.totalTokens) * 100) : 50;
        return '<div class="usage-row" style="--prompt-share:' + Math.max(0, Math.min(100, promptShare)) + '%">' +
          '<div><div class="usage-title">' + escapeHtml(item.providerId || "unknown") + statusTag(status, successRate + "% success") + '</div>' +
          '<div class="usage-owner">' + escapeHtml(item.modelId || "unknown model") + '</div>' +
          '<div class="usage-bar"><span></span><span></span></div>' +
          '<div class="quota-reset">' + formatNumber(item.promptTokens || 0) + ' prompt tokens / ' + formatNumber(item.completionTokens || 0) + ' completion tokens</div></div>' +
          '<div class="usage-side"><strong>' + formatNumber(item.totalTokens || 0) + '</strong><span>' + formatNumber(requestCount) + ' requests</span></div>' +
        '</div>';
      }

      function quotaPercent(window) {
        if (typeof window.remaining !== "number" || typeof window.limit !== "number" || window.limit <= 0) return null;
        return Math.round((window.remaining / window.limit) * 100);
      }

      function quotaLevel(percent, isExhausted) {
        if (isExhausted || percent === 0) return "empty";
        if (percent === null) return "unknown";
        if (percent < 20) return "low";
        if (percent < 50) return "watch";
        return "ok";
      }

      function quotaStatusText(level) {
        return level === "ok" ? "healthy" : level === "watch" ? "watch" : level === "unknown" ? "unknown" : level === "empty" ? "empty" : "low";
      }

      function quotaWindowLabel(kind) {
        const labels = { rpm: "Requests / minute", rpd: "Requests / day", tpm: "Tokens / minute", tpd: "Tokens / day" };
        return labels[kind] || String(kind || "Quota window").toUpperCase();
      }

      function statusTag(level, text) {
        const cls = level === "ok" ? "ok" : level === "watch" || level === "unknown" ? "warn" : "bad";
        return '<span class="tag ' + cls + '">' + escapeHtml(text) + '</span>';
      }

      function resetText(value) {
        if (!value) return "unknown";
        const reset = new Date(value);
        if (Number.isNaN(reset.getTime())) return String(value);
        const diff = reset.getTime() - Date.now();
        if (diff <= 0) return "now";
        const minutes = Math.ceil(diff / 60000);
        if (minutes < 60) return "in " + minutes + "m";
        const hours = Math.ceil(minutes / 60);
        if (hours < 24) return "in " + hours + "h";
        return "in " + Math.ceil(hours / 24) + "d";
      }

      function formatNumber(value) {
        if (typeof value !== "number") return escapeHtml(value);
        return new Intl.NumberFormat().format(value);
      }

      function renderCategoryOptions() {
        const select = document.getElementById("categoryFilter");
        const current = select.value;
        const categories = [...new Set(state.guides.map((guide) => guide.category))].sort();
        select.innerHTML = '<option value="">All categories</option>' + categories.map((category) => '<option value="' + category + '">' + label(category) + '</option>').join("");
        select.value = current;
      }

      function providerVisible(guide) {
        const env = state.env.providers[guide.id] || {};
        const query = state.filters.query;
        const haystack = [guide.id, guide.displayName, guide.category, guide.type, guide.keyEnvVar, ...(guide.capabilities || [])].filter(Boolean).join(" ").toLowerCase();
        if (query && !haystack.includes(query)) return false;
        if (state.filters.category && guide.category !== state.filters.category) return false;
        if (state.filters.runtime === "ready" && !guide.supportsRuntime) return false;
        if (state.filters.runtime === "manual" && guide.supportsRuntime) return false;
        if (state.filters.runtime === "configured" && !env.keyConfigured && !env.enabled) return false;
        return true;
      }

      function providerStatus(providerId) {
        return (state.status.providers || []).find((provider) => provider.id === providerId);
      }

      function statusPill(status, guide) {
        const text = !guide.supportsRuntime ? "storage" : !status?.enabled ? "disabled" : status.healthy ? "healthy" : "check";
        const cls = status?.healthy ? "ok" : status?.enabled || !guide.supportsRuntime ? "warn" : "";
        return '<span class="status-pill ' + cls + '">' + text + '</span>';
      }

      function capabilities(model) {
        return Object.entries(model.capabilities || {}).filter(([, enabled]) => Boolean(enabled)).map(([name]) => name);
      }

      function modelStrengths(model) {
        const scores = model.scores || {};
        return [
          scores.coding >= 0.75 ? "coding" : undefined,
          scores.reasoning >= 0.75 ? "reasoning" : undefined,
          scores.vision >= 0.7 ? "vision" : undefined,
          scores.imageGeneration >= 0.7 ? "image generation" : undefined,
          scores.embeddings >= 0.7 ? "embeddings" : undefined,
          scores.speed >= 0.8 ? "fast" : undefined,
          scores.longContext >= 0.6 ? "long context" : undefined
        ].filter(Boolean);
      }

      async function request(path, init = {}) {
        const response = await fetch(path, { headers: { "content-type": "application/json" }, ...init });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || data.message || "Request failed");
        return data;
      }

      function toast(message) {
        const node = document.getElementById("toast");
        node.textContent = message;
        node.classList.add("show");
        clearTimeout(window.__toastTimer);
        window.__toastTimer = setTimeout(() => node.classList.remove("show"), 3000);
      }

      function label(value) {
        return String(value || "").split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
      }
      function escapeHtml(value) {
        return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
      }
      function escapeAttr(value) { return escapeHtml(value); }

      // ====== Dark Mode ======
      function initTheme() {
        const saved = localStorage.getItem("neura-theme");
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const dark = saved ? saved === "dark" : prefersDark;
        document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
        document.getElementById("themeIcon").textContent = dark ? "☀️" : "🌙";
        document.getElementById("themeLabel").textContent = dark ? "Light Mode" : "Dark Mode";
      }

      function toggleTheme() {
        const html = document.documentElement;
        const isDark = html.getAttribute("data-theme") !== "dark";
        html.setAttribute("data-theme", isDark ? "dark" : "light");
        localStorage.setItem("neura-theme", isDark ? "dark" : "light");
        document.getElementById("themeIcon").textContent = isDark ? "☀️" : "🌙";
        document.getElementById("themeLabel").textContent = isDark ? "Light Mode" : "Dark Mode";
      }

      // ====== Particles ======
      let particlesInitialized = false;
      function initParticles() {
        if (particlesInitialized) return;
        particlesInitialized = true;
        const canvas = document.getElementById("particles");
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        let w, h, particles = [];
        const COUNT = 40;

        function resize() {
          w = canvas.width = window.innerWidth;
          h = canvas.height = window.innerHeight;
        }

        class Particle {
          constructor() {
            this.reset();
          }
          reset() {
            this.x = Math.random() * w;
            this.y = Math.random() * h;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.r = Math.random() * 2 + 1;
            this.alpha = Math.random() * 0.4 + 0.1;
          }
          update() {
            this.x += this.vx;
            this.y += this.vy;
            if (this.x < 0 || this.x > w) this.vx *= -1;
            if (this.y < 0 || this.y > h) this.vy *= -1;
          }
          draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(20, 184, 166, " + this.alpha + ")";
            ctx.fill();
          }
        }

        for (let i = 0; i < COUNT; i++) particles.push(new Particle());

        function animate() {
          ctx.clearRect(0, 0, w, h);
          for (const p of particles) {
            p.update();
            p.draw();
          }
          // Draw connections
          for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
              const dx = particles[i].x - particles[j].x;
              const dy = particles[i].y - particles[j].y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 120) {
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.strokeStyle = "rgba(20, 184, 166, " + (0.08 * (1 - dist / 120)) + ")";
                ctx.lineWidth = 0.6;
                ctx.stroke();
              }
            }
          }
          requestAnimationFrame(animate);
        }

        resize();
        window.addEventListener("resize", resize);
        animate();
      }

      // ====== API Key Guide ======
      function renderKeyGuide() {
        renderGuideWhatIs();
        renderGuideIntegration();
        renderGuideBestPractices();
        renderGuideProviders();
      }

      function renderGuideWhatIs() {
        const host = document.getElementById("guideWhatIs");
        host.innerHTML = [
          {
            title: "What is an API Key?",
            desc: "An API key is a unique identifier that authenticates requests to a service's API. Think of it like a password or access token — it tells the provider who you are and what you're allowed to do.",
            icon: "🔑"
          },
          {
            title: "How Do They Work?",
            desc: "When your application makes a request to an AI provider, the API key is included in the request headers. The provider validates the key, checks your quota/usage limits, and processes the request. Without a valid key, the API returns a 401 Unauthorized error.",
            icon: "⚙️"
          },
          {
            title: "Why Are They Needed?",
            desc: "API keys serve three purposes: (1) Authentication — proving you have permission to use the service, (2) Rate limiting — tracking your usage to prevent abuse, (3) Billing — measuring consumption for paid tiers. Free tiers still require keys for tracking.",
            icon: "🎯"
          },
          {
            title: "Where Are They Stored?",
            desc: "In Neura, API keys are stored in a local .env file on your machine. They are never sent to any external server — Neura runs entirely locally. The EnvManager reads and writes keys to .env, and process.env makes them available to the runtime adapters.",
            icon: "💻"
          }
        ].map((item) =>
          '<div class="guide-card"><h4>' + item.icon + " " + escapeHtml(item.title) + '</h4><div class="desc">' + escapeHtml(item.desc) + "</div></div>"
        ).join("");
      }

      function renderGuideIntegration() {
        document.getElementById("guideIntegration").innerHTML =
          '<p class="note" style="margin-bottom:14px;line-height:1.6">API keys are typically passed as HTTP headers. Below are examples in common programming languages and tools. Never hard-code keys in your source code — always use environment variables or a secrets manager.</p>' +

          '<div class="code-block"><span class="lang-tag">JavaScript/TypeScript (fetch)</span><pre>const response = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + process.env.OPENAI_API_KEY
  },
  body: JSON.stringify({
    model: "gpt-4",
    messages: [{ role: "user", content: "Hello!" }]
  })
});
const data = await response.json();</pre></div>' +

          '<div class="code-block"><span class="lang-tag">Python (requests)</span><pre>import os
import requests

response = requests.post(
    "https://api.openai.com/v1/chat/completions",
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {os.environ[&apos;OPENAI_API_KEY&apos;]}"
    },
    json={
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "Hello!"}]
    }
)
data = response.json()</pre></div>' +

          '<div class="code-block"><span class="lang-tag">cURL</span><pre>curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -d &apos;{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }&apos;</pre></div>' +

          '<div class="code-block"><span class="lang-tag">Node.js (OpenAI SDK)</span><pre>import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"],
});

const completion = await client.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: "Hello!" }],
});</pre></div>' +

          '<div class="code-block"><span class="lang-tag">Neura .env File</span><pre># Neura automatically reads these from your .env file
# Keys follow the format: PROVIDERID_API_KEY
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=your-gemini-api-key-here
GROQ_API_KEY=your-groq-api-key-here
COHERE_API_KEY=your-cohere-api-key-here
DEEPSEEK_API_KEY=your-deepseek-api-key-here</pre></div>';
      }

      function renderGuideBestPractices() {
        document.getElementById("guideBestPractices").innerHTML = [
          { icon: "🚫", title: "Never Commit Keys to Git", desc: "Add .env to your .gitignore. Use example env files (.env.example) with placeholder values to show developers what variables are needed without exposing secrets." },
          { icon: "🔒", title: "Use Environment Variables", desc: "Always load API keys from environment variables or a secrets manager. This keeps keys out of your source code and makes deployment more secure." },
          { icon: "🎯", title: "Scope Keys to Minimum Permissions", desc: "Many providers let you create scoped API keys. Create separate keys for development, testing, and production. Revoke unused keys regularly." },
          { icon: "⏰", title: "Set Usage Limits & Budgets", desc: "Most AI providers let you set hard spending limits and usage caps. Enable these to prevent unexpected charges from bugs or runaway scripts." },
          { icon: "🔄", title: "Rotate Keys Periodically", desc: "Regenerate API keys every 90 days or after any suspected compromise. Update your .env file and any deployed services with the new key." },
          { icon: "🔐", title: "Use Local Secrets Management", desc: "Neura stores keys in a local .env file that never leaves your machine. For production deployments, use managed secrets services like HashiCorp Vault, AWS Secrets Manager, or Doppler." },
          { icon: "📝", title: "Monitor Usage & Audit Logs", desc: "Regularly check your provider dashboards for unexpected API calls. Many providers offer audit logs that show which key made which request and when." },
          { icon: "📖", title: "Document Your Key Setup", desc: "Maintain clear documentation on which API keys are needed for your project, what permissions they require, and how to set them up. This helps onboard new team members quickly." }
        ].map((bp) =>
          '<div class="best-practice"><div class="bp-icon">' + bp.icon + '</div><div><strong>' + escapeHtml(bp.title) + '</strong><p>' + escapeHtml(bp.desc) + '</p></div></div>'
        ).join("");
      }

      let guideActiveCategory = "";

      function renderGuideProviders() {
        if (!state.guides.length) return;
        const categories = [...new Set(state.guides.map((g) => g.category))].sort();
        const tabs = document.getElementById("guideProviderTabs");
        tabs.innerHTML =
          '<button data-action="guide-tab" data-tab="" class="' + (!guideActiveCategory ? "active" : "") + '">All Providers</button>' +
          categories.map((cat) =>
            '<button data-action="guide-tab" data-tab="' + cat + '" class="' + (guideActiveCategory === cat ? "active" : "") + '">' + label(cat) + "</button>"
          ).join("");

        renderGuideProviderCards();
      }

      function switchGuideTab(category) {
        guideActiveCategory = category || "";
        renderGuideProviders();
      }

      function renderGuideProviderCards() {
        const host = document.getElementById("guideProviders");
        const visible = state.guides.filter((g) => !guideActiveCategory || g.category === guideActiveCategory);
        host.innerHTML = visible.map((guide) => {
          const keyInfo = guide.keyEnvVar
            ? "Env var: <code>" + escapeHtml(guide.keyEnvVar) + "</code>"
            : "No API key required (local runtime)";
          return '<div class="guide-card">' +
            '<h4>' + freeBadge(guide.freeTier) + " " + escapeHtml(guide.displayName) + '</h4>' +
            '<div class="meta">' + label(guide.category) + " &bull; " + escapeHtml(guide.id) + " &bull; " + (guide.supportsRuntime ? '<span class="badge-free" style="background:#1d4ed8">runtime</span>' : '<span class="badge-paid">storage</span>') + "</div>" +
            '<div class="desc">' +
              (guide.capabilities || []).slice(0, 6).map((cap) => '<span class="tag blue">' + escapeHtml(cap) + "</span>").join(" ") +
            "</div>" +
            '<div class="key-info">' + keyInfo + "</div>" +
            '<div class="row" style="margin-top:10px;gap:6px">' +
            (guide.keyUrl ? '<a class="key-btn" href="' + escapeAttr(guide.keyUrl) + '" target="_blank" rel="noreferrer" style="font-size:12px;padding:6px 12px">Get Key</a>' : "") +
            '<a class="button" href="' + escapeAttr(guide.docsUrl) + '" target="_blank" rel="noreferrer" style="font-size:12px;padding:6px 12px;min-height:auto">Docs</a>' +
            "</div></div>";
        }).join("") || '<div class="empty">No providers in this category.</div>';
      }

      initTheme();
      setTimeout(initParticles, 100);

      load().catch((error) => toast(error.message));
      window.saveProvider = saveProvider;
      window.testProvider = testProvider;
      window.selectTask = selectTask;
    </script>
  </body>
</html>`.replaceAll("\\`", "`").replaceAll("\\${", "${").replace(
    /      function renderGuideIntegration\(\) \{[\s\S]*?\r?\n      function renderGuideBestPractices\(\) \{/,
    `${renderGuideIntegrationScript()}\n\n      function renderGuideBestPractices() {`
  );
}

function renderGuideIntegrationScript(): string {
  return String.raw`      function renderGuideIntegration() {
        function codeBlock(lang, lines) {
          return '<div class="code-block"><span class="lang-tag">' + escapeHtml(lang) + '</span><pre>' + escapeHtml(lines.join("\n")) + '</pre></div>';
        }

        document.getElementById("guideIntegration").innerHTML =
          '<p class="note" style="margin-bottom:14px;line-height:1.6">API keys are typically passed as HTTP headers. Below are examples in common programming languages and tools. Never hard-code keys in your source code and always use environment variables or a secrets manager.</p>' +
          codeBlock("JavaScript/TypeScript (fetch)", [
            'const response = await fetch("https://api.openai.com/v1/chat/completions", {',
            '  method: "POST",',
            '  headers: {',
            '    "Content-Type": "application/json",',
            '    "Authorization": "Bearer " + process.env.OPENAI_API_KEY',
            "  },",
            "  body: JSON.stringify({",
            '    model: "gpt-4",',
            '    messages: [{ role: "user", content: "Hello!" }]',
            "  })",
            "});",
            "const data = await response.json();"
          ]) +
          codeBlock("Python (requests)", [
            "import os",
            "import requests",
            "",
            "response = requests.post(",
            '    "https://api.openai.com/v1/chat/completions",',
            "    headers={",
            '        "Content-Type": "application/json",',
            '        "Authorization": f"Bearer {os.environ[\'OPENAI_API_KEY\']}"',
            "    },",
            "    json={",
            '        "model": "gpt-4",',
            '        "messages": [{"role": "user", "content": "Hello!"}]',
            "    }",
            ")",
            "data = response.json()"
          ]) +
          codeBlock("cURL", [
            "curl https://api.openai.com/v1/chat/completions \\",
            '  -H "Content-Type: application/json" \\',
            '  -H "Authorization: Bearer $OPENAI_API_KEY" \\',
            "  -d '{",
            '    "model": "gpt-4",',
            '    "messages": [{"role": "user", "content": "Hello!"}]',
            "  }'"
          ]) +
          codeBlock("Node.js (OpenAI SDK)", [
            'import OpenAI from "openai";',
            "",
            "const client = new OpenAI({",
            '  apiKey: process.env["OPENAI_API_KEY"],',
            "});",
            "",
            "const completion = await client.chat.completions.create({",
            '  model: "gpt-4",',
            '  messages: [{ role: "user", content: "Hello!" }],',
            "});"
          ]) +
          codeBlock("Neura .env File", [
            "# Neura automatically reads these from your .env file",
            "# Keys follow the format: PROVIDERID_API_KEY",
            "OPENAI_API_KEY=sk-...",
            "ANTHROPIC_API_KEY=sk-ant-...",
            "GEMINI_API_KEY=your-gemini-api-key-here",
            "GROQ_API_KEY=your-groq-api-key-here",
            "COHERE_API_KEY=your-cohere-api-key-here",
            "DEEPSEEK_API_KEY=your-deepseek-api-key-here"
          ]);
      }`;
}
