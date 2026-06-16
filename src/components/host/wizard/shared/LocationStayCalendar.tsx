"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DateTime } from "luxon";

import {
  arrivalAccommodationLabel,
  departureAccommodationLabel,
} from "@/lib/host/setup/accommodation-calendar";
import {
  isAccommodationCrossoverDay,
  TRANSPORT_CORRIDOR_LEFT_SHARE,
  TRANSPORT_CORRIDOR_RIGHT_START,
  TRANSPORT_CORRIDOR_WIDTH,
} from "@/lib/host/setup/transport-corridor";
import { useBoundaryDrag } from "@/components/host/setup/use-boundary-drag";
import { tripCalendarScrollAnchor } from "@/lib/host/setup/calendar-bounds";
import type { NightBoundary } from "@/lib/host/setup/stay-boundaries";
import {
  DIVIDER_SLIDE_BACKWARD_SHARE,
  DIVIDER_SLIDE_FORWARD_SHARE,
  dividerDragAnchorShare,
  isDividerDraggable,
} from "@/lib/host/wizard/crossover-adjust";
import {
  locationBorderColor,
  locationColor,
  locationTextColor,
  addDays,
  DEFAULT_HALF_SHARE,
  halfFromClickX,
  isSplitDay,
  type HalfSide,
} from "@/lib/host/wizard/location-stays";
import { clickHitsTransitSegment } from "@/lib/host/setup/transport-block-selection";
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
  isAirportPlace,
  isAirportRouteLabel,
  parseAirportRouteLabel,
} from "@/lib/geo/airport-codes";
import type { AccommodationStayDraft, DayPlaceDraft } from "@/lib/host/wizard/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKS_PER_WINDOW = 6;

type DividerDragStart = {
  date: string;
  anchorShare: number;
  pointerId: number;
  clientX: number;
  clientY: number;
};

function calendarDayAtPoint(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return null;
  const cell = el.closest("[data-calendar-day]");
  return cell?.getAttribute("data-calendar-day") ?? null;
}

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

type CalendarWeekSection = {
  key: string;
  cells: Array<WeekCell | null>;
  contextWeek: WeekCell[];
  monthLabel: string | null;
  monthBreakBefore: boolean;
  monthKey: string;
};

function monthLabelFromCell(cell: WeekCell): string {
  return DateTime.fromISO(cell.iso).toFormat("LLLL yyyy");
}

/** Split weeks at month boundaries so a new month starts on a fresh row with a gap above. */
function planCalendarWeekSections(weeks: WeekCell[][]): CalendarWeekSection[] {
  const sections: CalendarWeekSection[] = [];
  const labeledMonths = new Set<string>();
  let hasPriorSection = false;

  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
    const week = weeks[weekIndex]!;
    const firstOfMonthIdx = week.findIndex((c) => c.day === 1);

    if (firstOfMonthIdx > 0) {
      const tailCells = week.map((c, i) => (i < firstOfMonthIdx ? c : null));
      const tailMonthKey = week[0]!.monthKey;
      sections.push({
        key: `${week[0]!.iso}-tail`,
        cells: tailCells,
        contextWeek: week,
        monthLabel: null,
        monthBreakBefore: false,
        monthKey: tailMonthKey,
      });
      hasPriorSection = true;

      const headCell = week[firstOfMonthIdx]!;
      const headCells = week.map((c, i) => (i >= firstOfMonthIdx ? c : null));
      const headMonthKey = headCell.monthKey;
      const label = monthLabelFromCell(headCell);
      labeledMonths.add(headMonthKey);
      sections.push({
        key: `${headCell.iso}-head`,
        cells: headCells,
        contextWeek: week,
        monthLabel: label,
        monthBreakBefore: hasPriorSection,
        monthKey: headMonthKey,
      });
      hasPriorSection = true;
      continue;
    }

    let monthLabel: string | null = null;
    const mondayMonthKey = week[0]!.monthKey;

    if (firstOfMonthIdx === 0) {
      monthLabel = monthLabelFromCell(week[0]!);
      labeledMonths.add(mondayMonthKey);
    } else if (weekIndex === 0) {
      monthLabel = monthLabelFromCell(week[0]!);
      labeledMonths.add(mondayMonthKey);
    } else if (!labeledMonths.has(mondayMonthKey)) {
      monthLabel = monthLabelFromCell(week[0]!);
      labeledMonths.add(mondayMonthKey);
    }

    sections.push({
      key: week[0]!.iso,
      cells: week,
      contextWeek: week,
      monthLabel,
      monthBreakBefore: Boolean(monthLabel && hasPriorSection),
      monthKey: mondayMonthKey,
    });
    hasPriorSection = true;
  }

  return sections;
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

const CORRIDOR_LABEL_LEN = 4;

