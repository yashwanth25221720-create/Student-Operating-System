import { getChromeBookmarks } from "../lib/chromeApi";
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
});
