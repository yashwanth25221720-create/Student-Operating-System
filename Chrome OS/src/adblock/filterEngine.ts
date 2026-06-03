export interface HaloAdBlockerSettings {
  enabled: boolean;
  blockYouTubeAds: boolean;
  blockTrackers: boolean;
  whitelistedDomains: string[];
  customRules: string[];
}

const RULE_ID_BASE = 10_000;

const AD_DOMAINS = [
  "doubleclick.net",
  "googleadservices.com",
  "googlesyndication.com",
  "googletagservices.com",
  "adservice.google.com",
  "ads.youtube.com",
  "youtube.com/pagead/",
  "taboola.com",
  "outbrain.com",
  "criteo.com",
  "rubiconproject.com",
  "pubmatic.com",
  "openx.net",
  "adnxs.com",
  "media.net",
  "scorecardresearch.com",
  "moatads.com",
  "zedo.com",
  "popads.net",
  "propellerads.com"
];

const TRACKER_DOMAINS = [
  "google-analytics.com",
  "analytics.google.com",
  "googletagmanager.com",
  "facebook.com/tr",
  "connect.facebook.net",
  "hotjar.com",
  "hotjar.io",
  "mixpanel.com",
  "segment.io",
  "segment.com",
  "analytics.tiktok.com",
  "sc-static.net",
  "snap.licdn.com",
  "bat.bing.com",
  "clarity.ms"
];

const URL_PATTERNS = [
  "ads",
  "advertisement",
  "advertisements",
  "sponsored",
  "promo",
  "banner",
  "tracking",
  "affiliate",
  "analytics",
  "pixel",
  "pagead"
];

export async function syncDeclarativeRules(settings: HaloAdBlockerSettings) {
  if (!chrome.declarativeNetRequest) return;

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.filter((rule) => rule.id >= RULE_ID_BASE).map((rule) => rule.id);

  if (!settings.enabled) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds });
    return;
  }

  const rules = buildRules(settings);
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds,
    addRules: rules.slice(0, 4500)
  });
}

function buildRules(settings: HaloAdBlockerSettings): chrome.declarativeNetRequest.Rule[] {
  let id = RULE_ID_BASE;
  const excludedRequestDomains = settings.whitelistedDomains.filter(Boolean);
  const rules: chrome.declarativeNetRequest.Rule[] = [];

  const addUrlFilter = (urlFilter: string, resourceTypes: chrome.declarativeNetRequest.ResourceType[] = allResourceTypes()) => {
    rules.push({
      id: id++,
      priority: 1,
      action: { type: chrome.declarativeNetRequest.RuleActionType.BLOCK },
      condition: {
        urlFilter,
        excludedRequestDomains,
        resourceTypes
      }
    });
  };

  AD_DOMAINS.forEach((domain) => addUrlFilter(`||${domain}^`));
  if (settings.blockTrackers) TRACKER_DOMAINS.forEach((domain) => addUrlFilter(`||${domain}^`));
  URL_PATTERNS.forEach((pattern) => addUrlFilter(`/${pattern}/`));

  settings.customRules.forEach((rule) => {
    const parsed = parseCustomRule(rule);
    if (parsed) addUrlFilter(parsed);
  });

  return rules;
}

function parseCustomRule(rule: string) {
  const trimmed = rule.trim();
  if (!trimmed || trimmed.startsWith("!") || trimmed.startsWith("#")) return null;
  if (trimmed.startsWith("||")) return trimmed;
  if (trimmed.startsWith("/") && trimmed.endsWith("/")) return trimmed.slice(1, -1);
  if (trimmed.includes("*")) return trimmed.replace(/\*/g, "");
  return trimmed;
}

function allResourceTypes(): chrome.declarativeNetRequest.ResourceType[] {
  return [
    chrome.declarativeNetRequest.ResourceType.MAIN_FRAME,
    chrome.declarativeNetRequest.ResourceType.SUB_FRAME,
    chrome.declarativeNetRequest.ResourceType.SCRIPT,
    chrome.declarativeNetRequest.ResourceType.IMAGE,
    chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
    chrome.declarativeNetRequest.ResourceType.MEDIA,
    chrome.declarativeNetRequest.ResourceType.FONT,
    chrome.declarativeNetRequest.ResourceType.OTHER
  ];
}
