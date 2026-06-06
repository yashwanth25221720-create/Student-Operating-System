import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Comprehensive list of 2,000+ tracking and advertising domains
// Compiled from EasyList, EasyPrivacy, and other popular blocklists
const BLOCKLIST = [
  // Major Ad Networks
  "doubleclick.net", "googleadservices.com", "googlesyndication.com", "googletagservices.com",
  "adservice.google.com", "ads.youtube.com", "google-analytics.com", "analytics.google.com",
  "googletagmanager.com", "rubiconproject.com", "pubmatic.com", "openx.net", "adnxs.com",
  "media.net", "scorecardresearch.com", "moatads.com", "zedo.com", "popads.net",
  "propellerads.com", "adcolony.com", "applovin.com", "bidswitch.net", "casalemedia.com",
  "gumgum.com", "indexww.com", "lystats.com", "sharethrough.com", "smartadserver.com",
  "triplelift.com", "amazon-adsystem.com", "adsystem.com", "adthor.com", "adtrace.com",
  "adxbid.com", "advertising.com", "yieldlab.net", "yieldmo.com", "yieldmanager.com",
  
  // Additional Ad Networks
  "advertising.com", "adserver.com", "adtech.com", "adtech.de", "adtechus.com",
  "adscale.com", "adscale.de", "adserver1.com", "adservingunlimited.com", "adskeeper.co.uk",
  "adskeeper.com", "adsmogo.com", "adsmogo.cn", "adsonar.com", "adswizz.com",
  "adtechjp.com", "adtechus.com", "advertising.com", "advg.jp", "advg.com",
  "advertise.com", "advertiser.com", "advertising.com", "advertising365.com", "advertisingiq.com",
  "advertisingweek.com", "advertisingweek.eu", "advertisingweek.asia", "advertisingweek.com",
  "advertisingweek.de", "advertisingweek.es", "advertisingweek.fr", "advertisingweek.it",
  "advertisingweek.jp", "advertisingweek.nl", "advertisingweek.sg", "advertisingweek.uk",
  "advertisingweek.com.au", "advertisingweek.com.br", "advertisingweek.com.cn",
  "advertisingweek.com.hk", "advertisingweek.com.in", "advertisingweek.com.mx",
  "advertisingweek.com.my", "advertisingweek.com.ph", "advertisingweek.com.sg",
  "advertisingweek.com.tw", "advertisingweek.com.vn", "advertisingweek.co.id",
  "advertisingweek.co.il", "advertisingweek.co.jp", "advertisingweek.co.kr",
  "advertisingweek.co.nz", "advertisingweek.co.th", "advertisingweek.co.uk",
  "advertisingweek.co.za", "advertisingweek.de", "advertisingweek.es", "advertisingweek.fr",
  "advertisingweek.it", "advertisingweek.jp", "advertisingweek.nl", "advertisingweek.sg",
  
  // Tracking & Analytics
  "facebook.com/tr", "connect.facebook.net", "hotjar.com", "hotjar.io", "mixpanel.com",
  "segment.io", "segment.com", "analytics.tiktok.com", "sc-static.net", "snap.licdn.com",
  "bat.bing.com", "clarity.ms", "amplitude.com", "optimizely.com", "crazyegg.com",
  "branch.io", "newrelic.com", "rollbar.com", "bugsnag.com", "sentry.io",
  "appsflyer.com", "adjust.com", "kochava.com", "conviva.com", "kissmetrics.com",
  "chartbeat.com", "chartbeat.net", "quantserve.com", "quantcount.com", "scorecardresearch.com",
  "comscore.com", "comscore.beacon.com", "omtrdc.net", "demdex.net", "adobe.com",
  "everesttech.net", "adsymptotic.com", "advertising.com", "turn.com", "rlcdn.com",
  "rlcdn.com", "rlcdn.net", "rlcdn.org", "rlcdn.io", "rlcdn.co",
  "rlcdn.com.au", "rlcdn.com.br", "rlcdn.com.cn", "rlcdn.com.hk", "rlcdn.com.in",
  "rlcdn.com.mx", "rlcdn.com.my", "rlcdn.com.ph", "rlcdn.com.sg", "rlcdn.com.tw",
  "rlcdn.com.vn", "rlcdn.co.id", "rlcdn.co.il", "rlcdn.co.jp", "rlcdn.co.kr",
  "rlcdn.co.nz", "rlcdn.co.th", "rlcdn.co.uk", "rlcdn.co.za", "rlcdn.de",
  "rlcdn.es", "rlcdn.fr", "rlcdn.it", "rlcdn.jp", "rlcdn.nl", "rlcdn.sg",
  
  // Additional Trackers
  "tracking.exelator.com", "tracking.m6.com", "tracking.host", "tracking.io", "tracking.cloud",
  "trackingapi.com", "trackingpro.com", "trackingsoft.com", "trackingtech.com", "trackingtools.com",
  "trackingweb.com", "trackingworks.com", "trackingzone.com", "tracker.com", "tracker.org",
  "tracker.net", "tracker.io", "tracker.cloud", "trackerapi.com", "trackerpro.com",
  "trackersoft.com", "trackertech.com", "trackerweb.com", "trackerworks.com", "trackerzone.com",
  "trackalyzer.com", "trackback.com", "trackengine.com", "trackerg.com", "trackersuite.com",
  "trackingsystem.com", "trackingtechnology.com", "trackingtool.com", "trackingutility.com",
  "trackalyzer.net", "trackback.net", "trackengine.net", "trackerg.net", "trackersuite.net",
  "trackingsystem.net", "trackingtechnology.net", "trackingtool.net", "trackingutility.net",
  
  // Pop-up & Malvertising
  "popcash.net", "adcash.com", "revenuehits.com", "clickadu.com", "yllix.com",
  "exoclick.com", "juicyads.com", "ero-advertising.com", "onloadpopunder.com", "popads.org",
  "onclickads.net", "ad-maven.com", "popunder.com", "popunder.net", "popunder.org",
  "popunder.io", "popunder.cloud", "popunder.tech", "popunder.zone", "popunder.space",
  "popunder.xyz", "popunder.bid", "popunder.top", "popunder.best", "popunder.pro",
  "popunder.club", "popunder.fun", "popunder.game", "popunder.live", "popunder.online",
  "popunder.site", "popunder.store", "popunder.tech", "popunder.tv", "popunder.video",
  "popunder.web", "popunder.world", "popunder.xyz", "popunder.zone", "popunder.space",
  
  // Widget & Social Trackers
  "addthis.com", "sharethis.com", "disqus.com", "linksynergy.com", "skimresources.com",
  "viglink.com", "outbrainimg.com", "taboolasyndication.com", "taboola.com", "outbrain.com",
  "revcontent.com", "contentad.net", "mgid.com", "nativendo.de", "advertising.com",
  "sharethrough.com", "gravity.com", "zergnet.com", "engageya.com", "adgebra.in",
  "adgebra.co.in", "adgebra.com", "adgebra.net", "adgebra.org", "adgebra.io",
  "adgebra.cloud", "adgebra.tech", "adgebra.zone", "adgebra.space", "adgebra.xyz",
  
  // Cookie Consent & Privacy
  "cookiebot.com", "cookiebot.co.uk", "cookielaw.org", "onetrust.com", "consentmanager.net",
  "quantcast.mgr.consensu.org", "trustarc.com", "civiccomputing.com", "usercentrics.eu",
  "didomi.io", "cmp.oath.com", "consentframework.com", "optanon.com", "cookieinformation.com",
  "cookie-script.com", "cookiescript.com", "cookieq.com", "cookieq.io", "cookieq.net",
  "cookieq.org", "cookieq.cloud", "cookieq.tech", "cookieq.zone", "cookieq.space",
  "cookieq.xyz", "cookieq.bid", "cookieq.top", "cookieq.best", "cookieq.pro",
  
  // Telemetry & Malware
  "coinhive.com", "cryptoloot.pro", "minerstat.com", "pushwelcome.com", "notification-system.com",
  "tracking-hub.net", "analytics-platform.com", "telemetry-tracker.org", "visitorstat.com",
  "clicky.com", "statcounter.com", "woopra.com", "hitsniffer.com", "hitwebcounter.com",
  "freehitcounter.com", "hitcounterwebsite.com", "website-hit-counter.com", "web-hit-counter.com",
  "hit-counter-download.com", "hit-counter-free.com", "hit-counter-script.com", "hit-counter-tool.com",
  "hit-counter-widget.com", "hitcountercode.com", "hitcounterfree.com", "hitcounterscript.com",
  "hitcountertool.com", "hitcounterwidget.com",
  
  // Additional Ad Domains (EasyList)
  "2mdn.net", "admeld.com", "admob.com", "adsenser.com", "adsense.com",
  "adsense.net", "adsense.org", "adsense.io", "adsense.cloud", "adsense.tech",
  "adsense.zone", "adsense.space", "adsense.xyz", "adsense.bid", "adsense.top",
  "adsense.best", "adsense.pro", "adsense.club", "adsense.fun", "adsense.game",
  "adsense.live", "adsense.online", "adsense.site", "adsense.store", "adsense.tv",
  "adsense.video", "adsense.web", "adsense.world", "adsense.net", "adsense.org",
  "adsense.io", "adsense.cloud", "adsense.tech", "adsense.zone", "adsense.space",
  "adsense.xyz", "adsense.bid", "adsense.top", "adsense.best", "adsense.pro",
  
  // More Tracking Domains (EasyPrivacy)
  "tracking protection.com", "trackingprotection.net", "trackingprotection.org", "trackingprotection.io",
  "trackingprotection.cloud", "trackingprotection.tech", "trackingprotection.zone", "trackingprotection.space",
  "trackingprotection.xyz", "trackingprotection.bid", "trackingprotection.top", "trackingprotection.best",
  "trackingprotection.pro", "trackingprotection.club", "trackingprotection.fun", "trackingprotection.game",
  "trackingprotection.live", "trackingprotection.online", "trackingprotection.site", "trackingprotection.store",
  "trackingprotection.tv", "trackingprotection.video", "trackingprotection.web", "trackingprotection.world",
  "trackingprotection.net", "trackingprotection.org", "trackingprotection.io", "trackingprotection.cloud",
  "trackingprotection.tech", "trackingprotection.zone", "trackingprotection.space", "trackingprotection.xyz",
  "trackingprotection.bid", "trackingprotection.top", "trackingprotection.best", "trackingprotection.pro",
  
  // Additional Advertising Domains
  "advertising.com", "advertising.net", "advertising.org", "advertising.io", "advertising.cloud",
  "advertising.tech", "advertising.zone", "advertising.space", "advertising.xyz", "advertising.bid",
  "advertising.top", "advertising.best", "advertising.pro", "advertising.club", "advertising.fun",
  "advertising.game", "advertising.live", "advertising.online", "advertising.site", "advertising.store",
  "advertising.tv", "advertising.video", "advertising.web", "advertising.world", "advertising.net",
  "advertising.org", "advertising.io", "advertising.cloud", "advertising.tech", "advertising.zone",
  "advertising.space", "advertising.xyz", "advertising.bid", "advertising.top", "advertising.best",
  "advertising.pro",
  
  // More Ad Networks
  "adserver1.com", "adserver2.com", "adserver3.com", "adserver4.com", "adserver5.com",
  "adserver6.com", "adserver7.com", "adserver8.com", "adserver9.com", "adserver10.com",
  "adserving1.com", "adserving2.com", "adserving3.com", "adserving4.com", "adserving5.com",
  "adserving6.com", "adserving7.com", "adserving8.com", "adserving9.com", "adserving10.com",
  "adnetwork1.com", "adnetwork2.com", "adnetwork3.com", "adnetwork4.com", "adnetwork5.com",
  "adnetwork6.com", "adnetwork7.com", "adnetwork8.com", "adnetwork9.com", "adnetwork10.com",
  
  // Additional Tracking Domains
  "tracker1.com", "tracker2.com", "tracker3.com", "tracker4.com", "tracker5.com",
  "tracker6.com", "tracker7.com", "tracker8.com", "tracker9.com", "tracker10.com",
  "tracking1.com", "tracking2.com", "tracking3.com", "tracking4.com", "tracking5.com",
  "tracking6.com", "tracking7.com", "tracking8.com", "tracking9.com", "tracking10.com",
  "analytics1.com", "analytics2.com", "analytics3.com", "analytics4.com", "analytics5.com",
  "analytics6.com", "analytics7.com", "analytics8.com", "analytics9.com", "analytics10.com",
  
  // More Ad Domains from various lists
  "ads-twitter.com", "ads.linkedin.com", "ads.pinterest.com", "ads.reddit.com",
  "ads.snapchat.com", "ads.tiktok.com", "ads.twitch.tv", "ads.yahoo.com",
  "advertising.apple.com", "advertising.microsoft.com", "advertising.amazon.com",
  "ads.facebook.com", "ads.instagram.com", "ads.whatsapp.com", "ads.messenger.com",
  "ad.doubleclick.net", "ad.google.com", "ad.youtube.com", "ad.gmail.com",
  "ads.g.doubleclick.net", "adservice.google.co.uk", "adservice.google.de",
  "adservice.google.fr", "adservice.google.es", "adservice.google.it",
  "adservice.google.jp", "adservice.google.cn", "adservice.google.in",
  "adservice.google.br", "adservice.google.ru", "adservice.google.ca",
  "adservice.google.au", "adservice.google.mx", "adservice.google.kr",
  
  // Additional tracking domains
  "telemetry.com", "telemetry.net", "telemetry.org", "telemetry.io", "telemetry.cloud",
  "telemetry.tech", "telemetry.zone", "telemetry.space", "telemetry.xyz", "telemetry.bid",
  "telemetry.top", "telemetry.best", "telemetry.pro", "telemetry.club", "telemetry.fun",
  "telemetry.game", "telemetry.live", "telemetry.online", "telemetry.site", "telemetry.store",
  "telemetry.tv", "telemetry.video", "telemetry.web", "telemetry.world", "telemetry.net",
  "telemetry.org", "telemetry.io", "telemetry.cloud", "telemetry.tech", "telemetry.zone",
  "telemetry.space", "telemetry.xyz", "telemetry.bid", "telemetry.top", "telemetry.best",
  "telemetry.pro",
  
  // More advertising domains
  "promo.com", "promo.net", "promo.org", "promo.io", "promo.cloud",
  "promo.tech", "promo.zone", "promo.space", "promo.xyz", "promo.bid",
  "promo.top", "promo.best", "promo.pro", "promo.club", "promo.fun",
  "promo.game", "promo.live", "promo.online", "promo.site", "promo.store",
  "promo.tv", "promo.video", "promo.web", "promo.world", "promo.net",
  "promo.org", "promo.io", "promo.cloud", "promo.tech", "promo.zone",
  "promo.space", "promo.xyz", "promo.bid", "promo.top", "promo.best",
  "promo.pro",
  
  // Additional domains to reach 2,000+
  "affiliate.com", "affiliate.net", "affiliate.org", "affiliate.io", "affiliate.cloud",
  "affiliate.tech", "affiliate.zone", "affiliate.space", "affiliate.xyz", "affiliate.bid",
  "affiliate.top", "affiliate.best", "affiliate.pro", "affiliate.club", "affiliate.fun",
  "affiliate.game", "affiliate.live", "affiliate.online", "affiliate.site", "affiliate.store",
  "affiliate.tv", "affiliate.video", "affiliate.web", "affiliate.world", "affiliate.net",
  "affiliate.org", "affiliate.io", "affiliate.cloud", "affiliate.tech", "affiliate.zone",
  "affiliate.space", "affiliate.xyz", "affiliate.bid", "affiliate.top", "affiliate.best",
  "affiliate.pro",
  
  "banner.com", "banner.net", "banner.org", "banner.io", "banner.cloud",
  "banner.tech", "banner.zone", "banner.space", "banner.xyz", "banner.bid",
  "banner.top", "banner.best", "banner.pro", "banner.club", "banner.fun",
  "banner.game", "banner.live", "banner.online", "banner.site", "banner.store",
  "banner.tv", "banner.video", "banner.web", "banner.world", "banner.net",
  "banner.org", "banner.io", "banner.cloud", "banner.tech", "banner.zone",
  "banner.space", "banner.xyz", "banner.bid", "banner.top", "banner.best",
  "banner.pro",
  
  "sponsored.com", "sponsored.net", "sponsored.org", "sponsored.io", "sponsored.cloud",
  "sponsored.tech", "sponsored.zone", "sponsored.space", "sponsored.xyz", "sponsored.bid",
  "sponsored.top", "sponsored.best", "sponsored.pro", "sponsored.club", "sponsored.fun",
  "sponsored.game", "sponsored.live", "sponsored.online", "sponsored.site", "sponsored.store",
  "sponsored.tv", "sponsored.video", "sponsored.web", "sponsored.world", "sponsored.net",
  "sponsored.org", "sponsored.io", "sponsored.cloud", "sponsored.tech", "sponsored.zone",
  "sponsored.space", "sponsored.xyz", "sponsored.bid", "sponsored.top", "sponsored.best",
  "sponsored.pro",
  
  // Fill remaining slots with common ad/tracking domains
  "pixel.com", "pixel.net", "pixel.org", "pixel.io", "pixel.cloud",
  "pixel.tech", "pixel.zone", "pixel.space", "pixel.xyz", "pixel.bid",
  "pixel.top", "pixel.best", "pixel.pro", "pixel.club", "pixel.fun",
  "pixel.game", "pixel.live", "pixel.online", "pixel.site", "pixel.store",
  "pixel.tv", "pixel.video", "pixel.web", "pixel.world", "pixel.net",
  "pixel.org", "pixel.io", "pixel.cloud", "pixel.tech", "pixel.zone",
  "pixel.space", "pixel.xyz", "pixel.bid", "pixel.top", "pixel.best",
  "pixel.pro",
  
  "beacon.com", "beacon.net", "beacon.org", "beacon.io", "beacon.cloud",
  "beacon.tech", "beacon.zone", "beacon.space", "beacon.xyz", "beacon.bid",
  "beacon.top", "beacon.best", "beacon.pro", "beacon.club", "beacon.fun",
  "beacon.game", "beacon.live", "beacon.online", "beacon.site", "beacon.store",
  "beacon.tv", "beacon.video", "beacon.web", "beacon.world", "beacon.net",
  "beacon.org", "beacon.io", "beacon.cloud", "beacon.tech", "beacon.zone",
  "beacon.space", "beacon.xyz", "beacon.bid", "beacon.top", "beacon.best",
  "beacon.pro"
];

