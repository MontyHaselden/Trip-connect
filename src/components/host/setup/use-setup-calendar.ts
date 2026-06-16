"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  calendarGridBounds,
  calendarScrollBounds,
  effectiveCalendarBounds,
  ensureDaysForRange,
  resolveCalendarScrollAnchor,
  todayIso,
} from "@/lib/host/setup/calendar-bounds";
import { projectCalendarFromState } from "@/lib/trip-engine/project-from-state";
import {
  allPlaneLegsFromState,
  stripOrphanFlightPaint,
} from "@/lib/host/setup/infer-flight-calendar";
import {
  groupAccommodationStays,
  groupIntercityLegs,
  mainAccommodationStays,
  mainIntercityLegs,
  mergeAccommodationStays,
} from "@/lib/host/setup/entity-scope";
import { dedupeCityChangeLegs } from "@/lib/host/setup/dedupe-intercity-legs";
import { nextCalendarRangeSelection } from "@/lib/host/setup/calendar-range-selection";
import { expandSelectionToNightPair } from "@/lib/host/setup/night-pair-selection";
import {
  moveNightBoundary,
  syncIntercityLegsForBoundaryMove,
  type NightBoundary,
} from "@/lib/host/setup/stay-boundaries";
import {
  findTransportLegForCalendarClick,
  transportLegDateSpan,
} from "@/lib/host/setup/transport-block-selection";
import {
  findTransportLegOnDay,
  warningReasonForLeg,
} from "@/lib/host/setup/transport-drag-warnings";
import { effectiveTripBoundsFromState } from "@/lib/host/setup/sync-trip-bounds";
import { tripDatesAreUnset } from "@/lib/host/trip-date-display";
import {
  applyLocationStays,
  coalesceAdjacentStays,
  effectiveStayStart,
  inferStaysFromDayPlaces,
  mergeStaysWithNewRange,
  trimStaysForNewRange,
  type HalfSide,
  type LocationStayDraft,
} from "@/lib/host/wizard/location-stays";
import {
  computeCalendarTransport,
  flightArrivalDates,
  flightDepartureDates,
  returnDepartsAfterTripEnd,
  travelLayoutMorningPaintEnd,
  travelLayoutPaintStart,
  travelPaintStartByDate,
} from "@/lib/host/wizard/transport-day-placement";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  TripWizardDraft,
} from "@/lib/host/wizard/types";
import type { ProjectedDay } from "@/lib/trip-engine/types";
import type { TripSetupState } from "@/lib/host/setup/types";

function projectedDaysToPlaces(days: ProjectedDay[]): DayPlaceDraft[] {
  return days.map((day) => ({
    date: day.date,
    primaryCity: day.primaryCity,
    secondaryCity: day.secondaryCity,
    primaryShare: day.primaryShare,
    dayType: day.dayType,
    includeBuffer: false,
  }));
}

export type WorkspaceFocusTab = "overview" | "transport";

export type DayClickOptions = {
  transportClick?: boolean;
};

export type CalendarSelection = {
  rangeStart: string;
  rangeEnd: string;
  startHalf: HalfSide | "full";
  endHalf: HalfSide | "full";
  focusTab?: WorkspaceFocusTab;
};

export type PendingBoundaryMove = {
  boundaryId: string;
  deltaDays: -1 | 1;
  reason: string;
};

function displayResolvedDays(main: DayPlaceDraft[], overlay: DayPlaceDraft[]): DayPlaceDraft[] {
  const mainByDate = new Map(main.map((d) => [d.date, d]));
  const overlayByDate = new Map(overlay.map((d) => [d.date, d]));
  const dates = new Set([...mainByDate.keys(), ...overlayByDate.keys()]);
  return [...dates]
    .sort()
    .map((date) => overlayByDate.get(date) ?? mainByDate.get(date)!)
    .filter(Boolean);
}

function extractOverlayDelta(
  main: DayPlaceDraft[],
  resolved: DayPlaceDraft[],
  existingOverlay: DayPlaceDraft[],
): DayPlaceDraft[] {
  const mainByDate = new Map(main.map((d) => [d.date, d]));
  const deltas: DayPlaceDraft[] = [...existingOverlay];

  for (const day of resolved) {
    const mainDay = mainByDate.get(day.date);
    const differs =
      !mainDay ||
      mainDay.primaryCity.trim().toLowerCase() !== day.primaryCity.trim().toLowerCase() ||
      (mainDay.secondaryCity ?? "") !== (day.secondaryCity ?? "") ||
      mainDay.primaryShare !== day.primaryShare;
    if (differs) {
      const idx = deltas.findIndex((d) => d.date === day.date);
      if (idx >= 0) deltas[idx] = day;
      else deltas.push(day);
    }
  }
  return deltas.sort((a, b) => a.date.localeCompare(b.date));
}

