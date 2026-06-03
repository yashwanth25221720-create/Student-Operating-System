import {
  Bot,
  Bookmark,
  CalendarDays,
  CheckSquare,
  Clock3,
  Code2,
  Image,
  Link,
  Monitor,
  Music,
  NotebookText,
  Quote,
  Sparkles,
  Timer,
  Video,
  Wallpaper
} from "lucide-react";
import type React from "react";
import type { MinimalWidgetInstance, MinimalWidgetType } from "../../types/halo";

export interface WidgetDefinition {
  type: MinimalWidgetType;
  title: string;
  description: string;
  icon: React.ElementType;
  defaultSize: { width: number; height: number };
  permissions: string[];
  configurable: boolean;
}

export const widgetRegistry: Record<MinimalWidgetType, WidgetDefinition> = {
  clock: { type: "clock", title: "Clock", description: "Live time and date.", icon: Clock3, defaultSize: { width: 24, height: 18 }, permissions: [], configurable: true },
  system: { type: "system", title: "System", description: "Workspace and desktop state.", icon: Monitor, defaultSize: { width: 24, height: 18 }, permissions: [], configurable: true },
  notes: { type: "notes", title: "Notes", description: "Transparent quick notes.", icon: NotebookText, defaultSize: { width: 27, height: 34 }, permissions: ["storage"], configurable: true },
  tasks: { type: "tasks", title: "Tasks", description: "Compact task manager.", icon: CheckSquare, defaultSize: { width: 26, height: 32 }, permissions: ["storage"], configurable: true },
  bookmarks: { type: "bookmarks", title: "Bookmarks", description: "Favorite and imported bookmarks.", icon: Bookmark, defaultSize: { width: 27, height: 24 }, permissions: ["bookmarks"], configurable: true },
  calendar: { type: "calendar", title: "Calendar", description: "Today summary placeholder.", icon: CalendarDays, defaultSize: { width: 24, height: 20 }, permissions: [], configurable: true },
  aiSearch: { type: "aiSearch", title: "AI Search", description: "Provider switcher and prompt launcher.", icon: Bot, defaultSize: { width: 28, height: 18 }, permissions: ["tabs"], configurable: true },
  quickLinks: { type: "quickLinks", title: "Quick Links", description: "Pinned launch buttons.", icon: Link, defaultSize: { width: 24, height: 20 }, permissions: ["tabs"], configurable: true },
  workspaceSwitcher: { type: "workspaceSwitcher", title: "Workspace Switcher", description: "Switch Halo workspaces.", icon: Sparkles, defaultSize: { width: 24, height: 20 }, permissions: ["storage"], configurable: true },
  quote: { type: "quote", title: "Quote", description: "A calm desktop quote.", icon: Quote, defaultSize: { width: 24, height: 16 }, permissions: [], configurable: true },
  music: { type: "music", title: "Music", description: "Music controls placeholder.", icon: Music, defaultSize: { width: 24, height: 18 }, permissions: [], configurable: true },
  systemMonitor: { type: "systemMonitor", title: "System Monitor", description: "Browser session stats.", icon: Monitor, defaultSize: { width: 24, height: 20 }, permissions: [], configurable: true },
  countdown: { type: "countdown", title: "Countdown", description: "Simple countdown timer.", icon: Timer, defaultSize: { width: 22, height: 16 }, permissions: ["storage"], configurable: true },
  customHtml: { type: "customHtml", title: "Custom HTML", description: "Sandbox-ready custom markup.", icon: Code2, defaultSize: { width: 28, height: 24 }, permissions: ["sandbox"], configurable: true },
  customUrl: { type: "customUrl", title: "Custom URL", description: "Embedded URL frame.", icon: Link, defaultSize: { width: 30, height: 24 }, permissions: ["network"], configurable: true },
  image: { type: "image", title: "Image", description: "Personal image widget.", icon: Image, defaultSize: { width: 24, height: 20 }, permissions: ["storage"], configurable: true },
  video: { type: "video", title: "Video", description: "Ambient video panel.", icon: Video, defaultSize: { width: 28, height: 22 }, permissions: ["storage"], configurable: true },
  wallpaperControls: { type: "wallpaperControls", title: "Wallpaper Controls", description: "Fast wallpaper focus controls.", icon: Wallpaper, defaultSize: { width: 24, height: 18 }, permissions: ["storage"], configurable: true }
};

export const widgetDefinitions = Object.values(widgetRegistry);

export function createWidgetInstance(type: MinimalWidgetType, seed = 0): MinimalWidgetInstance {
  const definition = widgetRegistry[type];
  return {
    id: crypto.randomUUID(),
    type,
    title: definition.title,
    frame: {
      x: Math.min(70, 8 + seed * 3),
      y: Math.min(70, 10 + seed * 3),
      width: definition.defaultSize.width,
      height: definition.defaultSize.height,
      zIndex: 10 + seed
    },
    hidden: false,
    locked: false,
    pinned: false,
    dock: "floating",
    visibility: "always",
    appearance: {
      glass: "glass",
      opacity: 0.72,
      blur: 24,
      radius: 14,
      animation: "float",
      themeColor: "#8b5cf6"
    },
    settings: {}
  };
}
