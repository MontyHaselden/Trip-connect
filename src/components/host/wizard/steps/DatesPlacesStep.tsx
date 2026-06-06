"use client";

import { useEffect, useMemo, useState } from "react";

import { TripTimezoneNote } from "@/components/geo/TripTimezoneNote";
import { buildDefaultDayPlaces } from "@/lib/host/wizard/detect-city-moves";
import {
  applyLocationStays,
  hasUncoveredTripDays,
  inferStaysFromDayPlaces,
  type LocationStayDraft,
} from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft, TripWizardDraft } from "@/lib/host/wizard/types";

import {
  ConfirmedStaysList,
  LocationAssignmentPanel,
} from "../shared/LocationAssignmentPanel";
import { LocationStayCalendar } from "../shared/LocationStayCalendar";

export function DatesPlacesStep({
  draft,
  onChange,
}: {
  draft: TripWizardDraft;
  onChange: (draft: TripWizardDraft) => void;
}) {
  const { basics, dayPlaces } = draft;
  const [stays, setStays] = useState<LocationStayDraft[]>([]);
  const [assignmentStep, setAssignmentStep] = useState(0);
  const [pendingLocation, setPendingLocation] = useState("");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [staysInitialized, setStaysInitialized] = useState(false);

  useEffect(() => {
    if (dayPlaces.length > 0 || !basics.startDate || !basics.endDate) return;
    onChange({
      ...draft,
      dayPlaces: buildDefaultDayPlaces(
        basics.startDate,
        basics.endDate,
        basics.departureCity,
        basics.returnCity,
      ),
    });
  }, [basics.startDate, basics.endDate, basics.departureCity, basics.returnCity, dayPlaces.length]);

  useEffect(() => {
    if (staysInitialized || !basics.startDate || !basics.endDate || !dayPlaces.length) return;
    const inferred = inferStaysFromDayPlaces(dayPlaces, basics.startDate, basics.endDate);
    if (inferred.length) {
      setStays(inferred);
      setAssignmentStep(inferred.length);
    }
    setStaysInitialized(true);
  }, [dayPlaces, basics.startDate, basics.endDate, staysInitialized]);

  const needsMoreLocations = useMemo(() => {
    if (!basics.startDate || !basics.endDate) return false;
    return hasUncoveredTripDays(dayPlaces, basics.startDate, basics.endDate);
  }, [dayPlaces, basics.startDate, basics.endDate]);

  const showAssignment = needsMoreLocations || assignmentStep === stays.length;

  function rebuildDays(nextStays: LocationStayDraft[]): DayPlaceDraft[] {
    return applyLocationStays(dayPlaces, nextStays, {
      startDate: basics.startDate,
      endDate: basics.endDate,
      departureCity: basics.departureCity,
      returnCity: basics.returnCity,
    });
  }

  function commitStays(nextStays: LocationStayDraft[]) {
    setStays(nextStays);
    onChange({ ...draft, dayPlaces: rebuildDays(nextStays) });
  }

  function onCalendarDayClick(iso: string) {
    if (!showAssignment) return;
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(iso);
      setRangeEnd("");
      return;
    }
    if (iso < rangeStart) {
      setRangeEnd(rangeStart);
      setRangeStart(iso);
    } else {
      setRangeEnd(iso);
    }
  }

  function confirmLocation() {
    if (!pendingLocation.trim() || !rangeStart || !rangeEnd) return;
    const nextStays = [
      ...stays,
      { location: pendingLocation.trim(), startDate: rangeStart, endDate: rangeEnd },
    ];
    commitStays(nextStays);
    setAssignmentStep(nextStays.length);
    setPendingLocation("");
    setRangeStart("");
    setRangeEnd("");
  }

  function removeStay(index: number) {
    const nextStays = stays.filter((_, i) => i !== index);
    commitStays(nextStays);
    setAssignmentStep(nextStays.length);
  }

  function updateDayShare(date: string, primaryShare: number) {
    onChange({
      ...draft,
      dayPlaces: dayPlaces.map((d) =>
        d.date === date
          ? {
              ...d,
              primaryShare,
              dayType: d.secondaryCity ? "travel" : d.dayType,
            }
          : d,
      ),
    });
  }

  function addAnotherLocation() {
    setAssignmentStep(stays.length);
    setPendingLocation("");
    setRangeStart("");
    setRangeEnd("");
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Where are you when?</h2>
      <p className="text-sm text-zinc-600">
        Paint each stay onto the calendar. Edge days are half-filled for travel; drag the split line
        on crossover days if the group needs more or less time in each place.
      </p>

      {!basics.startDate || !basics.endDate ? (
        <p className="text-sm text-amber-700">Set trip dates in Basics first.</p>
      ) : (
        <>
          {showAssignment ? (
            <LocationAssignmentPanel
              stepIndex={assignmentStep}
              location={pendingLocation}
              onLocationChange={setPendingLocation}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onConfirm={confirmLocation}
              onSkip={stays.length > 0 ? () => setAssignmentStep(stays.length + 1) : undefined}
              canSkip={stays.length > 0 && needsMoreLocations}
              countryNames={basics.destinationCountries}
            />
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm">
              <p className="text-zinc-700">All trip days have a location assigned.</p>
              <button
                type="button"
                onClick={addAnotherLocation}
                className="font-medium text-sky-700 hover:underline"
              >
                + Add another location
              </button>
            </div>
          )}

          <LocationStayCalendar
            days={dayPlaces}
            tripStart={basics.startDate}
            tripEnd={basics.endDate}
            selectable={showAssignment}
            pendingRangeStart={rangeStart}
            pendingRangeEnd={rangeEnd}
            onDayClick={onCalendarDayClick}
            onShareChange={updateDayShare}
          />

          <ConfirmedStaysList stays={stays} onRemove={removeStay} />
        </>
      )}

      <TripTimezoneNote
        countries={basics.destinationCountries}
        cities={dayPlaces.map((d) => d.primaryCity).filter(Boolean)}
        departureCity={basics.departureCity}
        currentTimezone={basics.timezone}
        onTimezoneResolved={(timezone) =>
          onChange({ ...draft, basics: { ...basics, timezone } })
        }
      />
    </div>
  );
}
