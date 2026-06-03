import { getChromeBookmarks } from "../lib/chromeApi";
import { syncDeclarativeRules } from "../adblock/filterEngine";
import { loadHaloState, saveHaloState } from "../storage/chromeStorage";

chrome.runtime.onInstalled.addListener(async () => {
  const state = await loadHaloState();
  const importedBookmarks = await getChromeBookmarks();

  if (importedBookmarks.length && state.bookmarks.length === 0) {
    await saveHaloState({
      ...state,
      bookmarks: importedBookmarks
    });
  }

  await syncDeclarativeRules(state.settings.adBlocker);
});

chrome.runtime.onStartup.addListener(async () => {
  const state = await loadHaloState();
  await syncDeclarativeRules(state.settings.adBlocker);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "HALO_ADBLOCKER_SYNC_SETTINGS") {
    syncDeclarativeRules(message.settings)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return true;
  }

  if (message?.type === "HALO_ADBLOCKER_CONTENT_EVENT") {
    chrome.storage.local.get("haloAdBlockerEvents").then((result) => {
      const events = Array.isArray(result.haloAdBlockerEvents) ? result.haloAdBlockerEvents : [];
      events.push({ ...message.payload, url: sender.tab?.url, at: Date.now() });
      return chrome.storage.local.set({ haloAdBlockerEvents: events.slice(-500) });
    });
  }

  return false;
});