function corridorAbbrev(name: string): string {
  const trimmed = name.trim();
  const core = trimmed.split(",")[0]?.trim() || trimmed;
  if (!core) return "";
  return core.slice(0, CORRIDOR_LABEL_LEN);
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
          const colorOnly = segment.colorOnly === true;
          return (
            <div
              key={`seg-${i}`}
              className={[
                "absolute inset-y-0 flex overflow-hidden px-0.5 pt-6",
                colorOnly || narrowCity
                  ? "items-center justify-center pb-1"
                  : "items-end pb-1.5",
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
              {!colorOnly && label ? (
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
        const tentative = segment.kind === "transit" && segment.tentative;
        return (
          <div
            key={`seg-${i}`}
            className={[
              "pointer-events-none absolute inset-y-0 z-[15] flex items-center justify-center overflow-hidden border-x-2 px-0.5 pt-5",
              tentative
                ? "border-rose-400/70 bg-rose-200/90"
                : "border-indigo-400/60 bg-zinc-300/85",
            ].join(" ")}
            style={{ left: `${left}%`, width: `${width}%` }}
            title={title}
            aria-hidden
          >
            {showAirportStack ? (
              <AirportRouteStack codes={airportCodes} />
            ) : label ? (
              <span
                className={[
                  "truncate px-0.5 text-center text-[9px] font-semibold",
                  tentative ? "text-rose-900" : "text-zinc-600",
                ].join(" ")}
              >
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
  baseDay,
  overlayKind,
  travelSegments,
  transitOverlays,
  isSelectable,
  isInPendingRange,
  pendingFillHalf,
  isRangeStart,
  isRangeEnd,
  isHomeEdge,
  crossoverAdjustable,
  showTransportCorridor = false,
  boundary,
  dividerAnchorShare,
  liveDividerShare,
  onBoundaryDragStart,
  onDividerDragStart,
  onSelect,
  onShareChange,
  onCorridorShareChange,
  onTransportCorridorClick,
  onCityChangeDividerClick,
  accommodationLabel,
  corridorDepartureAcco,
  corridorArrivalAcco,
  showAvailabilityDots = true,
  compact = false,
}: {
  day: DayPlaceDraft | null;
  baseDay?: DayPlaceDraft | null;
  overlayKind?: "inherit" | "override" | "add";
  travelSegments?: CalendarDaySegment[];
  transitOverlays: TransitOverlay[];
  isSelectable: boolean;
  isInPendingRange: boolean;
  pendingFillHalf: HalfSide | "full" | null;
  isRangeStart: boolean;
  isRangeEnd: boolean;
  isHomeEdge: boolean;
  crossoverAdjustable: boolean;
  showTransportCorridor?: boolean;
  /** Stay-centric boundary grip (setup board). */
  boundary?: NightBoundary;
  /** Grip position for divider drag (defaults to primaryShare). */
  dividerAnchorShare?: number;
  /** Live grip position while dragging (calendar-coordinated). */
  liveDividerShare?: number | null;
  onBoundaryDragStart?: (boundary: NightBoundary, e: React.PointerEvent) => void;
  onDividerDragStart?: (info: DividerDragStart) => void;
  onSelect?: (half?: HalfSide, options?: { transportClick?: boolean }) => void;
  onShareChange?: (share: number) => void;
  onCorridorShareChange?: (share: number) => void;
  onTransportCorridorClick?: () => void;
  /** Tap the Patong | Bangkok split to plan inter-city transport. */
  onCityChangeDividerClick?: () => void;
  /** Hotel/property name band in the bottom quarter of the cell */
  accommodationLabel?: string;
  corridorDepartureAcco?: string | null;
  corridorArrivalAcco?: string | null;
  /** Empty-day dots — trip window only once dates are set */
  showAvailabilityDots?: boolean;
  compact?: boolean;
}) {
  const cellRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartShare = useRef(0.5);
  const suppressClick = useRef(false);
  const [localLiveShare, setLocalLiveShare] = useState<number | null>(null);
  const coordinatedDrag = Boolean(onDividerDragStart);

  const primaryRaw = day?.primaryCity.trim() ?? "";
  const secondaryRaw = day?.secondaryCity?.trim() ?? "";
  const primary = primaryRaw && !isAirportPlace(primaryRaw) ? primaryRaw : "";
  const secondary = secondaryRaw && !isAirportPlace(secondaryRaw) ? secondaryRaw : "";
  const share = day?.primaryShare ?? 1;
  const anchorShare = boundary?.anchorShare ?? dividerAnchorShare ?? share;
  const activeLiveShare = coordinatedDrag ? (liveDividerShare ?? null) : localLiveShare;
  const displayShare = activeLiveShare ?? share;
  const displayAnchorShare = activeLiveShare ?? anchorShare;
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
  const showStayPaint =
    showTransportCorridor || (!travelBlocksPainting && !hideMergedStayCity);
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
  const hasAccommodationBand = Boolean(accommodationLabel?.trim());
  const cityPaintHeight = hasAccommodationBand ? "75%" : "100%";
  const isEmpty =
    showStayPaint &&
    !primary &&
    !secondary &&
    !hasTransit &&
    !hasAccommodationBand &&
    (!hasTravelLayout || travelPaintStart < 1 || hasMorningTravelPaint);
  const isHalfPending =
    isInPendingRange && (resolvedFillHalf === "left" || resolvedFillHalf === "right");
  const corridorDraggable = false;
  const accommodationEdgeBoundary =
    boundary?.kind === "stay-start" || boundary?.kind === "stay-end";
  const boundaryDraggable =
    showStayPaint &&
    Boolean(boundary && onBoundaryDragStart) &&
    (!isHomeEdge || accommodationEdgeBoundary);
  const thinDraggable =
    showStayPaint && crossoverAdjustable && Boolean(onShareChange) && !boundaryDraggable;
  const draggableDivider = corridorDraggable || boundaryDraggable || thinDraggable;

  useEffect(() => {
    if (!draggableDivider || coordinatedDrag) return;

    function finishDrag(clientX: number) {
      const el = cellRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const delta = clientX - dragStartX.current;
      const ratio = dragStartShare.current + delta / rect.width;
      const clamped = Math.min(0.95, Math.max(0.05, ratio));
      onShareChange?.(clamped);
      setLocalLiveShare(null);
    }

    function onPointerMove(e: PointerEvent) {
      if (!dragging.current) return;
      e.preventDefault();
      const el = cellRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const delta = e.clientX - dragStartX.current;
      const ratio = dragStartShare.current + delta / rect.width;
      setLocalLiveShare(Math.min(0.95, Math.max(0.05, ratio)));
    }

    function onPointerUp(e: PointerEvent) {
      if (!dragging.current) return;
      dragging.current = false;
      suppressClick.current = true;
      finishDrag(e.clientX);
    }

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [coordinatedDrag, draggableDivider, onShareChange]);

  return (
    <div
      ref={cellRef}
      data-calendar-day={day?.date}
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
      onClick={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        const rect = cellRef.current?.getBoundingClientRect();
        if (rect && layoutSegments?.length) {
          const ratio = (e.clientX - rect.left) / rect.width;
          if (clickHitsTransitSegment(ratio, layoutSegments)) {
            onSelect?.(undefined, { transportClick: true });
            return;
          }
        }
        if (!day || !isSplitDay(day)) {
          onSelect?.();
          return;
        }
        if (!rect) {
          onSelect?.();
          return;
        }
        onSelect?.(halfFromClickX(e.clientX, rect, day));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect?.();
      }}
      role="button"
      tabIndex={0}
      title={travelSummary || undefined}
    >
      {hasTravelLayout && displayTravelSegments && !showTransportCorridor ? (
        <TravelSegments segments={displayTravelSegments} />
      ) : null}
      {hasTravelLayout && layoutSegments && onSelect
        ? layoutSegments
            .filter((segment) => segment.kind === "transit")
            .map((segment, i) => (
              <button
                key={`transit-click-${i}`}
                type="button"
                className="absolute inset-y-0 z-[20] cursor-pointer border-x-2 border-indigo-500/80 bg-indigo-300/25 hover:bg-indigo-400/35"
                style={{
                  left: `${segment.start * 100}%`,
                  width: `${Math.max((segment.end - segment.start) * 100, 10)}%`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(undefined, { transportClick: true });
                }}
                aria-label="Open transport for this travel day"
                title="Transport"
              />
            ))
        : null}
      {baseDay?.primaryCity.trim() ? (
        <div
          className={[
            "pointer-events-none absolute inset-0 z-[5] rounded-xl border border-dashed border-zinc-300/70",
            overlayKind === "inherit" ? "opacity-35" : "opacity-25",
          ].join(" ")}
          aria-hidden
        >
          <div
            className="absolute inset-y-0 left-0 flex items-end overflow-hidden px-1.5 pb-1.5 pt-6"
            style={{
              width: `${(baseDay.primaryShare ?? 1) * 100}%`,
              backgroundColor: locationColor(baseDay.primaryCity),
            }}
          >
            <span
              className="truncate text-[10px] font-medium text-zinc-600"
              title={baseDay.primaryCity}
            >
              {shortCity(baseDay.primaryCity)}
            </span>
          </div>
        </div>
      ) : null}
      {showTransportCorridor && showStayPaint && primary && secondary ? (
        <>
          <div
            className="absolute inset-y-0 left-0 z-[8] flex flex-col overflow-hidden"
            style={{ width: `${DEFAULT_HALF_SHARE * 100}%` }}
          >
            <div
              className="relative h-3/4 min-h-0 shrink-0 px-1 pb-1 pt-4"
              style={{ backgroundColor: locationColor(primary) }}
              title={primary}
            >
              <span
                className="absolute bottom-1 left-1 truncate text-[9px] font-semibold leading-tight"
                style={{ color: locationTextColor(primary), maxWidth: "calc(100% - 0.25rem)" }}
              >
                {corridorAbbrev(primary)}
              </span>
            </div>
            <div
              className={[
                "relative h-1/4 min-h-0 shrink-0 px-1",
                corridorDepartureAcco ? "border-t border-violet-300/70 bg-violet-100" : "",
              ].join(" ")}
              style={
                corridorDepartureAcco
                  ? undefined
                  : { backgroundColor: locationColor(primary) }
              }
              title={corridorDepartureAcco ?? undefined}
            >
              {corridorDepartureAcco ? (
                <span className="absolute bottom-0.5 left-1 truncate text-[8px] font-semibold leading-tight text-violet-950">
                  {corridorAbbrev(corridorDepartureAcco)}
                </span>
              ) : null}
            </div>
          </div>
          {!boundaryDraggable && onTransportCorridorClick ? (
            <button
              type="button"
              className="absolute inset-y-0 z-[18] flex cursor-pointer items-center justify-center border-x-2 border-indigo-400/70 bg-zinc-200/95 text-xl font-semibold text-zinc-600 hover:bg-zinc-300"
              style={{
                left: `${TRANSPORT_CORRIDOR_LEFT_SHARE * 100}%`,
                width: `${TRANSPORT_CORRIDOR_WIDTH * 100}%`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onTransportCorridorClick();
              }}
              aria-label="Plan transport for this transfer day"
            />
          ) : null}
          <div
            className="absolute inset-y-0 right-0 z-[8] flex flex-col overflow-hidden"
            style={{ width: `${DEFAULT_HALF_SHARE * 100}%` }}
          >
            <div
              className="relative h-3/4 min-h-0 shrink-0 px-1 pb-1 pt-4"
              style={{ backgroundColor: locationColor(secondary) }}
              title={secondary}
            >
              <span
                className="absolute bottom-1 right-1 truncate text-right text-[9px] font-semibold leading-tight"
                style={{ color: locationTextColor(secondary), maxWidth: "calc(100% - 0.25rem)" }}
              >
                {corridorAbbrev(secondary)}
              </span>
            </div>
            <div
              className={[
                "relative h-1/4 min-h-0 shrink-0 px-1",
                corridorArrivalAcco ? "border-t border-violet-300/70 bg-violet-100" : "",
              ].join(" ")}
              style={
                corridorArrivalAcco
                  ? undefined
                  : { backgroundColor: locationColor(secondary) }
              }
              title={corridorArrivalAcco ?? undefined}
            >
              {corridorArrivalAcco ? (
                <span className="absolute bottom-0.5 right-1 truncate text-right text-[8px] font-semibold leading-tight text-violet-950">
                  {corridorAbbrev(corridorArrivalAcco)}
                </span>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
      {showStayPaint && primary && !showTransportCorridor ? (
        <div
          className="absolute left-0 top-0 flex items-end overflow-hidden px-1.5 pb-1 pt-4"
          style={{
            height: cityPaintHeight,
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
      {showStayPaint && secondary && !showTransportCorridor ? (
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
            height: cityPaintHeight,
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
      ) : null}
      {showStayPaint && isSplit && !draggableDivider && !showTransportCorridor && !hasTravelLayout ? (
        <button
          type="button"
          className="absolute inset-y-0 z-[18] -translate-x-1/2 cursor-pointer border-x-2 border-indigo-500/80 bg-zinc-200/90 hover:bg-indigo-100/80"
          style={{
            left: `${displayShare * 100}%`,
            width: "12%",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect?.(undefined, { transportClick: true });
          }}
          aria-label="Open transport for this divided day"
          title="Transport"
        />
      ) : null}
      {boundary?.kind === "city-change" && onCityChangeDividerClick ? (
        <button
          type="button"
          className="absolute inset-y-0 z-[24] -translate-x-1/2 cursor-pointer border-x-2 border-indigo-500/80 bg-indigo-200/70 hover:bg-indigo-300/80"
          style={{
            left: `${displayAnchorShare * 100}%`,
            width: "12%",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onCityChangeDividerClick();
          }}
          aria-label="Plan transport for this city change"
          title="Transport"
        />
      ) : null}
      {draggableDivider ? (
        <div
          className="absolute inset-y-2 z-[25] flex w-4 -translate-x-1/2 cursor-col-resize items-center justify-center opacity-80 transition-opacity hover:opacity-100"
          style={{ left: `${displayAnchorShare * 100}%` }}
          onPointerDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            suppressClick.current = true;
            if (boundary && onBoundaryDragStart) {
              onBoundaryDragStart(boundary, e);
            } else if (onDividerDragStart && day) {
              onDividerDragStart({
                date: day.date,
                anchorShare,
                pointerId: e.pointerId,
                clientX: e.clientX,
                clientY: e.clientY,
              });
            } else {
              dragging.current = true;
              dragStartX.current = e.clientX;
              dragStartShare.current = anchorShare;
            }
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onClick={(e) => {
            e.stopPropagation();
          }}
          aria-label={
            boundary?.kind === "city-change"
              ? "Drag to move this city change between days, or click to plan transport"
              : "Drag left or right to move this stay edge to the previous or next day"
          }
          title={
            boundary?.kind === "city-change"
              ? "Click to plan transport · drag to move departure day"
              : undefined
          }
        >
          <div
            className={[
              "flex h-8 w-1 flex-col items-center justify-center gap-0.5 rounded-full shadow-sm ring-1",
              boundary?.kind === "city-change"
                ? "bg-indigo-50 ring-indigo-500/90"
                : "bg-white/95 ring-indigo-400/80",
            ].join(" ")}
          >
            <span className="h-0.5 w-0.5 rounded-full bg-indigo-600" />
            <span className="h-0.5 w-0.5 rounded-full bg-indigo-600" />
            <span className="h-0.5 w-0.5 rounded-full bg-indigo-600" />
          </div>
        </div>
      ) : null}
      {showStayPaint &&
        !showTransportCorridor &&
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
      {hasAccommodationBand && (primary || secondary) && !showTransportCorridor ? (
        <div
          className="absolute bottom-0 z-[12] flex h-1/4 items-center overflow-hidden border-t border-violet-300/70 bg-violet-100 px-1.5"
          style={
            secondaryOnly
              ? {
                  left: `${displayShare * 100}%`,
                  width: `${(1 - displayShare) * 100}%`,
                }
              : primary && share < 1
                ? { left: 0, width: `${displayShare * 100}%` }
                : { left: 0, right: 0 }
          }
          title={accommodationLabel}
        >
          <span className="truncate text-[9px] font-semibold leading-tight text-violet-950">
            {accommodationLabel}
          </span>
        </div>
      ) : null}
      {isEmpty && !isInPendingRange && showAvailabilityDots ? (
        <div
          className="flex flex-col items-center justify-center gap-1 text-zinc-300"
          style={{ height: hasAccommodationBand ? "75%" : "100%" }}
        >
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
  baseDays,
  overlayMetaByDate,
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
  onDividerSlideToward,
  onCorridorShareChange,
  boundaries,
  onBoundaryMove,
  onBoundaryClick,
  onTransportCorridorClick,
  layout = "window",
  highlightDate,
  fillHeight = false,
  visibleWeekCount,
  accommodationByDate,
  accommodationStays,
  datesUnset = false,
  scrollGridStart,
  scrollGridEnd,
  scrollAnchorDate: scrollAnchorDateProp,
  headerAside,
  statusLine,
  embedded = false,
}: {
  days: DayPlaceDraft[];
  /** Main Group underlay (faded) when editing a non-main group */
  baseDays?: DayPlaceDraft[];
  overlayMetaByDate?: Map<string, "inherit" | "override" | "add">;
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
  onDayClick?: (iso: string, half?: HalfSide, options?: { transportClick?: boolean }) => void;
  onShareChange?: (date: string, share: number) => void;
  /** Slide divider toward hovered day while dragging (legacy locations UI). */
  onDividerSlideToward?: (dragDate: string, hoverDate: string) => string;
  onCorridorShareChange?: (date: string, share: number) => void;
  /** Stay-centric draggable night boundaries (setup board). */
  boundaries?: NightBoundary[];
  onBoundaryMove?: (boundaryId: string, deltaDays: -1 | 1) => void;
  /** Tap a city-change night boundary to plan transport for that transfer. */
  onBoundaryClick?: (boundary: NightBoundary) => void;
  onTransportCorridorClick?: (date: string) => void;
  /** window = 6 weeks with prev/next; scroll = vertical scroller through all weeks */
  layout?: "window" | "scroll";
  highlightDate?: string;
  /** Fill parent height and scroll inside (setup board). */
  fillHeight?: boolean;
  /** Scroll layout: clip viewport to this many week rows; all weeks still scroll inside. */
  visibleWeekCount?: number;
  accommodationByDate?: Map<string, string>;
  /** Named stays for half-aware hotel bands on city-change days. */
  accommodationStays?: AccommodationStayDraft[];
  /** When true, every visible day is paintable (no trip dates yet). */
  datesUnset?: boolean;
  /** Setup scroll: exact Monday–Sunday grid (skips extra week padding). */
  scrollGridStart?: string;
  scrollGridEnd?: string;
  /** Center viewport on first paint (defaults to mid-trip from tripStart/tripEnd). */
  scrollAnchorDate?: string;
  /** Setup board: groups etc. beside Trip calendar title */
  headerAside?: ReactNode;
  /** Setup board: selection / browse hint under headerAside */
  statusLine?: string;
  /** Flat chrome for setup board (no card border/shadow) */
  embedded?: boolean;
}) {
  const isWindow = layout !== "scroll";
  const boundaryMode = Boolean(onBoundaryMove);
  const boundariesByDate = useMemo(() => {
    const map = new Map<string, NightBoundary>();
    for (const boundary of boundaries ?? []) {
      if (!map.has(boundary.date)) map.set(boundary.date, boundary);
    }
    return map;
  }, [boundaries]);
  const boundariesById = useMemo(
    () => new Map((boundaries ?? []).map((b) => [b.id, b])),
    [boundaries],
  );
  const { startBoundaryDrag } = useBoundaryDrag({
    onBoundaryMove: onBoundaryMove ?? (() => {}),
    onBoundaryTap: (boundaryId) => {
      const boundary = boundariesById.get(boundaryId);
      if (boundary) onBoundaryClick?.(boundary);
    },
    enabled: boundaryMode,
  });
  const dayByDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days]);
  const baseDayByDate = useMemo(
    () => new Map((baseDays ?? []).map((d) => [d.date, d])),
    [baseDays],
  );
  const [windowStart, setWindowStart] = useState(0);
  const [stickyMonth, setStickyMonth] = useState("");
  const [dividerDrag, setDividerDrag] = useState<
    (DividerDragStart & { slidDuringDrag: boolean }) | null
  >(null);
  const [liveDividerShare, setLiveDividerShare] = useState<{
    date: string;
    share: number;
  } | null>(null);
  const dividerDragRef = useRef(dividerDrag);
  const onDividerSlideTowardRef = useRef(onDividerSlideToward);
  const onShareChangeRef = useRef(onShareChange);
  const scrollRef = useRef<HTMLDivElement>(null);
  const windowWheelRef = useRef<HTMLDivElement>(null);
  const tripStartAnchorRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const highlightAnchorRef = useRef<HTMLDivElement>(null);
  const initialScrollKey = useRef<string | null>(null);
  const hasAutoScrolled = useRef(false);

  const scrollAnchorDate = useMemo(
    () => scrollAnchorDateProp ?? tripCalendarScrollAnchor(tripStart, tripEnd),
    [scrollAnchorDateProp, tripStart, tripEnd],
  );

  const tripContext = useMemo(
    () => ({
      startDate: tripStart,
      endDate: tripEnd,
      departureCity,
      returnCity,
    }),
    [tripStart, tripEnd, departureCity, returnCity],
  );

  useEffect(() => {
    dividerDragRef.current = dividerDrag;
  }, [dividerDrag]);

  useEffect(() => {
    onDividerSlideTowardRef.current = onDividerSlideToward;
    onShareChangeRef.current = onShareChange;
  }, [onDividerSlideToward, onShareChange]);

  useEffect(() => {
    if (boundaryMode || !dividerDrag) return;

    function ratioInCell(date: string, clientX: number, anchorShare: number, startClientX: number) {
      const cell = document.querySelector<HTMLElement>(`[data-calendar-day="${date}"]`);
      if (!cell) return anchorShare;
      const rect = cell.getBoundingClientRect();
      if (rect.width <= 0) return anchorShare;
      const delta = clientX - startClientX;
      return Math.min(0.95, Math.max(0.05, anchorShare + delta / rect.width));
    }

    function adjacentHoverDate(sessionDate: string, hover: string): string | null {
      const next = addDays(sessionDate, 1);
      const prev = addDays(sessionDate, -1);
      if (hover === next || hover === prev) return hover;
      return null;
    }

    function onPointerMove(e: PointerEvent) {
      const session = dividerDragRef.current;
      if (!session || e.pointerId !== session.pointerId) return;

      const deltaX = e.clientX - session.clientX;
      const deltaY = e.clientY - session.clientY;
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        e.preventDefault();
      }

      const hover = calendarDayAtPoint(e.clientX, e.clientY);
      const adjacent = hover ? adjacentHoverDate(session.date, hover) : null;
      if (adjacent && onDividerSlideTowardRef.current) {
        const nextDate = onDividerSlideTowardRef.current(session.date, adjacent);
        dividerDragRef.current = {
          ...session,
          date: nextDate,
          slidDuringDrag: true,
          anchorShare: dividerDragAnchorShare(
            dayByDate.get(nextDate) ?? {
              date: nextDate,
              primaryCity: "",
              secondaryCity: null,
              primaryShare: 1,
              dayType: "trip",
              includeBuffer: false,
            },
            days,
            tripContext,
          ),
          clientX: e.clientX,
        };
        setDividerDrag(dividerDragRef.current);
        setLiveDividerShare(null);
        return;
      }

      if (hover === session.date) {
        setLiveDividerShare({
          date: session.date,
          share: ratioInCell(session.date, e.clientX, session.anchorShare, session.clientX),
        });
      }
    }

    function onPointerUp(e: PointerEvent) {
      const session = dividerDragRef.current;
      if (!session || e.pointerId !== session.pointerId) return;

      if (!session.slidDuringDrag && onShareChangeRef.current) {
        const hover = calendarDayAtPoint(e.clientX, e.clientY);
        if (hover === session.date) {
          const ratio = ratioInCell(session.date, e.clientX, session.anchorShare, session.clientX);
          if (ratio >= DIVIDER_SLIDE_FORWARD_SHARE - 0.25) {
            onShareChangeRef.current(session.date, DIVIDER_SLIDE_FORWARD_SHARE);
          } else if (ratio <= DIVIDER_SLIDE_BACKWARD_SHARE + 0.25) {
            onShareChangeRef.current(session.date, DIVIDER_SLIDE_BACKWARD_SHARE);
          }
        }
      }

      dividerDragRef.current = null;
      setDividerDrag(null);
      setLiveDividerShare(null);
    }

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [boundaryMode, dividerDrag, days, dayByDate, tripContext]);

  const scrollWeeks = useMemo(() => {
    const firstIso = scrollGridStart ?? days[0]?.date ?? tripStart;
    let lastIso = scrollGridEnd ?? days[days.length - 1]?.date ?? tripEnd;
    if (travelLayoutsByDate) {
      for (const date of travelLayoutsByDate.keys()) {
        if (date > lastIso) lastIso = date;
      }
    }
    const first = DateTime.fromISO(firstIso);
    const last = DateTime.fromISO(lastIso);
    if (!first.isValid || !last.isValid) return [];

    const rangeStart = scrollGridStart
      ? weekStartMonday(first)
      : weekStartMonday(first).minus({ weeks: 1 });
    const rangeEnd = scrollGridEnd
      ? weekStartMonday(last).plus({ days: 6 })
      : weekStartMonday(last).plus({ weeks: 1 }).plus({ days: 6 });
    return buildScrollWeeks(rangeStart, rangeEnd);
  }, [days, tripStart, tripEnd, travelLayoutsByDate, scrollGridStart, scrollGridEnd]);

  const scrollWeekSections = useMemo(
    () => (isWindow ? [] : planCalendarWeekSections(scrollWeeks)),
    [isWindow, scrollWeeks],
  );

  const maxWindowStart = Math.max(0, scrollWeeks.length - WEEKS_PER_WINDOW);
  const visibleWeeks = scrollWeeks.slice(windowStart, windowStart + WEEKS_PER_WINDOW);
  const windowRangeLabel = formatWindowRange(visibleWeeks);
  const lastWindowAnchor = useRef<string | null>(null);

  useEffect(() => {
    if (!isWindow || !scrollWeeks.length) return;
    const anchor = highlightDate || scrollAnchorDate;
    const anchorKey = highlightDate ? `h:${highlightDate}` : `m:${scrollAnchorDate}`;
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
  }, [isWindow, highlightDate, scrollAnchorDate, scrollWeeks.length]);

  useEffect(() => {
    if (windowStart > maxWindowStart) setWindowStart(maxWindowStart);
  }, [windowStart, maxWindowStart]);

  useEffect(() => {
    if (isWindow || !scrollWeeks.length) return;
    // Setup scroll calendar: center once on first paint only — never on later data edits.
    if (hasAutoScrolled.current) return;

    let frame2 = 0;

    function centerOnTripDates(): boolean {
      const scroller = scrollRef.current;
      if (!scroller) return false;
      const anchor =
        scrollAnchorRef.current ?? tripStartAnchorRef.current ?? highlightAnchorRef.current;
      if (!anchor) return false;

      const scrollerRect = scroller.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const delta =
        anchorRect.top -
        scrollerRect.top -
        (scroller.clientHeight - anchorRect.height) / 2;
      scroller.scrollTop += delta;
      hasAutoScrolled.current = true;
      initialScrollKey.current = scrollAnchorDate;
      return true;
    }

    const frame1 = window.requestAnimationFrame(() => {
      if (centerOnTripDates()) return;
      frame2 = window.requestAnimationFrame(() => {
        centerOnTripDates();
      });
    });

    return () => {
      window.cancelAnimationFrame(frame1);
      if (frame2) window.cancelAnimationFrame(frame2);
    };
  }, [isWindow, scrollWeeks.length, tripStart, tripEnd, scrollAnchorDate]);

  useEffect(() => {
    if (!isWindow || scrollWeeks.length <= WEEKS_PER_WINDOW) return;
    const el = windowWheelRef.current;
    if (!el) return;

    let accum = 0;
    const THRESHOLD = 48;

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      accum += event.deltaY;
      if (Math.abs(accum) < THRESHOLD) return;
      const steps = Math.trunc(accum / THRESHOLD);
      accum -= steps * THRESHOLD;
      if (steps !== 0) {
        setWindowStart((start) =>
          Math.max(0, Math.min(maxWindowStart, start + steps)),
        );
      }
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isWindow, scrollWeeks.length, maxWindowStart]);

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

      if (visibleWeekCount) {
        if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
          event.preventDefault();
        }
        return;
      }

      if ((deltaY > 0 && atBottom) || (deltaY < 0 && atTop)) {
        event.preventDefault();
        window.scrollBy({ top: deltaY, left: 0 });
      }
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isWindow, scrollWeeks, visibleWeekCount]);

  useEffect(() => {
    if (isWindow || !scrollWeekSections.length) return;
    const root = scrollRef.current;
    if (!root) return;

    function refreshStickyMonth() {
      const rootRect = root!.getBoundingClientRect();
      const anchor = rootRect.top + 52;
      const sections = root!.querySelectorAll<HTMLElement>("[data-calendar-month]");
      let label = "";

      for (const el of sections) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= anchor && rect.bottom > anchor) {
          label = el.dataset.calendarMonth ?? "";
          break;
        }
      }

      if (!label) {
        const firstVisible = [...sections].find(
          (el) => el.getBoundingClientRect().bottom > rootRect.top + 40,
        );
        label = firstVisible?.dataset.calendarMonth ?? "";
      }

      setStickyMonth((current) => (current === label ? current : label));
    }

    refreshStickyMonth();
    root.addEventListener("scroll", refreshStickyMonth, { passive: true });
    return () => root.removeEventListener("scroll", refreshStickyMonth);
  }, [isWindow, scrollWeekSections]);

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

  function inPaintGrid(iso: string): boolean {
    if (!scrollGridStart || !scrollGridEnd) return false;
    return iso >= scrollGridStart && iso <= scrollGridEnd;
  }

  function renderDayCell(cell: WeekCell, week: WeekCell[]) {
    const { iso, day: dayNum } = cell;
    const day = dayByDate.get(iso) ?? null;
    const travelSegments = travelLayoutsByDate?.get(iso);
    const transitOverlays = transitByDate?.get(iso) ?? [];
    const inTrip = isTripDay(iso);
    const hasPlannedContent =
      Boolean(day?.primaryCity.trim() || day?.secondaryCity?.trim()) ||
      Boolean(travelSegments?.length) ||
      Boolean(transitOverlays.length) ||
      Boolean(accommodationByDate?.get(iso));
    const openGridDay = !isWindow && selectable && inPaintGrid(iso);
    const onCalendar =
      day !== null ||
      Boolean(travelSegments?.length) ||
      Boolean(transitOverlays.length) ||
      openGridDay;
    const displayDay: DayPlaceDraft | null =
      day ??
      (onCalendar
        ? {
            date: iso,
            primaryCity: "",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip",
            includeBuffer: false,
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
        paintStart: openGridDay ? scrollGridStart : undefined,
        paintEnd: openGridDay ? scrollGridEnd : undefined,
      });
    const fadedPadding = !onCalendar && !inTrip && !openGridDay;
    const showAvailabilityDots =
      datesUnset || openGridDay ? onCalendar : hasPlannedContent;
    const monthTurn = dayNum === 1 ? DateTime.fromISO(iso).toFormat("MMM") : null;
    const namedStays = accommodationStays?.filter((s) => s.name?.trim()) ?? [];
    const primaryCity = displayDay?.primaryCity.trim() ?? "";
    const secondaryCity = displayDay?.secondaryCity?.trim() ?? "";
    const corridorDepartureAcco = namedStays.length
      ? departureAccommodationLabel(iso, primaryCity, namedStays) ??
        accommodationByDate?.get(iso) ??
        accommodationByDate?.get(addDays(iso, -1)) ??
        null
      : accommodationByDate?.get(iso) ?? accommodationByDate?.get(addDays(iso, -1)) ?? null;
    const corridorArrivalAcco = namedStays.length
      ? arrivalAccommodationLabel(iso, secondaryCity, namedStays)
      : accommodationByDate?.get(iso) ?? null;
    const dayAccommodationLabel =
      namedStays.length && primaryCity && displayDay && displayDay.primaryShare < 1
        ? departureAccommodationLabel(iso, primaryCity, namedStays) ??
          accommodationByDate?.get(iso) ??
          null
        : accommodationByDate?.get(iso);

    return (
      <div
        key={iso}
        ref={
          iso === scrollAnchorDate
            ? scrollAnchorRef
            : iso === tripStart
              ? tripStartAnchorRef
              : iso === highlightDate
                ? highlightAnchorRef
                : undefined
        }
        className="h-[7.5rem] space-y-1"
      >
        <div className="flex flex-col items-center justify-center gap-0.5">
          {monthTurn ? (
            <span className="text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
              {monthTurn}
            </span>
          ) : (
            <span className="h-[13px]" aria-hidden />
          )}
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
                    : hasPlannedContent
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
            baseDay={baseDayByDate.get(iso) ?? null}
            overlayKind={overlayMetaByDate?.get(iso)}
            travelSegments={travelSegments}
            transitOverlays={transitOverlays}
            isSelectable={daySelectable}
            isInPendingRange={inPendingRange(iso)}
            pendingFillHalf={pendingFillHalf?.(iso) ?? null}
            isRangeStart={iso === pendingRangeStart}
            isRangeEnd={iso === pendingRangeEnd}
            isHomeEdge={isHomeEdge && !edgePaintable}
            crossoverAdjustable={
              boundaryMode
                ? Boolean(boundariesByDate.get(iso)) && !travelSegments?.length
                : isDividerDraggable(displayDay, tripContext, {
                    blockFlightEdges: Boolean(travelSegments?.length),
                    days,
                  })
            }
            boundary={boundariesByDate.get(iso)}
            dividerAnchorShare={dividerDragAnchorShare(displayDay, days, tripContext)}
            liveDividerShare={
              liveDividerShare?.date === iso ? liveDividerShare.share : null
            }
            onBoundaryDragStart={boundaryMode ? startBoundaryDrag : undefined}
            onDividerDragStart={
              !boundaryMode && onDividerSlideToward && onShareChange
                ? (info) => setDividerDrag({ ...info, slidDuringDrag: false })
                : undefined
            }
            showTransportCorridor={
              accommodationByDate
                ? isAccommodationCrossoverDay(
                    displayDay,
                    accommodationByDate,
                    tripContext,
                    namedStays,
                  )
                : false
            }
            corridorDepartureAcco={corridorDepartureAcco}
            corridorArrivalAcco={corridorArrivalAcco}
            onSelect={(half, options) => onDayClick?.(iso, half, options)}
            accommodationLabel={dayAccommodationLabel ?? undefined}
            showAvailabilityDots={showAvailabilityDots}
            onTransportCorridorClick={
              onTransportCorridorClick ? () => onTransportCorridorClick(iso) : undefined
            }
            onCityChangeDividerClick={
              onBoundaryClick && boundariesByDate.get(iso)?.kind === "city-change"
                ? () => onBoundaryClick(boundariesByDate.get(iso)!)
                : undefined
            }
            onShareChange={
              !boundaryMode &&
              isDividerDraggable(displayDay, tripContext, {
                blockFlightEdges: Boolean(travelSegments?.length),
                days,
              }) &&
              onShareChange
                ? (share) => onShareChange(iso, share)
                : undefined
            }
            onCorridorShareChange={
              accommodationByDate &&
              isAccommodationCrossoverDay(
                displayDay,
                accommodationByDate,
                tripContext,
                namedStays,
              ) &&
              onCorridorShareChange
                ? (share) => onCorridorShareChange(iso, share)
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

  function renderWeekGrid(cells: Array<WeekCell | null>, week: WeekCell[]) {
    return (
      <div className="grid grid-cols-7 gap-2">
        {cells.map((cell, i) =>
          cell ? (
            renderDayCell(cell, week)
          ) : (
            <div key={`pad-${week[0]?.iso ?? "w"}-${i}`} className="h-[7.5rem]" aria-hidden />
          ),
        )}
      </div>
    );
  }

  function renderWeekSection(section: CalendarWeekSection) {
    const anchorCell =
      section.cells.find((c): c is WeekCell => c !== null) ?? section.contextWeek[0]!;
    const stickyLabel = section.monthLabel ?? monthLabelFromCell(anchorCell);

    return (
      <div
        key={section.key}
        data-calendar-month={stickyLabel}
        className={[
          "mb-3 last:mb-0",
          section.monthBreakBefore ? "mt-6 border-t border-zinc-200/80 pt-5" : "",
        ].join(" ")}
      >
        {section.monthLabel ? (
          <p className="mb-3 text-sm font-semibold text-zinc-800">{section.monthLabel}</p>
        ) : null}
        {renderWeekGrid(section.cells, section.contextWeek)}
      </div>
    );
  }

  const scrollViewportHeight =
    visibleWeekCount && visibleWeekCount > 0
      ? `calc(${visibleWeekCount} * (7.5rem + 0.75rem) + 0.5rem)`
      : undefined;

  const calendarSubtitle = selectable
    ? visibleWeekCount
      ? "Scroll to browse — tap days to paint stays"
      : "Tap days to paint each stay"
    : "Six weeks at a time";

  return (
    <div
      className={[
        embedded ? "overflow-hidden bg-white" : "overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm",
        fillHeight ? "flex h-full min-h-0 flex-col" : "",
      ].join(" ")}
    >
      <div
        className={[
          "flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 px-4 py-3 sm:px-5",
          embedded ? "bg-white" : "bg-gradient-to-r from-zinc-50/80 to-white",
        ].join(" ")}
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight text-zinc-900">Trip calendar</p>
          <p className="mt-0.5 text-xs text-zinc-500">{calendarSubtitle}</p>
        </div>
        {headerAside || statusLine || (isWindow && windowRangeLabel) ? (
          <div className="flex min-w-0 flex-col items-end gap-1.5">
            {headerAside}
            {statusLine ? (
              <p className="text-right text-xs text-zinc-500">{statusLine}</p>
            ) : null}
            {isWindow && windowRangeLabel ? (
              <span className="shrink-0 text-xs font-medium tabular-nums text-zinc-500">
                {windowRangeLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {isWindow ? (
        <div ref={windowWheelRef} className="px-4 py-3 sm:px-5">
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
            {planCalendarWeekSections(visibleWeeks).map((section) => renderWeekSection(section))}
          </div>
        </div>
      ) : (
        <div
          className={
            fillHeight && !visibleWeekCount ? "flex min-h-0 flex-1 flex-col" : ""
          }
        >
          <div className="sticky top-0 z-20 shrink-0 border-b border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
            <div className="mb-2 flex min-h-[1.25rem] items-center justify-between gap-2">
              <p className="text-sm font-semibold text-zinc-800">
                {stickyMonth || "\u00a0"}
              </p>
            </div>
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

          <div
            ref={scrollRef}
            className={[
              "no-scrollbar overflow-y-auto overscroll-contain px-4 py-3 sm:px-5",
              visibleWeekCount
                ? "shrink-0"
                : fillHeight
                  ? "min-h-0 flex-1"
                  : "max-h-[min(36rem,70vh)]",
            ].join(" ")}
            style={scrollViewportHeight ? { maxHeight: scrollViewportHeight } : undefined}
          >
            {scrollWeekSections.map((section) => renderWeekSection(section))}
          </div>
        </div>
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
