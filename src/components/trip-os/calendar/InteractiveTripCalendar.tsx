"use client";

import { useMemo, type ReactNode } from "react";
import { DateTime } from "luxon";

import {
  accommodationBandsForCalendarDay,
  accommodationLabelForCalendarDay,
} from "@/lib/host/setup/accommodation-calendar";
import { weekStartMonday } from "@/lib/host/setup/calendar-bounds";
import { tripDayHasPaintableStaySlot } from "@/lib/host/wizard/transport-day-placement";
import type { CalendarRenderModel } from "@/lib/trip-engine/types";
import {
  emptyGridDay,
  isTripOsDayInteractive,
  tripContextFromModel,
} from "./calendar-day-utils";
import {
  buildScrollWeeks,
  planCalendarWeekSections,
  type WeekCell,
} from "./calendar-weeks";
import { TripOsDayCell } from "./cells/TripOsDayCell";
import type { CalendarSelection } from "./useCalendarSelection";
import type { HalfSide } from "@/lib/host/wizard/location-stays";
import { TripEyebrow } from "../shared/TripEyebrow";
import { useCalendarInitialScroll } from "./useCalendarScroll";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function InteractiveTripCalendar(props: {
  model: CalendarRenderModel;
  tripId: string;
  selection: CalendarSelection;
  onDayClick: (iso: string, half?: HalfSide) => boolean;
  pendingFillHalf: (iso: string) => HalfSide | "full" | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  headerAside?: ReactNode;
  statusLine?: string;
  onClearSelection?: () => void;
}) {
  const { model, selection } = props;
  const hasSelection = Boolean(selection.rangeStart);

  function handleEmptyAreaClick(e: React.MouseEvent<HTMLElement>) {
    if (!hasSelection || !props.onClearSelection) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-calendar-day-cell]")) return;
    if (target.closest("button, select, a, input, textarea, label, [role='dialog']")) return;
    props.onClearSelection();
  }
  const tripContext = useMemo(() => tripContextFromModel(model), [model]);

  const dayByDate = useMemo(() => new Map(model.days.map((d) => [d.date, d])), [model.days]);

  const weekSections = useMemo(() => {
    const first = DateTime.fromISO(model.gridStart);
    const last = DateTime.fromISO(model.gridEnd);
    if (!first.isValid || !last.isValid) return [];
    const rangeStart = weekStartMonday(first);
    const rangeEnd = weekStartMonday(last).plus({ days: 6 });
    const weeks = buildScrollWeeks(rangeStart, rangeEnd);
    return planCalendarWeekSections(weeks);
  }, [model.gridStart, model.gridEnd]);

  useCalendarInitialScroll({
    scrollRef: props.scrollRef,
    anchorDate: model.scrollAnchorDate,
    scrollKey: `${props.tripId}:${model.groupId}:${model.scrollAnchorDate}`,
    contentReady: weekSections.length > 0,
  });

  const namedStays = model.accommodationStays.filter((s) => s.name?.trim());

  function renderCell(cell: WeekCell) {
    const day = dayByDate.get(cell.iso) ?? emptyGridDay(cell.iso);
    const travelLayout = model.travelLayoutsByDate.get(cell.iso);
    const isHomeEdge = cell.iso === model.tripStart || cell.iso === model.tripEnd;
    const edgePaintable =
      isHomeEdge &&
      tripDayHasPaintableStaySlot(cell.iso, tripContext, travelLayout, day);
    const isInteractive = isTripOsDayInteractive({
      iso: cell.iso,
      model,
      day,
      travelSegments: travelLayout,
    });
    const primaryCity = day.primaryCity.trim();
    const secondaryCity = day.secondaryCity?.trim() ?? "";
    const accommodationBands = namedStays.length
      ? accommodationBandsForCalendarDay(cell.iso, day, namedStays, model.accommodationByDate)
      : {
          left: model.accommodationByDate.get(cell.iso) ?? null,
          right: null,
        };
    const dayAccommodationLabel =
      accommodationBands.leftOnly ||
      accommodationBands.rightOnly ||
      (accommodationBands.left && accommodationBands.right)
        ? null
        : primaryCity || secondaryCity
          ? namedStays.length
            ? accommodationLabelForCalendarDay(cell.iso, day, namedStays, model.accommodationByDate)
            : model.accommodationByDate.get(cell.iso) ?? null
          : accommodationBands.left ?? accommodationBands.right;

    return (
      <TripOsDayCell
        key={cell.iso}
        iso={cell.iso}
        dayNum={cell.day}
        day={day}
        tripDayPlaces={model.days}
        isSelectable={isInteractive}
        isHomeEdge={isHomeEdge && !edgePaintable}
        isToday={cell.iso === model.todayIso}
        accommodationLabel={dayAccommodationLabel}
        accommodationLeftLabel={accommodationBands.left}
        accommodationRightLabel={accommodationBands.right}
        accommodationLeftOnly={accommodationBands.leftOnly}
        accommodationRightOnly={accommodationBands.rightOnly}
        activities={model.activitiesByDate.get(cell.iso) ?? []}
        selection={selection}
        locationColorByKey={model.locationColorByKey}
        pendingFillHalf={props.pendingFillHalf}
        onDayClick={props.onDayClick}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <div className="shrink-0 px-4 py-3" onClick={handleEmptyAreaClick}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <TripEyebrow>Trip calendar</TripEyebrow>
            {props.statusLine ? (
              <p className="mt-1 text-xs text-zinc-500">{props.statusLine}</p>
            ) : (
              <p className="mt-1 text-xs text-zinc-400">Scroll to browse the full trip</p>
            )}
          </div>
          {props.headerAside}
        </div>
      </div>

      <div
        className="shrink-0 grid grid-cols-7 gap-1.5 px-3 pb-2"
        onClick={handleEmptyAreaClick}
      >
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-medium uppercase tracking-wider text-zinc-400"
          >
            {d}
          </div>
        ))}
      </div>

      <div
        ref={props.scrollRef}
        className="trip-os-calendar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3"
        onClick={handleEmptyAreaClick}
      >
        {weekSections.map((section) => (
          <div key={section.key} className="mb-2 last:mb-0">
            {section.monthLabel ? (
              <p className="sticky top-0 z-10 mb-2 bg-white/80 px-1 py-1 text-xs font-semibold tracking-tight text-zinc-700 backdrop-blur-sm">
                {section.monthLabel}
              </p>
            ) : null}
            <div className="grid grid-cols-7 gap-1.5" onClick={handleEmptyAreaClick}>
              {section.cells.map((cell, i) =>
                cell ? (
                  renderCell(cell)
                ) : (
                  <div
                    key={`pad-${section.key}-${i}`}
                    className="min-h-[5.75rem]"
                    aria-hidden={!hasSelection}
                    onClick={hasSelection ? props.onClearSelection : undefined}
                  />
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
