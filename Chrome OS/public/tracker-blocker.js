// Tracker cleanup that complements network-level declarativeNetRequest rules.
(function () {
  const TRACKER_SCRIPT_PATTERNS = [
    "google-analytics", "googletagmanager", "facebook.net", "hotjar", "mixpanel",
    "segment", "tiktok", "snap.licdn", "bat.bing", "clarity.ms"
  ];

  function removeTrackerNodes() {
    document.querySelectorAll("script[src], img[src], iframe[src]").forEach((node) => {
      const src = node.getAttribute("src") || "";
      if (TRACKER_SCRIPT_PATTERNS.some((pattern) => src.includes(pattern))) node.remove();
    });
  }

  window.HaloTrackerBlocker = { removeTrackerNodes };
})();
