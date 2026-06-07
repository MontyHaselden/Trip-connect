"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";

import { isDividerDraggable } from "@/lib/host/wizard/crossover-adjust";
import {
  locationBorderColor,
  locationColor,
  locationTextColor,
  DEFAULT_HALF_SHARE,
  type HalfSide,
} from "@/lib/host/wizard/location-stays";
import {
  hasAfternoonDepartureTravel,
  mergeTravelWithPaintedStay,
  isCalendarDaySelectable,
  travelLayoutBlocksPainting,
  travelLayoutMorningPaintEnd,
  travelLayoutPaintStart,
  travelLayoutSummary,
  tripDayHasPaintableStaySlot,
  type CalendarDaySegment,
  type TransitOverlay,
} from "@/lib/host/wizard/transport-day-placement";
import {
  isAirportRouteLabel,
  parseAirportRouteLabel,
} from "@/lib/geo/airport-codes";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKS_PER_WINDOW = 6;

type WeekCell = { iso: string; day: number; monthKey: string };

/** Monday-based week start (matches WEEKDAYS). */
function weekStartMonday(dt: DateTime): DateTime {
  return dt.minus({ days: (dt.weekday + 6) % 7 }).startOf("day");
}

function buildScrollWeeks(rangeStart: DateTime, rangeEnd: DateTime): WeekCell[][] {
  const weeks: WeekCell[][] = [];
  let cursor = weekStartMonday(rangeStart);
  const lastWeekStart = weekStartMonday(rangeEnd);

  while (cursor <= lastWeekStart) {
    const week: WeekCell[] = [];
    for (let i = 0; i < 7; i++) {
      const d = cursor.plus({ days: i });
      const iso = d.toISODate();
      if (!iso) continue;
      week.push({
        iso,
        day: d.day,
        monthKey: d.toFormat("yyyy-MM"),
      });
    }
    weeks.push(week);
    cursor = cursor.plus({ weeks: 1 });
  }

  return weeks;
}

function monthHeaderForWeek(week: WeekCell[], isFirstWeek: boolean): string | null {
  if (isFirstWeek) {
    const first = DateTime.fromISO(week[0]!.iso);
    return first.toFormat("LLLL yyyy");
  }
  const firstOfMonth = week.find((c) => c.day === 1);
  if (!firstOfMonth) return null;
  return DateTime.fromISO(firstOfMonth.iso).toFormat("LLLL yyyy");
}

function weekIndexForDate(weeks: WeekCell[][], iso: string): number {
  return weeks.findIndex((week) => week.some((c) => c.iso === iso));
}

function windowStartForWeekIndex(weekIndex: number, totalWeeks: number): number {
  const maxStart = Math.max(0, totalWeeks - WEEKS_PER_WINDOW);
  if (weekIndex < 0) return 0;
  const centered = weekIndex - 2;
  return Math.max(0, Math.min(maxStart, centered));
}

function formatWindowRange(weeks: WeekCell[][]): string {
  if (!weeks.length) return "";
  const firstWeek = weeks[0]!;
  const lastWeek = weeks[weeks.length - 1]!;
  const first = DateTime.fromISO(firstWeek[0]!.iso);
  const lastIso = lastWeek[6]?.iso ?? lastWeek[lastWeek.length - 1]!.iso;
  const last = DateTime.fromISO(lastIso);
  if (!first.isValid || !last.isValid) return "";
  if (first.toFormat("MMM yyyy") === last.toFormat("MMM yyyy")) {
    return `${first.toFormat("d")} – ${last.toFormat("d MMM yyyy")}`;
  }
  return `${first.toFormat("d MMM")} – ${last.toFormat("d MMM yyyy")}`;
}

/** Below this share of the cell width, segment labels are hidden (tooltip only). */
const MIN_LABEL_SHARE = 0.18;
const TRAVEL_QUARTER = 0.25;

