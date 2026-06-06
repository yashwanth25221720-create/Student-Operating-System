import type { AiProvider, HaloState, MinimalWidgetInstance, WidgetKey } from "../types/halo";

export const DEFAULT_AI_PROVIDERS: AiProvider[] = [
  { id: "chatgpt", name: "ChatGPT", urlTemplate: "https://chatgpt.com/?q={query}", color: "#10a37f" },
  { id: "claude", name: "Claude", urlTemplate: "https://claude.ai/new?q={query}", color: "#d97745" },
  { id: "gemini", name: "Gemini", urlTemplate: "https://gemini.google.com/app?q={query}", color: "#4285f4" },
  { id: "grok", name: "Grok", urlTemplate: "https://grok.com/?q={query}", color: "#f5f5f5" },
  { id: "deepseek", name: "DeepSeek", urlTemplate: "https://chat.deepseek.com/?q={query}", color: "#4f8cff" },
  { id: "perplexity", name: "Perplexity", urlTemplate: "https://www.perplexity.ai/search?q={query}", color: "#20b8a8" }
];

const widgetOrder: WidgetKey[] = [
  "notepad",
  "tasksBoard",
  "bookmarksBoard",
  "tabGroupsBoard",
  "aiLauncher",
  "pinnedLinks",
  "recentTabs",
  "recentNotes",
  "todayTasks",
  "workspaceOverview"
];

const widgetAppearance = {
  glass: "glass" as const,
  opacity: 0.72,
  blur: 24,
  radius: 14,
  animation: "float" as const
};

export const defaultMinimalWidgets: MinimalWidgetInstance[] = [
  {
    id: "widget-clock",
    type: "clock",
    title: "Clock",
    frame: { x: 4, y: 4, width: 24, height: 18, zIndex: 2 },
    hidden: false,
    locked: false,
    pinned: false,
    dock: "floating",
    visibility: "always",
    appearance: widgetAppearance,
    settings: {}
  },
  {
    id: "widget-system",
    type: "system",
    title: "Workspace",
    frame: { x: 30, y: 4, width: 24, height: 18, zIndex: 2 },
    hidden: false,
    locked: false,
    pinned: false,
    dock: "floating",
    visibility: "always",
    appearance: widgetAppearance,
    settings: {}
  },
  {
    id: "widget-notes",
    type: "notes",
    title: "Quick Notes",
    frame: { x: 4, y: 22, width: 27, height: 34, zIndex: 2 },
    hidden: false,
    locked: false,
    pinned: false,
    dock: "floating",
    visibility: "always",
    appearance: widgetAppearance,
    settings: {}
  },
  {
    id: "widget-bookmarks",
    type: "bookmarks",
    title: "Bookmarks",
    frame: { x: 4, y: 59, width: 27, height: 24, zIndex: 2 },
    hidden: false,
    locked: false,
    pinned: false,
    dock: "floating",
    visibility: "always",
    appearance: widgetAppearance,
    settings: {}
  },
  {
    id: "widget-tasks",
    type: "tasks",
    title: "Tasks",
    frame: { x: 70, y: 22, width: 26, height: 32, zIndex: 2 },
    hidden: false,
    locked: false,
    pinned: false,
    dock: "floating",
    visibility: "always",
    appearance: widgetAppearance,
    settings: {}
  },
  {
    id: "widget-today",
    type: "calendar",
    title: "Today",
    frame: { x: 70, y: 58, width: 26, height: 21, zIndex: 2 },
    hidden: false,
    locked: false,
    pinned: false,
    dock: "floating",
    visibility: "always",
    appearance: widgetAppearance,
    settings: {}
  },
  {
    id: "widget-ai",
    type: "aiSearch",
    title: "AI Search",
    frame: { x: 36, y: 68, width: 28, height: 18, zIndex: 3 },
    hidden: false,
    locked: false,
    pinned: true,
    dock: "floating",
    visibility: "always",
    appearance: { ...widgetAppearance, glass: "ultraGlass", themeColor: "#8b5cf6" },
    settings: {}
  }
];

export const defaultState: HaloState = {
  providers: DEFAULT_AI_PROVIDERS,
  bookmarks: [],
  collections: [{ id: "favorites", name: "Favorites", bookmarkIds: [] }],
  notes: [
    {
      id: "welcome-note",
      title: "Welcome to Halo OS",
      body: "Capture fast notes, attach ideas to sites, and keep workspace context close.",
      mode: "rich",
      updatedAt: new Date().toISOString(),
      workspaceId: "coding"
    }
  ],
  tasks: [
    {
      id: "task-first-workspace",
      title: "Tune your first workspace",
      completed: false,
      dueDate: new Date().toISOString().slice(0, 10),
      priority: "medium",
      category: "Setup",
      workspaceId: "coding"
    }
  ],
  tabGroups: [],
  workspaces: [
    { id: "study", name: "Study Workspace", accent: "#7dd3fc", bookmarkIds: [], noteIds: [], taskIds: [], tabGroupIds: [] },
    { id: "coding", name: "Coding Workspace", accent: "#a78bfa", bookmarkIds: [], noteIds: ["welcome-note"], taskIds: ["task-first-workspace"], tabGroupIds: [] },
    { id: "ai", name: "AI Workspace", accent: "#34d399", bookmarkIds: [], noteIds: [], taskIds: [], tabGroupIds: [] },
    { id: "gaming", name: "Gaming Workspace", accent: "#fb7185", bookmarkIds: [], noteIds: [], taskIds: [], tabGroupIds: [] }
  ],
  currentWorkspaceId: "coding",
  settings: {
    theme: "dark",
    accentColor: "#8b5cf6",
    defaultAiProviderId: "chatgpt",
    searchBehavior: "new-tab",
    sidebarCollapsed: false,
    minimalMode: false,
    visibleWidgets: {
      pinnedLinks: true,
      recentTabs: true,
      recentNotes: true,
      todayTasks: true,
      workspaceOverview: true,
      notepad: true,
      tasksBoard: true,
      bookmarksBoard: true,
      tabGroupsBoard: true,
      aiLauncher: true
    },
    widgetOrder,
    wallpaper: {
      type: "gradient",
      value: "radial-gradient(circle at 20% 20%, rgba(139,92,246,.28), transparent 28%), linear-gradient(135deg, #080b12 0%, #111827 48%, #0b1324 100%)"
    },
    minimalWidgets: defaultMinimalWidgets,
    widgetGroups: [],
    widgetPresets: [
      {
        id: "preset-minimal",
        name: "Minimal Layout",
        widgets: defaultMinimalWidgets,
        groups: [],
        createdAt: new Date().toISOString()
      }
    ],
    adBlocker: {
      enabled: true,
      blockingMode: "balanced",
      blockYouTubeAds: true,
      blockTrackers: true,
      blockPopups: true,
      blockOverlays: true,
      blockCookieBanners: false,
      antiAntiAdblock: true,
      elementPicker: false,
      whitelistedDomains: [],
      customRules: [],
      stats: {
        adsBlocked: 0,
        trackersBlocked: 0,
        popupsBlocked: 0,
        overlaysRemoved: 0,
        bandwidthSavedBytes: 0
      }
    }
  }
};
