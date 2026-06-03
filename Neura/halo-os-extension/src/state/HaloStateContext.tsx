import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type React from "react";
import { getChromeBookmarks, getRecentTabs, saveCurrentTabsAsGroup } from "../lib/chromeApi";
import { loadHaloState, saveHaloState } from "../storage/chromeStorage";
import type { AiProvider, BookmarkItem, HaloNote, HaloState, HaloTask, ModuleKey, WidgetKey, WidgetLayout, Workspace } from "../types/halo";

type Action =
  | { type: "hydrate"; state: HaloState }
  | { type: "toggleSidebar" }
  | { type: "setActiveModule"; module: ModuleKey }
  | { type: "switchWorkspace"; workspaceId: string }
  | { type: "upsertNote"; note: HaloNote }
  | { type: "deleteNote"; noteId: string }
  | { type: "upsertTask"; task: HaloTask }
  | { type: "toggleTask"; taskId: string }
  | { type: "setDefaultProvider"; providerId: string }
  | { type: "upsertProvider"; provider: AiProvider }
  | { type: "toggleBookmarkFavorite"; bookmarkId: string }
  | { type: "setBookmarks"; bookmarks: BookmarkItem[] }
  | { type: "saveTabs"; name: string }
  | { type: "addSavedGroup"; group: HaloState["tabGroups"][number] }
  | { type: "toggleWidget"; widget: WidgetKey }
  | { type: "reorderWidget"; from: WidgetKey; to: WidgetKey }
  | { type: "setWidgetLayout"; workspaceId: string; widget: WidgetKey; layout: WidgetLayout }
  | { type: "upsertWorkspace"; workspace: Workspace }
  | { type: "setAccent"; accentColor: string }
  | { type: "setSearchBehavior"; behavior: HaloState["settings"]["searchBehavior"] };

interface HaloContextValue {
  activeModule: ModuleKey;
  state: HaloState;
  isReady: boolean;
  recentTabs: Awaited<ReturnType<typeof getRecentTabs>>;
  dispatch: React.Dispatch<Action>;
  importBookmarks: () => Promise<void>;
  captureCurrentTabs: (name: string) => Promise<void>;
}

const HaloContext = createContext<HaloContextValue | null>(null);

function reducer(state: HaloState, action: Action): HaloState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "toggleSidebar":
      return { ...state, settings: { ...state.settings, sidebarCollapsed: !state.settings.sidebarCollapsed } };
    case "switchWorkspace":
      return { ...state, currentWorkspaceId: action.workspaceId };
    case "upsertNote":
      return { ...state, notes: upsertById(state.notes, action.note) };
    case "deleteNote":
      return { ...state, notes: state.notes.filter((note) => note.id !== action.noteId) };
    case "upsertTask":
      return { ...state, tasks: upsertById(state.tasks, action.task) };
    case "toggleTask":
      return {
        ...state,
        tasks: state.tasks.map((task) => (task.id === action.taskId ? { ...task, completed: !task.completed } : task))
      };
    case "setDefaultProvider":
      return { ...state, settings: { ...state.settings, defaultAiProviderId: action.providerId } };
    case "upsertProvider":
      return { ...state, providers: upsertById(state.providers, action.provider) };
    case "toggleBookmarkFavorite":
      return {
        ...state,
        bookmarks: state.bookmarks.map((bookmark) =>
          bookmark.id === action.bookmarkId ? { ...bookmark, favorite: !bookmark.favorite } : bookmark
        )
      };
    case "setBookmarks":
      return { ...state, bookmarks: action.bookmarks };
    case "addSavedGroup":
      return { ...state, tabGroups: [action.group, ...state.tabGroups] };
    case "toggleWidget":
      return {
        ...state,
        settings: {
          ...state.settings,
          visibleWidgets: {
            ...state.settings.visibleWidgets,
            [action.widget]: !state.settings.visibleWidgets[action.widget]
          }
        }
      };
    case "reorderWidget": {
      const order = [...state.settings.widgetOrder];
      const fromIndex = order.indexOf(action.from);
      const toIndex = order.indexOf(action.to);
      if (fromIndex < 0 || toIndex < 0) return state;
      order.splice(fromIndex, 1);
      order.splice(toIndex, 0, action.from);
      return { ...state, settings: { ...state.settings, widgetOrder: order } };
    }
    case "setWidgetLayout": {
      const workspaceLayouts = state.settings.widgetLayouts[action.workspaceId] ?? {};
      return {
        ...state,
        settings: {
          ...state.settings,
          widgetLayouts: {
            ...state.settings.widgetLayouts,
            [action.workspaceId]: {
              ...workspaceLayouts,
              [action.widget]: action.layout
            }
          }
        }
      };
    }
    case "upsertWorkspace":
      return { ...state, workspaces: upsertById(state.workspaces, action.workspace) };
    case "setAccent":
      return { ...state, settings: { ...state.settings, accentColor: action.accentColor } };
    case "setSearchBehavior":
      return { ...state, settings: { ...state.settings, searchBehavior: action.behavior } };
    default:
      return state;
  }
}

function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
  return items.some((item) => item.id === next.id) ? items.map((item) => (item.id === next.id ? next : item)) : [next, ...items];
}

export function HaloStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatchBase] = useReducer(reducer, undefined as unknown as HaloState);
  const [activeModule, setActiveModule] = useState<ModuleKey>("home");
  const [isReady, setReady] = useState(false);
  const [recentTabs, setRecentTabs] = useState<Awaited<ReturnType<typeof getRecentTabs>>>([]);

  useEffect(() => {
    loadHaloState().then((loaded) => {
      dispatchBase({ type: "hydrate", state: loaded });
      setReady(true);
    });
    getRecentTabs().then(setRecentTabs).catch(() => setRecentTabs([]));
  }, []);

  useEffect(() => {
    if (isReady) void saveHaloState(state);
  }, [isReady, state]);

  const dispatch = useCallback((action: Action) => {
    if (action.type === "setActiveModule") {
      setActiveModule(action.module);
      return;
    }
    dispatchBase(action);
  }, []);

  const importBookmarks = useCallback(async () => {
    const bookmarks = await getChromeBookmarks();
    dispatchBase({ type: "setBookmarks", bookmarks });
  }, []);

  const captureCurrentTabs = useCallback(
    async (name: string) => {
      const group = await saveCurrentTabsAsGroup(name, state.currentWorkspaceId);
      dispatchBase({ type: "addSavedGroup", group });
    },
    [state?.currentWorkspaceId]
  );

  const value = useMemo(
    () => ({ activeModule, state, isReady, recentTabs, dispatch, importBookmarks, captureCurrentTabs }),
    [activeModule, captureCurrentTabs, dispatch, importBookmarks, isReady, recentTabs, state]
  );

  if (!isReady || !state) {
    return <div className="boot-screen">Halo OS is initializing</div>;
  }

  return <HaloContext.Provider value={value}>{children}</HaloContext.Provider>;
}

export function useHalo() {
  const context = useContext(HaloContext);
  if (!context) throw new Error("useHalo must be used inside HaloStateProvider");
  return context;
}
