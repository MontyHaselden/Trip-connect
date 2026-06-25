"use client";

import { useRef } from "react";

import { canonicalStayCity } from "@/lib/host/setup/canonical-stay-city";
import {
  DEFAULT_HALF_SHARE,
  halfFromClickX,
  isSplitDay,
  normalizeDayShare,
  type HalfSide,
  type LocationPaletteSwatch,
} from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import type { ActivityMarker } from "@/lib/trip-engine/types";

import type { CalendarSelection } from "../useCalendarSelection";
import { ActivityChips } from "./ActivityChips";
import { LocationBand } from "./LocationBand";
import { StayBand, stayBandStyleForCity } from "./StayBand";
import { TransitOverlay } from "./TransitOverlay";
import { TransportBand } from "./TransportBand";
import { destinationCoveredByOverlays } from "./transit-overlay-labels";
import type { CalendarDaySegment, TransitOverlay as TransitOverlayType } from "@/lib/host/wizard/transport-day-placement";
import {
  mergeTravelWithPaintedStay,
  travelLayoutBlocksPainting,
} from "@/lib/host/wizard/transport-day-placement";

export function TripOsDayCell(props: {
  iso: string;
  dayNum: number;
  day: DayPlaceDraft;
  tripDayPlaces?: DayPlaceDraft[];
  isSelectable: boolean;
  isHomeEdge: boolean;
  accommodationLabel?: string | null;
  accommodationLeftLabel?: string | null;
  accommodationRightLabel?: string | null;
  accommodationLeftOnly?: boolean;
  accommodationRightOnly?: boolean;
  activities: ActivityMarker[];
  selection: CalendarSelection;
  locationColorByKey?: Map<string, LocationPaletteSwatch>;
  pendingFillHalf: (iso: string) => HalfSide | "full" | null;
  onDayClick: (iso: string, half?: HalfSide) => boolean;
  isToday?: boolean;
  transitOverlays?: TransitOverlayType[];
  travelSegments?: CalendarDaySegment[];
}) {
  const cellRef = useRef<HTMLDivElement>(null);
  const { iso, day, selection } = props;

  const stayCtx = { dayPlaces: props.tripDayPlaces ?? [day], date: iso };
  const primary = day.primaryCity.trim()
    ? canonicalStayCity(day.primaryCity, stayCtx)
    : "";
  const secondary = day.secondaryCity?.trim()
    ? canonicalStayCity(day.secondaryCity, stayCtx)
    : "";
  const transitOverlays = props.transitOverlays ?? [];
  const travelSegments = props.travelSegments;
  const displayPrimary =
    primary && destinationCoveredByOverlays(primary, transitOverlays) ? "" : primary;
  const displaySecondary =
    secondary && destinationCoveredByOverlays(secondary, transitOverlays) ? "" : secondary;
  const displayShare = normalizeDayShare(day.primaryShare ?? 1);
  const mergedDay = {
    ...day,
    primaryCity: displayPrimary,
    secondaryCity: displaySecondary || null,
  };
  const hasFullStayDay = Boolean(displayPrimary) && !displaySecondary && displayShare >= 0.99;
  const activeTravelSegments = hasFullStayDay ? undefined : travelSegments;
  const { segments: displayTravelSegments, hideMergedStayCity } = mergeTravelWithPaintedStay(
    activeTravelSegments,
    mergedDay,
  );
  const layoutSegments = displayTravelSegments ?? activeTravelSegments;
  const hasTravelLayout = Boolean(layoutSegments?.length);
  const travelBlocksPainting = travelLayoutBlocksPainting(layoutSegments);
  const hasTransitChip = transitOverlays.length > 0 && !hasTravelLayout;

  const isInPendingRange =
    Boolean(selection.rangeStart) &&
    iso >= selection.rangeStart! &&
    iso <= (selection.rangeEnd || selection.rangeStart!);

  const showStayPaint = Boolean(displayPrimary || displaySecondary);
  const showLocationBand = showStayPaint && !travelBlocksPainting && !hideMergedStayCity;

  const pendingFillHalf = props.pendingFillHalf(iso);
  const resolvedFillHalf = pendingFillHalf;

  const leftHasAccommodation = Boolean(props.accommodationLeftLabel?.trim());
  const rightHasAccommodation = Boolean(props.accommodationRightLabel?.trim());
  const fullDayAccommodation = Boolean(
    props.accommodationLabel?.trim() &&
      !props.accommodationLeftOnly &&
      !props.accommodationRightOnly,
  );
  const leftCityPaintHeight =
    leftHasAccommodation || fullDayAccommodation ? "75%" : "100%";
  const rightCityPaintHeight =
    rightHasAccommodation || fullDayAccommodation ? "75%" : "100%";
  const locationSplit =
    Boolean(displayPrimary && displaySecondary) ||
    (Boolean(displayPrimary) && isSplitDay(day) && displayShare < 0.99);
  const isBuffer = day.dayType === "buffer";
  const isHalfPending =
    isInPendingRange && (resolvedFillHalf === "left" || resolvedFillHalf === "right");
  const halfSelectionDivider =
    isSplitDay(day) && displayShare < 0.99 ? displayShare : DEFAULT_HALF_SHARE;

  const accommodationLeftColors = displayPrimary
    ? stayBandStyleForCity(displayPrimary, props.locationColorByKey)
    : null;
  const accommodationRightColors = displaySecondary
    ? stayBandStyleForCity(displaySecondary, props.locationColorByKey)
    : null;
  const accommodationSingleColors =
    displayPrimary || displaySecondary
      ? stayBandStyleForCity(displayPrimary || displaySecondary, props.locationColorByKey)
      : null;

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!props.isSelectable) return;
    if (!isSplitDay(day)) {
      props.onDayClick(iso);
      return;
    }
    const rect = cellRef.current?.getBoundingClientRect();
    if (!rect) {
      props.onDayClick(iso);
      return;
    }
    props.onDayClick(iso, halfFromClickX(e.clientX, rect, day));
  }

  const selectedFullDay = isInPendingRange && !isHalfPending;
  const selectedHalfDay = isHalfPending;
  const dayNumSelected = isInPendingRange && !isHalfPending;

  const title =
    displayPrimary && displaySecondary
      ? `${displayPrimary} / ${displaySecondary}`
      : displayPrimary || displaySecondary || transitOverlays[0]?.label || undefined;

  return (
    <div className="flex min-h-[5.75rem] flex-col p-0.5" data-calendar-day-cell={iso}>
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
        title={title}
      >
        {selectedHalfDay ? (
          <div
            className="pointer-events-none absolute inset-y-0 z-[20] rounded-lg border-2 border-violet-500/90 bg-violet-500/10"
            style={
              resolvedFillHalf === "right"
                ? {
                    left: `${displayShare * 100}%`,
                    width: `${(1 - displayShare) * 100}%`,
                  }
                : { left: 0, width: `${halfSelectionDivider * 100}%` }
            }
            aria-hidden
          />
        ) : null}

        <LocationBand
          day={mergedDay}
          displayShare={displayShare}
          showStayPaint={showLocationBand}
          leftCityPaintHeight={leftCityPaintHeight}
          rightCityPaintHeight={rightCityPaintHeight}
          locationColorByKey={props.locationColorByKey}
        />

        <TransportBand
          segments={layoutSegments}
          showTransportCorridor={false}
          primary={displayPrimary}
          secondary={displaySecondary}
          locationColorByKey={props.locationColorByKey}
        />

        {hasTransitChip ? <TransitOverlay overlays={transitOverlays} /> : null}

        {locationSplit ? (
          <div
            className="pointer-events-none absolute inset-y-0 z-[11] w-px bg-zinc-400/80"
            style={{ left: `${displayShare * 100}%` }}
            aria-hidden
          />
        ) : null}

        <StayBand
          label={props.accommodationLabel}
          leftLabel={props.accommodationLeftLabel}
          rightLabel={props.accommodationRightLabel}
          leftOnly={props.accommodationLeftOnly}
          rightOnly={props.accommodationRightOnly}
          displayShare={displayShare}
          primary={displayPrimary}
          secondary={displaySecondary}
          leftColors={accommodationLeftColors}
          rightColors={accommodationRightColors}
          singleColors={accommodationSingleColors}
        />
        <ActivityChips activities={props.activities} />
      </div>
    </div>
  );
}
