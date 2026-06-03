import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import type React from "react";
import { getChromeBookmarks, getRecentTabs, importChromeTabGroups, saveCurrentTabsAsGroup } from "../lib/chromeApi";
import { loadHaloState, saveHaloState } from "../storage/chromeStorage";
import type {
  AiProvider,
  BookmarkItem,
  HaloNote,
  HaloState,
  HaloTask,
  MinimalWidgetFrame,
  MinimalWidgetInstance,
  MinimalWidgetPreset,
  ModuleKey,
  Wallpaper,
  WidgetKey,
  Workspace
} from "../types/halo";

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
  | { type: "addSavedGroups"; groups: HaloState["tabGroups"] }
  | { type: "toggleWidget"; widget: WidgetKey }
  | { type: "reorderWidget"; from: WidgetKey; to: WidgetKey }
  | { type: "upsertWorkspace"; workspace: Workspace }
  | { type: "setAccent"; accentColor: string }
  | { type: "setSearchBehavior"; behavior: HaloState["settings"]["searchBehavior"] }
  | { type: "toggleMinimalMode" }
  | { type: "setWallpaper"; wallpaper: Wallpaper }
  | { type: "addMinimalWidget"; widget: MinimalWidgetInstance }
  | { type: "updateMinimalWidget"; widgetId: string; patch: Partial<MinimalWidgetInstance> }
  | { type: "updateMinimalWidgetFrame"; widgetId: string; frame: Partial<MinimalWidgetFrame>; workspaceId?: string }
  | { type: "removeMinimalWidget"; widgetId: string }
  | { type: "duplicateMinimalWidget"; widgetId: string }
  | { type: "bringWidgetForward"; widgetId: string }
  | { type: "sendWidgetBackward"; widgetId: string }
  | { type: "saveWidgetPreset"; name: string }
  | { type: "applyWidgetPreset"; presetId: string }
  | { type: "importWidgetPreset"; preset: MinimalWidgetPreset }
  | { type: "createWidgetGroup"; name: string; widgetIds: string[] }
  | { type: "toggleWidgetGroup"; groupId: string }
  | { type: "updateAdBlockerSettings"; patch: Partial<HaloState["settings"]["adBlocker"]> }
  | { type: "addAdBlockerCustomRule"; rule: string }
  | { type: "removeAdBlockerCustomRule"; rule: string }
  | { type: "toggleAdBlockerWhitelist"; domain: string }
  | { type: "incrementAdBlockerStats"; patch: Partial<HaloState["settings"]["adBlocker"]["stats"]> };

