import { AIDock } from "./components/ai/AIDock";
import { BookmarksView } from "./components/bookmarks/BookmarksView";
import { Dashboard } from "./components/dashboard/Dashboard";
import { Shell } from "./components/layout/Shell";
import { NotesView } from "./components/notes/NotesView";
import { SettingsView } from "./components/settings/SettingsView";
import { UniversalSearch } from "./components/search/UniversalSearch";
import { TasksView } from "./components/tasks/TasksView";
import { TabGroupsView } from "./components/workspaces/TabGroupsView";
import { WorkspacesView } from "./components/workspaces/WorkspacesView";
import { useHalo } from "./state/HaloStateContext";

export function App() {
  const { activeModule } = useHalo();

  return (
    <Shell topBar={<UniversalSearch />} aiDock={<AIDock />}>
      {activeModule === "home" && <Dashboard />}
      {activeModule === "bookmarks" && <BookmarksView />}
      {activeModule === "notes" && <NotesView />}
      {activeModule === "tasks" && <TasksView />}
      {activeModule === "tabGroups" && <TabGroupsView />}
      {activeModule === "aiHub" && <AIDock expanded />}
      {activeModule === "workspaces" && <WorkspacesView />}
      {activeModule === "settings" && <SettingsView />}
    </Shell>
  );
}
