"use client";

import type { ReactNode } from "react";

import { LocationStayCalendar } from "@/components/host/wizard/shared/LocationStayCalendar";
import type { CalendarRenderModel } from "@/lib/trip-engine/types";
import type { NightBoundary } from "@/lib/host/setup/stay-boundaries";
import type { HalfSide } from "@/lib/host/wizard/location-stays";

import type { CalendarSelection } from "./useCalendarInteraction";

export function TripCalendar(props: {
  model: CalendarRenderModel;
  selection: CalendarSelection;
  onDayClick: (iso: string, half?: HalfSide, options?: { transportClick?: boolean }) => boolean;
  onBoundaryMove?: (boundaryId: string, deltaDays: -1 | 1) => void;
  onBoundaryClick?: (boundary: NightBoundary) => void;
  onTransportCorridorClick?: (date: string) => void;
  pendingFillHalf: (iso: string) => HalfSide | "full" | null;
  scrollAnchorDate?: string;
  pinnedScrollDate?: string | null;
  headerAside?: ReactNode;
  statusLine?: string;
}) {
  const { model, selection } = props;
  const { rangeStart, rangeEnd } = selection;
  const hasNamedStays = model.accommodationStays.some((s) => s.name?.trim());
  const overlayMetaByDate = new Map(
    [...model.overlayMetaByDate.entries()].filter(
      (entry): entry is [string, "inherit" | "override" | "add"] => entry[1] !== "hidden",
    ),
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <LocationStayCalendar
        days={model.days}
        baseDays={model.baseDays}
        overlayMetaByDate={overlayMetaByDate}
        tripStart={model.tripStart}
        tripEnd={model.tripEnd}
        datesUnset={model.datesUnset}
        scrollGridStart={model.gridStart}
        scrollGridEnd={model.gridEnd}
        scrollAnchorDate={props.pinnedScrollDate || props.scrollAnchorDate || model.scrollAnchorDate}
        departureCity={model.departureCity}
        returnCity={model.returnCity}
        travelLayoutsByDate={model.travelLayoutsByDate}
        transitByDate={model.transitByDate}
        selectable
        layout="scroll"
        fillHeight
        embedded
        highlightDate={props.pinnedScrollDate || rangeStart || undefined}
        pendingRangeStart={rangeStart || undefined}
        pendingRangeEnd={rangeEnd || undefined}
        pendingFillHalf={props.pendingFillHalf}
        onDayClick={props.onDayClick}
        boundaries={hasNamedStays ? model.boundaries : undefined}
        onBoundaryMove={hasNamedStays ? props.onBoundaryMove : undefined}
        onBoundaryClick={props.onBoundaryClick}
        onTransportCorridorClick={props.onTransportCorridorClick}
        accommodationByDate={model.accommodationByDate}
        accommodationStays={model.accommodationStays}
        headerAside={props.headerAside}
        statusLine={props.statusLine}
      />
    </div>
  );
}