interface HaloContextValue {
  activeModule: ModuleKey;
  state: HaloState;
  isReady: boolean;
  recentTabs: Awaited<ReturnType<typeof getRecentTabs>>;
  dispatch: React.Dispatch<Action>;
  importBookmarks: () => Promise<number>;
  captureCurrentTabs: (name: string) => Promise<void>;
  importTabGroups: () => Promise<number>;
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
    case "addSavedGroups":
      return { ...state, tabGroups: [...action.groups, ...state.tabGroups] };
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
    case "upsertWorkspace":
      return { ...state, workspaces: upsertById(state.workspaces, action.workspace) };
    case "setAccent":
      return { ...state, settings: { ...state.settings, accentColor: action.accentColor } };
    case "setSearchBehavior":
      return { ...state, settings: { ...state.settings, searchBehavior: action.behavior } };
    case "toggleMinimalMode":
      return {
        ...state,
        settings: {
          ...state.settings,
          minimalMode: !state.settings.minimalMode,
          sidebarCollapsed: !state.settings.minimalMode ? true : state.settings.sidebarCollapsed
        }
      };
    case "setWallpaper":
      return { ...state, settings: { ...state.settings, wallpaper: action.wallpaper } };
    case "addMinimalWidget":
      return {
        ...state,
        settings: {
          ...state.settings,
          minimalWidgets: [...state.settings.minimalWidgets, action.widget]
        }
      };
    case "updateMinimalWidget":
      return {
        ...state,
        settings: {
          ...state.settings,
          minimalWidgets: state.settings.minimalWidgets.map((widget) =>
            widget.id === action.widgetId ? { ...widget, ...action.patch } : widget
          )
        }
      };
    case "updateMinimalWidgetFrame":
      return {
        ...state,
        settings: {
          ...state.settings,
          minimalWidgets: state.settings.minimalWidgets.map((widget) => {
            if (widget.id !== action.widgetId) return widget;
            if (!action.workspaceId) return { ...widget, frame: { ...widget.frame, ...action.frame } };
            const baseFrame = widget.workspaceFrames?.[action.workspaceId] ?? widget.frame;
            return {
              ...widget,
              workspaceFrames: {
                ...widget.workspaceFrames,
                [action.workspaceId]: { ...baseFrame, ...action.frame }
              }
            };
          })
        }
      };
    case "removeMinimalWidget":
      return {
        ...state,
        settings: {
          ...state.settings,
          minimalWidgets: state.settings.minimalWidgets.filter((widget) => widget.id !== action.widgetId),
          widgetGroups: state.settings.widgetGroups.map((group) => ({
            ...group,
            widgetIds: group.widgetIds.filter((id) => id !== action.widgetId)
          }))
        }
      };
    case "duplicateMinimalWidget": {
      const source = state.settings.minimalWidgets.find((widget) => widget.id === action.widgetId);
      if (!source) return state;
      const copy: MinimalWidgetInstance = {
        ...source,
        id: crypto.randomUUID(),
        title: `${source.title} Copy`,
        locked: false,
        frame: {
          ...source.frame,
          x: clampFrameValue(source.frame.x + 4, 0, 88),
          y: clampFrameValue(source.frame.y + 4, 0, 88),
          zIndex: maxWidgetZ(state.settings.minimalWidgets) + 1
        }
      };
      return { ...state, settings: { ...state.settings, minimalWidgets: [...state.settings.minimalWidgets, copy] } };
    }
    case "bringWidgetForward":
      return updateWidgetZ(state, action.widgetId, 1);
    case "sendWidgetBackward":
      return updateWidgetZ(state, action.widgetId, -1);
    case "saveWidgetPreset": {
      const preset: MinimalWidgetPreset = {
        id: crypto.randomUUID(),
        name: action.name,
        widgets: state.settings.minimalWidgets,
        groups: state.settings.widgetGroups,
        createdAt: new Date().toISOString()
      };
      return { ...state, settings: { ...state.settings, widgetPresets: [preset, ...state.settings.widgetPresets] } };
    }
    case "applyWidgetPreset": {
      const preset = state.settings.widgetPresets.find((item) => item.id === action.presetId);
      return preset ? { ...state, settings: { ...state.settings, minimalWidgets: preset.widgets, widgetGroups: preset.groups } } : state;
    }
    case "importWidgetPreset":
      return {
        ...state,
        settings: {
          ...state.settings,
          widgetPresets: [action.preset, ...state.settings.widgetPresets],
          minimalWidgets: action.preset.widgets,
          widgetGroups: action.preset.groups
        }
      };
    case "createWidgetGroup": {
      const groupId = crypto.randomUUID();
      return {
        ...state,
        settings: {
          ...state.settings,
          widgetGroups: [
            { id: groupId, name: action.name, widgetIds: action.widgetIds, collapsed: false },
            ...state.settings.widgetGroups
          ],
          minimalWidgets: state.settings.minimalWidgets.map((widget) =>
            action.widgetIds.includes(widget.id) ? { ...widget, groupId } : widget
          )
        }
      };
    }
    case "toggleWidgetGroup": {
      const group = state.settings.widgetGroups.find((item) => item.id === action.groupId);
      if (!group) return state;
      const nextCollapsed = !group.collapsed;
      return {
        ...state,
        settings: {
          ...state.settings,
          widgetGroups: state.settings.widgetGroups.map((item) =>
            item.id === action.groupId ? { ...item, collapsed: nextCollapsed } : item
          ),
          minimalWidgets: state.settings.minimalWidgets.map((widget) =>
            group.widgetIds.includes(widget.id) ? { ...widget, hidden: nextCollapsed } : widget
          )
        }
      };
    }
    case "updateAdBlockerSettings":
      return {
        ...state,
        settings: {
          ...state.settings,
          adBlocker: { ...state.settings.adBlocker, ...action.patch }
        }
      };
    case "addAdBlockerCustomRule":
      return {
        ...state,
        settings: {
          ...state.settings,
          adBlocker: {
            ...state.settings.adBlocker,
            customRules: [...new Set([...state.settings.adBlocker.customRules, action.rule.trim()].filter(Boolean))]
          }
        }
      };
    case "removeAdBlockerCustomRule":
      return {
        ...state,
        settings: {
          ...state.settings,
          adBlocker: {
            ...state.settings.adBlocker,
            customRules: state.settings.adBlocker.customRules.filter((rule) => rule !== action.rule)
          }
        }
      };
    case "toggleAdBlockerWhitelist": {
      const domain = action.domain.trim().toLowerCase();
      const exists = state.settings.adBlocker.whitelistedDomains.includes(domain);
      return {
        ...state,
        settings: {
          ...state.settings,
          adBlocker: {
            ...state.settings.adBlocker,
            whitelistedDomains: exists
              ? state.settings.adBlocker.whitelistedDomains.filter((item) => item !== domain)
              : [...state.settings.adBlocker.whitelistedDomains, domain]
          }
        }
      };
    }
    case "incrementAdBlockerStats":
      return {
        ...state,
        settings: {
          ...state.settings,
          adBlocker: {
            ...state.settings.adBlocker,
            stats: {
              ...state.settings.adBlocker.stats,
              adsBlocked: state.settings.adBlocker.stats.adsBlocked + (action.patch.adsBlocked ?? 0),
              trackersBlocked: state.settings.adBlocker.stats.trackersBlocked + (action.patch.trackersBlocked ?? 0),
              popupsBlocked: state.settings.adBlocker.stats.popupsBlocked + (action.patch.popupsBlocked ?? 0),
              overlaysRemoved: state.settings.adBlocker.stats.overlaysRemoved + (action.patch.overlaysRemoved ?? 0),
              bandwidthSavedBytes: state.settings.adBlocker.stats.bandwidthSavedBytes + (action.patch.bandwidthSavedBytes ?? 0)
            }
          }
        }
      };
    default:
      return state;
  }
}

