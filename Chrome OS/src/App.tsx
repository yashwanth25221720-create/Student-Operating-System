import { AIDock } from "./components/ai/AIDock";
import { AdBlockerView } from "./components/adblocker/AdBlockerView";
import { BookmarksView } from "./components/bookmarks/BookmarksView";
import { Dashboard } from "./components/dashboard/Dashboard";
import { GamesView } from "./components/games/GamesView";
import { Shell } from "./components/layout/Shell";
import { MinimalDesktop } from "./components/minimal/MinimalDesktop";
import { NotesView } from "./components/notes/NotesView";
import { SettingsView } from "./components/settings/SettingsView";
import { UniversalSearch } from "./components/search/UniversalSearch";
import { TasksView } from "./components/tasks/TasksView";
import { TabGroupsView } from "./components/workspaces/TabGroupsView";
import { WorkspacesView } from "./components/workspaces/WorkspacesView";
import { useHalo } from "./state/HaloStateContext";

export function App() {
  const { activeModule, state } = useHalo();

  if (state.settings.minimalMode) {
    return <MinimalDesktop />;
  }

  return (
    <Shell topBar={<UniversalSearch />} aiDock={<AIDock />}>
      {activeModule === "home" && <Dashboard />}
      {activeModule === "bookmarks" && <BookmarksView />}
      {activeModule === "notes" && <NotesView />}
      {activeModule === "tasks" && <TasksView />}
      {activeModule === "tabGroups" && <TabGroupsView />}
      {activeModule === "games" && <GamesView />}
      {activeModule === "aiHub" && <AIDock expanded />}
      {activeModule === "adBlocker" && <AdBlockerView />}
      {activeModule === "workspaces" && <WorkspacesView />}
      {/* YouTube module removed */}
      {activeModule === "settings" && <SettingsView />}
    </Shell>
  );
}
