"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { TripTimezoneNote } from "@/components/geo/TripTimezoneNote";
import { computeCalendarBounds } from "@/lib/host/wizard/calendar-bounds";
import {
  buildDefaultDayPlaces,
  syncIntercityLegs,
} from "@/lib/host/wizard/detect-city-moves";
import { applyTransportToDraft, resizeDayPlacesForTripRange } from "@/lib/host/wizard/derive-trip-dates";
import { applyCrossoverDrag } from "@/lib/host/wizard/crossover-adjust";
import {
  buildTripDayCoverageContext,
  computeCalendarTransport,
  flightArrivalDates,
  flightDepartureDates,
  hasAfternoonDepartureTravel,
  isCalendarDaySelectable,
  returnDepartsAfterTripEnd,
  travelLayoutMorningPaintEnd,
  travelLayoutPaintStart,
  travelPaintStartByDate,
  tripDayHasPaintableStaySlot,
} from "@/lib/host/wizard/transport-day-placement";
import {
  applyLocationStays,
  coalesceAdjacentStays,
  effectiveStayStart,
  getEmptyHalf,
  hasUncoveredTripDays,
  inferStaysFromDayPlaces,
  mergeStaysWithNewRange,
  previewStayMerge,
  trimStaysForNewRange,
  type HalfSide,
  type LocationStayDraft,
} from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft, TripWizardDraft } from "@/lib/host/wizard/types";

import {
  ConfirmedStaysList,
  LocationAssignmentPanel,
} from "../shared/LocationAssignmentPanel";
import { LocationStayCalendar } from "../shared/LocationStayCalendar";
import {
  WizardCalendarLayout,
  WizardSidebarNav,
} from "../shared/WizardCalendarLayout";

