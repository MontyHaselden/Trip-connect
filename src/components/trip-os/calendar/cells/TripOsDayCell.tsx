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
  const displayShare = normalizeDayShare(day.primaryShare ?? 1);
  const mergedDay = {
    ...day,
    primaryCity: primary,
    secondaryCity: secondary || null,
  };

  const isInPendingRange =
    Boolean(selection.rangeStart) &&
    iso >= selection.rangeStart! &&
    iso <= (selection.rangeEnd || selection.rangeStart!);

  const showStayPaint = Boolean(primary || secondary);
  const showLocationBand = showStayPaint;

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
    Boolean(primary && secondary) ||
    (Boolean(primary) && isSplitDay(day) && displayShare < 0.99);
  const isBuffer = day.dayType === "buffer";
  const isHalfPending =
    isInPendingRange && (resolvedFillHalf === "left" || resolvedFillHalf === "right");
  const halfSelectionDivider =
    isSplitDay(day) && displayShare < 0.99 ? displayShare : DEFAULT_HALF_SHARE;

  const accommodationLeftColors = primary
    ? stayBandStyleForCity(primary, props.locationColorByKey)
    : null;
  const accommodationRightColors = secondary
    ? stayBandStyleForCity(secondary, props.locationColorByKey)
    : null;
  const accommodationSingleColors =
    primary || secondary
      ? stayBandStyleForCity(primary || secondary, props.locationColorByKey)
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
    primary && secondary
      ? `${primary} / ${secondary}`
      : primary || secondary || undefined;

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
          primary={primary}
          secondary={secondary}
          leftColors={accommodationLeftColors}
          rightColors={accommodationRightColors}
          singleColors={accommodationSingleColors}
        />
        <ActivityChips activities={props.activities} />
      </div>
    </div>
  );
}
