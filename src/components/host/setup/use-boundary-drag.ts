"use client";

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

import { consumeBoundaryDragDelta } from "@/lib/host/setup/boundary-drag-step";
import type { NightBoundary } from "@/lib/host/setup/stay-boundaries";
import { addDays } from "@/lib/host/wizard/location-stays";

const DEFAULT_CELL_WIDTH_PX = 100;

function dayCellWidthFromGrip(grip: HTMLElement): number {
  const cell = grip.closest<HTMLElement>("[data-calendar-day]");
  const width = cell?.getBoundingClientRect().width;
  return width && width > 0 ? width : DEFAULT_CELL_WIDTH_PX;
}

/** Pointer session for night-boundary drags — steps by chronological day, not grid row. */
export function useBoundaryDrag(options: {
  onBoundaryMove: (boundaryId: string, deltaDays: -1 | 1) => void;
  /** Fired on pointer up when the grip was tapped, not dragged. */
  onBoundaryTap?: (boundaryId: string) => void;
  enabled?: boolean;
}) {
  const sessionRef = useRef<{
    boundaryId: string;
    date: string;
    pointerId: number;
    cellWidth: number;
    accumX: number;
    lastClientX: number;
    lastClientY: number;
    moved: boolean;
  } | null>(null);
  const onMoveRef = useRef(options.onBoundaryMove);
  onMoveRef.current = options.onBoundaryMove;
  const onTapRef = useRef(options.onBoundaryTap);
  onTapRef.current = options.onBoundaryTap;

  const startBoundaryDrag = useCallback(
    (boundary: NightBoundary, e: React.PointerEvent) => {
      if (options.enabled === false) return;
      e.stopPropagation();
      e.preventDefault();
      sessionRef.current = {
        boundaryId: boundary.id,
        date: boundary.date,
        pointerId: e.pointerId,
        cellWidth: dayCellWidthFromGrip(e.currentTarget as HTMLElement),
        accumX: 0,
        lastClientX: e.clientX,
        lastClientY: e.clientY,
        moved: false,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [options.enabled],
  );

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const session = sessionRef.current;
      if (!session || e.pointerId !== session.pointerId) return;

      const deltaX = e.clientX - session.lastClientX;
      const deltaY = e.clientY - session.lastClientY;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        e.preventDefault();
      }

      const { steps, accumX } = consumeBoundaryDragDelta(
        session.accumX,
        deltaX,
        session.cellWidth,
      );

      if (steps.length) {
        let date = session.date;
        for (const step of steps) {
          onMoveRef.current(session.boundaryId, step);
          date = addDays(date, step);
        }
        sessionRef.current = {
          ...session,
          date,
          accumX,
          lastClientX: e.clientX,
          lastClientY: e.clientY,
          moved: true,
        };
        return;
      }

      sessionRef.current = {
        ...session,
        accumX,
        lastClientX: e.clientX,
        lastClientY: e.clientY,
      };
    }

    function endDrag(e: PointerEvent) {
      const session = sessionRef.current;
      if (!session || e.pointerId !== session.pointerId) return;
      if (!session.moved) {
        onTapRef.current?.(session.boundaryId);
      }
      sessionRef.current = null;
    }

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, []);

  return { startBoundaryDrag };
}
