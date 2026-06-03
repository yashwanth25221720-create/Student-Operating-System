import {
  Bot,
  Bookmark,
  Briefcase,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Gamepad,
  Home,
  Layers,
  Shield,
  NotebookText,
  Settings,
  Sparkles
} from "lucide-react";
import { useMemo } from "react";
import type React from "react";
import { useHalo } from "../../state/HaloStateContext";
import type { ModuleKey } from "../../types/halo";
import { WallpaperLayer, wallpaperBackground } from "../minimal/WallpaperLayer";

const navItems: Array<{ key: ModuleKey; label: string; icon: React.ElementType }> = [
  { key: "home", label: "Home", icon: Home },
  { key: "bookmarks", label: "Bookmarks", icon: Bookmark },
  { key: "notes", label: "Notes", icon: NotebookText },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "tabGroups", label: "Tab Groups", icon: Layers },
  { key: "games", label: "Games", icon: Gamepad },
  { key: "aiHub", label: "AI Hub", icon: Bot },
  { key: "adBlocker", label: "Ad Blocker", icon: Shield },
  { key: "workspaces", label: "Workspaces", icon: Briefcase },
  { key: "settings", label: "Settings", icon: Settings }
];

export function Shell({
  children,
  topBar,
  aiDock
}: {
  children: React.ReactNode;
  topBar: React.ReactNode;
  aiDock: React.ReactNode;
}) {
  const { activeModule, state, dispatch } = useHalo();
  const workspace = useMemo(
    () => state.workspaces.find((item) => item.id === state.currentWorkspaceId) ?? state.workspaces[0],
    [state.currentWorkspaceId, state.workspaces]
  );

  const wallpaper = state.settings.wallpaper;

  return (
    <div
      className="app-shell"
      style={{ "--accent": state.settings.accentColor, background: wallpaperBackground(wallpaper) } as React.CSSProperties}
    >
      <WallpaperLayer wallpaper={wallpaper} />
      <aside className={`sidebar ${state.settings.sidebarCollapsed ? "is-collapsed" : ""}`}>
        <div className="brand">
          <Sparkles size={22} />
          {!state.settings.sidebarCollapsed && <span>Halo OS</span>}
        </div>
        <nav className="side-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activeModule === item.key ? "active" : ""}
                key={item.key}
                title={item.label}
                onClick={() => dispatch({ type: "setActiveModule", module: item.key })}
              >
                <Icon size={19} />
                {!state.settings.sidebarCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
        <button className="collapse-button" onClick={() => dispatch({ type: "toggleSidebar" })} title="Toggle sidebar">
          {state.settings.sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </aside>

      <main className="workspace">
        <header className="top-bar">
          {topBar}
          <div className="workspace-pill" style={{ borderColor: workspace.accent }}>
            <span style={{ background: workspace.accent }} />
            {workspace.name}
          </div>
          <div className="quick-actions">
            <button onClick={() => dispatch({ type: "toggleMinimalMode" })}>Minimal</button>
            <button onClick={() => dispatch({ type: "setActiveModule", module: "notes" })}>New Note</button>
            <button onClick={() => dispatch({ type: "setActiveModule", module: "tasks" })}>New Task</button>
          </div>
        </header>
        <section className="content-grid">{children}</section>
      </main>

      {aiDock}
    </div>
  );
}
