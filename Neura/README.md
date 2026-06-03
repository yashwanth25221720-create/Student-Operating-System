# Neura Runtime

Neura is a modular TypeScript orchestration runtime for personal, free-tier-first AI allocation. It discovers providers, inspects accessible models, tracks quota and token usage, monitors health, and routes each request to the best available model without binding the core runtime to a single vendor.

## Architecture

- `src/types`: provider, model, quota, usage, and task contracts.
- `src/providers`: isolated adapters plus generic OpenAI-compatible adapters for the large provider catalog.
- `src/core`: orchestration, routing, scoring, capability analysis, health, quota, registry, and config.
- `src/database`: SQLite schema and persistence wrapper.
- `src/cli`: operational dashboard commands for a personal runtime.
- `src/storage`: JSON caches for quick inspection and recovery.

Provider adapters implement one interface. The orchestrator talks only to that interface, so adding a provider means creating an adapter and registering it in `ProviderManager`.

## Setup

Requires Node.js 24 or newer for the built-in `node:sqlite` runtime.

```bash
npm install
cp .env.example .env
npm run build
```

Add whichever provider keys you have to `.env`. Ollama is discovered locally through `OLLAMA_BASE_URL`.

## CLI

```bash
npm run dev -- status
npm run dev -- providers
npm run dev -- models
npm run dev -- quotas
npm run dev -- usage
npm run dev -- route --prompt "Refactor this TypeScript function" --task coding
npm run ui
```

The CLI reports live provider state from SQLite plus the latest discovery cache. It intentionally shows your actual detected values rather than static examples.

## Local Setup Interface

Run:

```bash
npm run ui
```

Then open the printed localhost URL. The interface includes:

- A large provider catalog covering frontier labs, inference clouds, gateways, community hosting, decentralized/GPU providers, Asian cloud providers, coding services, experimental APIs, and local runtimes.
- Official provider key/docs links wherever the provider exposes one.
- Masked key status and local `.env` saving.
- Base URL configuration for every provider.
- Provider search, category filters, and runtime-ready/key-storage filters.
- Per-provider Test Key actions.
- Model discovery, provider health, quota, usage, and route preview views.
- Model capability views for coding, reasoning, vision, image generation, embeddings, tools, speed, and long-context fit.

Keys are stored in your local `.env` file and are not shown back in full after saving.

Not every catalog provider exposes the same API shape. Runtime-ready OpenAI-compatible providers can be routed immediately through the generic adapter. Providers marked as key storage are available in the UI so you can collect credentials now and add a dedicated adapter later without changing the setup surface.

## Programmatic Use

```ts
import { Orchestrator } from "./src";

const runtime = await Orchestrator.create();
const result = await runtime.generate({
  messages: [{ role: "user", content: "Plan a SQLite migration strategy." }],
  taskHint: "planning"
});

console.log(result.text);
```

## Notes

The runtime favors free-tier preservation by default. It penalizes unhealthy providers, cooling-down providers, scarce quota windows, and models whose capabilities are excessive for low-priority tasks. Usage, routing, quota, model, provider, and health events are persisted in SQLite.

Official endpoint references used for the initial adapters:

- [OpenRouter models API](https://openrouter.ai/docs/api/api-reference/models/get-models)
- [OpenRouter chat completions](https://openrouter.ai/docs/api-reference/chat-completion)
- [Groq API reference](https://console.groq.com/docs/api-reference)
- [Gemini API reference](https://ai.google.dev/docs/gemini_api_overview/)
- [Gemini models endpoint](https://ai.google.dev/api/models)
- [NVIDIA NIM OpenAI-compatible API](https://docs.nvidia.com/nim/large-language-models/2.0.1/reference/api-reference.html)
- [NVIDIA hosted LLM endpoint](https://docs.api.nvidia.com/nim/reference/create_chat_completion_v1_chat_completions_post)
- [Ollama model listing](https://docs.ollama.com/api/tags)
- [Ollama chat API](https://docs.ollama.com/api/chat)
