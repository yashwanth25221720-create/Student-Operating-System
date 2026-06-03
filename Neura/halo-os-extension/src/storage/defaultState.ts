import type { AiProvider, HaloState, WidgetKey, WidgetLayout } from "../types/halo";

export const DEFAULT_AI_PROVIDERS: AiProvider[] = [
  { id: "chatgpt", name: "ChatGPT", urlTemplate: "https://chatgpt.com/?q={query}", color: "#10a37f" },
  { id: "claude", name: "Claude", urlTemplate: "https://claude.ai/new?q={query}", color: "#d97745" },
  { id: "gemini", name: "Gemini", urlTemplate: "https://gemini.google.com/app?q={query}", color: "#4285f4" },
  { id: "grok", name: "Grok", urlTemplate: "https://grok.com/?q={query}", color: "#f5f5f5" },
  { id: "deepseek", name: "DeepSeek", urlTemplate: "https://chat.deepseek.com/?q={query}", color: "#4f8cff" },
  { id: "perplexity", name: "Perplexity", urlTemplate: "https://www.perplexity.ai/search?q={query}", color: "#20b8a8" }
];

const widgetOrder: WidgetKey[] = ["clock", "pinnedLinks", "recentTabs", "recentNotes", "todayTasks", "workspaceOverview", "aiAssistant"];

const defaultWidgetLayouts: Record<WidgetKey, WidgetLayout> = {
  clock: { x: 0, y: 0, width: 360, height: 210, zIndex: 10, opacity: 0.96, preset: "medium" },
  pinnedLinks: { x: 376, y: 0, width: 360, height: 260, zIndex: 11, opacity: 0.94, preset: "medium" },
  recentTabs: { x: 752, y: 0, width: 340, height: 260, zIndex: 12, opacity: 0.94, preset: "medium" },
  recentNotes: { x: 0, y: 228, width: 360, height: 300, zIndex: 13, opacity: 0.94, preset: "large" },
  todayTasks: { x: 376, y: 276, width: 360, height: 252, zIndex: 14, opacity: 0.94, preset: "medium" },
  workspaceOverview: { x: 752, y: 276, width: 340, height: 252, zIndex: 15, opacity: 0.94, preset: "medium" },
  aiAssistant: { x: 0, y: 546, width: 520, height: 210, zIndex: 16, opacity: 0.94, preset: "large" }
};

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
    visibleWidgets: {
      clock: true,
      pinnedLinks: true,
      recentTabs: true,
      recentNotes: true,
      todayTasks: true,
      workspaceOverview: true,
      aiAssistant: true
    },
    widgetOrder,
    widgetLayouts: {
      study: defaultWidgetLayouts,
      coding: defaultWidgetLayouts,
      ai: defaultWidgetLayouts,
      gaming: defaultWidgetLayouts
    },
    wallpaper: {
      type: "gradient",
      value: "radial-gradient(circle at 20% 20%, rgba(139,92,246,.28), transparent 28%), linear-gradient(135deg, #080b12 0%, #111827 48%, #0b1324 100%)"
    }
  }
};
