"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

import { TripTimezoneNote } from "@/components/geo/TripTimezoneNote";
import { intercityLegPrompt, syncIntercityFromDraft } from "@/lib/host/wizard/detect-city-moves";
import { computeCalendarTransport } from "@/lib/host/wizard/transport-day-placement";
import type { IntercityLegDraft, TripWizardDraft } from "@/lib/host/wizard/types";

import { IntercityTravelLegForm } from "../shared/IntercityTravelLegForm";
import { LocationStayCalendar } from "../shared/LocationStayCalendar";
import {
  WizardCalendarLayout,
  WizardSidebarNav,
} from "../shared/WizardCalendarLayout";

function sortIntercityLegs(legs: IntercityLegDraft[]): IntercityLegDraft[] {
  const kindOrder = { airport_arrival: 0, airport_departure: 1, city_change: 2 } as const;
  return [...legs].sort((a, b) => {
    const dateCmp = a.travelDate.localeCompare(b.travelDate);
    if (dateCmp !== 0) return dateCmp;
    const ka = kindOrder[a.legKind ?? "city_change"];
    const kb = kindOrder[b.legKind ?? "city_change"];
    return ka - kb;
  });
}

function cityShort(name: string): string {
  return name.split(",")[0]?.trim() || name;
}

function formatLegDate(iso: string): string {
  return DateTime.fromISO(iso).toFormat("d MMM yyyy");
}

export function BetweenCityTravelStep({
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
  const { basics, dayPlaces } = draft;
  const [legIndex, setLegIndex] = useState(0);

  useEffect(() => {
    if (!draft.datesPlacesConfirmed || draft.dayPlaces.length === 0) return;
    const synced = syncIntercityFromDraft(draft);
    if (JSON.stringify(synced) !== JSON.stringify(draft.intercityLegs)) {
      onChange({ ...draft, intercityLegs: synced });
    }
  }, [
    draft.dayPlaces,
    draft.datesPlacesConfirmed,
    draft.outboundLegs,
    draft.returnLegs,
    draft.basics.startDate,
    draft.basics.endDate,
  ]);

  const sortedLegs = useMemo(() => sortIntercityLegs(draft.intercityLegs), [draft.intercityLegs]);

  useEffect(() => {
    if (legIndex >= sortedLegs.length && sortedLegs.length > 0) {
      setLegIndex(sortedLegs.length - 1);
    }
  }, [sortedLegs.length, legIndex]);

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
      basics.startDate,
      basics.endDate,
      basics.departureCity,
      basics.returnCity,
    ],
  );

  const currentLeg = sortedLegs[legIndex];
  const isLastLeg = legIndex >= sortedLegs.length - 1;

  function handlePreviousLeg() {
    if (legIndex > 0) setLegIndex((i) => i - 1);
  }

  function handleContinue() {
    if (sortedLegs.length === 0 || isLastLeg) {
      onContinue?.();
    } else {
      setLegIndex((i) => i + 1);
    }
  }

  function updateLeg(updated: IntercityLegDraft, leg: IntercityLegDraft) {
    const index = draft.intercityLegs.findIndex((l) => l.id === leg.id);
    const next: IntercityLegDraft = {
      ...updated,
      intercityFromCity: leg.intercityFromCity,
      intercityToCity: leg.intercityToCity,
      legKind: leg.legKind,
      anchorLegId: leg.anchorLegId,
    };
    onChange({
      ...draft,
      intercityLegs: draft.intercityLegs.map((l, j) => (j === index ? next : l)),
    });
  }

  if (!draft.datesPlacesConfirmed) {
    return (
      <div className="space-y-3">
        <h2 className="text-xl font-semibold tracking-tight text-zinc-900">Between cities</h2>
        <p className="text-sm text-amber-700">
          Finish your dates and places plan first, then you can set travel between each city change
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 lg:space-y-6">
      <div className="mb-5 border-b border-zinc-100 pb-4">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">Between cities</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Leg {legIndex + 1} of {sortedLegs.length || 1} — how are you getting there?
        </p>
      </div>

      {!basics.startDate || !basics.endDate ? (
        <p className="text-sm text-amber-700">Set trip dates in Basics first.</p>
      ) : sortedLegs.length === 0 ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 text-sm text-zinc-600">
            No city changes in your plan — you can continue to accommodation.
          </p>
          <WizardSidebarNav
            onBack={onBack}
            onContinue={onContinue}
            saving={saving}
          />
        </div>
      ) : (
        <WizardCalendarLayout
          sidebar={
            <>
              <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
                <h3 className="text-lg font-semibold tracking-tight text-zinc-900">
                  {cityShort(currentLeg!.intercityFromCity)}{" "}
                  <span className="font-normal text-zinc-400">→</span>{" "}
                  {cityShort(currentLeg!.intercityToCity)}
                </h3>
                <time className="mt-1 block text-xs font-medium text-zinc-500">
                  {formatLegDate(currentLeg!.travelDate)}
                </time>
                {intercityLegPrompt(currentLeg!) ? (
                  <p className="mt-2 text-xs leading-relaxed text-indigo-700">
                    {intercityLegPrompt(currentLeg!)}
                  </p>
                ) : null}
              </div>

              <IntercityTravelLegForm
                embedded
                leg={currentLeg!}
                countryNames={basics.destinationCountries}
                onChange={(updated) => updateLeg(updated, currentLeg!)}
              />
            </>
          }
          sidebarFooter={
            <WizardSidebarNav
              onPreviousLeg={handlePreviousLeg}
              previousLegDisabled={legIndex === 0}
              onBack={onBack}
              backLabel="Back to places"
              onContinue={handleContinue}
              continueLabel={isLastLeg ? "Continue" : "Next leg"}
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
                highlightDate={currentLeg?.travelDate}
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
