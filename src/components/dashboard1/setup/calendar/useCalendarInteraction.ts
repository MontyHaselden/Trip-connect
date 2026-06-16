"use client";

import { useCallback, useRef, useState } from "react";

import {
  EMPTY_CALENDAR_SELECTION,
  nextCalendarRangeSelection,
  type CalendarRangeSelection,
} from "@/lib/host/setup/calendar-range-selection";
import {
  findTransportLegForCalendarClick,
  transportLegDateSpan,
} from "@/lib/host/setup/transport-block-selection";
import type { NightBoundary } from "@/lib/host/setup/stay-boundaries";
import {
  moveNightBoundary,
  syncIntercityLegsForBoundaryMove,
} from "@/lib/host/setup/stay-boundaries";
import type { CalendarRenderModel } from "@/lib/trip-engine/types";
import type { TripEntityGraph } from "@/lib/trip-engine/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { formatCalendarSelectionLabel } from "@/lib/host/setup/night-pair-selection";
import type { HalfSide } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

export type CalendarIntent = "location" | "stay" | "transport" | "activity" | null;

export type CalendarSelection = CalendarRangeSelection & {
  intent?: CalendarIntent;
};

export type MiddleView = "section" | "day";

function emptySelection(): CalendarSelection {
  return { ...EMPTY_CALENDAR_SELECTION, intent: undefined };
}