function shortCity(name: string, maxLen = 11): string {
  const trimmed = name.trim();
  const cityOnly = trimmed.split(",")[0]?.trim() || trimmed;
  if (cityOnly.length <= maxLen) return cityOnly;
  return `${cityOnly.slice(0, maxLen - 1)}…`;
}

function shortTransitLabel(label: string, widthShare: number): string | null {
  if (isAirportRouteLabel(label)) {
    return widthShare >= 0.35 ? label : null;
  }
  if (widthShare >= 0.45) return label;
  const arrowMatch = /→\s*([^(]+)/.exec(label);
  if (arrowMatch?.[1]) return `→ ${arrowMatch[1].trim()}`;
  if (label.length <= 12) return label;
  return widthShare < 0.28 ? "Fly" : label.slice(0, 11) + "…";
}

function citySegmentLabel(city: string, widthShare: number): string {
  const maxLen = widthShare < 0.28 ? 8 : widthShare < 0.35 ? 10 : widthShare < 0.5 ? 14 : 18;
  return shortCity(city, maxLen);
}

function segmentLabel(segment: CalendarDaySegment, widthShare: number): string | null {
  if (widthShare < MIN_LABEL_SHARE) return null;
  if (segment.kind === "city") {
    return citySegmentLabel(segment.city, widthShare);
  }
  return shortTransitLabel(segment.label, widthShare);
}

function AirportRouteStack({ codes }: { codes: string[] }) {
  return (
    <div className="flex flex-col items-center justify-center gap-px py-1">
      {codes.map((code, i) => (
        <span key={`${code}-${i}`} className="text-[8px] font-bold leading-none text-zinc-700">
          {code}
        </span>
      ))}
    </div>
  );
}

function segmentTitle(segment: CalendarDaySegment): string {
  return segment.kind === "city" ? segment.city.trim() : segment.label;
}

function TravelSegments({ segments }: { segments: CalendarDaySegment[] }) {
  return (
    <>
      {segments.map((segment, i) => {
        const widthShare = segment.end - segment.start;
        const width = widthShare * 100;
        const left = segment.start * 100;
        const label = segmentLabel(segment, widthShare);
        const title = segmentTitle(segment);
        const airportCodes =
          segment.kind === "transit" ? parseAirportRouteLabel(segment.label) : [];
        const showAirportStack = airportCodes.length >= 2 && widthShare <= TRAVEL_QUARTER + 0.02;
        const narrowCity = segment.kind === "city" && widthShare <= TRAVEL_QUARTER + 0.02;

        if (segment.kind === "city") {
          return (
            <div
              key={`seg-${i}`}
              className={[
                "absolute inset-y-0 flex overflow-hidden px-0.5 pt-6",
                narrowCity ? "items-center justify-center pb-1" : "items-end pb-1.5",
              ].join(" ")}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: locationColor(segment.city),
                borderRight:
                  i < segments.length - 1
                    ? `2px solid ${locationBorderColor(segment.city)}`
                    : undefined,
              }}
              title={title}
            >
              {label ? (
                <span
                  className={[
                    "font-semibold leading-tight tracking-tight",
                    narrowCity ? "text-[9px]" : "truncate text-[10px]",
                  ].join(" ")}
                  style={{ color: locationTextColor(segment.city) }}
                >
                  {label}
                </span>
              ) : null}
            </div>
          );
        }
        return (
          <div
            key={`seg-${i}`}
            className="pointer-events-none absolute inset-y-0 z-[15] flex items-center justify-center overflow-hidden border-x border-zinc-400/50 bg-zinc-300/85 px-0.5 pt-5"
            style={{ left: `${left}%`, width: `${width}%` }}
            title={title}
            aria-hidden
          >
            {showAirportStack ? (
              <AirportRouteStack codes={airportCodes} />
            ) : label ? (
              <span className="truncate px-0.5 text-center text-[9px] font-semibold text-zinc-600">
                {label}
              </span>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function DayCell({
  day,
  travelSegments,
  transitOverlays,
  isSelectable,
  isInPendingRange,
  pendingFillHalf,
  isRangeStart,
  isRangeEnd,
  isHomeEdge,
  crossoverAdjustable,
  onSelect,
  onShareChange,
  compact = false,
}: {
  day: DayPlaceDraft | null;
  travelSegments?: CalendarDaySegment[];
  transitOverlays: TransitOverlay[];
  isSelectable: boolean;
  isInPendingRange: boolean;
  pendingFillHalf: HalfSide | "full" | null;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isHomeEdge: boolean;
  crossoverAdjustable: boolean;
  onSelect?: () => void;
  onShareChange?: (share: number) => void;
  compact?: boolean;
}) {
  const cellRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragStartX = useRef(0);

  const primary = day?.primaryCity.trim() ?? "";
  const secondary = day?.secondaryCity?.trim() ?? "";
  const share = day?.primaryShare ?? 1;
  const displayShare = share;
  const secondaryOnly = Boolean(secondary && !primary && share < 1);
  const isBuffer = day?.dayType === "buffer";
  const isLocked = isBuffer || isHomeEdge;
  const hasTravelLayout = Boolean(travelSegments?.length);
  const hasFullStayDay = Boolean(primary) && !secondary && displayShare >= 1;
  const activeTravelSegments = hasFullStayDay ? undefined : travelSegments;
  const { segments: displayTravelSegments, hideMergedStayCity } = mergeTravelWithPaintedStay(
    activeTravelSegments,
    day,
  );
  const layoutSegments = displayTravelSegments ?? activeTravelSegments;
  const travelPaintStart = travelLayoutPaintStart(layoutSegments);
  const travelMorningEnd = travelLayoutMorningPaintEnd(layoutSegments);
  const travelBlocksPainting = travelLayoutBlocksPainting(layoutSegments);
  const showStayPaint = !travelBlocksPainting && !hideMergedStayCity;
  const hasAfternoonTravelPaint =
    hasTravelLayout && travelPaintStart > 0 && travelPaintStart < 1;
  const hasAfternoonDepartureOnly =
    hasTravelLayout && hasAfternoonDepartureTravel(layoutSegments);
  const hasMorningTravelPaint =
    hasTravelLayout && travelMorningEnd > 0 && travelMorningEnd < 1;
  const hasPartialTravelPaint =
    hasAfternoonTravelPaint || hasMorningTravelPaint || hasAfternoonDepartureOnly;
  const resolvedFillHalf: HalfSide | "full" | null =
    pendingFillHalf === "full" && hasAfternoonTravelPaint
      ? "right"
      : pendingFillHalf === "full" && hasMorningTravelPaint
        ? "left"
        : pendingFillHalf === "full" && hasAfternoonDepartureOnly
          ? "left"
          : pendingFillHalf;
  const selectionPaintStart =
    resolvedFillHalf === "right" && hasAfternoonTravelPaint
      ? travelPaintStart
      : resolvedFillHalf === "right"
        ? displayShare
        : 0;
  const leftPendingWidth =
    resolvedFillHalf === "left" && hasMorningTravelPaint && !primary
      ? travelMorningEnd
      : resolvedFillHalf === "left" && hasAfternoonDepartureOnly && !primary
        ? DEFAULT_HALF_SHARE
        : displayShare;
  const isSplit = Boolean(primary && (secondary || share < 1));
  const hasTransit = transitOverlays.length > 0;
  const travelSummary = travelLayoutSummary(displayTravelSegments ?? travelSegments);
  const isEmpty =
    showStayPaint &&
    !primary &&
    !secondary &&
    !hasTransit &&
    (!hasTravelLayout || travelPaintStart < 1 || hasMorningTravelPaint);
  const isHalfPending =
    isInPendingRange && (resolvedFillHalf === "left" || resolvedFillHalf === "right");
  const draggableDivider = showStayPaint && crossoverAdjustable && Boolean(onShareChange);

  useEffect(() => {
    const onShare = onShareChange;
    if (!draggableDivider || !onShare) return;

    function finishDrag(clientX: number) {
      const el = cellRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const delta = clientX - dragStartX.current;
      const ratio = 0.5 + delta / rect.width;
      onShare?.(Math.min(0.95, Math.max(0.05, ratio)));
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging.current) return;
      e.preventDefault();
    }

    function onPointerUp(e: PointerEvent) {
      if (!dragging.current) return;
      dragging.current = false;
      finishDrag(e.clientX);
    }

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [draggableDivider, onShareChange]);

  return (
    <div
      ref={cellRef}
      className={[
        "group relative w-full overflow-hidden rounded-xl border transition-all duration-150",
        compact ? "h-[4.25rem]" : "h-[6rem]",
        isBuffer
          ? "border-dashed border-zinc-300 bg-zinc-100/80 opacity-90"
          : isHomeEdge
            ? "border-zinc-300 bg-zinc-50/90"
            : isInPendingRange && isEmpty && !hasPartialTravelPaint
              ? "border-indigo-950 bg-indigo-900 shadow-sm"
              : isInPendingRange && !isHalfPending && !hasPartialTravelPaint
                ? "border-indigo-800 bg-white shadow-sm ring-2 ring-inset ring-indigo-900/70"
                : "border-zinc-200/90 bg-white shadow-sm",
        !isHalfPending &&
        !hasPartialTravelPaint &&
        (isRangeStart || isRangeEnd)
          ? "ring-2 ring-indigo-300 ring-offset-1"
          : "",
        isSelectable && !isBuffer ? "cursor-pointer hover:opacity-95" : "",
        isBuffer || isHomeEdge ? "cursor-default" : "",
      ].join(" ")}
      onClick={() => onSelect?.()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect?.();
      }}
      role="button"
      tabIndex={0}
      title={travelSummary || undefined}
    >
      {hasTravelLayout && displayTravelSegments ? (
        <TravelSegments segments={displayTravelSegments} />
      ) : null}
      {showStayPaint && primary ? (
        <div
          className="absolute inset-y-0 left-0 flex items-end overflow-hidden px-1.5 pb-1.5 pt-6"
          style={{
            width: `${displayShare * 100}%`,
            backgroundColor: locationColor(primary),
            borderRight: isSplit
              ? `2px solid ${isHomeEdge ? "#a1a1aa" : locationBorderColor(primary)}`
              : undefined,
          }}
        >
          <span
            className="truncate text-[10px] font-semibold leading-tight tracking-tight"
            title={primary}
            style={{ color: locationTextColor(primary) }}
          >
            {shortCity(primary)}
          </span>
        </div>
      ) : null}
      {showStayPaint && secondary ? (
        <div
          className={[
            "absolute inset-y-0 flex items-end overflow-hidden px-1.5 pb-1.5 pt-6",
            secondaryOnly ? "" : "right-0 justify-end",
          ].join(" ")}
          style={{
            ...(secondaryOnly
              ? { left: `${displayShare * 100}%`, width: `${(1 - displayShare) * 100}%` }
              : { width: `${(1 - displayShare) * 100}%` }),
            backgroundColor: locationColor(secondary),
          }}
        >
          <span
            className="truncate text-right text-[10px] font-semibold leading-tight tracking-tight"
            title={secondary}
            style={{ color: locationTextColor(secondary) }}
          >
            {shortCity(secondary)}
          </span>
        </div>
      ) : showStayPaint && primary && share < 1 ? (
        <div
          className="absolute inset-y-0 right-0 bg-gradient-to-br from-zinc-50 to-zinc-100/90"
          style={{ width: `${(1 - share) * 100}%` }}
        />
      ) : null}
      {showStayPaint && isSplit && !draggableDivider ? (
        <div
          className="absolute inset-y-3 z-10 w-px bg-zinc-400/80"
          style={{ left: `${displayShare * 100}%` }}
          aria-hidden
        />
      ) : null}
      {draggableDivider ? (
        <div
          className="absolute inset-y-2 z-10 flex w-4 -translate-x-1/2 cursor-col-resize items-center justify-center opacity-80 transition-opacity hover:opacity-100"
          style={{ left: `${displayShare * 100}%` }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            dragging.current = true;
            dragStartX.current = e.clientX;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          aria-label="Drag left or right to move this stay edge to the previous or next day"
        >
          <div className="flex h-8 w-1 flex-col items-center justify-center gap-0.5 rounded-full bg-white/95 shadow-sm ring-1 ring-indigo-400/80">
            <span className="h-0.5 w-0.5 rounded-full bg-indigo-600" />
            <span className="h-0.5 w-0.5 rounded-full bg-indigo-600" />
            <span className="h-0.5 w-0.5 rounded-full bg-indigo-600" />
          </div>
        </div>
      ) : null}
      {showStayPaint &&
        transitOverlays.map((transit, i) => (
        <div
          key={`transit-${i}`}
          className="pointer-events-none absolute inset-y-0 z-[15] flex items-end overflow-hidden border-x border-zinc-400/50 bg-zinc-300/85 px-1 pb-1.5 pt-6"
          style={{
            left: `${transit.fromShare * 100}%`,
            width: `${(transit.toShare - transit.fromShare) * 100}%`,
          }}
          aria-hidden
        >
          <span className="truncate text-[10px] font-semibold text-zinc-600">{transit.label}</span>
        </div>
        ))}
      {isHalfPending ? (
        <div
          className="pointer-events-none absolute inset-y-0 z-20 border-2 border-indigo-900 bg-indigo-900/20"
          style={
            resolvedFillHalf === "right"
              ? {
                  left: `${selectionPaintStart * 100}%`,
                  width: `${(1 - selectionPaintStart) * 100}%`,
                }
              : { left: 0, width: `${leftPendingWidth * 100}%` }
          }
          aria-hidden
        />
      ) : null}
      {isEmpty && !isInPendingRange ? (
        <div className="flex h-full flex-col items-center justify-center gap-1 text-zinc-300">
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
        </div>
      ) : null}
    </div>
  );
}

export function LocationStayCalendar({
  days,
  tripStart,
  tripEnd,
  departureCity,
  returnCity,
  travelLayoutsByDate,
  transitByDate,
  selectable = false,
  pendingRangeStart,
  pendingRangeEnd,
  pendingFillHalf,
  onDayClick,
  onShareChange,
  layout = "window",
  highlightDate,
}: {
  days: DayPlaceDraft[];
  tripStart: string;
  tripEnd: string;
  departureCity: string;
  returnCity: string;
  travelLayoutsByDate?: Map<string, CalendarDaySegment[]>;
  transitByDate?: Map<string, TransitOverlay[]>;
  selectable?: boolean;
  pendingRangeStart?: string;
  pendingRangeEnd?: string;
  pendingFillHalf?: (iso: string) => HalfSide | "full" | null;
  onDayClick?: (iso: string) => void;
  onShareChange?: (date: string, share: number) => void;
  /** window = 6 weeks with prev/next; scroll = legacy vertical scroller */
  layout?: "window" | "scroll";
  highlightDate?: string;
}) {
  const isWindow = layout !== "scroll";
  const dayByDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const [windowStart, setWindowStart] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tripStartAnchorRef = useRef<HTMLDivElement>(null);
  const highlightAnchorRef = useRef<HTMLDivElement>(null);
  const initialScrollTripStart = useRef<string | null>(null);

  const tripContext = useMemo(
    () => ({
      startDate: tripStart,
      endDate: tripEnd,
      departureCity,
      returnCity,
    }),
    [tripStart, tripEnd, departureCity, returnCity],
  );

  const scrollWeeks = useMemo(() => {
    const firstIso = days[0]?.date ?? tripStart;
    let lastIso = days[days.length - 1]?.date ?? tripEnd;
    if (travelLayoutsByDate) {
      for (const date of travelLayoutsByDate.keys()) {
        if (date > lastIso) lastIso = date;
      }
    }
    const first = DateTime.fromISO(firstIso);
    const last = DateTime.fromISO(lastIso);
    if (!first.isValid || !last.isValid) return [];

    const rangeStart = weekStartMonday(first).minus({ weeks: 1 });
    const rangeEnd = weekStartMonday(last).plus({ weeks: 1 }).plus({ days: 6 });
    return buildScrollWeeks(rangeStart, rangeEnd);
  }, [days, tripStart, tripEnd, travelLayoutsByDate]);

  const maxWindowStart = Math.max(0, scrollWeeks.length - WEEKS_PER_WINDOW);
  const visibleWeeks = scrollWeeks.slice(windowStart, windowStart + WEEKS_PER_WINDOW);
  const windowRangeLabel = formatWindowRange(visibleWeeks);
  const lastWindowAnchor = useRef<string | null>(null);

  useEffect(() => {
    if (!isWindow || !scrollWeeks.length) return;
    const anchor = highlightDate || tripStart;
    const anchorKey = highlightDate ? `h:${highlightDate}` : `t:${tripStart}`;
    const weekIdx = weekIndexForDate(scrollWeeks, anchor);
    if (weekIdx < 0) return;

    setWindowStart((currentStart) => {
      const visibleEnd = currentStart + WEEKS_PER_WINDOW - 1;
      if (weekIdx >= currentStart && weekIdx <= visibleEnd) {
        lastWindowAnchor.current = anchorKey;
        return currentStart;
      }
      if (lastWindowAnchor.current === anchorKey) return currentStart;
      lastWindowAnchor.current = anchorKey;
      return windowStartForWeekIndex(weekIdx, scrollWeeks.length);
    });
  }, [isWindow, highlightDate, tripStart, scrollWeeks.length]);

  useEffect(() => {
    if (windowStart > maxWindowStart) setWindowStart(maxWindowStart);
  }, [windowStart, maxWindowStart]);

  useEffect(() => {
    if (!isWindow || initialScrollTripStart.current === tripStart || !scrollWeeks.length) return;
    const anchor = tripStartAnchorRef.current;
    const scroller = scrollRef.current;
    if (!anchor || !scroller) return;

    const frame = window.requestAnimationFrame(() => {
      const scrollerRect = scroller.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      scroller.scrollTop += anchorRect.top - scrollerRect.top - scroller.clientHeight * 0.15;
      initialScrollTripStart.current = tripStart;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isWindow, scrollWeeks, tripStart]);

  useEffect(() => {
    if (!isWindow || !highlightDate) return;
    const anchor = highlightAnchorRef.current;
    const scroller = scrollRef.current;
    if (!anchor || !scroller) return;

    const frame = window.requestAnimationFrame(() => {
      const scrollerRect = scroller.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      scroller.scrollTop += anchorRect.top - scrollerRect.top - scroller.clientHeight * 0.2;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isWindow, highlightDate, scrollWeeks]);

  useEffect(() => {
    if (isWindow) return;
    const el = scrollRef.current;
    if (!el) return;

    function onWheel(event: WheelEvent) {
      const target = scrollRef.current;
      if (!target) return;
      const maxScroll = target.scrollHeight - target.clientHeight;
      if (maxScroll <= 0) return;

      const { deltaY } = event;
      if (deltaY === 0) return;

      const atTop = target.scrollTop <= 0;
      const atBottom = target.scrollTop >= maxScroll - 1;

      if ((deltaY > 0 && atBottom) || (deltaY < 0 && atTop)) {
        event.preventDefault();
        window.scrollBy({ top: deltaY, left: 0 });
      }
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isWindow, scrollWeeks]);

  function shiftWindow(delta: number) {
    setWindowStart((start) => Math.max(0, Math.min(maxWindowStart, start + delta)));
  }

  function inPendingRange(iso: string): boolean {
    if (!pendingRangeStart) return false;
    if (!pendingRangeEnd) return iso === pendingRangeStart;
    return iso >= pendingRangeStart && iso <= pendingRangeEnd;
  }

  function isTripDay(iso: string): boolean {
    return iso >= tripStart && iso <= tripEnd;
  }

  function isOutsideMonth(iso: string, week: WeekCell[]): boolean {
    const cell = week.find((c) => c.iso === iso);
    if (!cell) return false;
    const midMonth = week[3]?.monthKey ?? cell.monthKey;
    return cell.monthKey !== midMonth;
  }

  function renderDayCell(cell: WeekCell, week: WeekCell[]) {
    const { iso, day: dayNum } = cell;
    const day = dayByDate.get(iso) ?? null;
    const travelSegments = travelLayoutsByDate?.get(iso);
    const transitOverlays = transitByDate?.get(iso) ?? [];
    const inTrip = isTripDay(iso);
    const onCalendar =
      day !== null || Boolean(travelSegments?.length) || Boolean(transitOverlays.length);
    const displayDay: DayPlaceDraft | null =
      day ??
      (onCalendar
        ? {
            date: iso,
            primaryCity: "",
            secondaryCity: null,
            primaryShare: 1,
            dayType: iso > tripEnd ? "buffer" : "trip",
            includeBuffer: iso > tripEnd || iso < tripStart,
          }
        : null);
    const selected = inPendingRange(iso);
    const isEndpoint =
      selected &&
      pendingRangeStart &&
      (iso === pendingRangeStart || iso === (pendingRangeEnd ?? pendingRangeStart));
    const isHomeEdge = iso === tripStart || iso === tripEnd;
    const edgePaintable =
      isHomeEdge && tripDayHasPaintableStaySlot(iso, tripContext, travelSegments, day);
    const daySelectable =
      selectable &&
      isCalendarDaySelectable({
        iso,
        trip: tripContext,
        day: displayDay,
        travelSegments,
      });
    const fadedPadding = !onCalendar && !inTrip;

    return (
      <div
        key={iso}
        ref={
          iso === tripStart
            ? tripStartAnchorRef
            : iso === highlightDate
              ? highlightAnchorRef
              : undefined
        }
        className="h-[7.5rem] space-y-1"
      >
        <div className="flex items-center justify-center">
          <span
            className={[
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors",
              selected
                ? isEndpoint
                  ? "bg-indigo-950 text-white ring-2 ring-indigo-700/60"
                  : "bg-indigo-800 text-white"
                : iso === highlightDate
                  ? "bg-indigo-600 text-white ring-2 ring-indigo-400/80"
                  : displayDay?.dayType === "buffer"
                    ? "bg-zinc-400 text-white"
                    : inTrip
                      ? "bg-zinc-900 text-white"
                      : fadedPadding || isOutsideMonth(iso, week)
                        ? "text-zinc-300"
                        : "text-zinc-400",
            ].join(" ")}
          >
            {dayNum}
          </span>
        </div>
        {onCalendar && displayDay ? (
          <DayCell
            day={displayDay}
            travelSegments={travelSegments}
            transitOverlays={transitOverlays}
            isSelectable={daySelectable}
            isInPendingRange={inPendingRange(iso)}
            pendingFillHalf={pendingFillHalf?.(iso) ?? null}
            isRangeStart={iso === pendingRangeStart}
            isRangeEnd={iso === pendingRangeEnd}
            isHomeEdge={isHomeEdge && !edgePaintable}
            crossoverAdjustable={isDividerDraggable(displayDay, tripContext, {
              blockFlightEdges: Boolean(travelSegments?.length),
            })}
            onSelect={() => onDayClick?.(iso)}
            onShareChange={
              isDividerDraggable(displayDay, tripContext, {
                blockFlightEdges: Boolean(travelSegments?.length),
              }) && onShareChange
                ? (share) => onShareChange(iso, share)
                : undefined
            }
          />
        ) : (
          <div
            onClick={selectable ? () => onDayClick?.(iso) : undefined}
            onKeyDown={
              selectable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") onDayClick?.(iso);
                  }
                : undefined
            }
            role={selectable ? "button" : undefined}
            tabIndex={selectable ? 0 : undefined}
            className={[
              "h-[6rem] rounded-xl border border-dashed",
              fadedPadding ? "border-zinc-100 bg-zinc-50/50" : "border-zinc-200/60 bg-zinc-50/80",
              selectable ? "cursor-pointer" : "",
            ].join(" ")}
            aria-hidden={!selectable}
          />
        )}
      </div>
    );
  }

  const calendarSubtitle = selectable
    ? "Tap days to paint each stay"
    : "Six weeks at a time";

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 bg-gradient-to-r from-zinc-50/80 to-white px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-zinc-900">Trip calendar</p>
          <p className="mt-0.5 text-xs text-zinc-500">{calendarSubtitle}</p>
        </div>
        {isWindow && scrollWeeks.length > WEEKS_PER_WINDOW ? (
          <div className="flex shrink-0 items-center gap-2">
            <span className="min-w-[7.5rem] text-center text-xs font-medium tabular-nums text-zinc-600">
              {windowRangeLabel}
            </span>
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                disabled={windowStart === 0}
                onClick={() => shiftWindow(-WEEKS_PER_WINDOW)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-30"
                aria-label="Earlier weeks"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={windowStart >= maxWindowStart}
                onClick={() => shiftWindow(WEEKS_PER_WINDOW)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-30"
                aria-label="Later weeks"
              >
                ↓
              </button>
            </div>
          </div>
        ) : isWindow && windowRangeLabel ? (
          <span className="shrink-0 text-xs font-medium tabular-nums text-zinc-500">
            {windowRangeLabel}
          </span>
        ) : null}
      </div>

      {isWindow ? (
        <div className="px-4 py-3 sm:px-5">
          <div className="mb-2 grid grid-cols-7 gap-2">
            {WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className="text-center text-[11px] font-medium uppercase tracking-wider text-zinc-400"
              >
                {wd}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {visibleWeeks.map((week, weekIndex) => {
              const globalWeekIndex = windowStart + weekIndex;
              const monthHeader = monthHeaderForWeek(week, globalWeekIndex === 0);
              const weekKey = week[0]?.iso ?? `week-${windowStart + weekIndex}`;

              return (
                <div key={weekKey}>
                  {monthHeader ? (
                    <p className="mb-2 text-sm font-semibold text-zinc-800">{monthHeader}</p>
                  ) : null}
                  <div className="grid grid-cols-7 gap-2">
                    {week.map((cell) => renderDayCell(cell, week))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <div className="sticky top-0 z-20 border-b border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
            <div className="grid grid-cols-7 gap-2">
              {WEEKDAYS.map((wd) => (
                <div
                  key={wd}
                  className="text-center text-[11px] font-medium uppercase tracking-wider text-zinc-400"
                >
                  {wd}
                </div>
              ))}
            </div>
          </div>

          <div ref={scrollRef} className="no-scrollbar max-h-[min(36rem,70vh)] overflow-y-auto px-4 py-3 sm:px-5">
            {scrollWeeks.map((week, weekIndex) => {
              const monthHeader = monthHeaderForWeek(week, weekIndex === 0);
              const weekKey = week[0]?.iso ?? `week-${weekIndex}`;

              return (
                <div key={weekKey} className="mb-3 last:mb-0">
                  {monthHeader ? (
                    <p className="sticky top-12 z-10 mb-2 bg-white/90 py-1 text-sm font-semibold text-zinc-800 backdrop-blur">
                      {monthHeader}
                    </p>
                  ) : null}
                  <div className="grid grid-cols-7 gap-2">
                    {week.map((cell) => renderDayCell(cell, week))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {selectable && isWindow ? (
        <div className="flex flex-wrap gap-2 border-t border-zinc-100 bg-zinc-50/60 px-5 py-3">
          {[
            "Leave/return days — home halves are fixed",
            "Departures: ½ origin · ½ flying",
            "Drag dividers to shift stays",
          ].map((tip) => (
            <span
              key={tip}
              className="rounded-full border border-zinc-200/80 bg-white px-3 py-1 text-[11px] text-zinc-600 shadow-sm"
            >
              {tip}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
