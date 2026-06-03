import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnthropicAdapter } from "./adapter";
import type { ProviderConfig } from "../../types/provider";

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: "anthropic",
    type: "anthropic-compatible",
    displayName: "Anthropic Claude",
    enabled: true,
    apiKey: "sk-ant-test123",
    baseUrl: "https://api.anthropic.com",
    timeoutMs: 30000,
    ...overrides,
  };
}

function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function errorResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("AnthropicAdapter", () => {
  let adapter: AnthropicAdapter;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    adapter = new AnthropicAdapter(makeConfig());
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  describe("constructor", () => {
    it("sets id, type, displayName, and config", () => {
      expect(adapter.id).toBe("anthropic");
      expect(adapter.type).toBe("anthropic-compatible");
      expect(adapter.displayName).toBe("Anthropic Claude");
      expect(adapter.config.apiKey).toBe("sk-ant-test123");
    });

    it("normalizes base URL by stripping trailing slash", () => {
      const a = new AnthropicAdapter(makeConfig({ baseUrl: "https://api.anthropic.com/" }));
      expect(a["baseUrl"]).toBe("https://api.anthropic.com");
    });
  });

  describe("validateKey", () => {
    it("returns true when API responds with ok", async () => {
      fetchSpy.mockResolvedValue(okResponse({ data: [] }));
      await expect(adapter.validateKey()).resolves.toBe(true);
    });

    it("throws when API responds with 401", async () => {
      fetchSpy.mockResolvedValue(errorResponse(401, { error: { message: "Unauthorized" } }));
      await expect(adapter.validateKey()).rejects.toThrow("Anthropic Claude request failed");
    });

    it("throws when API responds with 500", async () => {
      fetchSpy.mockResolvedValue(errorResponse(500, { error: { message: "Server error" } }));
      await expect(adapter.validateKey()).rejects.toThrow("Server error");
    });
  });

  describe("getModels", () => {
    it("returns models from API when successful", async () => {
      const apiModels = {
        data: [
          { id: "claude-sonnet-4-20250514", type: "model", display_name: "Claude Sonnet 4" },
          { id: "claude-3-haiku-20240307", type: "model", display_name: "Claude 3 Haiku" },
        ],
      };
      fetchSpy.mockResolvedValue(okResponse(apiModels));
      const models = await adapter.getModels();
      expect(models).toHaveLength(2);
      expect(models[0].id).toBe("claude-sonnet-4-20250514");
      expect(models[1].id).toBe("claude-3-haiku-20240307");
    });

    it("falls back to hardcoded models when API fails", async () => {
      fetchSpy.mockRejectedValue(new Error("Network failure"));
      const models = await adapter.getModels();
      expect(models.length).toBeGreaterThanOrEqual(6);
      expect(models[0].id).toBe("claude-sonnet-4-20250514");
    });

    it("falls back when API returns empty data", async () => {
      fetchSpy.mockResolvedValue(okResponse({ data: [] }));
      const models = await adapter.getModels();
      expect(models.length).toBeGreaterThanOrEqual(6);
    });
  });

  describe("generate", () => {
    it("throws when model is missing", async () => {
      await expect(
        adapter.generate({ messages: [{ role: "user", content: "hello" }] })
      ).rejects.toThrow("No model was selected");
    });

    it("returns generate result with correct text and usage", async () => {
      const response = {
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "Hello from Claude!" }],
        model: "claude-sonnet-4-20250514",
        stop_reason: "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      };
      fetchSpy.mockResolvedValue(okResponse(response));

      const result = await adapter.generate({
        messages: [{ role: "user", content: "Say hello" }],
        model: "claude-sonnet-4-20250514",
      });

      expect(result.text).toBe("Hello from Claude!");
      expect(result.modelId).toBe("claude-sonnet-4-20250514");
      expect(result.providerId).toBe("anthropic");
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(5);
      expect(result.usage.totalTokens).toBe(15);
      expect(result.finishReason).toBe("end_turn");
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("handles system messages in a multi-message conversation", async () => {
      const response = {
        id: "msg_456",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "Sure!" }],
        model: "claude-sonnet-4-20250514",
        usage: { input_tokens: 5, output_tokens: 2 },
      };
      fetchSpy.mockResolvedValue(okResponse(response));

      const result = await adapter.generate({
        messages: [
          { role: "system", content: "Be helpful." },
          { role: "user", content: "Hi" },
        ],
        model: "claude-sonnet-4-20250514",
      });

      expect(result.text).toBe("Sure!");
      expect(result.modelId).toBe("claude-sonnet-4-20250514");
      expect(result.usage.totalTokens).toBe(7);
    });
  });

  describe("stream", () => {
    function streamChunk(data: unknown): Uint8Array {
      return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
    }

    function makeStreamResponse(chunks: Uint8Array[]): Response {
      const stream = new ReadableStream({
        async start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(chunk);
          }
          controller.close();
        },
      });
      return new Response(stream, { headers: { "content-type": "text/event-stream" } });
    }

    it("throws when model is missing", async () => {
      await expect(
        adapter.stream(
          { messages: [{ role: "user", content: "hello" }] },
          {}
        )
      ).rejects.toThrow("No model was selected");
    });

    it("parses stream events and calls callbacks", async () => {
      const event1 = streamChunk({
        type: "message_start",
        message: { usage: { input_tokens: 12 } },
      });
      const event2 = streamChunk({
        type: "content_block_delta",
        delta: { text: "Hello" },
      });
      const event3 = streamChunk({
        type: "content_block_delta",
        delta: { text: " world" },
      });
      const event4 = streamChunk({
        type: "message_delta",
        delta: { stop_reason: "end_turn" },
        usage: { output_tokens: 4 },
      });

      fetchSpy.mockResolvedValue(makeStreamResponse([event1, event2, event3, event4]));

      const tokens: string[] = [];
      const onToken = vi.fn((t: string) => {
        tokens.push(t);
      });
      const onDone = vi.fn();
      const onUsage = vi.fn();

      const result = await adapter.stream(
        { messages: [{ role: "user", content: "Hi" }], model: "claude-sonnet-4-20250514" },
        { onToken, onDone, onUsage }
      );

      expect(result.text).toBe("Hello world");
      expect(result.finishReason).toBe("end_turn");
      expect(result.usage.promptTokens).toBe(12);
      expect(result.usage.completionTokens).toBe(4);
      expect(onToken).toHaveBeenCalledTimes(2);
      expect(onUsage).toHaveBeenCalledWith(result.usage);
      expect(onDone).toHaveBeenCalledWith(result);
    });

    it("throws on empty response body", async () => {
      const response = new Response(null, { status: 200 });
      Object.defineProperty(response, "body", { value: null });
      fetchSpy.mockResolvedValue(response);

      await expect(
        adapter.stream(
          { messages: [{ role: "user", content: "Hi" }], model: "claude-sonnet-4-20250514" },
          {}
        )
      ).rejects.toThrow("empty stream body");
    });
  });

  describe("healthCheck", () => {
    it("returns healthy when validateKey succeeds", async () => {
      fetchSpy.mockResolvedValue(okResponse({ data: [] }));
      const health = await adapter.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.providerId).toBe("anthropic");
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("returns unhealthy when validateKey throws", async () => {
      fetchSpy.mockRejectedValue(new Error("Network error"));
      const health = await adapter.healthCheck();
      expect(health.healthy).toBe(false);
      expect(health.error).toBe("Network error");
    });
  });

  describe("capability methods", () => {
    it("supportsVision returns true for sonnet/opus models", () => {
      expect(adapter.supportsVision("claude-sonnet-4-20250514")).toBe(true);
      expect(adapter.supportsVision("claude-3-opus-20240229")).toBe(true);
      expect(adapter.supportsVision("claude-3-haiku-20240307")).toBe(false);
    });

    it("supportsVision returns true when no model specified", () => {
      expect(adapter.supportsVision()).toBe(true);
    });

    it("supportsTools returns true", () => {
      expect(adapter.supportsTools()).toBe(true);
    });

    it("supportsEmbeddings returns false", () => {
      expect(adapter.supportsEmbeddings()).toBe(false);
    });
  });

  describe("getQuota", () => {
    it("returns quota with empty windows", async () => {
      const quota = await adapter.getQuota();
      expect(quota.providerId).toBe("anthropic");
      expect(quota.windows).toHaveLength(0);
      expect(quota.isExhausted).toBe(false);
    });
  });

  describe("getUsage", () => {
    it("returns undefined", async () => {
      await expect(adapter.getUsage()).resolves.toBeUndefined();
    });
  });

  describe("model mapping", () => {
    it("maps Opus model with high reasoning score", async () => {
      fetchSpy.mockResolvedValue(okResponse({
        data: [{ id: "claude-3-opus-20240229", type: "model", display_name: "Claude 3 Opus" }],
      }));
      const models = await adapter.getModels();
      expect(models[0].scores.reasoning).toBeGreaterThanOrEqual(0.9);
      expect(models[0].scores.coding).toBeGreaterThanOrEqual(0.85);
      expect(models[0].freeTier).toBe(false);
      expect(models[0].capabilities.vision).toBe(true);
    });

    it("maps Haiku model with high speed score", async () => {
      fetchSpy.mockResolvedValue(okResponse({
        data: [{ id: "claude-3-haiku-20240307", type: "model", display_name: "Claude 3 Haiku" }],
      }));
      const models = await adapter.getModels();
      expect(models[0].scores.speed).toBeGreaterThanOrEqual(0.9);
      expect(models[0].scores.costEfficiency).toBeGreaterThanOrEqual(0.9);
    });

    it("all models have contextWindow 200000", async () => {
      fetchSpy.mockResolvedValue(okResponse({
        data: [{ id: "claude-sonnet-4-20250514", type: "model", display_name: "Claude Sonnet 4" }],
      }));
      const models = await adapter.getModels();
      expect(models[0].contextWindow).toBe(200000);
    });
  });
});
