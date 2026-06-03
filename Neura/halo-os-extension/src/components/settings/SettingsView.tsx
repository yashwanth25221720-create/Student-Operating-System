import { useHalo } from "../../state/HaloStateContext";
import type { WidgetKey } from "../../types/halo";

const widgetLabels: Record<WidgetKey, string> = {
  clock: "Clock",
  pinnedLinks: "Pinned Links",
  recentTabs: "Recent Tabs",
  recentNotes: "Recent Notes",
  todayTasks: "Today's Tasks",
  workspaceOverview: "Workspace Overview",
  aiAssistant: "AI Widget"
};

export function SettingsView() {
  const { state, dispatch } = useHalo();

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
          <p className="empty-copy">The data model supports gradients, uploads, videos, categories, and future WebGL live backgrounds. File pickers can plug into the same stored wallpaper object.</p>
        </article>
      </div>
    </section>
  );
}
