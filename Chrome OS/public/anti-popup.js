// Popup, pop-under, redirect, and notification prompt defense.
(function () {
  const originalOpen = window.open.bind(window);
  const userGestureWindowMs = 850;
  let lastTrustedClick = 0;

  document.addEventListener("click", (event) => {
    if (event.isTrusted) lastTrustedClick = Date.now();
    const anchor = event.target?.closest?.("a[target='_blank']");
    if (anchor && /ad|sponsor|promo|download|redirect/i.test(anchor.href + anchor.textContent)) {
      event.preventDefault();
      chrome.runtime?.sendMessage?.({ type: "HALO_ADBLOCKER_CONTENT_EVENT", payload: { kind: "popup", reason: "suspicious-target-blank" } });
    }
  }, true);

  window.open = function patchedOpen(url, target, features) {
    const allowed = Date.now() - lastTrustedClick < userGestureWindowMs;
    const suspicious = /ad|click|promo|pop|redirect|affiliate|download/i.test(String(url));
    if (!allowed || suspicious) {
      chrome.runtime?.sendMessage?.({ type: "HALO_ADBLOCKER_CONTENT_EVENT", payload: { kind: "popup", reason: "window-open" } });
      return null;
    }
    return originalOpen(url, target, features);
  };

  const originalPermissionQuery = navigator.permissions?.query?.bind(navigator.permissions);
  if (originalPermissionQuery) {
    navigator.permissions.query = (descriptor) => descriptor?.name === "notifications"
      ? Promise.resolve({ state: "denied", onchange: null })
      : originalPermissionQuery(descriptor);
  }
})();
