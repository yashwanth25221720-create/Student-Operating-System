export interface HaloAdBlockerSettings {
  enabled: boolean;
  blockingMode: "basic" | "balanced" | "max" | "custom";
  blockYouTubeAds: boolean;
  blockTrackers: boolean;
  blockPopups: boolean;
  blockOverlays: boolean;
  blockCookieBanners: boolean;
  antiAntiAdblock: boolean;
  elementPicker: boolean;
  whitelistedDomains: string[];
  customRules: string[];
}

const RULE_ID_BASE = 10_000;

// ==========================================
// 1. BASIC BLOCKLIST (Lightweight)
// ==========================================
const BASIC_AD_DOMAINS = [
  "doubleclick.net",
  "googleadservices.com",
  "googlesyndication.com",
  "googletagservices.com",
  "adservice.google.com",
  "ads.youtube.com",
  "youtube.com/pagead/",
  "criteo.com",
  "taboola.com",
  "outbrain.com"
];

const BASIC_TRACKER_DOMAINS = [
  "google-analytics.com",
  "analytics.google.com",
  "googletagmanager.com"
];

const BASIC_URL_PATTERNS = [
  "pagead",
  "adservice",
  "googleadservices"
];

// ==========================================
// 2. UBLOCK ORIGIN BLOCKLIST (Balanced/Standard)
// ==========================================
const UBLOCK_AD_DOMAINS = [
  "rubiconproject.com",
  "pubmatic.com",
  "openx.net",
  "adnxs.com",
  "media.net",
  "scorecardresearch.com",
  "moatads.com",
  "zedo.com",
  "popads.net",
  "propellerads.com",
  "adcolony.com",
  "applovin.com",
  "bidswitch.net",
  "casalemedia.com",
  "gumgum.com",
  "indexww.com",
  "lystats.com",
  "sharethrough.com",
  "smartadserver.com",
  "triplelift.com",
  "amazon-adsystem.com",
  "adsystem.com",
  "adthor.com",
  "adtrace.com",
  "adxbid.com",
  "advertising.com",
  "yieldlab.net",
  "yieldmo.com",
  "yieldmanager.com"
];

const UBLOCK_TRACKER_DOMAINS = [
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
  "clarity.ms",
  "amplitude.com",
  "optimizely.com",
  "crazyegg.com",
  "branch.io",
  "newrelic.com",
  "rollbar.com",
  "bugsnag.com",
  "sentry.io",
  "appsflyer.com",
  "adjust.com",
  "kochava.com",
  "conviva.com",
  "kissmetrics.com"
];

const UBLOCK_URL_PATTERNS = [
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
  "telemetry",
  "tracker"
];

// ==========================================
// 3. ADGUARD BLOCKLIST (Max/Extensive)
// ==========================================
const ADGUARD_AD_DOMAINS = [
  // Popups & Redirect domains
  "popcash.net",
  "adcash.com",
  "revenuehits.com",
  "clickadu.com",
  "yllix.com",
  "exoclick.com",
  "juicyads.com",
  "ero-advertising.com",
  "onloadpopunder.com",
  "popads.org",
  "onclickads.net",
  "ad-maven.com",
  // Widget trackers & Annoyances
  "addthis.com",
  "sharethis.com",
  "disqus.com",
  "linksynergy.com",
  "skimresources.com",
  "viglink.com",
  "outbrainimg.com",
  "taboolasyndication.com"
];

const ADGUARD_TRACKER_DOMAINS = [
  // Cookie Consent Managers & Banners
  "cookiebot.com",
  "cookiebot.co.uk",
  "cookielaw.org",
  "onetrust.com",
  "consentmanager.net",
  "quantcast.mgr.consensu.org",
  "trustarc.com",
  "civiccomputing.com",
  "usercentrics.eu",
  "didomi.io",
  "cmp.oath.com",
  "consentframework.com",
  "optanon.com",
  // Telemetry, Malware & Extra Trackers
  "coinhive.com",
  "cryptoloot.pro",
  "minerstat.com",
  "pushwelcome.com",
  "notification-system.com",
  "tracking-hub.net",
  "analytics-platform.com",
  "telemetry-tracker.org",
  "visitorstat.com",
  "clicky.com",
  "statcounter.com",
  "woopra.com"
];

