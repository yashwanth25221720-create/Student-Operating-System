import {
  Copy,
  EyeOff,
  Lock,
  Move,
  Trash2,
  Unlock
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useHalo } from "../../state/HaloStateContext";
import type { MinimalWidgetFrame, MinimalWidgetInstance, WidgetSizePreset } from "../../types/halo";

const GRID = 1;
const MIN_FRAME = { width: 16, height: 18 };
const resizeHandles = ["n", "s", "e", "w", "ne", "nw", "se", "sw"] as const;
type ResizeHandle = (typeof resizeHandles)[number];

const snap = (value: number) => Math.round(value / GRID) * GRID;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function clampFrame(frame: MinimalWidgetFrame): MinimalWidgetFrame {
  const width = clamp(snap(frame.width), MIN_FRAME.width, 100);
  const height = clamp(snap(frame.height), MIN_FRAME.height, 100);
  return {
    ...frame,
    width: clamp(width, MIN_FRAME.width, 100),
    height: clamp(height, MIN_FRAME.height, 100),
    x: clamp(snap(frame.x), 0, Math.max(0, 100 - width)),
    y: clamp(snap(frame.y), 0, Math.max(0, 100 - height))
  };
}

function frameForWorkspace(widget: MinimalWidgetInstance, workspaceId: string) {
  return clampFrame(widget.workspaceFrames?.[workspaceId] ?? widget.frame);
}

export function WidgetFrame({ widget, children }: { widget: MinimalWidgetInstance; children: React.ReactNode }) {
  const { state, dispatch } = useHalo();
  const frameRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<MinimalWidgetFrame | null>(null);
  const dragPreviewRef = useRef<{ x: number; y: number } | null>(null);
  const [isActive, setActive] = useState(false);
  const workspaceFrame = useMemo(() => frameForWorkspace(widget, state.currentWorkspaceId), [state.currentWorkspaceId, widget]);
  const [liveFrame, setLiveFrame] = useState(workspaceFrame);

  useEffect(() => setLiveFrame(workspaceFrame), [workspaceFrame]);

  useEffect(
    () => () => {
      if (rafRef.current) {
        window.cancelAnimationFrame(rafRef.current);
      }
    },
    []
  );

  useEffect(() => {
    const onResize = () => {
      const clamped = clampFrame(frameForWorkspace(widget, state.currentWorkspaceId));
      dispatch({ type: "updateMinimalWidgetFrame", widgetId: widget.id, workspaceId: state.currentWorkspaceId, frame: clamped });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [dispatch, state.currentWorkspaceId, widget]);

  if (widget.hidden) return null;

  const commitFrame = (frame: MinimalWidgetFrame) => {
    dispatch({ type: "updateMinimalWidgetFrame", widgetId: widget.id, workspaceId: state.currentWorkspaceId, frame });
  };

  const updateLiveFrame = (frame: MinimalWidgetFrame) => {
    pendingRef.current = frame;
    if (rafRef.current) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      if (pendingRef.current) setLiveFrame(pendingRef.current);
    });
  };

  const setDragPreview = (x: number, y: number) => {
    dragPreviewRef.current = { x, y };
    if (!frameRef.current) return;
    frameRef.current.style.setProperty("--drag-x", `${x}px`);
    frameRef.current.style.setProperty("--drag-y", `${y}px`);
  };

  const clearDragPreview = () => {
    dragPreviewRef.current = null;
    if (!frameRef.current) return;
    frameRef.current.style.setProperty("--drag-x", "0px");
    frameRef.current.style.setProperty("--drag-y", "0px");
  };

  const beginInteraction = (event: React.PointerEvent, handle?: ResizeHandle) => {
    if (widget.locked || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setActive(true);
    dispatch({ type: "bringWidgetForward", widgetId: widget.id });

    const startX = event.clientX;
    const startY = event.clientY;
    const startFrame = liveFrame;
    const parent = frameRef.current?.parentElement?.getBoundingClientRect();
    if (!parent) return;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = ((moveEvent.clientX - startX) / parent.width) * 100;
      const dy = ((moveEvent.clientY - startY) / parent.height) * 100;
      let next = startFrame;

      if (!handle) {
        next = { ...startFrame, x: startFrame.x + dx, y: startFrame.y + dy };
      } else {
        const growsLeft = handle.includes("w");
        const growsTop = handle.includes("n");
        next = {
          ...startFrame,
          x: growsLeft ? startFrame.x + dx : startFrame.x,
          y: growsTop ? startFrame.y + dy : startFrame.y,
          width: startFrame.width + (handle.includes("e") ? dx : growsLeft ? -dx : 0),
          height: startFrame.height + (handle.includes("s") ? dy : growsTop ? -dy : 0)
        };
      }

      const clampedNext = clampFrame(next);
      pendingRef.current = clampedNext;

      if (!handle) {
        const dragX = ((clampedNext.x - startFrame.x) / 100) * parent.width;
        const dragY = ((clampedNext.y - startFrame.y) / 100) * parent.height;
        setDragPreview(dragX, dragY);
        return;
      }

      updateLiveFrame(clampedNext);
    };

    const cleanup = () => {
      const finalFrame = pendingRef.current ?? liveFrame;
      pendingRef.current = null;
      setActive(false);
      clearDragPreview();
      setLiveFrame(finalFrame);
      commitFrame(finalFrame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
  };

  return (
    <article
      ref={frameRef}
      className={`widget-frame holo-widget widget-${widget.appearance.glass} ${isActive ? "is-active" : ""} ${widget.locked ? "is-locked" : ""} ${widget.pinned ? "is-pinned" : ""}`}
      data-widget-type={widget.type}
      style={{
        left: `${liveFrame.x}%`,
        top: `${liveFrame.y}%`,
        width: `${liveFrame.width}%`,
        height: `${liveFrame.height}%`,
        transform: "translate3d(var(--drag-x, 0px), var(--drag-y, 0px), 0)",
        zIndex: widget.pinned ? 900 + liveFrame.zIndex : liveFrame.zIndex,
        opacity: widget.appearance.opacity,
        borderRadius: widget.appearance.radius,
        backdropFilter: `blur(${widget.appearance.blur}px) saturate(140%)`
      }}
      onPointerDown={() => setActive(true)}
      onPointerLeave={() => setActive(false)}
    >
      <header className="widget-frame-header" onPointerDown={(event) => beginInteraction(event)}>
        <span><Move size={14} /> {widget.title}</span>
        <div onPointerDown={(event) => event.stopPropagation()}>
            <button title="Duplicate" onClick={() => dispatch({ type: "duplicateMinimalWidget", widgetId: widget.id })}><Copy size={14} /></button>
          <button title={widget.locked ? "Unlock layer" : "Lock layer"} onClick={() => dispatch({ type: "updateMinimalWidget", widgetId: widget.id, patch: { locked: !widget.locked } })}>
            {widget.locked ? <Lock size={14} /> : <Unlock size={14} />}
          </button>
          <button title="Hide" onClick={() => dispatch({ type: "updateMinimalWidget", widgetId: widget.id, patch: { hidden: true } })}><EyeOff size={14} /></button>
          <button title="Remove" onClick={() => dispatch({ type: "removeMinimalWidget", widgetId: widget.id })}><Trash2 size={14} /></button>
        </div>
      </header>
      <div className="widget-frame-body">{children}</div>
      {!widget.locked && resizeHandles.map((handle) => (
        <button
          aria-label={`Resize ${handle}`}
          className={`widget-resize-handle resize-${handle}`}
          key={handle}
          onPointerDown={(event) => beginInteraction(event, handle)}
        />
      ))}
    </article>
  );
}
