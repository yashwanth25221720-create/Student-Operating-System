import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bot,
  Bookmark,
  CalendarDays,
  CheckSquare,
  Clock3,
  Eye,
  EyeOff,
  Home,
  Layers,
  NotebookText,
  Pin,
  PinOff,
  Plus,
  Search,
  Settings,
  Shield,
  Sparkles,
  Upload
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { openUrl } from "../../lib/chromeApi";
import { useHalo } from "../../state/HaloStateContext";
import type { HaloNote, HaloTask, MinimalWidgetInstance, MinimalWidgetPreset, ModuleKey } from "../../types/halo";
import { AdBlockerView } from "../adblocker/AdBlockerView";
import { AIDock } from "../ai/AIDock";
import { BookmarksView } from "../bookmarks/BookmarksView";
import { NotesView } from "../notes/NotesView";
import { SettingsView } from "../settings/SettingsView";
import { TasksView } from "../tasks/TasksView";
import { TabGroupsView } from "../workspaces/TabGroupsView";
import { WorkspacesView } from "../workspaces/WorkspacesView";
import { WallpaperLayer, wallpaperBackground, type WallpaperStyle } from "./WallpaperLayer";
import { WidgetFrame } from "./WidgetFrame";
import { createWidgetInstance, widgetDefinitions } from "./widgetRegistry";

type PanelKey = Exclude<ModuleKey, "home"> | null;

const panelTitles: Record<Exclude<ModuleKey, "home">, string> = {
  bookmarks: "Bookmarks",
  notes: "Notes",
  tasks: "Tasks",
  tabGroups: "Tab Groups",
  games: "Games",
  aiHub: "AI",
  adBlocker: "Ad Blocker",
  workspaces: "Workspaces",
  settings: "Settings"
};

function nextPosition(position: "top" | "right" | "bottom" | "left") {
  const order: Array<"top" | "right" | "bottom" | "left"> = ["top", "right", "bottom", "left"];
  const nextIndex = (order.indexOf(position) + 1) % order.length;
  return order[nextIndex];
}

