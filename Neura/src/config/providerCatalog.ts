import type { ProviderType } from "../types/provider";

export type ProviderCategory =
  | "frontier"
  | "inference"
  | "community"
  | "decentralized"
  | "asian-cloud"
  | "coding"
  | "local"
  | "gateway"
  | "experimental";

export type ProviderCapabilityTag =
  | "chat"
  | "coding"
  | "reasoning"
  | "vision"
  | "image-generation"
  | "embeddings"
  | "reranking"
  | "tools"
  | "streaming"
  | "long-context"
  | "local"
  | "gpu"
  | "gateway";

export interface ProviderGuide {
  id: string;
  displayName: string;
  category: ProviderCategory;
  type: ProviderType;
  keyEnvVar?: string;
  baseUrlEnvVar: string;
  enabledEnvVar?: string;
  keyUrl?: string;
  docsUrl: string;
  defaultBaseUrl: string;
  supportsRuntime: boolean;
  modelDiscovery: "dynamic" | "manual" | "local";
  capabilities: ProviderCapabilityTag[];
  freeTier: boolean;
  instructions: string[];
  notes: string[];
}

export const PROVIDER_GUIDES: ProviderGuide[] = [
  provider("openai", "OpenAI", "frontier", "openai-compatible", "https://platform.openai.com/api-keys", "https://platform.openai.com/docs/api-reference", "https://api.openai.com/v1", ["chat", "coding", "reasoning", "vision", "image-generation", "embeddings", "tools", "streaming", "long-context"]),
  provider("anthropic", "Anthropic Claude", "frontier", "anthropic-compatible", "https://console.anthropic.com/settings/keys", "https://docs.anthropic.com/en/api/getting-started", "https://api.anthropic.com", ["chat", "coding", "reasoning", "vision", "tools", "streaming", "long-context"]),
  provider("gemini", "Google AI Studio (Gemini)", "frontier", "gemini", "https://aistudio.google.com/apikey", "https://ai.google.dev/gemini-api/docs/api-key", "https://generativelanguage.googleapis.com/v1beta", ["chat", "coding", "reasoning", "vision", "embeddings", "tools", "streaming", "long-context"], true, true),
  provider("xai", "xAI Grok", "frontier", "openai-compatible", "https://console.x.ai/", "https://docs.x.ai/docs/api-reference", "https://api.x.ai/v1", ["chat", "coding", "reasoning", "vision", "tools", "streaming"]),
  provider("mistral", "Mistral AI", "frontier", "openai-compatible", "https://console.mistral.ai/api-keys", "https://docs.mistral.ai/api/", "https://api.mistral.ai/v1", ["chat", "coding", "reasoning", "embeddings", "tools", "streaming"]),
  provider("cohere", "Cohere", "frontier", "cohere-compatible", "https://dashboard.cohere.com/api-keys", "https://docs.cohere.com/reference/about", "https://api.cohere.com/v2", ["chat", "reasoning", "embeddings", "reranking", "tools", "streaming"]),
  provider("ai21", "AI21 Labs", "frontier", "manual", "https://studio.ai21.com/account/api-key", "https://docs.ai21.com/reference", "https://api.ai21.com/studio/v1", ["chat", "reasoning", "long-context"], false),
  provider("deepseek", "DeepSeek", "frontier", "openai-compatible", "https://platform.deepseek.com/api_keys", "https://api-docs.deepseek.com/", "https://api.deepseek.com/v1", ["chat", "coding", "reasoning", "tools", "streaming"]),
  provider("zhipu", "Zhipu AI (GLM)", "frontier", "openai-compatible", "https://open.bigmodel.cn/usercenter/apikeys", "https://open.bigmodel.cn/dev/api", "https://open.bigmodel.cn/api/paas/v4", ["chat", "coding", "reasoning", "vision", "tools", "streaming"]),
  provider("minimax", "MiniMax AI", "frontier", "openai-compatible", "https://platform.minimaxi.com/user-center/basic-information/interface-key", "https://www.minimax.io/platform/document", "https://api.minimax.io/v1", ["chat", "reasoning", "vision", "tools", "streaming"]),
  provider("moonshot", "Moonshot AI (Kimi)", "frontier", "openai-compatible", "https://platform.moonshot.ai/console/api-keys", "https://platform.moonshot.ai/docs/api-reference", "https://api.moonshot.ai/v1", ["chat", "coding", "reasoning", "long-context", "tools", "streaming"]),
  provider("stepfun", "StepFun AI", "frontier", "openai-compatible", "https://platform.stepfun.com/account/api-keys", "https://platform.stepfun.com/docs", "https://api.stepfun.com/v1", ["chat", "reasoning", "vision", "tools", "streaming"]),
  provider("01ai", "01.AI (Yi Models)", "frontier", "openai-compatible", "https://platform.lingyiwanwu.com/apikeys", "https://platform.lingyiwanwu.com/docs", "https://api.lingyiwanwu.com/v1", ["chat", "coding", "reasoning", "streaming"]),

  provider("openrouter", "OpenRouter", "inference", "openrouter", "https://openrouter.ai/settings/keys", "https://openrouter.ai/docs/api-keys", "https://openrouter.ai/api/v1", ["chat", "coding", "reasoning", "vision", "embeddings", "tools", "streaming", "long-context", "gateway"]),
  provider("groq", "Groq", "inference", "groq", "https://console.groq.com/keys", "https://console.groq.com/docs/api-reference", "https://api.groq.com/openai/v1", ["chat", "coding", "reasoning", "tools", "streaming"], true, true),
  provider("together", "Together AI", "inference", "openai-compatible", "https://api.together.xyz/settings/api-keys", "https://docs.together.ai/reference/chat-completions-1", "https://api.together.xyz/v1", ["chat", "coding", "reasoning", "vision", "image-generation", "embeddings", "streaming", "gpu"]),
  provider("fireworks", "Fireworks AI", "inference", "openai-compatible", "https://fireworks.ai/account/api-keys", "https://docs.fireworks.ai/api-reference/introduction", "https://api.fireworks.ai/inference/v1", ["chat", "coding", "reasoning", "vision", "embeddings", "tools", "streaming", "gpu"]),
  provider("cerebras", "Cerebras Cloud", "inference", "openai-compatible", "https://cloud.cerebras.ai/platform/", "https://inference-docs.cerebras.ai/api-reference/chat-completions", "https://api.cerebras.ai/v1", ["chat", "coding", "reasoning", "streaming"]),
  provider("sambanova", "SambaNova Cloud", "inference", "openai-compatible", "https://cloud.sambanova.ai/apis", "https://docs.sambanova.ai/cloud/docs/api-reference", "https://api.sambanova.ai/v1", ["chat", "coding", "reasoning", "streaming"]),
  provider("deepinfra", "DeepInfra", "inference", "openai-compatible", "https://deepinfra.com/dash/api_keys", "https://deepinfra.com/docs/openai_api", "https://api.deepinfra.com/v1/openai", ["chat", "coding", "reasoning", "vision", "image-generation", "embeddings", "streaming", "gpu"]),
  provider("replicate", "Replicate", "inference", "manual", "https://replicate.com/account/api-tokens", "https://replicate.com/docs/reference/http", "https://api.replicate.com/v1", ["chat", "vision", "image-generation", "gpu"], false),
  provider("hyperbolic", "Hyperbolic AI", "inference", "openai-compatible", "https://app.hyperbolic.xyz/settings", "https://docs.hyperbolic.xyz/docs/getting-started", "https://api.hyperbolic.xyz/v1", ["chat", "coding", "reasoning", "vision", "image-generation", "streaming", "gpu"]),
  provider("baseten", "Baseten", "inference", "manual", "https://app.baseten.co/settings/api_keys", "https://docs.baseten.co/api-reference", "https://model-xxxx.api.baseten.co", ["chat", "image-generation", "gpu"], false),
  provider("lepton", "Lepton AI", "inference", "openai-compatible", "https://dashboard.lepton.ai/settings", "https://www.lepton.ai/docs", "https://llm.lepton.run/api/v1", ["chat", "coding", "reasoning", "streaming", "gpu"]),
  provider("anyscale", "Anyscale Endpoints", "inference", "openai-compatible", "https://console.anyscale.com/credentials", "https://docs.anyscale.com/llm/serving/api-reference", "https://api.endpoints.anyscale.com/v1", ["chat", "coding", "reasoning", "streaming"]),
  provider("octoai", "OctoAI", "inference", "manual", "https://octo.ai/docs/getting-started/how-to-create-an-octoai-access-token", "https://octo.ai/docs", "https://text.octoai.run/v1", ["chat", "image-generation", "gpu"], false),
  provider("inferless", "Inferless AI", "inference", "manual", "https://app.inferless.com/", "https://docs.inferless.com/", "https://api.inferless.com", ["chat", "gpu"], false),
  provider("novita", "Novita AI", "inference", "openai-compatible", "https://novita.ai/settings/key-management", "https://novita.ai/docs/api-reference/llm/create-chat-completion", "https://api.novita.ai/v3/openai", ["chat", "coding", "reasoning", "vision", "image-generation", "streaming", "gpu"]),
  provider("siliconflow", "SiliconFlow", "inference", "openai-compatible", "https://cloud.siliconflow.cn/account/ak", "https://docs.siliconflow.cn/api-reference/chat-completions/chat-completions", "https://api.siliconflow.cn/v1", ["chat", "coding", "reasoning", "embeddings", "tools", "streaming"]),
  provider("kluster", "Kluster AI", "inference", "openai-compatible", "https://platform.kluster.ai/", "https://docs.kluster.ai/", "https://api.kluster.ai/v1", ["chat", "coding", "reasoning", "streaming"]),
  provider("llm7", "LLM7", "inference", "openai-compatible", "https://token.llm7.io/", "https://github.com/chigwell/llm7.io", "https://api.llm7.io/v1", ["chat", "coding", "reasoning", "streaming"]),
  provider("modelfusion", "ModelFusion AI", "inference", "manual", "https://modelfusion.ai/", "https://modelfusion.ai/", "https://api.modelfusion.ai", ["chat", "gateway"], false),
  provider("poe", "Poe API", "inference", "manual", "https://poe.com/api_key", "https://creator.poe.com/docs/accessing-other-bots-on-poe", "https://api.poe.com", ["chat", "gateway"], false),
  provider("perplexity", "Perplexity API", "inference", "openai-compatible", "https://www.perplexity.ai/settings/api", "https://docs.perplexity.ai/api-reference/chat-completions", "https://api.perplexity.ai", ["chat", "reasoning", "streaming"]),
  provider("aimlapi", "AIML API", "inference", "openai-compatible", "https://aimlapi.com/app/keys", "https://docs.aimlapi.com/api-references/text-models-llm", "https://api.aimlapi.com/v1", ["chat", "coding", "reasoning", "vision", "image-generation", "embeddings", "streaming", "gateway"]),
  provider("vercel-ai-gateway", "Vercel AI Gateway", "gateway", "openai-compatible", "https://vercel.com/account/settings/tokens", "https://vercel.com/docs/ai-gateway", "https://ai-gateway.vercel.sh/v1", ["chat", "coding", "reasoning", "vision", "tools", "streaming", "gateway"]),
  provider("portkey", "Portkey AI Gateway", "gateway", "openai-compatible", "https://app.portkey.ai/api-keys", "https://portkey.ai/docs/api-reference/introduction", "https://api.portkey.ai/v1", ["chat", "coding", "reasoning", "vision", "tools", "streaming", "gateway"]),
  provider("openpipe", "OpenPipe", "gateway", "openai-compatible", "https://app.openpipe.ai/settings/api-keys", "https://docs.openpipe.ai/", "https://api.openpipe.ai/api/v1", ["chat", "streaming", "gateway"]),
  provider("helicone", "Helicone AI Gateway", "gateway", "openai-compatible", "https://us.helicone.ai/settings/api-keys", "https://docs.helicone.ai/getting-started/integration-method/openai-proxy", "https://oai.helicone.ai/v1", ["chat", "coding", "reasoning", "vision", "tools", "streaming", "gateway"]),

  provider("huggingface", "Hugging Face Inference API", "community", "huggingface-compatible", "https://huggingface.co/settings/tokens", "https://huggingface.co/docs/api-inference/index", "https://router.huggingface.co/v1", ["chat", "coding", "reasoning", "vision", "image-generation", "embeddings", "streaming"]),
  provider("cloudflare-workers-ai", "Cloudflare Workers AI", "community", "cloudflare-workers-ai", "https://dash.cloudflare.com/profile/api-tokens", "https://developers.cloudflare.com/workers-ai/", "https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai", ["chat", "coding", "reasoning", "vision", "image-generation", "embeddings", "gpu"], true, true),
  provider("github-models", "GitHub Models", "community", "openai-compatible", "https://github.com/settings/tokens", "https://docs.github.com/en/github-models/prototyping-with-ai-models", "https://models.github.ai/inference", ["chat", "coding", "reasoning", "vision", "tools", "streaming"], true, true),
  provider("nvidia", "NVIDIA NIM", "community", "nvidia", "https://build.nvidia.com/", "https://docs.api.nvidia.com/nim/docs/api-quickstart", "https://integrate.api.nvidia.com/v1", ["chat", "coding", "reasoning", "vision", "tools", "streaming", "gpu"]),
  provider("modal", "Modal Labs", "community", "manual", "https://modal.com/settings/tokens", "https://modal.com/docs/guide/webhooks", "https://api.modal.com", ["chat", "image-generation", "gpu"], false),
  provider("runpod", "RunPod Serverless", "community", "manual", "https://www.runpod.io/console/user/settings", "https://docs.runpod.io/serverless", "https://api.runpod.ai/v2", ["chat", "image-generation", "gpu"], false),
  provider("lambda-cloud", "Lambda AI Cloud", "community", "manual", "https://cloud.lambda.ai/api-keys", "https://docs.lambda.ai/public-cloud/cloud-api/", "https://cloud.lambdalabs.com/api/v1", ["gpu"], false),
  provider("banana", "Banana.dev", "community", "manual", "https://app.banana.dev/", "https://docs.banana.dev/", "https://api.banana.dev", ["chat", "image-generation", "gpu"], false),
  provider("beam", "Beam Cloud", "community", "manual", "https://cloud.beam.cloud/settings/api-keys", "https://docs.beam.cloud/v2/api", "https://api.beam.cloud", ["chat", "image-generation", "gpu"], false),
  provider("datacrunch", "DataCrunch AI", "community", "manual", "https://datacrunch.io/", "https://datacrunch.io/docs", "https://api.datacrunch.io", ["gpu"], false),
  provider("crusoe", "Crusoe Cloud", "community", "manual", "https://console.crusoecloud.com/", "https://docs.crusoecloud.com/reference", "https://api.crusoecloud.com/v1alpha5", ["gpu"], false),
  provider("genesis-cloud", "Genesis Cloud AI", "community", "manual", "https://www.genesiscloud.com/", "https://www.genesiscloud.com/docs", "https://api.genesiscloud.com", ["gpu"], false),

  provider("openledger", "OpenLedger", "decentralized", "manual", "https://openledger.xyz/", "https://openledger.xyz/", "https://openledger.xyz", ["chat"], false),
  provider("bittensor", "Bittensor", "decentralized", "manual", "https://bittensor.com/", "https://docs.bittensor.com/", "https://bittensor.com", ["chat", "gpu"], false),
  provider("akash", "Akash Network", "decentralized", "manual", "https://console.akash.network/", "https://akash.network/docs/", "https://akash.network", ["gpu"], false),
  provider("gensyn", "Gensyn AI", "decentralized", "manual", "https://gensyn.ai/", "https://gensyn.ai/", "https://gensyn.ai", ["gpu"], false),
  provider("pokt", "POKT Network AI", "decentralized", "manual", "https://pokt.network/", "https://docs.pokt.network/", "https://pokt.network", ["gateway"], false),
  provider("nosana", "Nosana AI", "decentralized", "manual", "https://nosana.io/", "https://docs.nosana.io/", "https://nosana.io", ["gpu"], false),
  provider("ionet", "io.net", "decentralized", "manual", "https://io.net/", "https://docs.io.net/", "https://io.net", ["gpu"], false),
  provider("vastai", "Vast.ai", "decentralized", "manual", "https://cloud.vast.ai/account/", "https://docs.vast.ai/", "https://console.vast.ai", ["gpu"], false),

  provider("qwen", "Alibaba Model Studio (Qwen)", "asian-cloud", "openai-compatible", "https://bailian.console.aliyun.com/?apiKey=1", "https://help.aliyun.com/zh/model-studio/developer-reference/use-qwen-by-calling-api", "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", ["chat", "coding", "reasoning", "vision", "embeddings", "tools", "streaming"]),
  provider("tencent-hunyuan", "Tencent Hunyuan", "asian-cloud", "manual", "https://console.cloud.tencent.com/cam/capi", "https://cloud.tencent.com/document/product/1729", "https://hunyuan.tencentcloudapi.com", ["chat", "coding", "reasoning", "vision"], false),
  provider("baidu-qianfan", "Baidu Qianfan", "asian-cloud", "manual", "https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application", "https://cloud.baidu.com/doc/WENXINWORKSHOP/index.html", "https://qianfan.baidubce.com/v2", ["chat", "coding", "reasoning", "vision", "embeddings"], false),
  provider("sensenova", "SenseNova AI", "asian-cloud", "manual", "https://platform.sensenova.cn/", "https://platform.sensenova.cn/doc", "https://api.sensenova.cn", ["chat", "vision", "image-generation"], false),
  provider("volcengine", "ByteDance Volcano Engine AI", "asian-cloud", "openai-compatible", "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey", "https://www.volcengine.com/docs/82379", "https://ark.cn-beijing.volces.com/api/v3", ["chat", "coding", "reasoning", "vision", "tools", "streaming"]),
  provider("huawei-modelarts", "Huawei ModelArts", "asian-cloud", "manual", "https://console.huaweicloud.com/iam/", "https://support.huaweicloud.com/modelarts/", "https://modelarts.cn-north-4.myhuaweicloud.com", ["chat", "gpu"], false),
  provider("aisphere", "AISphere", "asian-cloud", "manual", "https://aisphere.com/", "https://aisphere.com/", "https://aisphere.com", ["chat"], false),

  provider("codegpt", "CodeGPT API", "coding", "manual", "https://codegpt.co/", "https://docs.codegpt.co/", "https://api.codegpt.co", ["chat", "coding", "tools"], false),
  provider("continue-dev", "Continue Dev Hub", "coding", "manual", "https://continue.dev/", "https://docs.continue.dev/", "https://api.continue.dev", ["chat", "coding", "tools"], false),
  provider("sourcegraph-cody", "Sourcegraph Cody API", "coding", "manual", "https://sourcegraph.com/cody", "https://sourcegraph.com/docs/cody", "https://sourcegraph.com/.api", ["chat", "coding"], false),
  provider("tabbyml", "TabbyML", "coding", "manual", "https://tabbyml.com/", "https://tabby.tabbyml.com/docs", "https://api.tabbyml.com", ["chat", "coding"], false),
  provider("windsurf", "Codeium Windsurf API", "coding", "manual", "https://windsurf.com/", "https://docs.windsurf.com/", "https://windsurf.com", ["chat", "coding", "tools"], false),
  provider("cursor", "Cursor API Integrations", "coding", "manual", "https://cursor.com/settings", "https://docs.cursor.com/", "https://api.cursor.com", ["chat", "coding", "tools"], false),

  local("ollama", "Ollama", "ollama", "https://ollama.com/download", "https://docs.ollama.com/api", "http://localhost:11434", true),
  local("lmstudio", "LM Studio", "local-openai-compatible", "https://lmstudio.ai/", "https://lmstudio.ai/docs/app/api/endpoints/openai", "http://localhost:1234/v1"),
  local("vllm", "vLLM", "local-openai-compatible", "https://docs.vllm.ai/", "https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html", "http://localhost:8000/v1"),
  local("localai", "LocalAI", "local-openai-compatible", "https://localai.io/", "https://localai.io/basics/getting_started/", "http://localhost:8080/v1"),
  local("jan", "Jan AI", "local-openai-compatible", "https://jan.ai/", "https://jan.ai/docs/local-api", "http://localhost:1337/v1"),
  local("gpt4all", "GPT4All", "manual", "https://gpt4all.io/", "https://docs.gpt4all.io/", "http://localhost:4891/v1", false),
  local("koboldcpp", "KoboldCpp", "manual", "https://github.com/LostRuins/koboldcpp", "https://github.com/LostRuins/koboldcpp/wiki", "http://localhost:5001", false),
  local("text-generation-webui", "Text Generation WebUI", "manual", "https://github.com/oobabooga/text-generation-webui", "https://github.com/oobabooga/text-generation-webui/wiki", "http://localhost:5000", false),

  provider("dify", "Dify AI", "experimental", "manual", "https://cloud.dify.ai/apps", "https://docs.dify.ai/", "https://api.dify.ai/v1", ["chat", "tools"], false),
  provider("flowise", "Flowise AI", "experimental", "manual", "https://flowiseai.com/", "https://docs.flowiseai.com/", "http://localhost:3000/api/v1", ["chat", "tools"], false),
  provider("langdock", "Langdock", "experimental", "openai-compatible", "https://app.langdock.com/settings/api-keys", "https://docs.langdock.com/api-endpoints/completion/openai", "https://api.langdock.com/openai/eu/v1", ["chat", "coding", "reasoning", "tools", "streaming", "gateway"]),
  provider("pawan", "Pawan API", "experimental", "openai-compatible", "https://pawan.krd/", "https://docs.pawan.krd/", "https://api.pawan.krd/v1", ["chat", "streaming"]),
  provider("pollinations", "Pollinations AI", "experimental", "manual", "https://pollinations.ai/", "https://github.com/pollinations/pollinations", "https://text.pollinations.ai", ["chat", "image-generation"], false),
  provider("opendevin", "OpenDevin Cloud", "experimental", "manual", "https://opendevin.com/", "https://github.com/OpenDevin/OpenDevin", "https://opendevin.com", ["chat", "coding", "tools"], false),
  provider("koyeb", "Koyeb AI", "experimental", "manual", "https://app.koyeb.com/", "https://www.koyeb.com/docs", "https://app.koyeb.com", ["gpu"], false),

  customProvider()
];

