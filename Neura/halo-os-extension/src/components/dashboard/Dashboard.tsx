import {
  ArrowDownToLine,
  ArrowUpToLine,
  Bot,
  GripVertical,
  Lock,
  Pin,
  Send,
  Star,
  Unlock
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { openUrl } from "../../lib/chromeApi";
import { useHalo } from "../../state/HaloStateContext";
import type { WidgetKey, WidgetLayout, WidgetSizePreset } from "../../types/halo";

const GRID_SIZE = 12;
const MIN_WIDGET = { width: 220, height: 150 };
const SIZE_PRESETS: Record<Exclude<WidgetSizePreset, "custom">, Pick<WidgetLayout, "width" | "height">> = {
  xs: { width: 240, height: 150 },
  small: { width: 300, height: 190 },
  medium: { width: 360, height: 250 },
  large: { width: 520, height: 320 },
  xl: { width: 700, height: 430 }
};

const widgetTitles: Record<WidgetKey, string> = {
  clock: "Clock",
  pinnedLinks: "Pinned Links",
  recentTabs: "Recent Tabs",
  recentNotes: "Recent Notes",
  todayTasks: "Today's Tasks",
  workspaceOverview: "Workspace Overview",
  aiAssistant: "AI Widget"
};

const resizeHandles = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
type ResizeHandle = (typeof resizeHandles)[number];

type Interaction =
  | {
      type: "drag";
      widget: WidgetKey;
      pointerId: number;
      startX: number;
      startY: number;
      startLayout: WidgetLayout;
    }
  | {
      type: "resize";
      widget: WidgetKey;
      handle: ResizeHandle;
      pointerId: number;
      startX: number;
      startY: number;
      startLayout: WidgetLayout;
    };

const snap = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

function clampLayout(layout: WidgetLayout, bounds: DOMRect | undefined): WidgetLayout {
  const maxWidth = Math.max(MIN_WIDGET.width, bounds?.width ?? layout.width);
  const maxHeight = Math.max(MIN_WIDGET.height, bounds?.height ?? layout.height);
  const width = Math.min(Math.max(MIN_WIDGET.width, snap(layout.width)), maxWidth);
  const height = Math.min(Math.max(MIN_WIDGET.height, snap(layout.height)), maxHeight);
  return {
    ...layout,
    width,
    height,
    x: Math.min(Math.max(0, snap(layout.x)), Math.max(0, maxWidth - width)),
    y: Math.min(Math.max(0, snap(layout.y)), Math.max(0, maxHeight - height))
  };
}

function deriveFallbackLayout(index: number, bounds: DOMRect | undefined): WidgetLayout {
  const columns = Math.max(1, Math.floor(((bounds?.width ?? 1120) + 16) / 376));
  const x = (index % columns) * 376;
  const y = Math.floor(index / columns) * 276;
  return clampLayout({ x, y, width: 360, height: 250, zIndex: 20 + index, opacity: 0.94, preset: "medium" }, bounds);
}

function getWallpaperTone(value: string) {
  const matches = [...value.matchAll(/#([0-9a-f]{3,6})/gi)];
  if (!matches.length) return "dark";
  const brightness =
    matches.reduce((total, match) => {
      const raw = match[1].length === 3 ? match[1].split("").map((char) => char + char).join("") : match[1];
      const red = Number.parseInt(raw.slice(0, 2), 16);
      const green = Number.parseInt(raw.slice(2, 4), 16);
      const blue = Number.parseInt(raw.slice(4, 6), 16);
      return total + (red * 299 + green * 587 + blue * 114) / 1000;
    }, 0) / matches.length;
  return brightness > 142 ? "light" : "dark";
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

export function Dashboard() {
  const { state, recentTabs, dispatch } = useHalo();
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingLayoutRef = useRef<WidgetLayout | null>(null);
  const workspace = state.workspaces.find((item) => item.id === state.currentWorkspaceId) ?? state.workspaces[0];
  const storedLayouts = state.settings.widgetLayouts[workspace.id] ?? {};
  const wallpaperTone = getWallpaperTone(workspace.wallpaper?.value ?? state.settings.wallpaper.value);
  const now = useClock();

  const layouts = useMemo(() => {
    const bounds = desktopRef.current?.getBoundingClientRect();
    return state.settings.widgetOrder.reduce<Partial<Record<WidgetKey, WidgetLayout>>>((items, widget, index) => {
      items[widget] = clampLayout(storedLayouts[widget] ?? deriveFallbackLayout(index, bounds), bounds);
      return items;
    }, {});
  }, [state.settings.widgetOrder, storedLayouts]);

  const [liveLayouts, setLiveLayouts] = useState(layouts);

  useEffect(() => setLiveLayouts(layouts), [layouts]);

  const commitLayout = useCallback(
    (widget: WidgetKey, layout: WidgetLayout) => {
      dispatch({ type: "setWidgetLayout", workspaceId: workspace.id, widget, layout });
    },
    [dispatch, workspace.id]
  );

  const patchLiveLayout = useCallback((widget: WidgetKey, next: WidgetLayout) => {
    pendingLayoutRef.current = next;
    if (rafRef.current) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      const pending = pendingLayoutRef.current;
      if (!pending) return;
      setLiveLayouts((current) => ({ ...current, [widget]: pending }));
    });
  }, []);

  const bringToFront = (widget: WidgetKey, layout: WidgetLayout) => {
    const maxZ = Math.max(...Object.values(liveLayouts).map((item) => item?.zIndex ?? 1), 1);
    commitLayout(widget, { ...layout, zIndex: maxZ + 1 });
  };

  const sendToBack = (widget: WidgetKey, layout: WidgetLayout) => {
    const minZ = Math.min(...Object.values(liveLayouts).map((item) => item?.zIndex ?? 1), 1);
    commitLayout(widget, { ...layout, zIndex: minZ - 1 });
  };

  const applyPreset = (widget: WidgetKey, layout: WidgetLayout, preset: Exclude<WidgetSizePreset, "custom">) => {
    const next = clampLayout({ ...layout, ...SIZE_PRESETS[preset], preset }, desktopRef.current?.getBoundingClientRect());
    commitLayout(widget, next);
  };

  const toggleLock = (widget: WidgetKey, layout: WidgetLayout) => commitLayout(widget, { ...layout, locked: !layout.locked });
  const togglePin = (widget: WidgetKey, layout: WidgetLayout) => commitLayout(widget, { ...layout, pinned: !layout.pinned });

  const startDrag = (event: React.PointerEvent, widget: WidgetKey, layout: WidgetLayout) => {
    if (layout.locked || event.button !== 0) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    bringToFront(widget, layout);
    interactionRef.current = {
      type: "drag",
      widget,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLayout: { ...layout, zIndex: Math.max(...Object.values(liveLayouts).map((item) => item?.zIndex ?? 1), 1) + 1 }
    };
  };

  const startResize = (event: React.PointerEvent, widget: WidgetKey, layout: WidgetLayout, handle: ResizeHandle) => {
    if (layout.locked || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    bringToFront(widget, layout);
    interactionRef.current = {
      type: "resize",
      widget,
      handle,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLayout: { ...layout, zIndex: Math.max(...Object.values(liveLayouts).map((item) => item?.zIndex ?? 1), 1) + 1 }
    };
  };

  const updateInteraction = (event: React.PointerEvent) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    const bounds = desktopRef.current?.getBoundingClientRect();
    const dx = event.clientX - interaction.startX;
    const dy = event.clientY - interaction.startY;
    let next = interaction.startLayout;

    if (interaction.type === "drag") {
      next = { ...interaction.startLayout, x: interaction.startLayout.x + dx, y: interaction.startLayout.y + dy };
    } else {
      const handle = interaction.handle;
      const growsLeft = handle.includes("w");
      const growsTop = handle.includes("n");
      const width = interaction.startLayout.width + (handle.includes("e") ? dx : growsLeft ? -dx : 0);
      const height = interaction.startLayout.height + (handle.includes("s") ? dy : growsTop ? -dy : 0);
      next = {
        ...interaction.startLayout,
        x: growsLeft ? interaction.startLayout.x + dx : interaction.startLayout.x,
        y: growsTop ? interaction.startLayout.y + dy : interaction.startLayout.y,
        width,
        height,
        preset: "custom"
      };
    }

    patchLiveLayout(interaction.widget, clampLayout(next, bounds));
  };

  const endInteraction = (event: React.PointerEvent) => {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    const finalLayout = pendingLayoutRef.current ?? liveLayouts[interaction.widget];
    interactionRef.current = null;
    pendingLayoutRef.current = null;
    if (finalLayout) commitLayout(interaction.widget, finalLayout);
  };

  useEffect(() => {
    const handleResize = () => {
      const bounds = desktopRef.current?.getBoundingClientRect();
      state.settings.widgetOrder.forEach((widget) => {
        const layout = liveLayouts[widget];
        if (!layout) return;
        const clamped = clampLayout(layout, bounds);
        if (clamped.x !== layout.x || clamped.y !== layout.y || clamped.width !== layout.width || clamped.height !== layout.height) {
          commitLayout(widget, clamped);
        }
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [commitLayout, liveLayouts, state.settings.widgetOrder]);

  return (
    <div className="dashboard-desktop" ref={desktopRef} data-wallpaper-tone={wallpaperTone}>
      <div className="desktop-zone zone-top" />
      <div className="desktop-zone zone-left" />
      <div className="desktop-zone zone-center" />
      <div className="desktop-zone zone-right" />
      <div className="desktop-zone zone-bottom" />
      {state.settings.widgetOrder.map((widget) => {
        if (!state.settings.visibleWidgets[widget]) return null;
        const layout = liveLayouts[widget] ?? deriveFallbackLayout(0, desktopRef.current?.getBoundingClientRect());
        const compact = layout.width < 310 || layout.height < 200;
        return (
          <article
            className={`widget-card desktop-widget ${layout.locked ? "is-locked" : ""} ${layout.pinned ? "is-pinned" : ""}`}
            key={widget}
            style={{
              width: layout.width,
              height: layout.height,
              opacity: layout.opacity,
              zIndex: layout.zIndex,
              transform: `translate3d(${layout.x}px, ${layout.y}px, 0)`
            }}
            onPointerMove={updateInteraction}
            onPointerUp={endInteraction}
            onPointerCancel={endInteraction}
          >
            <header className="widget-header" onPointerDown={(event) => startDrag(event, widget, layout)}>
              <span className="widget-title"><GripVertical size={16} />{widgetTitles[widget]}</span>
              <div className="widget-layer-actions">
                <button title="Send to back" onClick={() => sendToBack(widget, layout)}><ArrowDownToLine size={14} /></button>
                <button title="Bring to front" onClick={() => bringToFront(widget, layout)}><ArrowUpToLine size={14} /></button>
                <button title={layout.pinned ? "Unpin layer" : "Pin layer"} onClick={() => togglePin(widget, layout)}><Pin size={14} /></button>
                <button title={layout.locked ? "Unlock layer" : "Lock layer"} onClick={() => toggleLock(widget, layout)}>{layout.locked ? <Lock size={14} /> : <Unlock size={14} />}</button>
              </div>
            </header>
            <div className="widget-preset-row">
              {(["xs", "small", "medium", "large", "xl"] as const).map((preset) => (
                <button className={layout.preset === preset ? "active" : ""} key={preset} onClick={() => applyPreset(widget, layout, preset)}>
                  {preset.toUpperCase()}
                </button>
              ))}
            </div>
            <WidgetBody widget={widget} layout={layout} compact={compact} now={now} />
            {!layout.locked && resizeHandles.map((handle) => (
              <button
                aria-label={`Resize ${handle}`}
                className={`resize-handle resize-${handle}`}
                key={handle}
                onPointerDown={(event) => startResize(event, widget, layout, handle)}
              />
            ))}
          </article>
        );
      })}
    </div>
  );
}

function WidgetBody({
  widget,
  layout,
  compact,
  now
}: {
  widget: WidgetKey;
  layout: WidgetLayout;
  compact: boolean;
  now: Date;
}) {
  const { state, recentTabs, dispatch } = useHalo();
  const workspace = state.workspaces.find((item) => item.id === state.currentWorkspaceId) ?? state.workspaces[0];
  const time = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const clockScale = Math.max(1.9, Math.min(5.6, layout.width / 82, layout.height / 42));

  if (widget === "clock") {
    const sizeMode = layout.width > 620 && layout.height > 340 ? "xl" : layout.width > 460 && layout.height > 270 ? "large" : compact ? "small" : "medium";
    return (
      <div className={`clock-widget clock-${sizeMode}`} style={{ "--clock-scale": clockScale } as React.CSSProperties}>
        <strong>{time}</strong>
        {sizeMode !== "small" && <span>{date}</span>}
        {(sizeMode === "large" || sizeMode === "xl") && <small>{timezone}</small>}
        {sizeMode === "xl" && (
          <div className="clock-dashboard">
            <span><b>{workspace.name}</b>Workspace</span>
            <span><b>{state.tasks.filter((task) => !task.completed).length}</b>Open tasks</span>
            <span><b>{state.notes.length}</b>Notes</span>
          </div>
        )}
      </div>
    );
  }

  if (widget === "pinnedLinks") {
    return (
      <div className="card-list widget-scroll">
        {state.bookmarks.filter((bookmark) => bookmark.favorite).slice(0, compact ? 3 : 8).map((bookmark) => (
          <button key={bookmark.id} onClick={() => void openUrl(bookmark.url)}>
            <Star size={15} /> {bookmark.title}
          </button>
        ))}
        {!state.bookmarks.some((bookmark) => bookmark.favorite) && <p className="empty-copy">Favorite bookmarks appear here.</p>}
      </div>
    );
  }

  if (widget === "recentTabs") {
    return (
      <div className="card-list widget-scroll">
        {recentTabs.slice(0, compact ? 4 : 8).map((tab) => (
          <button key={tab.url} onClick={() => void openUrl(tab.url)}>{tab.title}</button>
        ))}
        {recentTabs.length === 0 && <p className="empty-copy">Open Chrome tabs are shown in extension mode.</p>}
      </div>
    );
  }

  if (widget === "recentNotes") {
    return (
      <div className="card-list widget-scroll">
        {state.notes.slice(0, compact ? 3 : 6).map((note) => (
          <button key={note.id} onClick={() => dispatch({ type: "setActiveModule", module: "notes" })}>
            <strong>{note.title}</strong>
            <span>{note.body.slice(0, 90)}</span>
          </button>
        ))}
      </div>
    );
  }

  if (widget === "todayTasks") {
    return (
      <div className="task-mini-list widget-scroll">
        {state.tasks.slice(0, compact ? 4 : 8).map((task) => (
          <label key={task.id}>
            <input type="checkbox" checked={task.completed} onChange={() => dispatch({ type: "toggleTask", taskId: task.id })} />
            <span>{task.title}</span>
            <small>{task.priority}</small>
          </label>
        ))}
      </div>
    );
  }

  if (widget === "workspaceOverview") {
    return (
      <div className="overview-grid">
        <span><strong>{workspace.name}</strong>Active</span>
        <span><strong>{state.bookmarks.length}</strong>Bookmarks</span>
        <span><strong>{state.notes.length}</strong>Notes</span>
        <span><strong>{state.tasks.filter((task) => !task.completed).length}</strong>Open tasks</span>
      </div>
    );
  }

  return (
    <div className="ai-widget">
      <Bot size={34} />
      <div>
        <strong>{state.providers.find((provider) => provider.id === state.settings.defaultAiProviderId)?.name ?? "AI"}</strong>
        <span>Ask, route, and launch your selected provider from the dock.</span>
      </div>
      <button onClick={() => dispatch({ type: "setActiveModule", module: "aiHub" })}>
        <Send size={16} />
        Open
      </button>
    </div>
  );
}
