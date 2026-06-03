// Removes aggressive overlays, fake download buttons, scam modals, and click-jacking layers.
(function () {
  const OVERLAY_WORDS = ["advertisement", "sponsored", "promotion", "download now", "claim prize", "virus", "your computer", "allow notifications"];

  function removeBadOverlays() {
    document.querySelectorAll("div, section, aside, dialog").forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      const text = node.innerText?.slice(0, 500).toLowerCase() || "";
      const highLayer = ["fixed", "absolute", "sticky"].includes(style.position) && Number(style.zIndex || 0) >= 100;
      const coversPage = rect.width > innerWidth * 0.55 && rect.height > innerHeight * 0.25;
      const suspicious = OVERLAY_WORDS.some((word) => text.includes(word)) || /ad|promo|sponsor/i.test(node.id + " " + node.className);
      if (highLayer && coversPage && suspicious) {
        node.remove();
        chrome.runtime?.sendMessage?.({ type: "HALO_ADBLOCKER_CONTENT_EVENT", payload: { kind: "overlay", reason: "high-z-index" } });
      }
    });
  }

  window.HaloAntiOverlay = { removeBadOverlays };
})();
