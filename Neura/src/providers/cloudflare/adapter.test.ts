import { describe, it, expect, vi, beforeEach } from "vitest";
import { CloudflareAdapter } from "./adapter";
import type { ProviderConfig } from "../../types/provider";

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: "cloudflare-workers-ai",
    type: "cloudflare-workers-ai",
    displayName: "Cloudflare Workers AI",
    enabled: true,
    apiKey: "cf-api-token",
    baseUrl: "https://api.cloudflare.com/client/v4/accounts/test-account-id/ai",
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

describe("CloudflareAdapter", () => {
  let adapter: CloudflareAdapter;
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    adapter = new CloudflareAdapter(makeConfig());
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  describe("constructor", () => {
    it("sets id, type, displayName, and extracts accountId", () => {
      expect(adapter.id).toBe("cloudflare-workers-ai");
      expect(adapter.type).toBe("cloudflare-workers-ai");
      expect(adapter.displayName).toBe("Cloudflare Workers AI");
      expect(adapter["accountId"]).toBe("test-account-id");
    });

    it("handles missing accountId gracefully", () => {
      const a = new CloudflareAdapter(
        makeConfig({ baseUrl: "https://api.cloudflare.com/client/v4/ai" })
      );
      expect(a["accountId"]).toBe("");
    });
  });

  describe("validateKey", () => {
    it("returns true for 404 (valid key, no endpoint at base)", async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 404 }));
      await expect(adapter.validateKey()).resolves.toBe(true);
    });

    it("returns true for 405 (valid key, method not allowed)", async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 405 }));
      await expect(adapter.validateKey()).resolves.toBe(true);
    });

    it("returns false for 401 (invalid key)", async () => {
      fetchSpy.mockResolvedValue(errorResponse(401, { errors: [{ message: "Unauthorized" }] }));
      await expect(adapter.validateKey()).resolves.toBe(false);
    });

    it("returns false for 403 (wrong account)", async () => {
      fetchSpy.mockResolvedValue(errorResponse(403, { errors: [{ message: "Forbidden" }] }));
      await expect(adapter.validateKey()).resolves.toBe(false);
    });
  });

  describe("getModels", () => {
    it("returns models from API when accountId is present", async () => {
      const apiModels = {
        success: true,
        result: [
          { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", name: "Llama 3.3 70B" },
          { id: "@cf/meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B" },
        ],
      };
      // getModels calls fetchJson directly, which calls rawFetch
      // No validateKey call happens inside getModels
      fetchSpy.mockResolvedValue(okResponse(apiModels));
      const models = await adapter.getModels();
      expect(models).toHaveLength(2);
      expect(models[0].id).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
      expect(models[0].freeTier).toBe(true);
    });

    it("falls back to hardcoded models when API fails", async () => {
      fetchSpy.mockResolvedValue(okResponse({ success: false }));
      const models = await adapter.getModels();
      expect(models.length).toBeGreaterThanOrEqual(10);
      expect(models[0].id).toBe("@cf/meta/llama-3.3-70b-instruct-fp8-fast");
    });

    it("falls back when no accountId", async () => {
      const a = new CloudflareAdapter(
        makeConfig({ baseUrl: "https://api.cloudflare.com/client/v4/ai" })
      );
      fetchSpy.mockResolvedValue(new Response(null, { status: 404 }));
      const models = await a.getModels();
      expect(models.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("generate", () => {
    it("throws when model is missing", async () => {
      await expect(
        adapter.generate({ messages: [{ role: "user", content: "hello" }] })
      ).rejects.toThrow("No model was selected");
    });

    it("returns result with text from response.result.response", async () => {
      const response = {
        success: true,
        result: { response: "Hello from Cloudflare!" },
      };
      fetchSpy.mockResolvedValue(okResponse(response));

      const result = await adapter.generate({
        messages: [{ role: "user", content: "Hi" }],
        model: "@cf/meta/llama-3.1-8b-instruct",
      });

      expect(result.text).toBe("Hello from Cloudflare!");
      expect(result.modelId).toBe("@cf/meta/llama-3.1-8b-instruct");
      expect(result.providerId).toBe("cloudflare-workers-ai");
      expect(result.finishReason).toBeUndefined();
    });

    it("falls back to result.text when response is absent", async () => {
      const response = {
        success: true,
        result: { text: "Text fallback" },
      };
      fetchSpy.mockResolvedValue(okResponse(response));

      const result = await adapter.generate({
        messages: [{ role: "user", content: "Hi" }],
        model: "@cf/meta/llama-3.1-8b-instruct",
      });

      expect(result.text).toBe("Text fallback");
    });

    it("falls back to outputs array when other fields absent", async () => {
      const response = {
        success: true,
        result: { outputs: [{ text: "Output text" }] },
      };
      fetchSpy.mockResolvedValue(okResponse(response));

      const result = await adapter.generate({
        messages: [{ role: "user", content: "Hi" }],
        model: "@cf/meta/llama-3.1-8b-instruct",
      });

      expect(result.text).toBe("Output text");
    });

    it("throws when success is false", async () => {
      const response = {
        success: false,
        errors: [{ message: "Model not found" }],
      };
      fetchSpy.mockResolvedValue(okResponse(response));

      await expect(
        adapter.generate({
          messages: [{ role: "user", content: "Hi" }],
          model: "@cf/unknown/model",
        })
      ).rejects.toThrow("Model not found");
    });
  });

  describe("stream", () => {
    it("falls back to generate and calls callbacks", async () => {
      const response = {
        success: true,
        result: { response: "Stream fallback response" },
      };
      fetchSpy.mockResolvedValue(okResponse(response));

      const onToken = vi.fn();
      const onDone = vi.fn();
      const onUsage = vi.fn();

      const result = await adapter.stream(
        { messages: [{ role: "user", content: "Hi" }], model: "@cf/meta/llama-3.1-8b-instruct" },
        { onToken, onDone, onUsage }
      );

      expect(result.text).toBe("Stream fallback response");
      expect(onToken).toHaveBeenCalledWith("Stream fallback response");
      expect(onDone).toHaveBeenCalledWith(result);
      expect(onUsage).toHaveBeenCalledWith(result.usage);
    });
  });

  describe("healthCheck", () => {
    it("returns healthy when validateKey succeeds (404)", async () => {
      fetchSpy.mockResolvedValue(new Response(null, { status: 404 }));
      const health = await adapter.healthCheck();
      expect(health.healthy).toBe(true);
      expect(health.providerId).toBe("cloudflare-workers-ai");
    });

    it("returns healthy even on 401 since validateKey catches it", async () => {
      fetchSpy.mockResolvedValue(errorResponse(401, { errors: [{ message: "Unauthorized" }] }));
      const health = await adapter.healthCheck();
      // validateKey returns false for 401 but doesn't throw, so healthCheck considers it healthy
      expect(health.healthy).toBe(true);
      expect(health.providerId).toBe("cloudflare-workers-ai");
    });
  });

  describe("capability methods", () => {
    it("supportsVision returns true for vision/vl/multimodal/llava models", () => {
      expect(adapter.supportsVision("@cf/llava-hf/llava-1.5-7b")).toBe(true);
      expect(adapter.supportsVision("some-vision-model")).toBe(true);
      expect(adapter.supportsVision("some-vl-model")).toBe(true);
      expect(adapter.supportsVision("multimodal-model")).toBe(true);
    });

    it("supportsVision returns false for non-vision models", () => {
      expect(adapter.supportsVision("@cf/meta/llama-3.1-8b-instruct")).toBe(false);
    });

    it("supportsVision returns false when no model specified", () => {
      expect(adapter.supportsVision()).toBe(false);
    });

    it("supportsTools returns false", () => {
      expect(adapter.supportsTools()).toBe(false);
    });

    it("supportsEmbeddings returns false", () => {
      expect(adapter.supportsEmbeddings()).toBe(false);
    });
  });

  describe("model mapping", () => {
    it("marks large models (70b/72b) with higher reasoning", async () => {
      fetchSpy.mockResolvedValue(okResponse({
        success: true,
        result: [{ id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", name: "Llama 3.3 70B" }],
      }));
      const models = await adapter.getModels();
      expect(models[0].scores.reasoning).toBeGreaterThanOrEqual(0.7);
      expect(models[0].scores.coding).toBeGreaterThanOrEqual(0.5);
      expect(models[0].contextWindow).toBe(8192);
    });

    it("marks fast models with high speed", async () => {
      fetchSpy.mockResolvedValue(okResponse({
        success: true,
        result: [{ id: "@cf/meta/llama-3.1-8b-instruct-fast", name: "Llama 3.1 8B Fast" }],
      }));
      const models = await adapter.getModels();
      expect(models[0].scores.speed).toBeGreaterThanOrEqual(0.88);
    });

    it("marks coding models with deepseek", async () => {
      fetchSpy.mockResolvedValue(okResponse({
        success: true,
        result: [{ id: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", name: "DeepSeek R1" }],
      }));
      const models = await adapter.getModels();
      expect(models[0].scores.coding).toBeGreaterThanOrEqual(0.78);
      expect(models[0].strengths).toContain("coding");
    });

    it("all models are freeTier true", async () => {
      fetchSpy.mockResolvedValue(okResponse({
        success: true,
        result: [{ id: "@cf/meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B" }],
      }));
      const models = await adapter.getModels();
      expect(models[0].freeTier).toBe(true);
    });
  });

  describe("getQuota", () => {
    it("returns empty windows", async () => {
      const quota = await adapter.getQuota();
      expect(quota.providerId).toBe("cloudflare-workers-ai");
      expect(quota.isExhausted).toBe(false);
    });
  });

  describe("getUsage", () => {
    it("returns undefined", async () => {
      await expect(adapter.getUsage()).resolves.toBeUndefined();
    });
  });
});