function upsertById<T extends { id: string }>(items: T[], next: T): T[] {
  return items.some((item) => item.id === next.id) ? items.map((item) => (item.id === next.id ? next : item)) : [next, ...items];
}

function maxWidgetZ(widgets: MinimalWidgetInstance[]) {
  return widgets.reduce((max, widget) => Math.max(max, widget.frame.zIndex), 1);
}

function updateWidgetZ(state: HaloState, widgetId: string, direction: 1 | -1): HaloState {
  const nextZ = direction === 1 ? maxWidgetZ(state.settings.minimalWidgets) + 1 : 1;
  return {
    ...state,
    settings: {
      ...state.settings,
      minimalWidgets: state.settings.minimalWidgets.map((widget) =>
        widget.id === widgetId ? { ...widget, frame: { ...widget.frame, zIndex: direction === 1 ? nextZ : Math.max(1, widget.frame.zIndex - 1) } } : widget
      )
    }
  };
}

function clampFrameValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
    return bookmarks.length;
  }, []);

  const captureCurrentTabs = useCallback(
    async (name: string) => {
      const group = await saveCurrentTabsAsGroup(name, state.currentWorkspaceId);
      dispatchBase({ type: "addSavedGroup", group });
    },
    [state?.currentWorkspaceId]
  );

  const importTabGroups = useCallback(async () => {
    const groups = await importChromeTabGroups(state.currentWorkspaceId);
    dispatchBase({ type: "addSavedGroups", groups });
    return groups.length;
  }, [state?.currentWorkspaceId]);

  const value = useMemo(
    () => ({ activeModule, state, isReady, recentTabs, dispatch, importBookmarks, captureCurrentTabs, importTabGroups }),
    [activeModule, captureCurrentTabs, dispatch, importBookmarks, importTabGroups, isReady, recentTabs, state]
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
