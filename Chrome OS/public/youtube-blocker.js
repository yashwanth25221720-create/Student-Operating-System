// YouTube-specific fallback systems: cosmetic removal, skip, mute, and fast-forward.
(function () {
  const YT_SELECTORS = [
    ".ytp-ad-module",
    ".ytp-ad-overlay-container",
    ".ytp-ad-player-overlay",
    "ytd-ad-slot-renderer",
    "ytd-promoted-sparkles-web-renderer",
    "ytd-display-ad-renderer",
    "ytd-compact-promoted-video-renderer",
    "ytd-in-feed-ad-layout-renderer",
    "ytd-rich-item-renderer:has(ytd-ad-slot-renderer)",
    "tp-yt-paper-dialog:has([class*='ad'])"
  ];

  function isYouTube() {
    return location.hostname.includes("youtube.com") || location.hostname.includes("youtu.be");
  }

  function cleanupYouTube() {
    if (!isYouTube()) return;
    for (const selector of YT_SELECTORS) {
      try {
        document.querySelectorAll(selector).forEach((node) => node.remove());
      } catch {
        // Some browsers do not support :has in querySelectorAll everywhere.
      }
    }

    const skipButton = document.querySelector(".ytp-ad-skip-button, .ytp-ad-skip-button-modern");
    if (skipButton instanceof HTMLElement) skipButton.click();

    const player = document.querySelector(".html5-video-player");
    const video = document.querySelector("video");
    const adShowing = player?.classList.contains("ad-showing");
    if (adShowing && video) {
      video.muted = true;
      if (Number.isFinite(video.duration) && video.duration > 0) video.currentTime = Math.max(video.currentTime, video.duration - 0.25);
      video.playbackRate = 16;
    } else if (video && video.playbackRate > 2) {
      video.playbackRate = 1;
    }
  }

  window.HaloYouTubeBlocker = { cleanupYouTube };
})();
