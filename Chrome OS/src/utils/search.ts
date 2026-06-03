import type { HaloState, SearchResult } from "../types/halo";

export function searchHalo(state: HaloState, rawQuery: string): SearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const matches = (value = "") => value.toLowerCase().includes(query);

  return [
    ...state.bookmarks
      .filter((bookmark) => matches(bookmark.title) || matches(bookmark.url) || bookmark.tags.some(matches))
      .map<SearchResult>((bookmark) => ({
        id: bookmark.id,
        category: "Bookmarks",
        title: bookmark.title,
        subtitle: bookmark.url,
        url: bookmark.url,
        module: "bookmarks"
      })),
    ...state.notes
      .filter((note) => matches(note.title) || matches(note.body) || matches(note.domain))
      .map<SearchResult>((note) => ({
        id: note.id,
        category: "Notes",
        title: note.title,
        subtitle: note.domain ?? note.body.slice(0, 90),
        module: "notes"
      })),
    ...state.tasks
      .filter((task) => matches(task.title) || matches(task.category) || matches(task.priority))
      .map<SearchResult>((task) => ({
        id: task.id,
        category: "Tasks",
        title: task.title,
        subtitle: `${task.priority} priority${task.dueDate ? ` - due ${task.dueDate}` : ""}`,
        module: "tasks"
      })),
    ...state.workspaces
      .filter((workspace) => matches(workspace.name))
      .map<SearchResult>((workspace) => ({
        id: workspace.id,
        category: "Workspaces",
        title: workspace.name,
        subtitle: "Switch workspace",
        module: "workspaces"
      })),
    ...state.tabGroups
      .filter((group) => matches(group.name) || group.tabs.some((tab) => matches(tab.title) || matches(tab.url)))
      .map<SearchResult>((group) => ({
        id: group.id,
        category: "Tab Groups",
        title: group.name,
        subtitle: `${group.tabs.length} saved tabs`,
        module: "tabGroups"
      }))
  ].slice(0, 24);
}

export function groupSearchResults(results: SearchResult[]) {
  return results.reduce<Record<SearchResult["category"], SearchResult[]>>(
    (groups, result) => {
      groups[result.category].push(result);
      return groups;
    },
    { Bookmarks: [], Notes: [], Tasks: [], Workspaces: [], "Tab Groups": [] }
  );
}
