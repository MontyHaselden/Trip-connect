"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  clampDurationMove,
  clampResizeEnd,
  clampResizeStart,
  pointerYToMinutes,
} from "@/lib/timeline/time-math";

const AUTO_SCROLL_EDGE_PX = 56;
const AUTO_SCROLL_SPEED = 10;

type DragKind = "move" | "resize-start" | "resize-end";

type DragState = {
  kind: DragKind;
  itemId: string;
  pointerId: number;
  originStart: number;
  originEnd: number;
  anchorMinutes: number;
  currentStart: number;
  currentEnd: number;
  moved: boolean;
};

export type TimelineTimeOverride = {
  startMinutes: number;
  endMinutes: number;
};

function clientYToCanvasMinutes(
  clientY: number,
  scrollEl: HTMLElement,
  canvasEl: HTMLElement,
): number {
  const scrollRect = scrollEl.getBoundingClientRect();
  const yInContent = clientY - scrollRect.top + scrollEl.scrollTop;
  const yOnCanvas = yInContent - canvasEl.offsetTop;
  return pointerYToMinutes(yOnCanvas, 0);
}

export function useTimelineDrag(params: {
  enabled: boolean;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  getItemTimes: (id: string) => { startMinutes: number; endMinutes: number } | null;
  onCommit: (id: string, startMinutes: number, endMinutes: number) => Promise<void>;
  onDragComplete?: () => void;
}) {
  const { enabled, scrollRef, canvasRef, getItemTimes, onCommit, onDragComplete } =
    params;
  const dragRef = useRef<DragState | null>(null);
  const autoScrollRef = useRef<number | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Map<string, TimelineTimeOverride>>(
    new Map(),
  );

  const stopAutoScroll = useCallback(() => {
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  }, []);

  const runAutoScroll = useCallback(
    (clientY: number) => {
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;

      const rect = scrollEl.getBoundingClientRect();
      let velocity = 0;
      if (clientY < rect.top + AUTO_SCROLL_EDGE_PX) velocity = -AUTO_SCROLL_SPEED;
      else if (clientY > rect.bottom - AUTO_SCROLL_EDGE_PX) velocity = AUTO_SCROLL_SPEED;
      else {
        stopAutoScroll();
        return;
      }

      stopAutoScroll();
      const tick = () => {
        scrollEl.scrollTop += velocity;
        autoScrollRef.current = requestAnimationFrame(tick);
      };
      autoScrollRef.current = requestAnimationFrame(tick);
    },
    [scrollRef, stopAutoScroll],
  );

  const applyDrag = useCallback(
    (clientY: number) => {
      const drag = dragRef.current;
      const scrollEl = scrollRef.current;
      const canvasEl = canvasRef.current;
      if (!drag || !scrollEl || !canvasEl) return;

      drag.moved = true;
      const minutes = clientYToCanvasMinutes(clientY, scrollEl, canvasEl);
      const delta = minutes - drag.anchorMinutes;
      let start = drag.originStart;
      let end = drag.originEnd;

      if (drag.kind === "move") {
        const duration = drag.originEnd - drag.originStart;
        const moved = clampDurationMove(drag.originStart + delta, duration);
        start = moved.startMinutes;
        end = moved.endMinutes;
      } else if (drag.kind === "resize-start") {
        start = clampResizeStart(drag.originStart + delta, drag.originEnd);
        end = drag.originEnd;
      } else {
        start = drag.originStart;
        end = clampResizeEnd(drag.originStart, drag.originEnd + delta);
      }

      drag.currentStart = start;
      drag.currentEnd = end;

      setOverrides((prev) => {
        const next = new Map(prev);
        next.set(drag.itemId, { startMinutes: start, endMinutes: end });
        return next;
      });
    },
    [canvasRef, scrollRef],
  );

  const finishDrag = useCallback(async () => {
    const drag = dragRef.current;
    dragRef.current = null;
    stopAutoScroll();
    setDraggingId(null);

    if (!drag || !drag.moved) {
      return false;
    }

    const { itemId, currentStart, currentEnd } = drag;
    onDragComplete?.();

    try {
      await onCommit(itemId, currentStart, currentEnd);
    } finally {
      setOverrides((prev) => {
        const next = new Map(prev);
        next.delete(itemId);
        return next;
      });
    }
    return true;
  }, [onCommit, onDragComplete, stopAutoScroll]);

  const startDrag = useCallback(
    (kind: DragKind, itemId: string, e: React.PointerEvent) => {
      if (!enabled) return;
      const scrollEl = scrollRef.current;
      const canvasEl = canvasRef.current;
      if (!scrollEl || !canvasEl) return;

      const times = getItemTimes(itemId);
      if (!times) return;

      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

      const anchorMinutes = clientYToCanvasMinutes(e.clientY, scrollEl, canvasEl);

      dragRef.current = {
        kind,
        itemId,
        pointerId: e.pointerId,
        originStart: times.startMinutes,
        originEnd: times.endMinutes,
        anchorMinutes,
        currentStart: times.startMinutes,
        currentEnd: times.endMinutes,
        moved: false,
      };
      setDraggingId(itemId);
    },
    [enabled, canvasRef, scrollRef, getItemTimes],
  );

  const bindMove = useCallback(
    (itemId: string, e: React.PointerEvent) => {
      startDrag("move", itemId, e);
    },
    [startDrag],
  );

  const bindResize = useCallback(
    (itemId: string, edge: "start" | "end", e: React.PointerEvent) => {
      startDrag(edge === "start" ? "resize-start" : "resize-end", itemId, e);
    },
    [startDrag],
  );

  useEffect(() => {
    if (!enabled) return;

    function onPointerMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      applyDrag(e.clientY);
      runAutoScroll(e.clientY);
    }

    function onPointerUp(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      void finishDrag();
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      stopAutoScroll();
    };
  }, [enabled, applyDrag, finishDrag, runAutoScroll, stopAutoScroll]);

  const didDrag = useCallback(() => {
    return Boolean(dragRef.current?.moved);
  }, []);

  const clientYToMinutes = useCallback(
    (clientY: number) => {
      const scrollEl = scrollRef.current;
      const canvasEl = canvasRef.current;
      if (!scrollEl || !canvasEl) return 0;
      return clientYToCanvasMinutes(clientY, scrollEl, canvasEl);
    },
    [canvasRef, scrollRef],
  );

  return {
    draggingId,
    overrides,
    bindMove,
    bindResize,
    didDrag,
    clientYToMinutes,
  };
}
