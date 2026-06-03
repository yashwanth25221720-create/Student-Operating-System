export type ModuleKey =
  | "home"
  | "bookmarks"
  | "notes"
  | "tasks"
  | "tabGroups"
  | "aiHub"
  | "workspaces"
  | "settings";

export type WidgetKey = "clock" | "pinnedLinks" | "recentTabs" | "recentNotes" | "todayTasks" | "workspaceOverview" | "aiAssistant";

export type WidgetSizePreset = "xs" | "small" | "medium" | "large" | "xl" | "custom";

export interface WidgetLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  opacity: number;
  locked?: boolean;
  pinned?: boolean;
  preset?: WidgetSizePreset;
}

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
  type: "gradient" | "image" | "video" | "category";
  value: string;
}

export interface HaloSettings {
  theme: "dark" | "light";
  accentColor: string;
  defaultAiProviderId: string;
  searchBehavior: "new-tab" | "current-tab";
  sidebarCollapsed: boolean;
  visibleWidgets: Record<WidgetKey, boolean>;
  widgetOrder: WidgetKey[];
  widgetLayouts: Record<string, Partial<Record<WidgetKey, WidgetLayout>>>;
  wallpaper: Wallpaper;
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
