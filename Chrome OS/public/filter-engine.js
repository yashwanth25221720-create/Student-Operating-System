// Halo Ad Blocker cosmetic and heuristic filter engine.
// Runs in the page as a content script helper. MV3 network blocking lives in the service worker.
(function () {
  const AD_KEYWORDS = [
    "ad", "ads", "advert", "advertisement", "sponsor", "sponsored", "promo", "promotion",
    "taboola", "outbrain", "doubleclick", "download now", "claim prize", "winner"
  ];

  const SELECTORS = [
    "[id*='ad-']", "[id^='ad_']", "[class*=' ad-']", "[class*='ads']", "[class*='sponsored']",
    "[aria-label*='Sponsored' i]", "iframe[src*='doubleclick']", "iframe[src*='googlesyndication']",
    ".ad-slot", ".ad-banner", ".sponsor", ".sponsored", ".promoted", ".native-ad"
  ];

  function scoreElement(element) {
    if (!(element instanceof HTMLElement)) return 0;
    const text = `${element.id} ${element.className} ${element.getAttribute("aria-label") || ""} ${element.textContent || ""}`.toLowerCase();
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    let score = 0;

    for (const keyword of AD_KEYWORDS) if (text.includes(keyword)) score += 18;
    if ((style.position === "fixed" || style.position === "sticky") && Number(style.zIndex || 0) > 50) score += 24;
    if (rect.width >= 250 && rect.height >= 50 && rect.height <= 360) score += 10;
    if (rect.width > innerWidth * 0.75 && rect.height > innerHeight * 0.5) score += 35;
    if (text.includes("cookie") && text.includes("accept")) score += window.__HALO_ADBLOCKER_COOKIE_BANNERS__ ? 30 : 0;

    return score;
  }

  function removeElement(element, reason) {
    if (!element || element.dataset.haloRemoved) return;
    element.dataset.haloRemoved = "true";
    element.remove();
    chrome.runtime?.sendMessage?.({ type: "HALO_ADBLOCKER_CONTENT_EVENT", payload: { reason, kind: "cosmetic" } });
  }

  function runCosmeticPass(root = document) {
    for (const selector of SELECTORS) {
      root.querySelectorAll?.(selector).forEach((element) => removeElement(element, "selector"));
    }

    root.querySelectorAll?.("div, aside, section, iframe, ins, amp-ad").forEach((element) => {
      if (scoreElement(element) >= 45) removeElement(element, "heuristic");
    });
  }

  window.HaloFilterEngine = { runCosmeticPass, scoreElement, removeElement };
})();
