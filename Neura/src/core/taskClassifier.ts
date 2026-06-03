import type { GenerateRequest } from "../types/provider";
import type { TaskProfile, TaskType } from "../types/task";
import { estimateTokensFromMessages, messageToText } from "../utils/validators";

const TASK_KEYWORDS: Record<TaskType, RegExp[]> = {
  coding: [/code|typescript|javascript|python|bug|refactor|function|class|compile|test/i],
  reasoning: [/reason|prove|derive|analyze|why|tradeoff|evaluate/i],
  planning: [/plan|roadmap|architecture|strategy|steps|design/i],
  summarization: [/summarize|summary|compress|brief|tl;dr/i],
  vision: [/image|screenshot|photo|diagram|vision|visual/i],
  image_generation: [/generate image|create image|draw|illustration|poster|logo|text to image|image generation/i],
  embeddings: [/embedding|vector|semantic search|similarity|nearest/i],
  fast_chat: [/quick|fast|short|chat|reply/i],
  long_context: [/long context|large document|entire file|repository|transcript|book/i],
  terminal_execution: [/terminal|shell|command|execute|powershell|bash|cli/i]
};

export class TaskClassifier {
  classify(request: GenerateRequest): TaskProfile {
    const estimatedInputTokens = estimateTokensFromMessages(request.messages);
    const text = request.messages.map(messageToText).join("\n");
    const hasImage = request.messages.some(
      (message) => Array.isArray(message.content) && message.content.some((part) => part.type === "image_url")
    );
    const hinted = request.taskHint;
    const type = hinted ?? inferType(text, estimatedInputTokens, hasImage, Boolean(request.tools?.length));

    return {
      type,
      priority: inferPriority(type),
      requiresVision: hasImage || type === "vision",
      requiresTools: Boolean(request.tools?.length) || type === "terminal_execution",
      requiresEmbeddings: type === "embeddings",
      preferLocal: type === "terminal_execution",
      estimatedInputTokens,
      expectedOutputTokens: request.maxTokens ?? inferExpectedOutput(type),
      latencyPreference: type === "fast_chat" ? "lowest" : type === "reasoning" || type === "coding" ? "quality_first" : "balanced",
      qualityPreference: type === "reasoning" || type === "coding" || type === "planning" ? "best" : "balanced",
      preserveQuota: type === "fast_chat" || type === "summarization"
    };
  }
}

function inferType(text: string, estimatedInputTokens: number, hasImage: boolean, hasTools: boolean): TaskType {
  if (/generate image|create image|text to image|draw|illustration|poster|logo/i.test(text)) return "image_generation";
  if (hasImage) return "vision";
  if (hasTools) return "terminal_execution";
  if (estimatedInputTokens > 24000) return "long_context";

  const scores = new Map<TaskType, number>();
  for (const [type, patterns] of Object.entries(TASK_KEYWORDS) as Array<[TaskType, RegExp[]]>) {
    scores.set(type, patterns.filter((pattern) => pattern.test(text)).length);
  }

  const best = [...scores.entries()].sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : "fast_chat";
}

function inferPriority(type: TaskType): number {
  switch (type) {
    case "reasoning":
    case "coding":
    case "planning":
      return 0.85;
    case "vision":
    case "image_generation":
    case "long_context":
      return 0.75;
    case "terminal_execution":
      return 0.7;
    case "embeddings":
      return 0.55;
    case "summarization":
    case "fast_chat":
      return 0.45;
  }
}

function inferExpectedOutput(type: TaskType): number {
  switch (type) {
    case "coding":
    case "planning":
      return 2000;
    case "reasoning":
    case "long_context":
      return 3000;
    case "summarization":
      return 900;
    case "image_generation":
      return 1200;
    case "fast_chat":
      return 400;
    default:
      return 1200;
  }
}