export function DatesPlacesStep({
  draft,
  onChange,
  onBack,
  onContinue,
  continueDisabled,
  saving,
}: {
  draft: TripWizardDraft;
  onChange: (draft: TripWizardDraft) => void;
  onBack?: () => void;
  onContinue?: () => void;
  continueDisabled?: boolean;
  saving?: boolean;
}) {
  const { basics, dayPlaces } = draft;
  const [stays, setStays] = useState<LocationStayDraft[]>([]);
  const [pendingLocation, setPendingLocation] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [rangeStartHalf, setRangeStartHalf] = useState<HalfSide | "full">("full");
  const [rangeEndHalf, setRangeEndHalf] = useState<HalfSide | "full">("full");
  const [staysInitialized, setStaysInitialized] = useState(false);
  const wasNeedingMoreLocations = useRef(true);

  function tripContext() {
    return {
      startDate: basics.startDate,
      endDate: basics.endDate,
      departureCity: basics.departureCity,
      returnCity: basics.returnCity,
    };
  }

  function finalizeDays(nextStays: LocationStayDraft[]): DayPlaceDraft[] {
    const ctx = tripContext();
    return applyLocationStays(
      dayPlaces,
      nextStays,
      ctx,
      flightDepartureDates(draft, ctx),
      travelPaintStartByDate(draft, ctx),
      flightArrivalDates(draft, ctx),
      returnDepartsAfterTripEnd(draft, ctx.endDate),
    );
  }

  const { travelLayouts: travelLayoutsByDate, transitOverlays: transitByDate } = useMemo(
    () => computeCalendarTransport(draft, tripContext(), { includeIntercity: false }),
    [
      draft.outboundLegs,
      draft.returnLegs,
      draft.intercityLegs,
      basics.startDate,
      basics.endDate,
      basics.departureCity,
      basics.returnCity,
    ],
  );

  useEffect(() => {
    const synced = applyTransportToDraft(draft);
    if (
      synced.basics.startDate !== draft.basics.startDate ||
      synced.basics.endDate !== draft.basics.endDate ||
      synced.basics.departureCity !== draft.basics.departureCity ||
      synced.basics.returnCity !== draft.basics.returnCity
    ) {
      onChange(synced);
    }
  }, []);

  useEffect(() => {
    if (dayPlaces.length > 0 || !basics.startDate || !basics.endDate) return;
    const bounds = computeCalendarBounds(draft, basics);
    onChange({
      ...draft,
      dayPlaces: buildDefaultDayPlaces(
        basics.startDate,
        basics.endDate,
        basics.departureCity,
        basics.returnCity,
        bounds?.lastDate,
      ),
    });
  }, [basics.startDate, basics.endDate, basics.departureCity, basics.returnCity, dayPlaces.length]);

  const lastPlaceDate = dayPlaces[dayPlaces.length - 1]?.date ?? "";

  useEffect(() => {
    if (!basics.startDate || !basics.endDate || dayPlaces.length === 0) return;
    const bounds = computeCalendarBounds(draft, basics);
    if (!bounds || !lastPlaceDate || lastPlaceDate >= bounds.lastDate) return;
    onChange({
      ...draft,
      dayPlaces: resizeDayPlacesForTripRange(
        dayPlaces,
        basics.startDate,
        basics.endDate,
        basics.departureCity,
        basics.returnCity,
        bounds.lastDate,
      ),
    });
  }, [
    basics.startDate,
    basics.endDate,
    basics.departureCity,
    basics.returnCity,
    lastPlaceDate,
    draft.outboundLegs,
    draft.returnLegs,
  ]);

  useEffect(() => {
    if (staysInitialized || !basics.startDate || !basics.endDate || !dayPlaces.length) return;
    const inferred = inferStaysFromDayPlaces(
      dayPlaces,
      basics.startDate,
      basics.endDate,
      basics.departureCity,
      basics.returnCity,
    );
    if (inferred.length) {
      setStays(inferred);
    }
    setStaysInitialized(true);
  }, [dayPlaces, basics.startDate, basics.endDate, staysInitialized]);

  useEffect(() => {
    if (!staysInitialized || !stays.length || !basics.startDate || !basics.endDate) return;
    const refreshed = finalizeDays(stays);
    if (JSON.stringify(refreshed) === JSON.stringify(dayPlaces)) return;
    onChange({ ...draft, dayPlaces: refreshed });
  }, [
    staysInitialized,
    stays,
    draft.outboundLegs,
    draft.returnLegs,
    draft.intercityLegs,
    basics.startDate,
    basics.endDate,
    basics.departureCity,
    basics.returnCity,
  ]);

  const needsMoreLocations = useMemo(() => {
    if (!basics.startDate || !basics.endDate) return false;
    const trip = tripContext();
    return hasUncoveredTripDays(
      dayPlaces,
      basics.startDate,
      basics.endDate,
      buildTripDayCoverageContext(draft, trip, { includeIntercity: false }),
    );
  }, [
    dayPlaces,
    basics.startDate,
    basics.endDate,
    basics.departureCity,
    basics.returnCity,
    draft.outboundLegs,
    draft.returnLegs,
    draft.intercityLegs,
  ]);

  useEffect(() => {
    if (!needsMoreLocations || !draft.datesPlacesConfirmed) return;
    onChange({ ...draft, datesPlacesConfirmed: false });
  }, [needsMoreLocations, draft.datesPlacesConfirmed]);

  useEffect(() => {
    if (needsMoreLocations || draft.datesPlacesConfirmed || !basics.startDate || !basics.endDate) {
      return;
    }
    onChange({ ...draft, datesPlacesConfirmed: true });
  }, [
    needsMoreLocations,
    draft.datesPlacesConfirmed,
    dayPlaces,
    basics.startDate,
    basics.endDate,
    draft.outboundLegs,
    draft.returnLegs,
    draft.intercityLegs,
  ]);

  useEffect(() => {
    if (needsMoreLocations) {
      wasNeedingMoreLocations.current = true;
      return;
    }
    if (!wasNeedingMoreLocations.current) return;
    if (!basics.startDate || !basics.endDate || !dayPlaces.length) return;
    wasNeedingMoreLocations.current = false;
    const inferred = inferStaysFromDayPlaces(
      dayPlaces,
      basics.startDate,
      basics.endDate,
      basics.departureCity,
      basics.returnCity,
    );
    setStays(inferred);
    setPendingLocation("");
    setRangeStart("");
    setRangeEnd("");
    setRangeStartHalf("full");
    setRangeEndHalf("full");
  }, [
    needsMoreLocations,
    basics.startDate,
    basics.endDate,
    basics.departureCity,
    basics.returnCity,
    dayPlaces,
  ]);

  const adjacentMerge = useMemo(() => {
    if (!pendingLocation.trim() || !rangeStart) return null;
    const endDate = rangeEnd || rangeStart;
    const startDate = effectiveStayStart(rangeStart, endDate, dayPlaces);
    const preview = previewStayMerge(stays, pendingLocation, startDate, endDate);
    return preview ? { stay: preview } : null;
  }, [pendingLocation, rangeStart, rangeEnd, dayPlaces, stays]);

  function commitStays(nextStays: LocationStayDraft[]) {
    const coalesced = coalesceAdjacentStays(nextStays);
    setStays(coalesced);
    const finalDays = finalizeDays(coalesced);
    onChange({
      ...draft,
      dayPlaces: finalDays,
      datesPlacesConfirmed: false,
      intercityLegs: nextStays.length ? draft.intercityLegs : [],
    });
  }

  function clearAllStays() {
    setStays([]);
    setPendingLocation("");
    clearDateSelection();
    const finalDays = finalizeDays([]);
    onChange({
      ...draft,
      dayPlaces: finalDays,
      intercityLegs: [],
      datesPlacesConfirmed: false,
    });
  }

  function halfForDate(iso: string): HalfSide | "full" {
    const day = dayPlaces.find((d) => d.date === iso);
    const emptyHalf = day ? getEmptyHalf(day) : null;
    if (emptyHalf) return emptyHalf;

    const segments = travelLayoutsByDate.get(iso);
    const paintStart = travelLayoutPaintStart(segments);
    const morningEnd = travelLayoutMorningPaintEnd(segments);
    if (morningEnd > 0 && morningEnd < 1 && !day?.primaryCity.trim()) return "left";
    if (paintStart > 0 && paintStart < 1) {
      if (!day?.secondaryCity?.trim()) return "right";
      return "right";
    }
    if (iso === basics.endDate && hasAfternoonDepartureTravel(segments)) return "left";

    return "full";
  }

  function setRangeWithHalves(start: string, end: string) {
    setRangeStart(start);
    setRangeEnd(end);
    setRangeStartHalf(halfForDate(start));
    const endDay = dayPlaces.find((d) => d.date === end);
    setRangeEndHalf(
      start !== end && !(endDay && getEmptyHalf(endDay)) ? "left" : halfForDate(end),
    );
  }

  function onCalendarDayClick(iso: string) {
    const ctx = tripContext();
    const day = dayPlaces.find((d) => d.date === iso) ?? null;
    const segments = travelLayoutsByDate.get(iso);
    const selectable = isCalendarDaySelectable({
      iso,
      trip: ctx,
      day,
      travelSegments: segments,
    });

    if (!selectable) {
      if (rangeStart) clearDateSelection();
      return;
    }

    const start = rangeStart;
    const end = rangeEnd || rangeStart;

    if (rangeStart && iso >= start && iso <= end) {
      if (start === end) {
        clearDateSelection();
        return;
      }
      setRangeWithHalves(iso, iso);
      return;
    }

    if (!rangeStart) {
      setRangeWithHalves(iso, iso);
      return;
    }

    setRangeWithHalves(iso < start ? iso : start, iso > end ? iso : end);
  }

  function clearDateSelection() {
    setRangeStart("");
    setRangeEnd("");
    setRangeStartHalf("full");
    setRangeEndHalf("full");
  }

  function confirmLocation() {
    if (!pendingLocation.trim() || !rangeStart) return;
    const endDate = rangeEnd || rangeStart;
    const location = pendingLocation.trim();
    const startDate = effectiveStayStart(rangeStart, endDate, dayPlaces);
    const trimmed = trimStaysForNewRange(stays, location, startDate, dayPlaces);
    const nextStays = mergeStaysWithNewRange(trimmed, location, startDate, endDate);
    commitStays(nextStays);
    setPendingLocation("");
    setRangeStart("");
    setRangeEnd("");
    setRangeStartHalf("full");
    setRangeEndHalf("full");
  }

  function removeStay(index: number) {
    const nextStays = stays.filter((_, i) => i !== index);
    commitStays(nextStays);
  }

  function updateDayShare(date: string, primaryShare: number) {
    const ctx = tripContext();
    const nextDays = applyCrossoverDrag(dayPlaces, date, primaryShare, ctx, {
      flightDepartureDates: flightDepartureDates(draft, ctx),
      flightArrivalDates: flightArrivalDates(draft, ctx),
      skipEndHomeLock: returnDepartsAfterTripEnd(draft, ctx.endDate),
    });
    const intercityLegs = syncIntercityLegs(nextDays, draft.intercityLegs, {
      outboundLegs: draft.outboundLegs,
      returnLegs: draft.returnLegs,
      trip: ctx,
    });
    const inferred = inferStaysFromDayPlaces(
      nextDays,
      basics.startDate,
      basics.endDate,
      basics.departureCity,
      basics.returnCity,
    );
    setStays(inferred);
    onChange({ ...draft, dayPlaces: nextDays, intercityLegs });
  }

  function pendingFillHalf(iso: string): HalfSide | "full" | null {
    if (!rangeStart) return null;
    const end = rangeEnd || rangeStart;
    if (iso < rangeStart || iso > end) return null;

    const day = dayPlaces.find((d) => d.date === iso);
    const emptyHalf = day ? getEmptyHalf(day) : null;
    if (emptyHalf) return emptyHalf;

    if (iso === rangeStart && iso === end) return rangeStartHalf;
    if (iso === rangeStart) return rangeStartHalf;
    if (iso === end) {
      if (rangeStart !== end && !emptyHalf) return "left";
      return rangeEndHalf;
    }
    return "full";
  }

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="mb-5 border-b border-zinc-100 pb-4">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Where are you when?</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Tap days to assign stays. When every trip day has a location, continue.
        </p>
      </div>

      {!basics.startDate || !basics.endDate ? (
        <p className="text-sm text-amber-700">Set trip dates in Basics first.</p>
      ) : (
        <WizardCalendarLayout
          sidebar={
            <>
              <LocationAssignmentPanel
                layout="sidebar"
                extendingStay={adjacentMerge?.stay.location}
                location={pendingLocation}
                onLocationChange={setPendingLocation}
                rangeStart={rangeStart}
                rangeEnd={rangeEnd || rangeStart}
                onConfirm={confirmLocation}
                onClearDates={rangeStart ? clearDateSelection : undefined}
                countryNames={basics.destinationCountries}
              />
              {!needsMoreLocations ? (
                <p className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm font-medium text-emerald-800">
                  All trip days assigned — you can continue.
                </p>
              ) : null}

              <ConfirmedStaysList stays={stays} onRemove={removeStay} onClearAll={clearAllStays} />
            </>
          }
          sidebarFooter={
            <WizardSidebarNav
              onBack={onBack}
              onContinue={onContinue}
              continueDisabled={continueDisabled}
              saving={saving}
              hint={
                continueDisabled
                  ? "Fill every trip day on the calendar to continue."
                  : undefined
              }
            />
          }
          calendar={
            <>
              <LocationStayCalendar
                days={dayPlaces}
                tripStart={basics.startDate}
                tripEnd={basics.endDate}
                departureCity={basics.departureCity}
                returnCity={basics.returnCity}
                travelLayoutsByDate={travelLayoutsByDate}
                transitByDate={transitByDate}
                selectable
                pendingRangeStart={rangeStart}
                pendingRangeEnd={rangeEnd || rangeStart}
                pendingFillHalf={pendingFillHalf}
                onDayClick={onCalendarDayClick}
                onShareChange={updateDayShare}
              />

              <TripTimezoneNote
                countries={basics.destinationCountries}
                cities={dayPlaces.map((d) => d.primaryCity).filter(Boolean)}
                departureCity={basics.departureCity}
                currentTimezone={basics.timezone}
                onTimezoneResolved={(timezone) =>
                  onChange({ ...draft, basics: { ...basics, timezone } })
                }
              />
            </>
          }
        />
      )}
    </div>
  );
}
