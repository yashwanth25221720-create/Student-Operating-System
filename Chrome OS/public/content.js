// Halo Ad Blocker content orchestrator. Keeps work batched and low-cost.
(function () {
  let enabled = true;
  let scheduled = false;

  chrome.storage?.local.get("haloOSState").then((result) => {
    const settings = result.haloOSState?.settings?.adBlocker;
    enabled = settings?.enabled !== false;
    window.__HALO_ADBLOCKER_COOKIE_BANNERS__ = Boolean(settings?.blockCookieBanners);
  });

  function run() {
    if (!enabled) return;
    scheduled = false;
    window.HaloFilterEngine?.runCosmeticPass(document);
    window.HaloYouTubeBlocker?.cleanupYouTube();
    window.HaloTrackerBlocker?.removeTrackerNodes();
    window.HaloAntiOverlay?.removeBadOverlays();
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(run);
  }

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", schedule, { once: true });
  schedule();
})();