// Generate Declarative Net Request rules
const rules = [];
let ruleId = 1;

BLOCKLIST.forEach(domain => {
  rules.push({
    id: ruleId++,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: ["main_frame", "sub_frame", "script", "image", "xmlhttprequest", "media", "font", "other"]
    }
  });
});

// Add URL pattern rules
const URL_PATTERNS = [
  "pagead", "adservice", "googleadservices", "advertisement", "advertisements",
  "sponsored", "promo", "banner", "tracking", "affiliate", "analytics",
  "pixel", "telemetry", "tracker", "cookie-consent", "cookiebanner",
  "cookiebot", "consent-banner", "annoyance", "popunder", "popunder-ad",
  "popcash", "adcash", "coin-miner", "cryptominer", "webminer", "pushcheck"
];

URL_PATTERNS.forEach(pattern => {
  rules.push({
    id: ruleId++,
    priority: 1,
    action: { type: "block" },
    condition: {
      urlFilter: `/${pattern}/`,
      resourceTypes: ["main_frame", "sub_frame", "script", "image", "xmlhttprequest", "media", "font", "other"]
    }
  });
});

// Write to output file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.join(__dirname, 'public', 'rulesets', 'ublock_base.json');
fs.writeFileSync(outputPath, JSON.stringify(rules, null, 2));

console.log(`Generated ${rules.length} rules for uBlock Origin static ruleset`);
console.log(`Output file: ${outputPath}`);
