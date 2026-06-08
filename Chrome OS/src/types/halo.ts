export type ModuleKey =
  | "home"
  | "bookmarks"
  | "notes"
  | "tasks"
  | "tabGroups"
  | "games"
  | "aiHub"
  | "adBlocker"
  | "workspaces"
  | "settings"
  ;

export type WidgetKey =
  | "pinnedLinks"
  | "recentTabs"
  | "recentNotes"
  | "todayTasks"
  | "workspaceOverview"
  | "notepad"
  | "tasksBoard"
  | "bookmarksBoard"
  | "tabGroupsBoard"
  | "aiLauncher";

export type Priority = "low" | "medium" | "high";

export interface AiProvider {
  id: string;
  name: string;
  urlTemplate: string;
  color: string;
  isCustom?: boolean;
}

export interface BookmarkItem {
  id: string;
  title: string;
  url: string;
  tags: string[];
  collectionId?: string;
  favorite: boolean;
  faviconUrl?: string;
}

export interface BookmarkCollection {
  id: string;
  name: string;
  bookmarkIds: string[];
}

export interface HaloNote {
  id: string;
  title: string;
  body: string;
  mode: "quick" | "rich" | "website";
  domain?: string;
  updatedAt: string;
  workspaceId?: string;
}

export interface HaloTask {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
  priority: Priority;
  category: string;
  workspaceId?: string;
}

export interface SavedTab {
  title: string;
  url: string;
  favIconUrl?: string;
}

export interface SavedTabGroup {
  id: string;
  name: string;
  tabs: SavedTab[];
  workspaceId?: string;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  accent: string;
  wallpaper?: Wallpaper;
  bookmarkIds: string[];
  noteIds: string[];
  taskIds: string[];
  tabGroupIds: string[];
}

export interface Wallpaper {
  type: "gradient" | "image" | "video" | "category" | "html" | "url";
  value: string;
}

export type MinimalWidgetType =
  | "clock"
  | "system"
  | "notes"
  | "tasks"
  | "bookmarks"
  | "calendar"
  | "aiSearch"
  | "chromeSearch"
  | "shortcuts"
  | "quickLinks"
  | "workspaceSwitcher"
  | "quote"
  | "music"
  | "systemMonitor"
  | "countdown"
  | "customHtml"
  | "customUrl"
  | "image"
  | "video"
  | "wallpaperControls";

export type WidgetDockMode = "floating" | "left" | "right" | "top" | "bottom";
export type WidgetVisibilityRule = "always" | "hover" | "click" | "autoHide" | "focusHidden" | "workspace";
export type WidgetGlassMode = "glass" | "ultraGlass" | "solid" | "adaptive" | "invisible" | "wallpaperReactive";
export type WidgetSizePreset = "xs" | "small" | "medium" | "large" | "xl" | "custom";

export interface MinimalWidgetFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

export interface MinimalWidgetAppearance {
  glass: WidgetGlassMode;
  opacity: number;
  blur: number;
  radius: number;
  themeColor?: string;
  animation: "none" | "float" | "pulse" | "glow";
}

export interface MinimalWidgetInstance {
  id: string;
  type: MinimalWidgetType;
  title: string;
  frame: MinimalWidgetFrame;
  workspaceFrames?: Record<string, MinimalWidgetFrame>;
  hidden: boolean;
  locked: boolean;
  pinned: boolean;
  groupId?: string;
  dock: WidgetDockMode;
  visibility: WidgetVisibilityRule;
  workspaceId?: string;
  refreshRateMs?: number;
  appearance: MinimalWidgetAppearance;
  sizePreset?: WidgetSizePreset;
  settings: Record<string, string | number | boolean>;
}

export interface MinimalWidgetGroup {
  id: string;
  name: string;
  widgetIds: string[];
  collapsed: boolean;
}

export interface MinimalWidgetPreset {
  id: string;
  name: string;
  widgets: MinimalWidgetInstance[];
  groups: MinimalWidgetGroup[];
  createdAt: string;
}

export interface HaloSettings {
  theme: "dark" | "light";
  accentColor: string;
  defaultAiProviderId: string;
  searchBehavior: "new-tab" | "current-tab";
  sidebarCollapsed: boolean;
  minimalMode: boolean;
  chromeShortcuts: { title: string; url: string }[];
  visibleWidgets: Record<WidgetKey, boolean>;
  widgetOrder: WidgetKey[];
  wallpaper: Wallpaper;
  minimalWidgets: MinimalWidgetInstance[];
  widgetGroups: MinimalWidgetGroup[];
  widgetPresets: MinimalWidgetPreset[];
  minimalDock: {
    position: "top" | "right" | "bottom" | "left";
    pinned: boolean;
  };
  adBlocker: AdBlockerSettings;
}

export interface AdBlockerSettings {
  enabled: boolean;
  blockingMode: "basic" | "balanced" | "max" | "custom";
  blockYouTubeAds: boolean;
  blockTrackers: boolean;
  blockPopups: boolean;
  blockOverlays: boolean;
  blockCookieBanners: boolean;
  antiAntiAdblock: boolean;
  elementPicker: boolean;
  whitelistedDomains: string[];
  customRules: string[];
  stats: AdBlockerStats;
}

export interface AdBlockerStats {
  adsBlocked: number;
  trackersBlocked: number;
  popupsBlocked: number;
  overlaysRemoved: number;
  bandwidthSavedBytes: number;
}

export interface HaloState {
  providers: AiProvider[];
  bookmarks: BookmarkItem[];
  collections: BookmarkCollection[];
  notes: HaloNote[];
  tasks: HaloTask[];
  tabGroups: SavedTabGroup[];
  workspaces: Workspace[];
  currentWorkspaceId: string;
  settings: HaloSettings;
}

export interface SearchResult {
  id: string;
  category: "Bookmarks" | "Notes" | "Tasks" | "Workspaces" | "Tab Groups";
  title: string;
  subtitle?: string;
  url?: string;
  module: ModuleKey;
}