export function useSetupCalendar(
  state: TripSetupState,
  activeGroupId: string,
  onChange: (next: TripSetupState) => void,
) {
  const isMain = activeGroupId === state.mainGroupId;
  const mainDays = state.dayPlacesByGroupId[state.mainGroupId] ?? [];
  const activeDays = state.dayPlacesByGroupId[activeGroupId] ?? [];
  const effectiveBounds = useMemo(
    () => effectiveTripBoundsFromState(state),
    [state],
  );
  const datesUnset = tripDatesAreUnset(
    effectiveBounds.startDate,
    effectiveBounds.endDate,
  );

  const emptySelection = (): CalendarSelection => ({
    rangeStart: "",
    rangeEnd: "",
    startHalf: "full",
    endHalf: "full",
  });
  const [selection, setSelection] = useState<CalendarSelection>(emptySelection);
  const [pendingBoundaryMove, setPendingBoundaryMove] =
    useState<PendingBoundaryMove | null>(null);
  const [stays, setStays] = useState<LocationStayDraft[]>([]);
  const [staysInitialized, setStaysInitialized] = useState(false);
  const [pinnedScrollDate, setPinnedScrollDate] = useState<string | null>(null);

  // Fixed on first render — selection must not shift the scrollable month range.
  const scrollAnchorRef = useRef(
    todayIso(state.basics.timezone),
  );

  const bounds = useMemo(
    () =>
      effectiveCalendarBounds(
        effectiveBounds.startDate,
        effectiveBounds.endDate,
        state.basics.timezone,
      ),
    [
      effectiveBounds.startDate,
      effectiveBounds.endDate,
      state.basics.timezone,
    ],
  );

  const scrollRange = useMemo(
    () =>
      calendarScrollBounds(
        effectiveBounds.startDate,
        effectiveBounds.endDate,
        state.basics.timezone,
        scrollAnchorRef.current,
      ),
    [
      effectiveBounds.startDate,
      effectiveBounds.endDate,
      state.basics.timezone,
    ],
  );

  const gridRange = useMemo(
    () => calendarGridBounds(scrollRange.scrollStart, scrollRange.scrollEnd),
    [scrollRange.scrollStart, scrollRange.scrollEnd],
  );

  /** Home-edge locks only — not the paintable calendar window. */
  const tripEdgeRange = useMemo(
    () =>
      datesUnset || bounds.usingDefaultRange
        ? { tripStart: gridRange.gridStart, tripEnd: gridRange.gridEnd }
        : { tripStart: bounds.tripStart, tripEnd: bounds.tripEnd },
    [datesUnset, bounds, gridRange.gridStart, gridRange.gridEnd],
  );

  /** Every visible grid day stays open for painting — never blanked or closed. */
  const interactionRange = gridRange;

  const scopedStays = useMemo(
    () =>
      isMain
        ? mainAccommodationStays(state)
        : groupAccommodationStays(state, activeGroupId),
    [state, isMain, activeGroupId],
  );

  const hasNamedStays = useMemo(
    () => scopedStays.some((s) => s.name?.trim()),
    [scopedStays],
  );

  const scopedIntercityLegs = useMemo(
    () =>
      isMain
        ? mainIntercityLegs(state)
        : groupIntercityLegs(state, activeGroupId),
    [state, isMain, activeGroupId],
  );

  const resolvedPlaces = isMain ? activeDays : displayResolvedDays(mainDays, activeDays);

  const tripContext = useMemo(
    () => ({
      startDate: datesUnset ? scrollRange.scrollStart : effectiveBounds.startDate,
      endDate: datesUnset ? scrollRange.scrollEnd : effectiveBounds.endDate,
      departureCity: state.basics.departureCity,
      returnCity: state.basics.returnCity,
    }),
    [
      datesUnset,
      scrollRange.scrollStart,
      scrollRange.scrollEnd,
      effectiveBounds.startDate,
      effectiveBounds.endDate,
      state.basics.departureCity,
      state.basics.returnCity,
    ],
  );

  const derivedState = useMemo(() => {
    if (!hasNamedStays) return null;
    return projectCalendarFromState(state, {
      groupId: activeGroupId,
      overlayStoredLocationGaps: isMain,
      gridStart: gridRange.gridStart,
      gridEnd: gridRange.gridEnd,
    });
  }, [
    hasNamedStays,
    state,
    activeGroupId,
    isMain,
    gridRange.gridStart,
    gridRange.gridEnd,
  ]);

  const planeLegs = useMemo(() => allPlaneLegsFromState(state), [state]);

  const resolvedPlacesClean = useMemo(
    () =>
      stripOrphanFlightPaint(
        resolvedPlaces,
        planeLegs,
        scopedStays.filter((s) => s.name?.trim()),
      ),
    [resolvedPlaces, planeLegs, scopedStays],
  );

  const dayPlaces = useMemo(
    () =>
      ensureDaysForRange(
        derivedState
          ? projectedDaysToPlaces(derivedState.days)
          : resolvedPlacesClean,
        gridRange.gridStart,
        gridRange.gridEnd,
      ),
    [derivedState, resolvedPlacesClean, gridRange.gridStart, gridRange.gridEnd],
  );

  const boundaries = derivedState?.boundaries ?? [];
  const accommodationByDate = derivedState?.accommodationByDate;

  const scrollAnchorDate = useMemo(() => {
    if (pinnedScrollDate) return pinnedScrollDate;
    const transportDates: string[] = [];
    for (const leg of [...state.outboundLegs, ...state.returnLegs, ...state.intercityLegs]) {
      const date = leg.travelDate?.trim();
      if (date) transportDates.push(date);
    }
    return resolveCalendarScrollAnchor({
      startDate: effectiveBounds.startDate,
      endDate: effectiveBounds.endDate,
      timezone: state.basics.timezone,
      dayPlaces: resolvedPlaces,
      accommodationStays: state.accommodationStays,
      transportDates,
      fallbackAnchor: scrollAnchorRef.current,
    });
  }, [
    pinnedScrollDate,
    effectiveBounds.startDate,
    effectiveBounds.endDate,
    state.basics.timezone,
    state.accommodationStays,
    state.outboundLegs,
    state.returnLegs,
    state.intercityLegs,
    resolvedPlaces,
  ]);

  const overlayMetaByDate = useMemo(() => {
    if (isMain) return undefined;
    const meta = new Map<string, "inherit" | "override" | "add">();
    const mainByDate = new Map(mainDays.map((d) => [d.date, d]));
    for (const d of activeDays) {
      const main = mainByDate.get(d.date);
      if (!main?.primaryCity.trim()) meta.set(d.date, "add");
      else if (main.primaryCity.toLowerCase() !== d.primaryCity.toLowerCase()) {
        meta.set(d.date, "override");
      } else {
        meta.set(d.date, "inherit");
      }
    }
    return meta;
  }, [isMain, activeDays, mainDays]);

  const transportDraft = useMemo(
    (): Pick<TripWizardDraft, "outboundLegs" | "returnLegs" | "intercityLegs" | "dayPlaces"> => ({
      outboundLegs: state.outboundLegs,
      returnLegs: state.returnLegs,
      intercityLegs: state.intercityLegs,
      dayPlaces,
    }),
    [state, dayPlaces],
  );

  const { travelLayouts: travelLayoutsByDate, transitOverlays: transitByDate } = useMemo(
    () =>
      computeCalendarTransport(transportDraft, tripContext, {
        stays: state.accommodationStays,
      }),
    [transportDraft, tripContext, state.accommodationStays],
  );

  useEffect(() => {
    if (staysInitialized) return;
    const inferred = inferStaysFromDayPlaces(
      dayPlaces,
      bounds.tripStart,
      bounds.tripEnd,
      state.basics.departureCity,
      state.basics.returnCity,
    );
    if (inferred.length) setStays(inferred);
    setStaysInitialized(true);
  }, [staysInitialized, dayPlaces, bounds, state.basics]);

  function updateActiveDays(nextDays: DayPlaceDraft[]) {
    const stripped = nextDays.filter(
      (d) => d.date >= gridRange.gridStart && d.date <= gridRange.gridEnd,
    );
    onChange({
      ...state,
      dayPlacesByGroupId: {
        ...state.dayPlacesByGroupId,
        [activeGroupId]: isMain
          ? stripped.filter((d) => d.primaryCity.trim() || d.secondaryCity?.trim())
          : extractOverlayDelta(mainDays, stripped, activeDays),
      },
    });
  }

  function clearSelection() {
    setSelection(emptySelection());
  }

  function scrollToDate(iso: string) {
    if (!iso.trim()) return;
    scrollAnchorRef.current = iso;
    setPinnedScrollDate(iso);
  }

  /** Select a city-change / transfer day and open workspace on Transport. */
  function selectTransferDay(iso: string) {
    setSelection({
      rangeStart: iso,
      rangeEnd: iso,
      startHalf: "full",
      endHalf: "full",
      focusTab: "transport",
    });
  }

  function selectDayFocus(
    iso: string,
    half: HalfSide | "full",
    focusTab?: WorkspaceFocusTab,
  ): void {
    if (half === "full") {
      setSelection({
        rangeStart: iso,
        rangeEnd: iso,
        startHalf: "full",
        endHalf: "full",
        focusTab,
      });
      return;
    }
    setSelection({
      ...expandSelectionToNightPair({
        rangeStart: iso,
        rangeEnd: iso,
        startHalf: half,
        endHalf: half,
      }),
      focusTab,
    });
  }

  function onDayClick(iso: string, clickedHalf?: HalfSide, options?: DayClickOptions): boolean {
    setPinnedScrollDate(null);
    if (iso < gridRange.gridStart || iso > gridRange.gridEnd) {
      if (selection.rangeStart) {
        clearSelection();
        return false;
      }
      return false;
    }

    const day = dayPlaces.find((d) => d.date === iso);

    const { rangeStart, rangeEnd, startHalf, endHalf } = selection;
    const end = rangeEnd || rangeStart;

    if (options?.transportClick) {
      const leg = findTransportLegForCalendarClick(state, iso, day);
      const span = leg ? transportLegDateSpan(leg) : null;
      if (span) {
        const sameTransportSelection =
          rangeStart === span.start &&
          end === span.end &&
          startHalf === "full" &&
          endHalf === "full";
        if (sameTransportSelection) {
          clearSelection();
          return false;
        }
        setSelection({
          rangeStart: span.start,
          rangeEnd: span.end,
          startHalf: "full",
          endHalf: "full",
          focusTab: "transport",
        });
        return true;
      }
    }

    const { selection: next, selected } = nextCalendarRangeSelection(selection, iso);
    setSelection({ ...next, focusTab: selection.focusTab });
    return selected;
  }

  function paintLocation(location: string) {
    const { rangeStart, rangeEnd } = selection;
    if (!location.trim() || !rangeStart) return;
    const endDate = rangeEnd || rangeStart;
    const startDate = effectiveStayStart(rangeStart, endDate, dayPlaces);
    const trimmed = trimStaysForNewRange(stays, location.trim(), startDate, dayPlaces);
    const nextStays = mergeStaysWithNewRange(trimmed, location.trim(), startDate, endDate);
    const coalesced = coalesceAdjacentStays(nextStays);
    setStays(coalesced);
    const finalDays = applyLocationStays(
      dayPlaces,
      coalesced,
      tripContext,
      flightDepartureDates(transportDraft, tripContext),
      travelPaintStartByDate(transportDraft, tripContext),
      flightArrivalDates(transportDraft, tripContext),
      returnDepartsAfterTripEnd(transportDraft, tripContext.endDate),
    );
    updateActiveDays(finalDays);
  }

  function pendingFillHalf(iso: string): HalfSide | "full" | null {
    const { rangeStart, rangeEnd, startHalf, endHalf } = selection;
    if (!rangeStart) return null;
    const end = rangeEnd || rangeStart;
    if (iso < rangeStart || iso > end) return null;
    if (iso === rangeStart && iso === end) return startHalf;
    if (iso === rangeStart) return startHalf;
    if (iso === end) return endHalf;
    return "full";
  }

  function persistAfterBoundaryMove(
    updatedStays: AccommodationStayDraft[],
    updatedIntercityLegs = scopedIntercityLegs,
  ) {
    const derived = projectCalendarFromState(
      {
        ...state,
        accommodationStays: mergeAccommodationStays(state, activeGroupId, updatedStays),
        intercityLegs: updatedIntercityLegs,
      },
      {
        groupId: activeGroupId,
        overlayStoredLocationGaps: false,
        gridStart: gridRange.gridStart,
        gridEnd: gridRange.gridEnd,
      },
    );

    const stripped = projectedDaysToPlaces(derived.days)
      .filter((d) => d.date >= gridRange.gridStart && d.date <= gridRange.gridEnd)
      .filter((d) => d.primaryCity.trim() || d.secondaryCity?.trim());

    onChange({
      ...state,
      dayPlacesByGroupId: {
        ...state.dayPlacesByGroupId,
        [activeGroupId]: isMain ? stripped : extractOverlayDelta(mainDays, stripped, activeDays),
      },
      accommodationStays: mergeAccommodationStays(state, activeGroupId, updatedStays),
      intercityLegs: isMain
        ? updatedIntercityLegs
        : state.intercityLegs.map((leg) => {
            const synced = updatedIntercityLegs.find((l) => l.id === leg.id);
            return synced ?? leg;
          }),
    });
  }

  function boundaryById(id: string): NightBoundary | undefined {
    return boundaries.find((b) => b.id === id);
  }

  function isBoundaryBlocked(boundary: NightBoundary): boolean {
    return Boolean(travelLayoutsByDate.get(boundary.date)?.length);
  }

  function commitBoundaryMove(boundaryId: string, deltaDays: -1 | 1) {
    const boundary = boundaryById(boundaryId);
    if (!boundary || isBoundaryBlocked(boundary)) return;

    const moved = moveNightBoundary(boundary, deltaDays, scopedStays);
    if (moved === scopedStays) return;
    const syncedLegs = syncIntercityLegsForBoundaryMove(
      boundary,
      deltaDays,
      scopedIntercityLegs,
      moved,
    );
    const derivedForDedupe = projectCalendarFromState(
      {
        ...state,
        accommodationStays: mergeAccommodationStays(state, activeGroupId, moved),
        intercityLegs: syncedLegs,
      },
      {
        groupId: activeGroupId,
        overlayStoredLocationGaps: false,
        gridStart: gridRange.gridStart,
        gridEnd: gridRange.gridEnd,
      },
    );
    const movedLegs = dedupeCityChangeLegs(
      syncedLegs,
      moved,
      projectedDaysToPlaces(derivedForDedupe.days),
    );
    persistAfterBoundaryMove(moved, movedLegs);
  }

  function requestBoundaryMove(boundaryId: string, deltaDays: -1 | 1) {
    const boundary = boundaryById(boundaryId);
    if (!boundary || isBoundaryBlocked(boundary)) return;

    const day = dayPlaces.find((d) => d.date === boundary.date);
    const leg = findTransportLegOnDay(state, boundary.date, day);
    const reason = leg ? warningReasonForLeg(leg) : null;
    if (reason) {
      setPendingBoundaryMove({ boundaryId, deltaDays, reason });
      return;
    }
    commitBoundaryMove(boundaryId, deltaDays);
  }

  function onBoundaryMove(boundaryId: string, deltaDays: -1 | 1) {
    if (!hasNamedStays) return;
    requestBoundaryMove(boundaryId, deltaDays);
  }

  function confirmPendingBoundaryMove() {
    if (!pendingBoundaryMove) return;
    const { boundaryId, deltaDays } = pendingBoundaryMove;
    setPendingBoundaryMove(null);
    commitBoundaryMove(boundaryId, deltaDays);
  }

  function cancelPendingBoundaryMove() {
    setPendingBoundaryMove(null);
  }

  return {
    datesUnset,
    usingDefaultRange: bounds.usingDefaultRange,
    calendarBounds: bounds,
    scrollRange,
    gridRange,
    interactionRange,
    tripEdgeRange,
    scrollAnchorDate,
    pinnedScrollDate,
    scrollToDate,
    isMain,
    mainDays,
    dayPlaces,
    overlayMetaByDate,
    travelLayoutsByDate,
    transitByDate,
    selection,
    paintLocation,
    onDayClick,
    selectTransferDay,
    selectDayFocus,
    clearSelection,
    pendingFillHalf,
    boundaries,
    accommodationByDate,
    hasNamedStays,
    onBoundaryMove,
    pendingBoundaryMove,
    confirmPendingBoundaryMove,
    cancelPendingBoundaryMove,
  };
}