export function MinimalDesktop() {
  const { state, dispatch } = useHalo();
  const [panel, setPanel] = useState<PanelKey>(null);
  const [focused, setFocused] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [lowFxMode, setLowFxMode] = useState(false);
  const [dockHovered, setDockHovered] = useState(false);
  const importRef = useRef<HTMLInputElement | null>(null);
  const primaryNote = state.notes[0];
  const provider = state.providers.find((item) => item.id === state.settings.defaultAiProviderId) ?? state.providers[0];
  const workspace = state.workspaces.find((item) => item.id === state.currentWorkspaceId) ?? state.workspaces[0];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Space" && !isTypingTarget(event.target)) {
        event.preventDefault();
        setFocused((value) => !value);
      }
      if (event.key === "Escape") {
        setFocused(false);
        setPanel(null);
        setGalleryOpen(false);
        setManagerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shellStyle = useMemo<WallpaperStyle>(
    () => ({ "--accent": state.settings.accentColor, background: wallpaperBackground(state.settings.wallpaper) }),
    [state.settings.accentColor, state.settings.wallpaper]
  );
  const wallpaperTone = useMemo(() => getWallpaperTone(state.settings.wallpaper.value), [state.settings.wallpaper.value]);
  const dockPosition = state.settings.minimalDock.position;
  const dockPinned = state.settings.minimalDock.pinned;
  const dockCollapsed = !dockPinned && !dockHovered;

  const exportPreset = () => {
    const preset: MinimalWidgetPreset = {
      id: crypto.randomUUID(),
      name: "Shared Halo Layout",
      widgets: state.settings.minimalWidgets,
      groups: state.settings.widgetGroups,
      createdAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "halo-widget-layout.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const importPreset = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const preset = JSON.parse(String(reader.result)) as MinimalWidgetPreset;
        if (!Array.isArray(preset.widgets)) throw new Error("Invalid widget layout");
        dispatch({ type: "importWidgetPreset", preset: { ...preset, id: crypto.randomUUID(), createdAt: new Date().toISOString() } });
      } catch {
        window.alert("That file is not a valid Halo widget layout.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <main
      className={`minimal-desktop ${focused ? "is-focused" : ""} ${lowFxMode ? "is-low-fx" : ""}`}
      data-wallpaper-tone={wallpaperTone}
      style={shellStyle}
      onDoubleClick={() => setFocused((value) => !value)}
    >
      <WallpaperLayer wallpaper={state.settings.wallpaper} />
      {!lowFxMode && <div className="ambient-particles" aria-hidden="true" />}

      {!focused && (
        <>
          <div className="widget-canvas">
            {state.settings.minimalWidgets
              .filter((widget) => widget.visibility !== "workspace" || !widget.workspaceId || widget.workspaceId === state.currentWorkspaceId)
              .map((widget) => (
                <WidgetFrame widget={widget} key={widget.id}>
                  <MinimalWidgetContent
                    widget={widget}
                    providerName={provider.name}
                    providerUrlTemplate={provider.urlTemplate}
                    updatePrimaryNote={(body) => {
                      const note: HaloNote =
                        primaryNote ??
                        {
                          id: crypto.randomUUID(),
                          title: "Minimal Note",
                          body: "",
                          mode: "quick",
                          updatedAt: new Date().toISOString(),
                          workspaceId: state.currentWorkspaceId
                        };
                      dispatch({ type: "upsertNote", note: { ...note, body, updatedAt: new Date().toISOString() } });
                    }}
                    addTask={() => {
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
                    }}
                    openPanel={setPanel}
                  />
                </WidgetFrame>
              ))}
          </div>

          <button className="add-widget-button" onClick={() => setGalleryOpen(true)}>
            <Plus size={18} /> Add Widget
          </button>
          <button className="widget-manager-button" onClick={() => setManagerOpen(true)}>
            <Sparkles size={18} /> Widgets
          </button>
          <button className="widget-performance-button" onClick={() => setLowFxMode((value) => !value)}>
            {lowFxMode ? "High FX" : "Low FX"}
          </button>
          <Dock
            activePanel={panel}
            position={dockPosition}
            pinned={dockPinned}
            collapsed={dockCollapsed}
            onOpen={setPanel}
            onFullMode={() => dispatch({ type: "toggleMinimalMode" })}
            onFocus={() => setFocused(true)}
            onSetPosition={(position) => dispatch({ type: "setMinimalDockPosition", position })}
            onTogglePin={() => dispatch({ type: "toggleMinimalDockPinned" })}
            onHoverChange={setDockHovered}
          />
        </>
      )}

      {focused && (
        <button className="focus-exit" onClick={() => setFocused(false)}>
          <Eye size={17} /> Show widgets
        </button>
      )}

      {galleryOpen && <WidgetGallery onClose={() => setGalleryOpen(false)} />}
      {managerOpen && (
        <WidgetManager
          onClose={() => setManagerOpen(false)}
          onExport={exportPreset}
          onImport={() => importRef.current?.click()}
        />
      )}
      <input ref={importRef} className="hidden-file-input" type="file" accept="application/json,.json" onChange={(event) => importPreset(event.target.files?.[0])} />
      {panel && <FloatingPanel panel={panel} onClose={() => setPanel(null)} />}
    </main>
  );
}

function MinimalWidgetContent({
  widget,
  providerName,
  providerUrlTemplate,
  updatePrimaryNote,
  addTask,
  openPanel
}: {
  widget: MinimalWidgetInstance;
  providerName: string;
  providerUrlTemplate: string;
  updatePrimaryNote: (body: string) => void;
  addTask: () => void;
  openPanel: (panel: PanelKey) => void;
}) {
  const { state, dispatch } = useHalo();
  const primaryNote = state.notes[0];
  const now = useNow(widgetNeedsClock(widget.type) ? 1000 : 60000);
  const [aiQuery, setAiQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  if (widget.type === "clock") {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const workspace = state.workspaces.find((item) => item.id === state.currentWorkspaceId) ?? state.workspaces[0];
    return (
      <div className="clock-widget widget-content-center">
        <Clock3 size={18} />
        <strong>{now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong>
        <span>{now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</span>
        <small>{timezone}</small>
        <div className="clock-dashboard">
          <span><b>{workspace.name}</b>Workspace</span>
          <span><b>{state.tasks.filter((task) => !task.completed).length}</b>Open tasks</span>
          <span><b>{state.notes.length}</b>Notes</span>
        </div>
      </div>
    );
  }

  if (widget.type === "system") {
    const workspace = state.workspaces.find((item) => item.id === state.currentWorkspaceId) ?? state.workspaces[0];
    return (
      <div className="system-widget widget-content-center">
        <Sparkles size={18} />
        <strong>{workspace.name}</strong>
        <span>{state.settings.minimalWidgets.length} widgets online</span>
      </div>
    );
  }

  if (widget.type === "notes") {
    return <textarea className="widget-note-input" value={primaryNote?.body ?? ""} onChange={(event) => updatePrimaryNote(event.target.value)} placeholder="Write over your wallpaper." />;
  }

  if (widget.type === "tasks") {
    return (
      <div className="task-widget">
        {state.tasks.slice(0, 6).map((task) => (
          <label key={task.id}>
            <input type="checkbox" checked={task.completed} onChange={() => dispatch({ type: "toggleTask", taskId: task.id })} />
            <span>{task.title}</span>
          </label>
        ))}
        <button onClick={addTask}>Add task</button>
      </div>
    );
  }

  if (widget.type === "bookmarks" || widget.type === "quickLinks") {
    return (
      <div className="compact-list">
        {state.bookmarks.slice(0, 7).map((bookmark) => (
          <button key={bookmark.id} onClick={() => void openUrl(bookmark.url)}>{bookmark.title}</button>
        ))}
        <button onClick={() => openPanel("bookmarks")}>Open bookmarks</button>
      </div>
    );
  }

  if (widget.type === "aiSearch") {
    return (
      <div className="ai-mini-widget">
        <header><Bot size={17} /> {providerName}</header>
        <div>
          <Search size={16} />
          <input
            value={aiQuery}
            onChange={(event) => setAiQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && launchAi(providerUrlTemplate, aiQuery, setAiQuery)}
            placeholder="Ask anything"
          />
          <button onClick={() => launchAi(providerUrlTemplate, aiQuery, setAiQuery)}>Go</button>
        </div>
        <div className="mini-provider-strip">
          {state.providers.map((item) => (
            <button key={item.id} className={item.id === state.settings.defaultAiProviderId ? "active" : ""} onClick={() => dispatch({ type: "setDefaultProvider", providerId: item.id })}>
              {item.name.slice(0, 2)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (widget.type === "chromeSearch") {
    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = searchQuery.trim();
      if (!trimmed) return;
      await openUrl(`https://www.google.com/search?q=${encodeURIComponent(trimmed)}`, true);
      setSearchQuery("");
    };

    return (
      <div className="chrome-search-widget">
        <form className="chrome-search-widget-form" onSubmit={handleSubmit}>
          <Search size={18} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search Google or type a URL"
            aria-label="Chrome search"
          />
          <button type="submit">Search</button>
        </form>
        <div className="chrome-search-shortcuts">
          {state.settings.chromeShortcuts.length ? (
            state.settings.chromeShortcuts.map((shortcut, index) => (
              <button key={index} onClick={() => void openUrl(shortcut.url, true)}>
                {shortcut.title}
              </button>
            ))
          ) : (
            <p className="empty-copy">Add shortcuts in Settings to show them here.</p>
          )}
        </div>
      </div>
    );
  }

  if (widget.type === "shortcuts") {
    return <ShortcutsWidget shortcuts={state.settings.chromeShortcuts} />;
  }

  if (widget.type === "workspaceSwitcher") {
    return (
      <div className="compact-list">
        {state.workspaces.map((workspace) => (
          <button key={workspace.id} onClick={() => dispatch({ type: "switchWorkspace", workspaceId: workspace.id })}>{workspace.name}</button>
        ))}
      </div>
    );
  }

  if (widget.type === "calendar") {
    return (
      <div className="compact-list">
        <span>{now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</span>
        <span>{state.tasks.filter((task) => !task.completed).length} open tasks</span>
        <span>{state.notes.length} notes</span>
        <span>{state.tabGroups.length} tab groups</span>
      </div>
    );
  }

  if (widget.type === "quote") return <blockquote className="quote-widget">Design your desktop like it is a place you want to return to.</blockquote>;
  if (widget.type === "music") return <div className="compact-list"><span>Music widget ready for future media integration.</span><button>Connect player</button></div>;
  if (widget.type === "systemMonitor") return <div className="compact-list"><span>Bookmarks: {state.bookmarks.length}</span><span>Tasks: {state.tasks.length}</span><span>Notes: {state.notes.length}</span></div>;
  if (widget.type === "countdown") return <CountdownWidget now={now} />;
  if (widget.type === "wallpaperControls") return <div className="compact-list"><button onClick={() => openPanel("settings")}>Open wallpaper settings</button><span>Profiles and live controls plug in here.</span></div>;
  if (widget.type === "customHtml") return <iframe className="widget-embed" title={widget.title} srcDoc={String(widget.settings.html ?? "<div style='color:white;font:16px system-ui;padding:16px'>Custom HTML Widget</div>")} sandbox="allow-scripts" />;
  if (widget.type === "customUrl") return <iframe className="widget-embed" title={widget.title} src={String(widget.settings.url ?? "about:blank")} sandbox="allow-scripts allow-same-origin" />;
  if (widget.type === "image") return <div className="media-placeholder">Image widget</div>;
  if (widget.type === "video") return <div className="media-placeholder">Video widget</div>;

  return null;
}

const CountdownWidget = memo(function CountdownWidget({ now }: { now: Date }) {
  const minutes = 25;
  const secondsElapsed = now.getSeconds() + now.getMinutes() * 60;
  const cycle = minutes * 60;
  const remaining = cycle - (secondsElapsed % cycle);
  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  return (
    <div className="clock-widget widget-content-center">
      <strong>{mm}:{ss}</strong>
      <span>Focus cycle timer</span>
    </div>
  );
});

function WidgetGallery({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useHalo();
  const [query, setQuery] = useState("");
  const filteredWidgets = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return widgetDefinitions;
    return widgetDefinitions.filter(
      (definition) =>
        definition.title.toLowerCase().includes(trimmed) ||
        definition.description.toLowerCase().includes(trimmed) ||
        definition.type.toLowerCase().includes(trimmed)
    );
  }, [query]);

  return (
    <section className="widget-overlay">
      <div className="widget-gallery">
        <header>
          <div>
            <strong>Add Widget</strong>
            <span>Registry driven and plugin-ready.</span>
          </div>
          <button onClick={onClose}>Close</button>
        </header>
        <input
          className="widget-gallery-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search widgets"
          aria-label="Search widgets"
        />
        <div className="widget-gallery-grid">
          {filteredWidgets.map((definition, index) => {
            const Icon = definition.icon;
            return (
              <button
                key={definition.type}
                onClick={() => {
                  dispatch({ type: "addMinimalWidget", widget: createWidgetInstance(definition.type, state.settings.minimalWidgets.length + index) });
                  onClose();
                }}
              >
                <Icon size={20} />
                <strong>{definition.title}</strong>
                <span>{definition.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function widgetNeedsClock(type: MinimalWidgetInstance["type"]) {
  return type === "clock" || type === "calendar" || type === "countdown";
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs]);
  return now;
}

function launchAi(providerUrlTemplate: string, query: string, setQuery: (value: string) => void) {
  const trimmed = query.trim();
  if (!trimmed) return;
  void openUrl(providerUrlTemplate.replace("{query}", encodeURIComponent(trimmed)));
  setQuery("");
}

function WidgetManager({ onClose, onExport, onImport }: { onClose: () => void; onExport: () => void; onImport: () => void }) {
  const { state, dispatch } = useHalo();

  return (
    <section className="widget-overlay">
      <div className="widget-manager">
        <header>
          <div>
            <strong>Widget Manager</strong>
            <span>Hide, restore, preset, import, and export layouts.</span>
          </div>
          <button onClick={onClose}>Close</button>
        </header>
        <div className="widget-manager-actions">
          <button onClick={() => {
            const name = window.prompt("Preset name", "Custom Layout");
            if (name) dispatch({ type: "saveWidgetPreset", name });
          }}>Save Preset</button>
          <button onClick={() => {
            const name = window.prompt("Group name", "Productivity Group");
            const widgetIds = state.settings.minimalWidgets.filter((widget) => !widget.hidden).map((widget) => widget.id);
            if (name && widgetIds.length) dispatch({ type: "createWidgetGroup", name, widgetIds });
          }}>Group Visible</button>
          <button onClick={onExport}>Export Layout</button>
          <button onClick={onImport}><Upload size={16} /> Import Layout</button>
        </div>
        <div className="widget-manager-list">
          {state.settings.widgetGroups.map((group) => (
            <article key={group.id}>
              <div>
                <strong>{group.name}</strong>
                <span>{group.widgetIds.length} widgets · {group.collapsed ? "collapsed" : "expanded"}</span>
              </div>
              <button onClick={() => dispatch({ type: "toggleWidgetGroup", groupId: group.id })}>{group.collapsed ? "Expand" : "Collapse"}</button>
            </article>
          ))}
        </div>
        <div className="widget-manager-list">
          {state.settings.minimalWidgets.map((widget) => (
            <article key={widget.id}>
              <div>
                <strong>{widget.title}</strong>
                <span>{widget.type} · {widget.hidden ? "hidden" : "visible"} · z{widget.frame.zIndex}</span>
              </div>
              <button onClick={() => dispatch({ type: "updateMinimalWidget", widgetId: widget.id, patch: { hidden: !widget.hidden } })}>{widget.hidden ? "Show" : "Hide"}</button>
              <button onClick={() => dispatch({ type: "duplicateMinimalWidget", widgetId: widget.id })}>Duplicate</button>
            </article>
          ))}
        </div>
        <div className="widget-manager-list">
          {state.settings.widgetPresets.map((preset) => (
            <article key={preset.id}>
              <div>
                <strong>{preset.name}</strong>
                <span>{preset.widgets.length} widgets</span>
              </div>
              <button onClick={() => dispatch({ type: "applyWidgetPreset", presetId: preset.id })}>Apply</button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Dock({
  activePanel,
  position,
  pinned,
  collapsed,
  onOpen,
  onFullMode,
  onFocus,
  onSetPosition,
  onTogglePin,
  onHoverChange
}: {
  activePanel: PanelKey;
  position: "top" | "right" | "bottom" | "left";
  pinned: boolean;
  collapsed: boolean;
  onOpen: (panel: PanelKey) => void;
  onFullMode: () => void;
  onFocus: () => void;
  onSetPosition: (position: "top" | "right" | "bottom" | "left") => void;
  onTogglePin: () => void;
  onHoverChange: (hovered: boolean) => void;
}) {
  const dockItems: Array<{ key: PanelKey | "home"; label: string; icon: React.ElementType }> = [
    { key: "home", label: "Home", icon: Home },
    { key: "bookmarks", label: "Bookmarks", icon: Bookmark },
    { key: "notes", label: "Notes", icon: NotebookText },
    { key: "tasks", label: "Tasks", icon: CheckSquare },
    { key: "tabGroups", label: "Groups", icon: Layers },
    { key: "aiHub", label: "AI", icon: Bot },
    { key: "adBlocker", label: "Ad Blocker", icon: Shield },
    { key: "workspaces", label: "Workspaces", icon: Sparkles },
    { key: "settings", label: "Settings", icon: Settings }
  ];

  return (
    <nav
      className={`minimal-dock position-${position} ${collapsed ? "collapsed" : ""}`}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      {dockItems.map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.key} className={activePanel === item.key ? "active" : ""} title={item.label} onClick={() => onOpen(item.key === "home" ? null : item.key)}>
            <Icon size={20} />
          </button>
        );
      })}
      <div className="dock-config">
        <button title={pinned ? "Unpin dock" : "Pin dock"} onClick={onTogglePin} className={pinned ? "active" : ""}>
          {pinned ? <Pin size={16} /> : <PinOff size={16} />}
        </button>
        <button
          title={`Dock ${position}`}
          onClick={() => onSetPosition(nextPosition(position))}
          className="dock-position-button"
        >
          {position === "top" && <ArrowUp size={16} />}
          {position === "right" && <ArrowRight size={16} />}
          {position === "bottom" && <ArrowDown size={16} />}
          {position === "left" && <ArrowLeft size={16} />}
        </button>
      </div>
      <button title="Focus mode" onClick={onFocus}><EyeOff size={20} /></button>
      <button title="Full mode" onClick={onFullMode}>Full</button>
    </nav>
  );
}

const ShortcutsWidget = memo(function ShortcutsWidget({ shortcuts }: { shortcuts: { title: string; url: string }[] }) {
  const [favicons, setFavicons] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadFavicons = async () => {
      const newFavicons: Record<string, string> = {};
      for (const shortcut of shortcuts) {
        try {
          const url = new URL(shortcut.url);
          const faviconUrl = `${url.origin}/favicon.ico`;
          newFavicons[shortcut.url] = faviconUrl;
        } catch {
          newFavicons[shortcut.url] = "";
        }
      }
      setFavicons(newFavicons);
    };
    loadFavicons();
  }, [shortcuts]);

  if (!shortcuts.length) {
    return <p className="empty-copy">Add shortcuts in Settings to show them here.</p>;
  }

  return (
    <div className="shortcuts-widget">
      {shortcuts.map((shortcut, index) => (
        <button
          key={index}
          className="shortcut-block"
          onClick={() => void openUrl(shortcut.url, true)}
          title={shortcut.url}
        >
          <img
            src={favicons[shortcut.url] || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect fill='%238b5cf6' width='16' height='16' rx='2'/%3E%3Ctext x='8' y='12' font-size='10' font-weight='bold' fill='white' text-anchor='middle'%3E%3C/text%3E%3C/svg%3E"}
            alt={shortcut.title}
            className="shortcut-favicon"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect fill='%238b5cf6' width='16' height='16' rx='2'/%3E%3C/svg%3E";
            }}
          />
          <span className="shortcut-title">{shortcut.title}</span>
        </button>
      ))}
    </div>
  );
});

function FloatingPanel({ panel, onClose }: { panel: Exclude<ModuleKey, "home">; onClose: () => void }) {
  return (
    <section className="floating-panel">
      <header>
        <strong>{panelTitles[panel]}</strong>
        <button onClick={onClose}>Close</button>
      </header>
      <div className="floating-panel-body">
        {panel === "bookmarks" && <BookmarksView />}
        {panel === "notes" && <NotesView />}
        {panel === "tasks" && <TasksView />}
        {panel === "tabGroups" && <TabGroupsView />}
        {panel === "aiHub" && <AIDock expanded />}
        {panel === "adBlocker" && <AdBlockerView />}
        {panel === "workspaces" && <WorkspacesView />}
        {panel === "settings" && <SettingsView />}
      </div>
    </section>
  );
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
}

function getWallpaperTone(value: string) {
  const matches = [...value.matchAll(/#([0-9a-f]{3,6})/gi)];
  if (!matches.length) return "dark";
  const brightness =
    matches.reduce((total, match) => {
      const raw = match[1].length === 3 ? match[1].split("").map((char) => char + char).join("") : match[1];
      const red = Number.parseInt(raw.slice(0, 2), 16);
      const green = Number.parseInt(raw.slice(2, 4), 16);
      const blue = Number.parseInt(raw.slice(4, 6), 16);
      return total + (red * 299 + green * 587 + blue * 114) / 1000;
    }, 0) / matches.length;
  return brightness > 142 ? "light" : "dark";
}
