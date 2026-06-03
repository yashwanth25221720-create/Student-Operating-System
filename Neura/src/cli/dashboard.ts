import type { ProviderRuntimeStatus } from "../core/providerManager";
import type { ModelMetadata } from "../types/model";
import type { QuotaStatus } from "../types/quota";
import type { RoutingDecision } from "../types/task";
import type { UsageSummary } from "../types/usage";

export function renderStatus(input: {
  providers: ProviderRuntimeStatus[];
  models: ModelMetadata[];
  quotas: QuotaStatus[];
  usage: UsageSummary[];
}): string {
  return [
    "Neura Runtime Status",
    "",
    renderProviders(input.providers),
    "",
    renderModelSummary(input.models),
    "",
    renderQuotas(input.quotas),
    "",
    renderUsage(input.usage)
  ].join("\n");
}

export function renderProviders(providers: ProviderRuntimeStatus[]): string {
  if (!providers.length) {
    return "Providers\nNo providers configured.";
  }

  const lines = providers.map((provider) => {
    const state = !provider.enabled ? "disabled" : provider.healthy ? "healthy" : provider.registered ? "unhealthy" : "not registered";
    const latency = provider.avgLatencyMs ? `${Math.round(provider.avgLatencyMs)}ms` : "n/a";
    return `${pad(provider.displayName, 24)} ${pad(state, 14)} latency=${latency} failures=${provider.failureCount ?? 0}`;
  });

  return ["Providers", ...lines].join("\n");
}

export function renderModels(models: ModelMetadata[]): string {
  if (!models.length) {
    return "Models\nNo models discovered yet.";
  }

  const lines = models.map((model) => {
    const caps = [
      model.capabilities.local ? "local" : undefined,
      model.capabilities.vision ? "vision" : undefined,
      model.capabilities.tools ? "tools" : undefined,
      model.capabilities.embeddings ? "embeddings" : undefined,
      model.capabilities.longContext ? "long-context" : undefined
    ]
      .filter(Boolean)
      .join(",");
    const context = model.contextWindow ? `${model.contextWindow}` : "unknown";
    return `${pad(model.providerId, 12)} ${pad(model.id, 46)} free=${model.freeTier ? "yes" : "no"} ctx=${pad(
      context,
      8
    )} health=${pad(model.health, 12)} ${caps}`;
  });

  return ["Models", ...lines].join("\n");
}

export function renderModelSummary(models: ModelMetadata[]): string {
  const byProvider = new Map<string, number>();
  for (const model of models) {
    byProvider.set(model.providerId, (byProvider.get(model.providerId) ?? 0) + 1);
  }
  const lines = [...byProvider.entries()].map(([providerId, count]) => `${pad(providerId, 12)} ${count} discovered`);
  return ["Model Registry", ...(lines.length ? lines : ["No discovered models."])].join("\n");
}

export function renderQuotas(quotas: QuotaStatus[]): string {
  if (!quotas.length) {
    return "Quotas\nNo quota records yet.";
  }

  const lines = quotas.flatMap((quota) =>
    quota.windows.map((window) => {
      const owner = quota.modelId ? `${quota.providerId}/${quota.modelId}` : quota.providerId;
      const remaining = window.remaining === undefined ? "unknown" : `${window.remaining}`;
      const limit = window.limit === undefined ? "unknown" : `${window.limit}`;
      const reset = window.resetAt ?? "unknown";
      const cooldown = quota.cooldownUntil ? ` cooldown=${quota.cooldownUntil}` : "";
      return `${pad(owner, 32)} ${window.kind} remaining=${pad(remaining, 10)} limit=${pad(limit, 10)} reset=${reset}${cooldown}`;
    })
  );

  return ["Quotas", ...lines].join("\n");
}

export function renderUsage(usage: UsageSummary[]): string {
  if (!usage.length) {
    return "Usage\nNo usage events recorded.";
  }

  const lines = usage.map((item) => {
    const owner = `${item.providerId ?? "unknown"}/${item.modelId ?? "unknown"}`;
    return `${pad(owner, 42)} requests=${pad(`${item.requestCount}`, 6)} tokens=${pad(`${item.totalTokens}`, 10)} success=${item.successCount} failure=${item.failureCount}`;
  });
  return ["Usage", ...lines].join("\n");
}

export function renderRoute(decision: RoutingDecision): string {
  const lines = decision.candidates.slice(0, 10).map((candidate, index) => {
    const marker = index === 0 ? "*" : " ";
    return `${marker} ${pad(candidate.providerId, 12)} ${pad(candidate.modelId, 46)} score=${candidate.score.toFixed(3)} ${candidate.reasons.join(", ")}`;
  });

  return [
    "Routing Decision",
    `task=${decision.task.type} selected=${decision.selectedProviderId}/${decision.selectedModelId}`,
    `reason=${decision.reason}`,
    "",
    ...lines
  ].join("\n");
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value.padEnd(width, " ");
}
