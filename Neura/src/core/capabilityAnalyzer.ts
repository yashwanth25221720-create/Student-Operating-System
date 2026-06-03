import type { ModelMetadata } from "../types/model";
import { clamp01 } from "../utils/validators";

export class CapabilityAnalyzer {
  enrich(model: ModelMetadata): ModelMetadata {
    const text = `${model.id} ${model.displayName} ${JSON.stringify(model.raw)}`.toLowerCase();
    const contextScore = clamp01((model.contextWindow ?? 0) / 200000);
    const coding = Math.max(model.scores.coding, keywordScore(text, ["code", "coder", "qwen", "deepseek", "codestral"]));
    const reasoning = Math.max(model.scores.reasoning, keywordScore(text, ["reason", "r1", "thinking", "nemotron", "o1"]));
    const speed = Math.max(model.scores.speed, keywordScore(text, ["flash", "instant", "turbo", "groq", "8b", "7b"]));
    const creativity = Math.max(model.scores.creativity, keywordScore(text, ["creative", "opus", "pro", "large"]));
    const planning = Math.max(model.scores.planning, (reasoning + contextScore) / 2);

    const strengths = new Set(model.strengths);
    if (coding >= 0.75) strengths.add("coding");
    if (reasoning >= 0.75) strengths.add("reasoning");
    if (speed >= 0.8) strengths.add("speed");
    if (model.capabilities.vision) strengths.add("vision");
    if (model.capabilities.imageGeneration) strengths.add("image-generation");
    if (model.capabilities.embeddings) strengths.add("embeddings");
    if (model.capabilities.local) strengths.add("offline");
    if (model.capabilities.longContext) strengths.add("long-context");

    return {
      ...model,
      scores: {
        ...model.scores,
        coding: clamp01(coding),
        reasoning: clamp01(reasoning),
        speed: clamp01(speed),
        creativity: clamp01(creativity),
        planning: clamp01(planning),
        vision: model.capabilities.vision ? Math.max(model.scores.vision, 0.7) : 0,
        imageGeneration: model.capabilities.imageGeneration ? Math.max(model.scores.imageGeneration, 0.75) : 0,
        tools: model.capabilities.tools ? Math.max(model.scores.tools, 0.65) : 0,
        embeddings: model.capabilities.embeddings ? Math.max(model.scores.embeddings, 0.75) : 0,
        longContext: Math.max(model.scores.longContext, contextScore)
      },
      strengths: [...strengths]
    };
  }

  enrichMany(models: ModelMetadata[]): ModelMetadata[] {
    return models.map((model) => this.enrich(model));
  }
}

function keywordScore(text: string, keywords: string[]): number {
  const hits = keywords.filter((keyword) => text.includes(keyword)).length;
  if (hits === 0) {
    return 0;
  }
  return clamp01(0.55 + hits * 0.12);
}
