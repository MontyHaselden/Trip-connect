"use client";

import { useMemo, type ReactNode } from "react";
import { DateTime } from "luxon";

import {
  accommodationBandsForCalendarDay,
  accommodationLabelForCalendarDay,
  accommodationMorningHalfLabel,
  arrivalAccommodationLabel,
  departureAccommodationLabel,
} from "@/lib/host/setup/accommodation-calendar";
import { isAccommodationCrossoverDay } from "@/lib/host/setup/transport-corridor";
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

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function InteractiveTripCalendar(props: {
  model: CalendarRenderModel;
  selection: CalendarSelection;
  onDayClick: (iso: string, half?: HalfSide, options?: { transportClick?: boolean }) => boolean;
  onTransportCorridorClick?: (date: string) => void;
  pendingFillHalf: (iso: string) => HalfSide | "full" | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  headerAside?: ReactNode;
  statusLine?: string;
}) {
  const { model, selection } = props;
  const tripContext = useMemo(() => tripContextFromModel(model), [model]);

  const dayByDate = useMemo(() => new Map(model.days.map((d) => [d.date, d])), [model.days]);
  const baseDayByDate = useMemo(
    () => new Map((model.baseDays ?? []).map((d) => [d.date, d])),
    [model.baseDays],
  );

  const weekSections = useMemo(() => {
    const first = DateTime.fromISO(model.gridStart);
    const last = DateTime.fromISO(model.gridEnd);
    if (!first.isValid || !last.isValid) return [];
    const rangeStart = weekStartMonday(first);
    const rangeEnd = weekStartMonday(last).plus({ days: 6 });
    const weeks = buildScrollWeeks(rangeStart, rangeEnd);
    return planCalendarWeekSections(weeks).filter((section) =>
      section.cells.some((cell) => cell && cell.iso >= model.todayIso),
    );
  }, [model.gridStart, model.gridEnd, model.todayIso]);

  const namedStays = model.accommodationStays.filter((s) => s.name?.trim());

  function renderCell(cell: WeekCell) {
    if (cell.iso < model.todayIso) {
      return (
        <div
          key={cell.iso}
          className="min-h-[5.5rem] border-b border-r border-zinc-100 bg-zinc-50/40"
          aria-hidden
        />
      );
    }

    const day = dayByDate.get(cell.iso) ?? emptyGridDay(cell.iso);
    const travelLayout = model.travelLayoutsByDate.get(cell.iso);
    const transitOverlays = model.transitByDate.get(cell.iso) ?? [];
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
    const corridorDepartureAcco = namedStays.length
      ? departureAccommodationLabel(cell.iso, primaryCity, namedStays) ??
        model.accommodationByDate.get(cell.iso) ??
        accommodationMorningHalfLabel(cell.iso, namedStays) ??
        null
      : model.accommodationByDate.get(cell.iso) ?? null;
    const corridorArrivalAcco = namedStays.length
      ? arrivalAccommodationLabel(cell.iso, secondaryCity, namedStays)
      : model.accommodationByDate.get(cell.iso) ?? null;
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
    const showTransportCorridor = isAccommodationCrossoverDay(
      day,
      model.accommodationByDate,
      tripContext,
      namedStays,
    );

    return (
      <TripOsDayCell
        key={cell.iso}
        iso={cell.iso}
        dayNum={cell.day}
        day={day}
        baseDay={baseDayByDate.get(cell.iso)}
        overlayKind={model.overlayMetaByDate.get(cell.iso)}
        isSelectable={isInteractive}
        isHomeEdge={isHomeEdge && !edgePaintable}
        travelSegments={travelLayout}
        transitOverlays={transitOverlays}
        accommodationLabel={dayAccommodationLabel}
        accommodationLeftLabel={accommodationBands.left}
        accommodationRightLabel={accommodationBands.right}
        accommodationLeftOnly={accommodationBands.leftOnly}
        accommodationRightOnly={accommodationBands.rightOnly}
        corridorDepartureAcco={corridorDepartureAcco}
        corridorArrivalAcco={corridorArrivalAcco}
        showTransportCorridor={showTransportCorridor}
        activities={model.activitiesByDate.get(cell.iso) ?? []}
        selection={selection}
        pendingFillHalf={props.pendingFillHalf}
        onDayClick={props.onDayClick}
        onTransportCorridorClick={props.onTransportCorridorClick}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <div className="shrink-0 border-b border-zinc-200 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">Trip calendar</p>
            {props.statusLine ? (
              <p className="text-xs text-zinc-500">{props.statusLine}</p>
            ) : null}
          </div>
          {props.headerAside}
        </div>
      </div>

      <div className="shrink-0 grid grid-cols-7 border-b border-zinc-200 bg-zinc-50">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-1 py-1 text-center text-[10px] font-medium text-zinc-500">
            {d}
          </div>
        ))}
      </div>

      <div ref={props.scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-2">
        {weekSections.map((section) => (
          <div
            key={section.key}
            className={[
              "mb-1 last:mb-0",
              section.monthBreakBefore ? "mt-3 border-t border-zinc-200/80 pt-3" : "",
            ].join(" ")}
          >
            {section.monthLabel ? (
              <p className="mb-1.5 px-2 text-xs font-semibold text-zinc-700">{section.monthLabel}</p>
            ) : null}
            <div className="grid grid-cols-7">
              {section.cells.map((cell, i) =>
                cell ? (
                  renderCell(cell)
                ) : (
                  <div
                    key={`pad-${section.key}-${i}`}
                    className="min-h-[5.5rem] border-b border-r border-zinc-100"
                    aria-hidden
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
