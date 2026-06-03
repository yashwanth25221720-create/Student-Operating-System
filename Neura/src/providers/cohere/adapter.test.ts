import { describe, it, expect, vi, beforeEach } from "vitest";
import { CohereAdapter } from "./adapter";
import type { ProviderConfig } from "../../types/provider";

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: "cohere",
    type: "cohere-compatible",
    displayName: "Cohere",
    enabled: true,
    apiKey: "cohere-test-key",
    baseUrl: "https://api.cohere.com/v2",
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

describe("CohereAdapter", () => {
  let adapter: CohereAdapter;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    adapter = new CohereAdapter(makeConfig());
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  describe("constructor", () => {
    it("sets id, type, displayName, and config", () => {
      expect(adapter.id).toBe("cohere");
      expect(adapter.type).toBe("cohere-compatible");
      expect(adapter.displayName).toBe("Cohere");
      expect(adapter.config.apiKey).toBe("cohere-test-key");
    });

    it("normalizes base URL", () => {
      const a = new CohereAdapter(makeConfig({ baseUrl: "https://api.cohere.com/v2/" }));
      expect(a["baseUrl"]).toBe("https://api.cohere.com/v2");
    });
  });

  describe("validateKey", () => {
    it("returns true on 200", async () => {
      fetchSpy.mockResolvedValue(okResponse({ models: [] }));
      await expect(adapter.validateKey()).resolves.toBe(true);
    });

    it("throws on 401", async () => {
      fetchSpy.mockResolvedValue(errorResponse(401, { message: "Unauthorized" }));
      await expect(adapter.validateKey()).rejects.toThrow("Cohere request failed");
    });
  });

  describe("getModels", () => {
    it("returns chat models from API", async () => {
      const apiModels = {
        models: [
          { name: "command-r-08-2024", endpoints: ["chat"], context_length: 128000 },
          { name: "command-r-plus-08-2024", endpoints: ["chat"], context_length: 128000 },
          { name: "embed-english-v3.0", endpoints: ["embed"], context_length: 512 },
        ],
      };
      fetchSpy.mockResolvedValue(okResponse(apiModels));
      const models = await adapter.getModels();
      expect(models).toHaveLength(2);
      expect(models[0].id).toBe("command-r-08-2024");
      expect(models[1].id).toBe("command-r-plus-08-2024");
    });

    it("filters out non-chat models from mixed API response", async () => {
      const apiModels = {
        models: [
          { name: "command-r-08-2024", endpoints: ["chat"], context_length: 128000 },
          { name: "embed-english-v3.0", endpoints: ["embed"], context_length: 512 },
          { name: "rerank-english-v3.0", endpoints: ["rerank"] },
        ],
      };
      fetchSpy.mockResolvedValue(okResponse(apiModels));
      const models = await adapter.getModels();
      // Only the chat endpoint model should be returned
      expect(models).toHaveLength(1);
      expect(models[0].id).toBe("command-r-08-2024");
      expect(models[0].capabilities.embeddings).toBe(true);
    });

    it("falls back to hardcoded models on API failure", async () => {
      fetchSpy.mockRejectedValue(new Error("Network failure"));
      const models = await adapter.getModels();
      expect(models.length).toBeGreaterThanOrEqual(6);
      expect(models[0].id).toBe("command-r-plus-08-2024");
    });
  });

  describe("generate", () => {
    it("throws when model is missing", async () => {
      await expect(
        adapter.generate({ messages: [{ role: "user", content: "hello" }] })
      ).rejects.toThrow("No model was selected");
    });

    it("returns result with text from message.content array", async () => {
      const response = {
        message: {
          role: "assistant",
          content: [{ type: "text", text: "Hello from Cohere!" }],
        },
        generation_id: "gen_123",
        finish_reason: "COMPLETE",
        meta: {
          tokens: { input_tokens: 8, output_tokens: 4 },
        },
      };
      fetchSpy.mockResolvedValue(okResponse(response));

      const result = await adapter.generate({
        messages: [{ role: "user", content: "Hi" }],
        model: "command-r-08-2024",
      });

      expect(result.text).toBe("Hello from Cohere!");
      expect(result.modelId).toBe("command-r-08-2024");
      expect(result.providerId).toBe("cohere");
      expect(result.usage.promptTokens).toBe(8);
      expect(result.usage.completionTokens).toBe(4);
      expect(result.finishReason).toBe("COMPLETE");
    });

    it("falls back to response.text when message.content is absent", async () => {
      const response = {
        text: "Direct text fallback",
        generation_id: "gen_456",
        finish_reason: "COMPLETE",
      };
      fetchSpy.mockResolvedValue(okResponse(response));

      const result = await adapter.generate({
        messages: [{ role: "user", content: "Hi" }],
        model: "command-r-08-2024",
      });

      expect(result.text).toBe("Direct text fallback");
    });

    it("handles system messages in conversation", async () => {
      fetchSpy.mockResolvedValue(
        okResponse({
          message: { content: [{ type: "text", text: "OK" }] },
          generation_id: "gen_789",
          finish_reason: "COMPLETE",
        })
      );

      const result = await adapter.generate({
        messages: [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "Hi" },
        ],
        model: "command-r-08-2024",
      });

      expect(result.text).toBe("OK");
      expect(result.finishReason).toBe("COMPLETE");
    });
  });

  describe("stream", () => {
    function makeTextStream(chunks: string[]): Response {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();
        },
      });
      return new Response(stream, { headers: { "content-type": "application/json" } });
    }

    it("throws when model is missing", async () => {
      await expect(
        adapter.stream({ messages: [{ role: "user", content: "hello" }] }, {})
      ).rejects.toThrow("No model was selected");
    });

    it("streams text-generation events and calls onToken", async () => {
      const chunks = [
        JSON.stringify({ event_type: "stream-start", meta: { tokens: { input_tokens: 5 } } }) + "\n",
        JSON.stringify({ event_type: "text-generation", text: "Hello" }) + "\n",
        JSON.stringify({ event_type: "text-generation", text: " world" }) + "\n",
        JSON.stringify({
          event_type: "stream-end",
          finish_reason: "COMPLETE",
          response: {
            meta: { tokens: { input_tokens: 5, output_tokens: 3 } },
          },
        }) + "\n",
      ];

      fetchSpy.mockResolvedValue(makeTextStream(chunks));

      const tokens: string[] = [];
      const onToken = vi.fn((t: string) => {
        tokens.push(t);
      });
      const onDone = vi.fn();
      const onUsage = vi.fn();

      const result = await adapter.stream(
        { messages: [{ role: "user", content: "Hi" }], model: "command-r-08-2024" },
        { onToken, onDone, onUsage }
      );

      expect(result.text).toBe("Hello world");
      expect(result.finishReason).toBe("COMPLETE");
      expect(result.usage.promptTokens).toBe(5);
      expect(result.usage.completionTokens).toBe(3);
      expect(onToken).toHaveBeenCalledTimes(2);
      expect(onDone).toHaveBeenCalledWith(result);
      expect(onUsage).toHaveBeenCalledWith(result.usage);
    });

    it("handles malformed JSON lines gracefully", async () => {
      const chunks = ["not json\n", JSON.stringify({ event_type: "text-generation", text: "works" }) + "\n"];
      fetchSpy.mockResolvedValue(makeTextStream(chunks));

      const tokens: string[] = [];
      const onToken = vi.fn((t: string) => {
        tokens.push(t);
      });

      const result = await adapter.stream(
        { messages: [{ role: "user", content: "Hi" }], model: "command-r-08-2024" },
        { onToken }
      );

      expect(result.text).toBe("works");
      expect(onToken).toHaveBeenCalledTimes(1);
    });
  });

  describe("healthCheck", () => {
    it("returns healthy when validateKey succeeds", async () => {
      fetchSpy.mockResolvedValue(okResponse({ models: [] }));
      const health = await adapter.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.providerId).toBe("cohere");
    });

    it("returns unhealthy on network error", async () => {
      fetchSpy.mockRejectedValue(new Error("Timeout"));
      const health = await adapter.healthCheck();
      expect(health.healthy).toBe(false);
    });
  });

  describe("capability methods", () => {
    it("supportsVision returns false", () => {
      expect(adapter.supportsVision()).toBe(false);
    });

    it("supportsTools returns true", () => {
      expect(adapter.supportsTools()).toBe(true);
    });

    it("supportsEmbeddings returns true", () => {
      expect(adapter.supportsEmbeddings()).toBe(true);
    });
  });

  describe("model mapping", () => {
    it("marks command-r-plus with reasoning strength", async () => {
      fetchSpy.mockResolvedValue(okResponse({
        models: [{ name: "command-r-plus-08-2024", endpoints: ["chat"], context_length: 128000 }],
      }));
      const models = await adapter.getModels();
      expect(models[0].scores.reasoning).toBeGreaterThanOrEqual(0.78);
      expect(models[0].scores.costEfficiency).toBeGreaterThanOrEqual(0.8);
      expect(models[0].capabilities.embeddings).toBe(true);
    });

    it("marks command-light with high speed", async () => {
      fetchSpy.mockResolvedValue(okResponse({
        models: [{ name: "command-light", endpoints: ["chat"], context_length: 4096 }],
      }));
      const models = await adapter.getModels();
      expect(models[0].scores.speed).toBeGreaterThanOrEqual(0.88);
      expect(models[0].capabilities.longContext).toBe(false);
    });

    it("all models are freeTier false (paid)", async () => {
      fetchSpy.mockResolvedValue(okResponse({
        models: [{ name: "command-r-08-2024", endpoints: ["chat"], context_length: 128000 }],
      }));
      const models = await adapter.getModels();
      expect(models[0].freeTier).toBe(false);
    });
  });

  describe("getQuota", () => {
    it("returns empty windows", async () => {
      const quota = await adapter.getQuota();
      expect(quota.providerId).toBe("cohere");
      expect(quota.isExhausted).toBe(false);
    });
  });

  describe("getUsage", () => {
    it("returns undefined", async () => {
      await expect(adapter.getUsage()).resolves.toBeUndefined();
    });
  });
});
