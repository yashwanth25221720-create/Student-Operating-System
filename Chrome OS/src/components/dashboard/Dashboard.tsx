import { Bot, Check, GripVertical, Layers, NotebookText, Star } from "lucide-react";
import { openUrl } from "../../lib/chromeApi";
import { useHalo } from "../../state/HaloStateContext";
import type { HaloNote, HaloTask, WidgetKey } from "../../types/halo";

const widgetTitles: Record<WidgetKey, string> = {
  pinnedLinks: "Pinned Links",
  recentTabs: "Recent Tabs",
  recentNotes: "Recent Notes",
  todayTasks: "Today's Tasks",
  workspaceOverview: "Workspace Overview",
  notepad: "Notepad",
  tasksBoard: "Tasks",
  bookmarksBoard: "Bookmarks",
  tabGroupsBoard: "Tab Groups",
  aiLauncher: "AI Launcher"
};

export function Dashboard() {
  const { state, recentTabs, dispatch } = useHalo();
  const workspace = state.workspaces.find((item) => item.id === state.currentWorkspaceId) ?? state.workspaces[0];
  const primaryNote = state.notes[0];
  const defaultProvider = state.providers.find((provider) => provider.id === state.settings.defaultAiProviderId) ?? state.providers[0];

  const updatePrimaryNote = (body: string) => {
    const note: HaloNote =
      primaryNote ??
      {
        id: crypto.randomUUID(),
        title: "Minimal Notepad",
        body: "",
        mode: "quick",
        updatedAt: new Date().toISOString(),
        workspaceId: state.currentWorkspaceId
      };
    dispatch({ type: "upsertNote", note: { ...note, body, updatedAt: new Date().toISOString() } });
  };

  const addTask = () => {
    const title = window.prompt("Task name");
    if (!title?.trim()) return;
    const task: HaloTask = {
      id: crypto.randomUUID(),
      title: title.trim(),
      completed: false,
      priority: "medium",
      category: "Minimal",
      workspaceId: state.currentWorkspaceId
    };
    dispatch({ type: "upsertTask", task });
  };

  const launchAi = () => {
    const query = window.prompt(`Ask ${defaultProvider.name}`);
    if (!query?.trim()) return;
    void openUrl(defaultProvider.urlTemplate.replace("{query}", encodeURIComponent(query.trim())));
  };

  return (
    <div className={`dashboard ${state.settings.minimalMode ? "minimal-dashboard" : ""}`}>
      {state.settings.widgetOrder.map((widget) =>
        state.settings.visibleWidgets[widget] ? (
          <article
            className="widget-card"
            key={widget}
            draggable
            onDragStart={(event) => event.dataTransfer.setData("widget", widget)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => dispatch({ type: "reorderWidget", from: event.dataTransfer.getData("widget") as WidgetKey, to: widget })}
          >
            <header>
              <h2>{widgetTitles[widget]}</h2>
              <GripVertical size={17} />
            </header>
            {widget === "notepad" && (
              <div className="minimal-notepad">
                <div className="widget-icon-row"><NotebookText size={17} /> <span>{primaryNote?.title ?? "Quick Note"}</span></div>
                <textarea value={primaryNote?.body ?? ""} onChange={(event) => updatePrimaryNote(event.target.value)} placeholder="Transparent notepad. Type anything." />
              </div>
            )}
            {widget === "tasksBoard" && (
              <div className="task-mini-list">
                <button className="widget-command" onClick={addTask}><Check size={16} /> Add Task</button>
                {state.tasks.slice(0, 7).map((task) => (
                  <label key={task.id}>
                    <input type="checkbox" checked={task.completed} onChange={() => dispatch({ type: "toggleTask", taskId: task.id })} />
                    <span>{task.title}</span>
                    <small>{task.priority}</small>
                  </label>
                ))}
              </div>
            )}
            {widget === "bookmarksBoard" && (
              <div className="card-list">
                {state.bookmarks.slice(0, 8).map((bookmark) => (
                  <button key={bookmark.id} onClick={() => void openUrl(bookmark.url)}>
                    <Star size={15} fill={bookmark.favorite ? "currentColor" : "none"} /> {bookmark.title}
                  </button>
                ))}
                {state.bookmarks.length === 0 && <p className="empty-copy">Import bookmarks to fill this widget.</p>}
              </div>
            )}
            {widget === "tabGroupsBoard" && (
              <div className="card-list">
                {state.tabGroups.slice(0, 5).map((group) => (
                  <button key={group.id} onClick={() => dispatch({ type: "setActiveModule", module: "tabGroups" })}>
                    <Layers size={15} /> {group.name}
                    <span>{group.tabs.length} tabs</span>
                  </button>
                ))}
                {state.tabGroups.length === 0 && <p className="empty-copy">Saved and imported tab groups appear here.</p>}
              </div>
            )}
            {widget === "aiLauncher" && (
              <div className="card-list">
                <button onClick={launchAi}>
                  <Bot size={16} /> Ask {defaultProvider.name}
                  <span>Uses your selected default AI provider.</span>
                </button>
              </div>
            )}
            {widget === "pinnedLinks" && (
              <div className="card-list">
                {state.bookmarks.filter((bookmark) => bookmark.favorite).slice(0, 6).map((bookmark) => (
                  <button key={bookmark.id} onClick={() => void openUrl(bookmark.url)}>
                    <Star size={15} /> {bookmark.title}
                  </button>
                ))}
                {!state.bookmarks.some((bookmark) => bookmark.favorite) && <p className="empty-copy">Favorite bookmarks appear here.</p>}
              </div>
            )}
            {widget === "recentTabs" && (
              <div className="card-list">
                {recentTabs.map((tab) => (
                  <button key={tab.url} onClick={() => void openUrl(tab.url)}>{tab.title}</button>
                ))}
                {recentTabs.length === 0 && <p className="empty-copy">Open Chrome tabs are shown in extension mode.</p>}
              </div>
            )}
            {widget === "recentNotes" && (
              <div className="card-list">
                {state.notes.slice(0, 4).map((note) => (
                  <button key={note.id} onClick={() => dispatch({ type: "setActiveModule", module: "notes" })}>
                    <strong>{note.title}</strong>
                    <span>{note.body.slice(0, 80)}</span>
                  </button>
                ))}
              </div>
            )}
            {widget === "todayTasks" && (
              <div className="task-mini-list">
                {state.tasks.slice(0, 5).map((task) => (
                  <label key={task.id}>
                    <input type="checkbox" checked={task.completed} onChange={() => dispatch({ type: "toggleTask", taskId: task.id })} />
                    <span>{task.title}</span>
                    <small>{task.priority}</small>
                  </label>
                ))}
              </div>
            )}
            {widget === "workspaceOverview" && (
              <div className="overview-grid">
                <span><strong>{workspace.name}</strong>Active</span>
                <span><strong>{state.bookmarks.length}</strong>Bookmarks</span>
                <span><strong>{state.notes.length}</strong>Notes</span>
                <span><strong>{state.tasks.filter((task) => !task.completed).length}</strong>Open tasks</span>
              </div>
            )}
          </article>
        ) : null
      )}
    </div>
  );
}
