import { useHalo } from "../../state/HaloStateContext";
import type { Wallpaper, WidgetKey } from "../../types/halo";

const widgetLabels: Record<WidgetKey, string> = {
  pinnedLinks: "Pinned Links",
  recentTabs: "Recent Tabs",
  recentNotes: "Recent Notes",
  todayTasks: "Today's Tasks",
  workspaceOverview: "Workspace Overview",
  notepad: "Notepad",
  tasksBoard: "Tasks Board",
  bookmarksBoard: "Bookmarks Board",
  tabGroupsBoard: "Tab Groups Board",
  aiLauncher: "AI Launcher"
};

export function SettingsView() {
  const { state, dispatch } = useHalo();

  const setUploadedWallpaper = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      const wallpaper: Wallpaper =
        file.type === "text/html" || file.name.toLowerCase().endsWith(".html")
          ? { type: "html", value: value.replace(/^data:text\/html[^,]*,/, "") }
          : file.type.startsWith("video/")
            ? { type: "video", value }
            : { type: "image", value };
      dispatch({ type: "setWallpaper", wallpaper });
    };

    if (file.type === "text/html" || file.name.toLowerCase().endsWith(".html")) {
      reader.readAsText(file);
      return;
    }

    reader.readAsDataURL(file);
  };

  const setUrlWallpaper = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    const wallpaper: Wallpaper = lower.endsWith(".mp4") || lower.endsWith(".webm") || lower.endsWith(".mov")
      ? { type: "video", value: trimmed }
      : lower.endsWith(".html") || lower.startsWith("data:text/html")
        ? { type: "html", value: lower.startsWith("data:text/html") ? decodeURIComponent(trimmed.split(",").slice(1).join(",")) : `<iframe src="${trimmed}" style="border:0;width:100vw;height:100vh"></iframe>` }
        : { type: "image", value: trimmed };
    dispatch({ type: "setWallpaper", wallpaper });
  };

  return (
    <section className="module-panel settings-panel">
      <div className="module-header">
        <div>
          <h1>Settings</h1>
          <p>Theme, accent color, default AI, widgets, search behavior, and wallpaper architecture.</p>
        </div>
      </div>
      <div className="settings-grid">
        <article>
          <h2>Theme</h2>
          <label className="setting-row">
            <span>Minimal Mode</span>
            <input type="checkbox" checked={state.settings.minimalMode} onChange={() => dispatch({ type: "toggleMinimalMode" })} />
          </label>
          <div className="setting-row">
            <span>Accent</span>
            <input type="color" value={state.settings.accentColor} onChange={(event) => dispatch({ type: "setAccent", accentColor: event.target.value })} />
          </div>
          <div className="setting-row">
            <span>Search opens</span>
            <select
              value={state.settings.searchBehavior}
              onChange={(event) => dispatch({ type: "setSearchBehavior", behavior: event.target.value as typeof state.settings.searchBehavior })}
            >
              <option value="new-tab">New tab</option>
              <option value="current-tab">Current tab</option>
            </select>
          </div>
        </article>
        <article>
          <h2>Default AI</h2>
          <select value={state.settings.defaultAiProviderId} onChange={(event) => dispatch({ type: "setDefaultProvider", providerId: event.target.value })}>
            {state.providers.map((provider) => <option value={provider.id} key={provider.id}>{provider.name}</option>)}
          </select>
        </article>
        <article>
          <h2>Ad Blocker</h2>
          <label className="setting-row">
            <span>Enabled</span>
            <input type="checkbox" checked={state.settings.adBlocker.enabled} onChange={(event) => dispatch({ type: "updateAdBlockerSettings", patch: { enabled: event.target.checked } })} />
          </label>
          <label className="setting-row">
            <span>YouTube cleanup</span>
            <input type="checkbox" checked={state.settings.adBlocker.blockYouTubeAds} onChange={(event) => dispatch({ type: "updateAdBlockerSettings", patch: { blockYouTubeAds: event.target.checked } })} />
          </label>
          <label className="setting-row">
            <span>Tracker blocking</span>
            <input type="checkbox" checked={state.settings.adBlocker.blockTrackers} onChange={(event) => dispatch({ type: "updateAdBlockerSettings", patch: { blockTrackers: event.target.checked } })} />
          </label>
          <button onClick={() => dispatch({ type: "setActiveModule", module: "adBlocker" })}>Open Ad Blocker Dashboard</button>
        </article>
        <article>
          <h2>Widgets</h2>
          {state.settings.widgetOrder.map((widget) => (
            <label className="setting-row" key={widget}>
              <span>{widgetLabels[widget]}</span>
              <input type="checkbox" checked={state.settings.visibleWidgets[widget]} onChange={() => dispatch({ type: "toggleWidget", widget })} />
            </label>
          ))}
        </article>
        <article>
          <h2>Wallpaper</h2>
          <div className="wallpaper-controls">
            <label>
              Upload image, video, or HTML
              <input type="file" accept="image/*,video/*,.html,text/html" onChange={(event) => setUploadedWallpaper(event.target.files?.[0])} />
            </label>
            <label>
              Image, video, or live HTML URL
              <input
                placeholder="https://example.com/wallpaper.mp4"
                onKeyDown={(event) => {
                  if (event.key === "Enter") setUrlWallpaper(event.currentTarget.value);
                }}
              />
            </label>
            <button
              onClick={() =>
                dispatch({
                  type: "setWallpaper",
                  wallpaper: {
                    type: "gradient",
                    value: "radial-gradient(circle at 20% 20%, rgba(139,92,246,.28), transparent 28%), linear-gradient(135deg, #080b12 0%, #111827 48%, #0b1324 100%)"
                  }
                })
              }
            >
              Restore Default
            </button>
            <p className="empty-copy">HTML wallpapers run behind the interface in a sandboxed live layer. Large local videos may exceed Chrome local storage limits, so hosted URLs are best for long clips.</p>
          </div>
        </article>
        {/* White Noise Player removed */}
      </div>
    </section>
  );
}