export function findProviderGuide(providerId: string): ProviderGuide | undefined {
  return PROVIDER_GUIDES.find((guide) => guide.id === providerId);
}

export function envPrefix(providerId: string): string {
  return providerId.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function provider(
  id: string,
  displayName: string,
  category: ProviderCategory,
  type: ProviderType,
  keyUrl: string,
  docsUrl: string,
  defaultBaseUrl: string,
  capabilities: ProviderCapabilityTag[],
  supportsRuntime = true,
  freeTier = false
): ProviderGuide {
  const prefix = envPrefix(id);
  return {
    id,
    displayName,
    category,
    type,
    keyEnvVar: `${prefix}_API_KEY`,
    baseUrlEnvVar: `${prefix}_BASE_URL`,
    keyUrl,
    docsUrl,
    defaultBaseUrl,
    supportsRuntime,
    modelDiscovery: supportsRuntime ? "dynamic" : "manual",
    capabilities,
    freeTier,
    instructions: [
      `Open ${displayName}'s key or console page.`,
      "Create or copy an API key/token.",
      "Paste the key into this card and save it locally.",
      supportsRuntime ? "Use Test Key, then Discover Models to populate the registry." : "This provider is stored for future/custom adapter use."
    ],
    notes: [
      freeTier ? `${displayName} offers a free tier — ideal for testing and prototyping.` :
      supportsRuntime
        ? `${displayName} is wired to a runtime adapter. If the provider changes its endpoint shape, update the base URL or adapter.`
        : `${displayName} is listed for key management and future adapter expansion. Neura stores the key but does not route traffic to it yet.`
    ]
  };
}

function local(
  id: string,
  displayName: string,
  type: ProviderType,
  keyUrl: string,
  docsUrl: string,
  defaultBaseUrl: string,
  enabledByDefault = false
): ProviderGuide {
  const prefix = envPrefix(id);
  return {
    id,
    displayName,
    category: "local",
    type,
    baseUrlEnvVar: `${prefix}_BASE_URL`,
    enabledEnvVar: `${prefix}_ENABLED`,
    keyUrl,
    docsUrl,
    defaultBaseUrl,
    supportsRuntime: type !== "manual",
    modelDiscovery: type === "manual" ? "manual" : "local",
    capabilities: ["chat", "coding", "reasoning", "vision", "embeddings", "tools", "streaming", "local"],
    freeTier: true,
    instructions: [
      `Install and start ${displayName}.`,
      "Pull or load the local models you want.",
      "Confirm the local base URL.",
      type !== "manual" ? "Use Test Key, then Discover Models to detect local models." : "This local runtime is stored for future/custom adapter use."
    ],
    notes: [
      enabledByDefault
        ? `${displayName} is enabled by default because it is commonly local and keyless.`
        : `${displayName} is keyless but disabled until you enable it in the UI.`
    ]
  };
}

function customProvider(): ProviderGuide {
  return {
    id: "custom-openai",
    displayName: "Custom OpenAI-Compatible Endpoint",
    category: "gateway",
    type: "openai-compatible",
    keyEnvVar: "CUSTOM_OPENAI_API_KEY",
    baseUrlEnvVar: "CUSTOM_OPENAI_BASE_URL",
    keyUrl: "https://platform.openai.com/docs/api-reference",
    docsUrl: "https://platform.openai.com/docs/api-reference",
    defaultBaseUrl: "https://example.com/v1",
    supportsRuntime: true,
    modelDiscovery: "dynamic",
    capabilities: ["chat", "coding", "reasoning", "vision", "embeddings", "tools", "streaming", "gateway"],
    freeTier: false,
    instructions: [
      "Paste any OpenAI-compatible base URL ending in /v1.",
      "Paste its API key if required.",
      "Save and test the endpoint.",
      "Discover models to add it to the registry."
    ],
    notes: ["Use this for new providers before a dedicated adapter exists."]
  };
}
