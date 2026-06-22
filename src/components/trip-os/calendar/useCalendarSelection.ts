"use client";

import { useCallback, useState } from "react";

import {
  EMPTY_CALENDAR_SELECTION,
  expandHalfSelectionToFullDay,
  nextCalendarRangeSelection,
  type CalendarRangeSelection,
} from "@/lib/host/setup/calendar-range-selection";
import {
  formatCalendarSelectionLabel,
} from "@/lib/host/setup/night-pair-selection";
import {
  findTransportLegForCalendarClick,
  transportLegDateSpan,
} from "@/lib/host/setup/transport-block-selection";
import type { NightBoundary } from "@/lib/host/setup/stay-boundaries";
import type { HalfSide } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import type { CalendarRenderModel, TripEntityGraph } from "@/lib/trip-engine/types";

import { emptyGridDay, isTripOsDayInteractive } from "./calendar-day-utils";

export type CalendarIntent = "location" | "stay" | "transport" | "activity" | null;

export type CalendarSelection = CalendarRangeSelection & {
  intent?: CalendarIntent;
};

export type MiddleView = "section" | "day";

function emptySelection(): CalendarSelection {
  return { ...EMPTY_CALENDAR_SELECTION, intent: undefined };
}

export function useCalendarSelection(props: {
  graph: TripEntityGraph | null;
  renderModel: CalendarRenderModel | null;
  groupId: string;
  onDispatch: (commands: TripCommand[]) => Promise<boolean>;
  onOpenDayView: () => void;
  onOpenSectionView: () => void;
  saveScrollPosition: () => void;
}) {
  const [selection, setSelection] = useState<CalendarSelection>(emptySelection());

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
      const { interactionStart, gridEnd, days } = props.renderModel;
      props.saveScrollPosition();

      if (iso < interactionStart || iso > gridEnd) {
        if (selection.rangeStart) clearSelection();
        return false;
      }

      const day = days.find((d) => d.date === iso) ?? emptyGridDay(iso);
      const travelSegments = props.renderModel.travelLayoutsByDate.get(iso);

      if (
        !isTripOsDayInteractive({
          iso,
          model: props.renderModel,
          day,
          travelSegments,
        })
      ) {
        if (selection.rangeStart) clearSelection();
        return false;
      }

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
        const expanded = expandHalfSelectionToFullDay(selection, iso, half);
        if (expanded) {
          setSelection({ ...expanded, intent: selection.intent });
          props.onOpenDayView();
          return true;
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
      props.saveScrollPosition();
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

  const statusLine = selection.rangeStart
    ? `Selected ${formatCalendarSelectionLabel(selection)}`
    : props.renderModel?.datesUnset
      ? "Scroll to browse and paint days"
      : "Click days for a range, or a half on split days";

  return {
    selection,
    clearSelection,
    onDayClick,
    selectTransferDay,
    pendingFillHalf,
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
