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
  rightHalfSelectionBounds,
  travelLayoutPaintStart,
  travelLayoutSummary,
  type CalendarDaySegment,
  type TransitOverlay as TransitOverlayType,
} from "@/lib/host/wizard/transport-day-placement";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import type { ActivityMarker, OverlayMeta } from "@/lib/trip-engine/types";
import type { LocationPaletteSwatch } from "@/lib/host/wizard/location-stays";

import type { CalendarSelection } from "../useCalendarSelection";
import { ActivityChips } from "./ActivityChips";
import { LocationBand } from "./LocationBand";
import { StayBand } from "./StayBand";

type StayBandStyle = {
  fill: string;
  border: string;
  text: string;
};
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
  locationColorByKey?: Map<string, LocationPaletteSwatch>;
  accommodationLeftColors?: StayBandStyle | null;
  accommodationRightColors?: StayBandStyle | null;
  accommodationSingleColors?: StayBandStyle | null;
  pendingFillHalf: (iso: string) => HalfSide | "full" | null;
  onDayClick: (iso: string, half?: HalfSide, options?: { transportClick?: boolean }) => boolean;
  isToday?: boolean;
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
  const isHalfPending =
    isInPendingRange && (resolvedFillHalf === "left" || resolvedFillHalf === "right");
  const travelSummary = travelLayoutSummary(displayTravelSegments ?? props.travelSegments);
  const halfSelectionDivider =
    isSplitDay(day) && displayShare < 0.99 ? displayShare : 0.5;

  const rightSelectionBounds =
    resolvedFillHalf === "right"
      ? rightHalfSelectionBounds(day, layoutSegments)
      : null;
  const leftPendingWidth =
    resolvedFillHalf === "left" && hasMorningTravelPaint && !primary
      ? travelMorningEnd
      : resolvedFillHalf === "left" && hasAfternoonDepartureOnly && !primary
        ? 0.5
        : halfSelectionDivider;

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

  const selectedFullDay =
    isInPendingRange && !isHalfPending && !hasPartialTravelPaint;
  const selectedHalfDay = isHalfPending;
  const dayNumSelected = isInPendingRange && !isHalfPending;

  return (
    <div className="flex min-h-[5.75rem] flex-col p-0.5">
      <div className="flex shrink-0 justify-center pt-1">
        <span
          className={[
            "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors duration-200",
            dayNumSelected
              ? "font-semibold text-violet-700 ring-2 ring-violet-500/80"
              : isInPendingRange && isHalfPending
                ? "font-semibold text-violet-700"
                : props.isToday
                  ? "text-violet-700 ring-2 ring-violet-400/60"
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
          "relative mt-1 min-h-[4.75rem] flex-1 overflow-hidden rounded-xl border transition-all duration-200",
          isBuffer
            ? "border-dashed border-zinc-200 bg-zinc-100/60 opacity-90"
            : props.isHomeEdge
              ? "border-zinc-200/80 bg-zinc-50/90"
              : selectedFullDay
                ? "border-violet-400/70 bg-white shadow-sm ring-2 ring-violet-500/70 ring-offset-1"
                : "border-zinc-200/60 bg-white shadow-sm",
          props.isSelectable
            ? "cursor-pointer hover:scale-[1.01] hover:shadow-md"
            : "cursor-default",
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
        {selectedHalfDay ? (
          <div
            className="pointer-events-none absolute inset-y-0 z-[20] rounded-lg border-2 border-violet-500/90 bg-violet-500/10"
            style={
              resolvedFillHalf === "right" && rightSelectionBounds
                ? {
                    left: `${rightSelectionBounds.start * 100}%`,
                    width: `${rightSelectionBounds.width * 100}%`,
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
          corridorDepartureAccoColors={props.accommodationLeftColors}
          corridorArrivalAccoColors={props.accommodationRightColors}
          locationColorByKey={props.locationColorByKey}
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
          locationColorByKey={props.locationColorByKey}
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
            leftColors={props.accommodationLeftColors}
            rightColors={props.accommodationRightColors}
            singleColors={props.accommodationSingleColors}
          />
        ) : null}
        <ActivityChips activities={props.activities} />
      </div>
    </div>
  );
}