export function useCalendarInteraction(props: {
  graph: TripEntityGraph | null;
  renderModel: CalendarRenderModel | null;
  groupId: string;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
  onOpenDayView: () => void;
  onOpenSectionView: () => void;
}) {
  const [selection, setSelection] = useState<CalendarSelection>(emptySelection());
  const [pinnedScrollDate, setPinnedScrollDate] = useState<string | null>(null);
  const scrollAnchorRef = useRef<string>("");

  const clearSelection = useCallback(() => {
    setSelection(emptySelection());
    props.onOpenSectionView();
  }, [props]);

  const pendingFillHalf = useCallback(
    (iso: string): HalfSide | "full" | null => {
      const { rangeStart, rangeEnd, startHalf, endHalf } = selection;
      if (!rangeStart) return null;
      const end = rangeEnd || rangeStart;
      if (iso < rangeStart || iso > end) return null;
      if (iso === rangeStart && iso === end) return startHalf;
      if (iso === rangeStart) return startHalf;
      if (iso === end) return endHalf;
      return "full";
    },
    [selection],
  );

  const onDayClick = useCallback(
    (iso: string, half?: HalfSide, options?: { transportClick?: boolean }): boolean => {
      if (!props.renderModel) return false;
      const { gridStart, gridEnd, days } = props.renderModel;
      setPinnedScrollDate(null);

      if (iso < gridStart || iso > gridEnd) {
        if (selection.rangeStart) clearSelection();
        return false;
      }

      const day = days.find((d) => d.date === iso);

      if (options?.transportClick && props.graph) {
        const leg = findTransportLegForCalendarClick(props.graph, iso, day);
        const span = leg ? transportLegDateSpan(leg) : null;
        if (span) {
          setSelection({
            rangeStart: span.start,
            rangeEnd: span.end,
            startHalf: "full",
            endHalf: "full",
            intent: "transport",
          });
          props.onOpenDayView();
          return true;
        }
      }

      if (half) {
        const end = selection.rangeEnd || selection.rangeStart;
        if (selection.rangeStart && iso > end) {
          setSelection({
            rangeStart: selection.rangeStart,
            rangeEnd: iso,
            startHalf: selection.startHalf,
            endHalf: half,
            intent: selection.intent,
          });
          props.onOpenDayView();
          return true;
        }
        if (selection.rangeStart && iso < selection.rangeStart) {
          setSelection({
            rangeStart: iso,
            rangeEnd: end,
            startHalf: half,
            endHalf: selection.endHalf,
            intent: selection.intent,
          });
          props.onOpenDayView();
          return true;
        }

        const halfSelection = {
          rangeStart: iso,
          rangeEnd: iso,
          startHalf: half,
          endHalf: half,
        };
        const sameHalf =
          selection.rangeStart === halfSelection.rangeStart &&
          selection.rangeEnd === halfSelection.rangeEnd &&
          selection.startHalf === halfSelection.startHalf &&
          selection.endHalf === halfSelection.endHalf;
        if (sameHalf) {
          clearSelection();
          return false;
        }
        setSelection({ ...halfSelection, intent: selection.intent });
        props.onOpenDayView();
        return true;
      }

      const { selection: next, selected } = nextCalendarRangeSelection(selection, iso);
      if (selected) {
        setSelection({ ...next, intent: selection.intent });
        props.onOpenDayView();
        return true;
      }
      clearSelection();
      return false;
    },
    [props, selection, clearSelection],
  );

  const selectTransferDay = useCallback(
    (iso: string) => {
      setSelection({
        rangeStart: iso,
        rangeEnd: iso,
        startHalf: "full",
        endHalf: "full",
        intent: "transport",
      });
      props.onOpenDayView();
    },
    [props],
  );

  const scrollToDate = useCallback((iso: string) => {
    if (!iso.trim()) return;
    scrollAnchorRef.current = iso;
    setPinnedScrollDate(iso);
  }, []);

  const commitBoundaryMove = useCallback(
    async (boundaryId: string, deltaDays: -1 | 1) => {
      if (!props.graph || !props.renderModel) return;
      const boundary = props.renderModel.boundaries.find((b) => b.id === boundaryId);
      if (!boundary) return;

      const stays = props.renderModel.accommodationStays;
      const moved = moveNightBoundary(boundary, deltaDays, stays);
      if (moved === stays) return;

      const syncedLegs = syncIntercityLegsForBoundaryMove(
        boundary,
        deltaDays,
        props.graph.intercityLegs,
        moved,
      );

      const commands: TripCommand[] = [];
      for (const stay of moved) {
        const prev = stays.find((s) => s.id === stay.id);
        if (prev && (prev.checkInDate !== stay.checkInDate || prev.checkOutDate !== stay.checkOutDate)) {
          commands.push({
            type: "updateStay",
            groupId: props.groupId,
            stayId: stay.id,
            patch: { checkInDate: stay.checkInDate, checkOutDate: stay.checkOutDate },
          });
        }
      }
      for (const leg of syncedLegs) {
        const prev = props.graph.intercityLegs.find((l) => l.id === leg.id);
        if (prev && prev.travelDate !== leg.travelDate) {
          commands.push({
            type: "updateTransportLeg",
            groupId: props.groupId,
            bucket: "intercity",
            legId: leg.id,
            patch: { travelDate: leg.travelDate },
          });
        }
      }
      if (commands.length) await props.onDispatch(commands);
    },
    [props],
  );

  const statusLine = selection.rangeStart
    ? `Selected ${formatCalendarSelectionLabel(selection)}`
    : "Click days for a range, or a half on split days for that portion only";

  return {
    selection,
    setSelection,
    clearSelection,
    onDayClick,
    selectTransferDay,
    pendingFillHalf,
    scrollToDate,
    pinnedScrollDate,
    scrollAnchorDate: pinnedScrollDate ?? props.renderModel?.scrollAnchorDate ?? "",
    commitBoundaryMove,
    statusLine,
  };
}

export function daysInSelection(
  selection: CalendarSelection,
  days: DayPlaceDraft[],
): DayPlaceDraft[] {
  if (!selection.rangeStart) return [];
  const end = selection.rangeEnd || selection.rangeStart;
  return days.filter((d) => d.date >= selection.rangeStart && d.date <= end);
}

export function boundariesForSelection(
  selection: CalendarSelection,
  boundaries: NightBoundary[],
): NightBoundary[] {
  if (!selection.rangeStart) return [];
  const end = selection.rangeEnd || selection.rangeStart;
  return boundaries.filter((b) => b.date >= selection.rangeStart && b.date <= end);
}
