"use client";

import { LocationStayCalendar } from "@/components/host/wizard/shared/LocationStayCalendar";
import { accommodationLabelByDate } from "@/lib/host/setup/accommodation-calendar";
import {
  groupAccommodationStays,
  mainAccommodationStays,
} from "@/lib/host/setup/entity-scope";
import type { TripSetupState } from "@/lib/host/setup/types";
import type { HalfSide } from "@/lib/host/wizard/location-stays";

import type { DayClickOptions } from "./use-setup-calendar";
import { useMemo } from "react";

import { SetupGroupSelector } from "./SetupGroupSelector";
import type { NightBoundary } from "@/lib/host/setup/stay-boundaries";

import type { useSetupCalendar } from "./use-setup-calendar";

type CalendarApi = ReturnType<typeof useSetupCalendar>;

export function SetupPersistentCalendar(props: {
  state: TripSetupState;
  activeGroupId: string;
  onCreateGroup: (name: string, type: string) => Promise<void>;
  onSelectGroup: (groupId: string) => void;
  calendar: CalendarApi;
  onDayClick?: (iso: string, half?: HalfSide, options?: DayClickOptions) => void;
  onTransportCorridorClick?: (iso: string) => void;
  onBoundaryClick?: (boundary: NightBoundary) => void;
}) {
  const {
    state,
    activeGroupId,
    onCreateGroup,
    onSelectGroup,
    calendar,
    onDayClick: onDayClickProp,
    onTransportCorridorClick,
    onBoundaryClick,
  } = props;
  const {
    isMain,
    mainDays,
    dayPlaces,
    overlayMetaByDate,
    travelLayoutsByDate,
    transitByDate,
    selection,
    tripEdgeRange,
    gridRange,
    scrollAnchorDate,
    pinnedScrollDate,
    usingDefaultRange,
    datesUnset,
    onDayClick: calendarOnDayClick,
    pendingFillHalf,
    boundaries,
    accommodationByDate: derivedAccommodationByDate,
    hasNamedStays,
    onBoundaryMove,
  } = calendar;

  const { rangeStart, rangeEnd } = selection;

  const visibleStays = useMemo(
    () =>
      isMain
        ? mainAccommodationStays(state)
        : groupAccommodationStays(state, activeGroupId),
    [state, isMain, activeGroupId],
  );

  const namedStays = useMemo(
    () => visibleStays.filter((s) => s.name?.trim()),
    [visibleStays],
  );

  const accommodationByDate = useMemo(
    () =>
      hasNamedStays && derivedAccommodationByDate
        ? derivedAccommodationByDate
        : accommodationLabelByDate(namedStays),
    [hasNamedStays, derivedAccommodationByDate, namedStays],
  );

  const statusLine = rangeStart
    ? `Selected ${rangeStart}${rangeEnd && rangeEnd !== rangeStart ? ` → ${rangeEnd}` : ""}`
    : usingDefaultRange || datesUnset
      ? "All days available — scroll to browse"
      : "Click start day, then click end day (forward only)";

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-white">
      <LocationStayCalendar
        days={dayPlaces}
        baseDays={isMain ? undefined : mainDays}
        overlayMetaByDate={overlayMetaByDate}
        tripStart={tripEdgeRange.tripStart}
        tripEnd={tripEdgeRange.tripEnd}
        datesUnset={datesUnset}
        scrollGridStart={gridRange.gridStart}
        scrollGridEnd={gridRange.gridEnd}
        scrollAnchorDate={scrollAnchorDate}
        departureCity={state.basics.departureCity}
        returnCity={state.basics.returnCity}
        travelLayoutsByDate={travelLayoutsByDate}
        transitByDate={transitByDate}
        selectable
        layout="scroll"
        fillHeight
        embedded
        highlightDate={pinnedScrollDate || rangeStart || undefined}
        pendingRangeStart={rangeStart || undefined}
        pendingRangeEnd={rangeEnd || undefined}
        pendingFillHalf={pendingFillHalf}
        onDayClick={onDayClickProp ?? calendarOnDayClick}
        boundaries={hasNamedStays ? boundaries : undefined}
        onBoundaryMove={hasNamedStays ? onBoundaryMove : undefined}
        onBoundaryClick={onBoundaryClick}
        onTransportCorridorClick={onTransportCorridorClick}
        accommodationByDate={accommodationByDate}
        accommodationStays={namedStays}
        headerAside={
          <SetupGroupSelector
            variant="toolbar"
            groups={state.groups}
            activeGroupId={activeGroupId}
            onSelect={onSelectGroup}
            onCreateGroup={onCreateGroup}
          />
        }
        statusLine={statusLine}
      />
    </div>
  );
}
