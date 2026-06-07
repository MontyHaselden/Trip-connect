"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

import { TripTimezoneNote } from "@/components/geo/TripTimezoneNote";
import { suggestAccommodationStays } from "@/lib/host/wizard/detect-city-moves";
import { computeCalendarTransport } from "@/lib/host/wizard/transport-day-placement";
import {
  newId,
  type AccommodationStayDraft,
  type StayType,
  type TripWizardDraft,
} from "@/lib/host/wizard/types";

import { AccommodationStayForm } from "../shared/AccommodationStayForm";
import { LocationStayCalendar } from "../shared/LocationStayCalendar";
import {
  WizardCalendarLayout,
  WizardSidebarNav,
} from "../shared/WizardCalendarLayout";

function cityShort(name: string): string {
  return name.split(",")[0]?.trim() || name;
}

function formatStayRange(checkIn: string, checkOut: string): string {
  const inDt = DateTime.fromISO(checkIn);
  const outDt = DateTime.fromISO(checkOut);
  if (!inDt.isValid || !outDt.isValid) return `${checkIn} – ${checkOut}`;
  if (checkIn === checkOut) return inDt.toFormat("d MMM yyyy");
  return `${inDt.toFormat("d MMM")} → ${outDt.toFormat("d MMM yyyy")}`;
}

function sortAccommodationStays(stays: AccommodationStayDraft[]): AccommodationStayDraft[] {
  return [...stays].sort(
    (a, b) =>
      a.checkInDate.localeCompare(b.checkInDate) ||
      a.checkOutDate.localeCompare(b.checkOutDate) ||
      a.cityLabel.localeCompare(b.cityLabel),
  );
}

export function AccommodationStep({
  draft,
  onChange,
  onBack,
  onContinue,
  saving,
}: {
  draft: TripWizardDraft;
  onChange: (draft: TripWizardDraft) => void;
  onBack?: () => void;
  onContinue?: () => void;
  saving?: boolean;
}) {
  const { accommodationStays, dayPlaces, basics } = draft;
  const [stayIndex, setStayIndex] = useState(0);

  useEffect(() => {
    if (accommodationStays.length > 0 || dayPlaces.length === 0) return;
    const suggested = suggestAccommodationStays(dayPlaces);
    onChange({
      ...draft,
      accommodationStays: suggested.map((s) => ({
        id: newId(),
        cityLabel: s.cityLabel,
        stayType: "hotel" as StayType,
        name: null,
        url: null,
        address: null,
        phone: null,
        checkInDate: s.checkInDate,
        checkOutDate: s.checkOutDate,
        notes: null,
        isHomestayGroup: false,
        multipleInCity: false,
      })),
    });
  }, [dayPlaces.length, accommodationStays.length]);

  const sortedStays = useMemo(
    () => sortAccommodationStays(accommodationStays),
    [accommodationStays],
  );

  useEffect(() => {
    if (stayIndex >= sortedStays.length && sortedStays.length > 0) {
      setStayIndex(sortedStays.length - 1);
    }
  }, [sortedStays.length, stayIndex]);

  const tripContext = useMemo(
    () => ({
      startDate: basics.startDate,
      endDate: basics.endDate,
      departureCity: basics.departureCity,
      returnCity: basics.returnCity,
    }),
    [basics.startDate, basics.endDate, basics.departureCity, basics.returnCity],
  );

  const { travelLayouts: travelLayoutsByDate, transitOverlays: transitByDate } = useMemo(
    () => computeCalendarTransport(draft, tripContext, { includeIntercity: true }),
    [
      draft.outboundLegs,
      draft.returnLegs,
      draft.intercityLegs,
      draft.dayPlaces,
      basics.startDate,
      basics.endDate,
      basics.departureCity,
      basics.returnCity,
    ],
  );

  const currentStay = sortedStays[stayIndex];
  const isLastStay = stayIndex >= sortedStays.length - 1;

  function handlePreviousStay() {
    if (stayIndex > 0) setStayIndex((i) => i - 1);
  }

  function handleContinue() {
    if (sortedStays.length === 0 || isLastStay) {
      onContinue?.();
    } else {
      setStayIndex((i) => i + 1);
    }
  }

  function updateStay(updated: AccommodationStayDraft) {
    onChange({
      ...draft,
      accommodationStays: accommodationStays.map((s) =>
        s.id === updated.id ? updated : s,
      ),
    });
  }

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="mb-5 border-b border-zinc-100 pb-4">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Accommodation</h2>
        <p className="mt-1 text-sm text-zinc-500">
          {sortedStays.length
            ? `Stay ${stayIndex + 1} of ${sortedStays.length} — where is the group sleeping?`
            : "Where is the group staying in each city?"}
        </p>
      </div>

      {!basics.startDate || !basics.endDate ? (
        <p className="text-sm text-amber-700">Set trip dates in Basics first.</p>
      ) : sortedStays.length === 0 ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-amber-700">
            Complete Dates &amp; Places first — we&apos;ll suggest stays from your day plan.
          </p>
          <WizardSidebarNav onBack={onBack} onContinue={onContinue} saving={saving} />
        </div>
      ) : (
        <WizardCalendarLayout
          sidebar={
            <>
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
                <h3 className="text-lg font-semibold tracking-tight text-zinc-900">
                  {cityShort(currentStay!.cityLabel)}
                </h3>
                <p className="mt-1 text-xs font-medium text-zinc-500">
                  {formatStayRange(currentStay!.checkInDate, currentStay!.checkOutDate)}
                </p>
              </div>

              <AccommodationStayForm
                embedded
                stay={currentStay!}
                onChange={updateStay}
                countryNames={basics.destinationCountries}
                cityHint={currentStay!.cityLabel}
              />
            </>
          }
          sidebarFooter={
            <WizardSidebarNav
              onPreviousLeg={handlePreviousStay}
              previousLegLabel="Previous stay"
              previousLegDisabled={stayIndex === 0}
              onBack={onBack}
              backLabel="Back to travel"
              onContinue={handleContinue}
              continueLabel={isLastStay ? "Open trip preview" : "Next stay"}
              continueLoadingLabel={isLastStay ? "Opening preview…" : "Saving…"}
              saving={saving}
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
                highlightDate={currentStay?.checkInDate}
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
