import { Command } from "commander";
import { ConfigManager } from "../core/configManager";
import { Orchestrator } from "../core/orchestrator";
import type { GenerateRequest } from "../types/provider";
import { startUiServer } from "../ui/server";
import { renderModels, renderProviders, renderQuotas, renderRoute, renderStatus, renderUsage } from "./dashboard";

export async function runCli(argv = process.argv): Promise<void> {
  const program = new Command();
  program.name("neura").description("Free-tier-first AI orchestration runtime").version("0.1.0");

  program
    .command("ui")
    .description("Start the local setup and monitoring interface")
    .option("--host <host>", "Host to bind", "127.0.0.1")
    .option("--port <port>", "Port to bind", "8787")
    .action(async (options: { host: string; port: string }) => {
      const requestedPort = Number(options.port);
      const server = await startUiServerWithFallback(options.host, requestedPort);
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : requestedPort;
      print(`Neura Console is running at http://${options.host}:${port}`);
      print("Press Ctrl+C to stop it.");
    });

  program
    .command("status")
    .description("Show provider, model, quota, and usage status")
    .option("--json", "Print JSON")
    .action(async (options: { json?: boolean }) => {
      await withRuntime(async (runtime) => {
        const status = runtime.status();
        print(options.json ? JSON.stringify(status, null, 2) : renderStatus(status));
      });
    });

  program
    .command("providers")
    .description("List configured providers and health")
    .option("--json", "Print JSON")
    .action(async (options: { json?: boolean }) => {
      await withRuntime(async (runtime) => {
        const providers = runtime.status().providers;
        print(options.json ? JSON.stringify(providers, null, 2) : renderProviders(providers));
      });
    });

  program
    .command("models")
    .description("List discovered models")
    .option("-p, --provider <provider>", "Filter by provider id")
    .option("--json", "Print JSON")
    .action(async (options: { provider?: string; json?: boolean }) => {
      await withRuntime(async (runtime) => {
        const models = runtime.status().models.filter((model) => !options.provider || model.providerId === options.provider);
        print(options.json ? JSON.stringify(models, null, 2) : renderModels(models));
      });
    });

  program
    .command("quotas")
    .description("Show quota and cooldown state")
    .option("--json", "Print JSON")
    .action(async (options: { json?: boolean }) => {
      await withRuntime(async (runtime) => {
        const quotas = runtime.status().quotas;
        print(options.json ? JSON.stringify(quotas, null, 2) : renderQuotas(quotas));
      });
    });

  program
    .command("usage")
    .description("Show token usage summary")
    .option("--json", "Print JSON")
    .action(async (options: { json?: boolean }) => {
      await withRuntime(async (runtime) => {
        const usage = runtime.status().usage;
        print(options.json ? JSON.stringify(usage, null, 2) : renderUsage(usage));
      });
    });

  program
    .command("discover")
    .description("Refresh model registry and quota snapshots")
    .action(async () => {
      await withRuntime(async (runtime) => {
        const count = await runtime.refreshModels();
        print(`Discovery complete. ${count} models refreshed.`);
      });
    });

  program
    .command("route")
    .description("Explain the model selection for a prompt")
    .requiredOption("--prompt <prompt>", "Prompt to route")
    .option("--task <task>", "Task hint")
    .option("--model <model>", "Force a model id, or provider:model")
    .option("--json", "Print JSON")
    .action(async (options: { prompt: string; task?: GenerateRequest["taskHint"]; model?: string; json?: boolean }) => {
      await withRuntime(async (runtime) => {
        const decision = await runtime.route({
          messages: [{ role: "user", content: options.prompt }],
          taskHint: options.task,
          model: options.model
        });
        print(options.json ? JSON.stringify(decision, null, 2) : renderRoute(decision));
      });
    });

  program
    .command("generate")
    .description("Run one routed generation request")
    .requiredOption("--prompt <prompt>", "Prompt to send")
    .option("--system <system>", "System instruction")
    .option("--task <task>", "Task hint")
    .option("--model <model>", "Force a model id, or provider:model")
    .option("--stream", "Stream tokens to stdout")
    .action(
      async (options: {
        prompt: string;
        system?: string;
        task?: GenerateRequest["taskHint"];
        model?: string;
        stream?: boolean;
      }) => {
        await withRuntime(async (runtime) => {
          const request: GenerateRequest = {
            messages: [
              ...(options.system ? [{ role: "system" as const, content: options.system }] : []),
              { role: "user", content: options.prompt }
            ],
            taskHint: options.task,
            model: options.model
          };

          if (options.stream) {
            const result = await runtime.stream(request, {
              onToken: (token) => {
                process.stdout.write(token);
              }
            });
            process.stdout.write(`\n\n[${result.providerId}/${result.modelId}] ${result.usage.totalTokens} tokens\n`);
            return;
          }

          const result = await runtime.generate(request);
          print(`${result.text}\n\n[${result.providerId}/${result.modelId}] ${result.usage.totalTokens} tokens`);
        });
      }
    );

  await program.parseAsync(argv);
}

async function startUiServerWithFallback(host: string, requestedPort: number) {
  let lastError: unknown;
  for (let port = requestedPort; port < requestedPort + 10; port += 1) {
    try {
      return await startUiServer({ host, port });
    } catch (error) {
      lastError = error;
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code !== "EADDRINUSE") {
        throw error;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unable to start UI server");
}

async function withRuntime<T>(callback: (runtime: Orchestrator) => Promise<T>): Promise<T> {
  const config = ConfigManager.load();
  if (!process.env.NEURA_LOG_LEVEL) {
    config.logLevel = "silent";
  }
  const runtime = await Orchestrator.create(config);
  try {
    return await callback(runtime);
  } finally {
    runtime.close();
  }
}

function print(value: string): void {
  process.stdout.write(`${value}\n`);
}
