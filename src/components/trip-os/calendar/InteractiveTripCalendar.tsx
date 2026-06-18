"use client";

import { useMemo, type ReactNode } from "react";
import { DateTime } from "luxon";

import {
  accommodationBandsForCalendarDay,
  accommodationLabelForCalendarDay,
  accommodationMorningHalfLabel,
  arrivalAccommodationLabel,
  departureAccommodationLabel,
  namedStayForLabel,
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
import { stayBandStyleForLabel } from "./cells/StayBand";
import type { CalendarSelection } from "./useCalendarSelection";
import type { HalfSide } from "@/lib/host/wizard/location-stays";
import { TripEyebrow } from "../shared/TripEyebrow";
import { useCalendarInitialScroll } from "./useCalendarScroll";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function InteractiveTripCalendar(props: {
  model: CalendarRenderModel;
  tripId: string;
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

  useCalendarInitialScroll({
    scrollRef: props.scrollRef,
    anchorDate: model.scrollAnchorDate,
    scrollKey: `${props.tripId}:${model.groupId}:${model.scrollAnchorDate}`,
    contentReady: weekSections.length > 0,
  });

  const namedStays = model.accommodationStays.filter((s) => s.name?.trim());

  function renderCell(cell: WeekCell) {
    if (cell.iso < model.todayIso) {
      return (
        <div
          key={cell.iso}
          className="min-h-[5.75rem] rounded-xl opacity-40"
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
    const accommodationLeftColors = accommodationBands.left
      ? stayBandStyleForLabel(
          namedStayForLabel(namedStays, accommodationBands.left, primaryCity) ?? {
            name: accommodationBands.left,
            cityLabel: primaryCity,
          },
        )
      : null;
    const accommodationRightColors = accommodationBands.right
      ? stayBandStyleForLabel(
          namedStayForLabel(namedStays, accommodationBands.right, secondaryCity) ?? {
            name: accommodationBands.right,
            cityLabel: secondaryCity || primaryCity,
          },
        )
      : null;
    const accommodationSingleColors =
      dayAccommodationLabel && !accommodationBands.leftOnly && !accommodationBands.rightOnly
        ? stayBandStyleForLabel(
            namedStayForLabel(namedStays, dayAccommodationLabel, primaryCity || secondaryCity) ?? {
              name: dayAccommodationLabel,
              cityLabel: primaryCity || secondaryCity,
            },
          )
        : null;

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
        isToday={cell.iso === model.todayIso}
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
        locationColorByKey={model.locationColorByKey}
        accommodationLeftColors={accommodationLeftColors}
        accommodationRightColors={accommodationRightColors}
        accommodationSingleColors={accommodationSingleColors}
        pendingFillHalf={props.pendingFillHalf}
        onDayClick={props.onDayClick}
        onTransportCorridorClick={props.onTransportCorridorClick}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <div className="shrink-0 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <TripEyebrow>Trip calendar</TripEyebrow>
            {props.statusLine ? (
              <p className="mt-1 text-xs text-zinc-500">{props.statusLine}</p>
            ) : (
              <p className="mt-1 text-xs text-zinc-400">All days from today — scroll to browse</p>
            )}
          </div>
          {props.headerAside}
        </div>
      </div>

      <div className="shrink-0 grid grid-cols-7 gap-1.5 px-3 pb-2">
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
      >
        {weekSections.map((section) => (
          <div key={section.key} className="mb-2 last:mb-0">
            {section.monthLabel ? (
              <p className="sticky top-0 z-10 mb-2 bg-white/80 px-1 py-1 text-xs font-semibold tracking-tight text-zinc-700 backdrop-blur-sm">
                {section.monthLabel}
              </p>
            ) : null}
            <div className="grid grid-cols-7 gap-1.5">
              {section.cells.map((cell, i) =>
                cell ? (
                  renderCell(cell)
                ) : (
                  <div key={`pad-${section.key}-${i}`} className="min-h-[5.75rem]" aria-hidden />
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
