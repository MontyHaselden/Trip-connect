"use client";

import { useRef } from "react";

import { clickHitsTransitSegment } from "@/lib/host/setup/transport-block-selection";
import { isAirportPlace } from "@/lib/geo/airport-codes";
import {
  halfFromClickX,
  isSplitDay,
  type HalfSide,
} from "@/lib/host/wizard/location-stays";
import {
  hasAfternoonDepartureTravel,
  mergeTravelWithPaintedStay,
  stayCityPaintShareForDay,
  travelLayoutBlocksPainting,
  travelLayoutMorningPaintEnd,
  travelLayoutPaintStart,
  travelLayoutSummary,
  type CalendarDaySegment,
  type TransitOverlay as TransitOverlayType,
} from "@/lib/host/wizard/transport-day-placement";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import type { ActivityMarker, OverlayMeta } from "@/lib/trip-engine/types";

import type { CalendarSelection } from "../useCalendarSelection";
import { ActivityChips } from "./ActivityChips";
import { LocationBand } from "./LocationBand";
import { StayBand } from "./StayBand";
import { TransportBand } from "./TransportBand";
import { TransitOverlay } from "./TransitOverlay";

export function TripOsDayCell(props: {
  iso: string;
  dayNum: number;
  day: DayPlaceDraft;
  baseDay?: DayPlaceDraft | null;
  overlayKind?: OverlayMeta;
  isSelectable: boolean;
  isHomeEdge: boolean;
  travelSegments?: CalendarDaySegment[];
  transitOverlays: TransitOverlayType[];
  accommodationLabel?: string | null;
  accommodationLeftLabel?: string | null;
  accommodationRightLabel?: string | null;
  accommodationLeftOnly?: boolean;
  accommodationRightOnly?: boolean;
  corridorDepartureAcco?: string | null;
  corridorArrivalAcco?: string | null;
  showTransportCorridor: boolean;
  activities: ActivityMarker[];
  selection: CalendarSelection;
  pendingFillHalf: (iso: string) => HalfSide | "full" | null;
  onDayClick: (iso: string, half?: HalfSide, options?: { transportClick?: boolean }) => boolean;
  onTransportCorridorClick?: (iso: string) => void;
}) {
  const cellRef = useRef<HTMLDivElement>(null);
  const { iso, day, selection } = props;

  const primaryRaw = day.primaryCity.trim();
  const secondaryRaw = day.secondaryCity?.trim() ?? "";
  const primary = primaryRaw && !isAirportPlace(primaryRaw) ? primaryRaw : "";
  const secondary = secondaryRaw && !isAirportPlace(secondaryRaw) ? secondaryRaw : "";
  const share = day.primaryShare ?? 1;

  const isInPendingRange =
    Boolean(selection.rangeStart) &&
    iso >= selection.rangeStart! &&
    iso <= (selection.rangeEnd || selection.rangeStart!);
  const isRangeStart = selection.rangeStart === iso;
  const isRangeEnd = (selection.rangeEnd || selection.rangeStart) === iso;
  const isEndpoint = isInPendingRange && (isRangeStart || isRangeEnd);

  const hasTravelLayout = Boolean(props.travelSegments?.length);
  const hasFullStayDay = Boolean(primary) && !secondary && share >= 1;
  const activeTravelSegments = hasFullStayDay ? undefined : props.travelSegments;
  const { segments: displayTravelSegments, hideMergedStayCity } = mergeTravelWithPaintedStay(
    activeTravelSegments,
    day,
  );
  const layoutSegments = displayTravelSegments ?? activeTravelSegments;
  const displayShare = stayCityPaintShareForDay(day, layoutSegments);
  const travelPaintStart = travelLayoutPaintStart(layoutSegments);
  const travelMorningEnd = travelLayoutMorningPaintEnd(layoutSegments);
  const travelBlocksPainting = travelLayoutBlocksPainting(layoutSegments);
  const showStayPaint =
    props.showTransportCorridor || (!travelBlocksPainting && !hideMergedStayCity);
  const hasAfternoonTravelPaint =
    hasTravelLayout && travelPaintStart > 0 && travelPaintStart < 1;
  const hasAfternoonDepartureOnly =
    hasTravelLayout && hasAfternoonDepartureTravel(layoutSegments);
  const hasMorningTravelPaint =
    hasTravelLayout && travelMorningEnd > 0 && travelMorningEnd < 1;
  const hasPartialTravelPaint =
    hasAfternoonTravelPaint || hasMorningTravelPaint || hasAfternoonDepartureOnly;

  const pendingFillHalf = props.pendingFillHalf(iso);
  const resolvedFillHalf: HalfSide | "full" | null =
    pendingFillHalf === "full" && hasAfternoonTravelPaint
      ? "right"
      : pendingFillHalf === "full" && hasMorningTravelPaint
        ? "left"
        : pendingFillHalf === "full" && hasAfternoonDepartureOnly
          ? "left"
          : pendingFillHalf;

  const hasAccommodationBand = Boolean(
    props.accommodationLabel?.trim() ||
      props.accommodationLeftLabel?.trim() ||
      props.accommodationRightLabel?.trim(),
  );
  const cityPaintHeight = hasAccommodationBand ? "75%" : "100%";
  const isBuffer = day.dayType === "buffer";
  const isEmpty =
    showStayPaint &&
    !primary &&
    !secondary &&
    !props.transitOverlays.length &&
    !hasAccommodationBand &&
    (!hasTravelLayout || travelPaintStart < 1 || hasMorningTravelPaint);
  const isHalfPending =
    isInPendingRange && (resolvedFillHalf === "left" || resolvedFillHalf === "right");
  const travelSummary = travelLayoutSummary(displayTravelSegments ?? props.travelSegments);

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
        ? 0.5
        : displayShare;

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!props.isSelectable) return;
    const rect = cellRef.current?.getBoundingClientRect();
    if (rect && layoutSegments?.length) {
      const ratio = (e.clientX - rect.left) / rect.width;
      if (clickHitsTransitSegment(ratio, layoutSegments)) {
        props.onDayClick(iso, undefined, { transportClick: true });
        return;
      }
    }
    if (!isSplitDay(day)) {
      props.onDayClick(iso);
      return;
    }
    if (!rect) {
      props.onDayClick(iso);
      return;
    }
    props.onDayClick(iso, halfFromClickX(e.clientX, rect, day));
  }

  return (
    <div className="flex min-h-[5.5rem] flex-col border-b border-r border-zinc-200 p-0.5">
      <div className="flex shrink-0 justify-center pt-0.5">
        <span
          className={[
            "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors",
            isInPendingRange
              ? isEndpoint
                ? "bg-indigo-950 text-white ring-2 ring-indigo-700/60"
                : "bg-indigo-800 text-white"
              : "text-zinc-500",
          ].join(" ")}
        >
          {props.dayNum}
        </span>
      </div>

      <div
        ref={cellRef}
        data-calendar-day={iso}
        className={[
          "relative mt-0.5 min-h-[4.5rem] flex-1 overflow-hidden rounded-lg border transition-all duration-150",
          isBuffer
            ? "border-dashed border-zinc-300 bg-zinc-100/80 opacity-90"
            : props.isHomeEdge
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
          props.isSelectable ? "cursor-pointer hover:opacity-95" : "cursor-default",
        ].join(" ")}
        onClick={handleClick}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && props.isSelectable) {
            props.onDayClick(iso);
          }
        }}
        role="button"
        tabIndex={props.isSelectable ? 0 : -1}
        title={travelSummary || undefined}
      >
        {isHalfPending ? (
          <div
            className="pointer-events-none absolute inset-y-0 z-[6] bg-indigo-400/25"
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

        <TransportBand
          segments={layoutSegments}
          showTransportCorridor={props.showTransportCorridor}
          primary={primary}
          secondary={secondary}
          corridorDepartureAcco={props.corridorDepartureAcco}
          corridorArrivalAcco={props.corridorArrivalAcco}
          onTransportCorridorClick={
            props.onTransportCorridorClick
              ? () => props.onTransportCorridorClick!(iso)
              : undefined
          }
          onTransitClick={() => props.onDayClick(iso, undefined, { transportClick: true })}
        />

        <LocationBand
          day={day}
          baseDay={props.baseDay}
          overlayKind={props.overlayKind}
          displayShare={displayShare}
          showStayPaint={showStayPaint && !props.showTransportCorridor}
          cityPaintHeight={cityPaintHeight}
        />

        <TransitOverlay overlays={props.transitOverlays} />
        {!props.showTransportCorridor ? (
          <StayBand
            label={props.accommodationLabel}
            leftLabel={props.accommodationLeftLabel}
            rightLabel={props.accommodationRightLabel}
            leftOnly={props.accommodationLeftOnly}
            rightOnly={props.accommodationRightOnly}
            displayShare={displayShare}
            primary={primary}
            secondary={secondary}
          />
        ) : null}
        <ActivityChips activities={props.activities} />
      </div>
    </div>
  );
}