const ADGUARD_URL_PATTERNS = [
  "cookie-consent",
  "cookiebanner",
  "cookiebot",
  "consent-banner",
  "annoyance",
  "popunder",
  "popunder-ad",
  "popcash",
  "adcash",
  "coin-miner",
  "cryptominer",
  "webminer",
  "pushcheck"
];

export async function syncDeclarativeRules(settings: HaloAdBlockerSettings) {
  if (!chrome.declarativeNetRequest) return;

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.filter((rule) => rule.id >= RULE_ID_BASE).map((rule) => rule.id);

  // Toggle static rulesets based on mode
  let enableRulesets: string[] = [];
  let disableRulesets: string[] = ["ruleset_ublock", "ruleset_adguard"];

  if (settings.enabled) {
    let mode = settings.blockingMode || "balanced";

    // If in custom mode, dynamically scale ruleset weight based on enabled features
    if (mode === "custom") {
      if (settings.blockCookieBanners || settings.elementPicker) {
        mode = "max";
      } else if (settings.blockTrackers || settings.blockPopups || settings.blockOverlays) {
        mode = "balanced";
      } else {
        mode = "basic";
      }
    }

    // Enable appropriate static ruleset based on mode
    if (mode === "balanced") {
      enableRulesets = ["ruleset_ublock"];
      disableRulesets = ["ruleset_adguard"];
    } else if (mode === "max") {
      enableRulesets = ["ruleset_adguard"];
      disableRulesets = ["ruleset_ublock"];
    } else {
      // Basic mode - disable both static rulesets, use lightweight dynamic rules only
      enableRulesets = [];
      disableRulesets = ["ruleset_ublock", "ruleset_adguard"];
    }

    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: enableRulesets,
      disableRulesetIds: disableRulesets
    });
  } else {
    // Ad blocker disabled - disable both static rulesets
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: [],
      disableRulesetIds: ["ruleset_ublock", "ruleset_adguard"]
    });
  }

  // Update dynamic rules (for basic mode and custom rules)
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

function getRuleLists(settings: HaloAdBlockerSettings) {
  let mode = settings.blockingMode || "balanced";

  // If in custom mode, dynamically scale ruleset weight based on enabled features
  if (mode === "custom") {
    if (settings.blockCookieBanners || settings.elementPicker) {
      mode = "max";
    } else if (settings.blockTrackers || settings.blockPopups || settings.blockOverlays) {
      mode = "balanced";
    } else {
      mode = "basic";
    }
  }

  let ads = [...BASIC_AD_DOMAINS];
  let trackers = [...BASIC_TRACKER_DOMAINS];
  let urls = [...BASIC_URL_PATTERNS];

  if (mode === "balanced" || mode === "max") {
    ads = [...ads, ...UBLOCK_AD_DOMAINS];
    trackers = [...trackers, ...UBLOCK_TRACKER_DOMAINS];
    urls = [...urls, ...UBLOCK_URL_PATTERNS];
  }

  if (mode === "max") {
    ads = [...ads, ...ADGUARD_AD_DOMAINS];
    trackers = [...trackers, ...ADGUARD_TRACKER_DOMAINS];
    urls = [...urls, ...ADGUARD_URL_PATTERNS];
  }

  return { ads, trackers, urls };
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

  const { ads, trackers, urls } = getRuleLists(settings);

  // Add ad domains
  ads.forEach((domain) => addUrlFilter(`||${domain}^`));

  // Add tracker domains if tracking protection is enabled
  if (settings.blockTrackers) {
    trackers.forEach((domain) => addUrlFilter(`||${domain}^`));
  }

  // Add general url patterns
  urls.forEach((pattern) => addUrlFilter(`/${pattern}/`));

  // Add user custom rules
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
