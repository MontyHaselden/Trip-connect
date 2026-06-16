"use client";

import { DateTime } from "luxon";
import { useEffect, useMemo, useState } from "react";

import { LocationAssignmentPanel } from "@/components/host/wizard/shared/LocationAssignmentPanel";
import { stayCityLabel } from "@/lib/host/setup/accommodation-calendar";
import { mainAccommodationStays } from "@/lib/host/setup/entity-scope";
import { expandSelectionToNightPair, formatNightPairLabel } from "@/lib/host/setup/night-pair-selection";
import { removeAccommodationAndCitiesFromRange } from "@/lib/host/setup/remove-accommodation-range";
import { applySetupTransportChange } from "@/lib/host/setup/apply-setup-transport";
import { dedupeCityChangeLegs } from "@/lib/host/setup/dedupe-intercity-legs";
import { locationsStatusItems } from "@/lib/host/setup/section-status-items";
import type { TripSetupState } from "@/lib/host/setup/types";
import { cityOnHalf } from "@/lib/host/wizard/location-stays";
import { legTouchesRange } from "@/lib/host/wizard/transport-leg-dates";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

import { SetupAddsPanel } from "./SetupAddsPanel";
import { SetupSectionSplit } from "./SetupSectionSplit";
import { SetupSectionStatusPanel } from "./SetupSectionStatusPanel";
import type { CalendarSelection, useSetupCalendar } from "./use-setup-calendar";

type CalendarApi = ReturnType<typeof useSetupCalendar>;

function formatRangeDate(iso: string): string {
  return DateTime.fromISO(iso).toFormat("d MMM yyyy");
}

function paintedLabelForSelection(
  selection: CalendarSelection,
  dayPlaces: DayPlaceDraft[],
): string | null {
  const expanded = expandSelectionToNightPair(selection);
  const { rangeStart, rangeEnd, startHalf, endHalf } = expanded;
  if (!rangeStart) return null;
  const end = rangeEnd || rangeStart;

  const labels: string[] = [];
  for (const day of dayPlaces) {
    if (day.date < rangeStart || day.date > end) continue;
    if (day.date === rangeStart && day.date === end) {
      if (startHalf === "left" || startHalf === "full") {
        const left = cityOnHalf(day, "left").trim();
        if (left) labels.push(left);
      }
      if (endHalf === "right" || (startHalf === "full" && endHalf === "full")) {
        const right = cityOnHalf(day, "right").trim();
        if (right) labels.push(right);
      }
      continue;
    }
    if (day.date === rangeStart && (startHalf === "left" || startHalf === "full")) {
      const left = cityOnHalf(day, "left").trim();
      if (left) labels.push(left);
    } else if (day.date === end && (endHalf === "right" || endHalf === "full")) {
      const right = cityOnHalf(day, "right").trim();
      if (right) labels.push(right);
    } else {
      const primary = day.primaryCity.trim();
      const secondary = day.secondaryCity?.trim() ?? "";
      if (primary) labels.push(primary);
      if (secondary && secondary !== primary) labels.push(secondary);
    }
  }

  return [...new Set(labels)].join(" · ") || null;
}

function locationSourceHint(
  state: TripSetupState,
  rangeStart: string,
  rangeEnd: string,
  dayPlaces: DayPlaceDraft[],
): string | null {
  const end = rangeEnd || rangeStart;
  const named = mainAccommodationStays(state).filter((s) => s.name?.trim());
  const stayMatch = named.find(
    (s) => s.checkInDate <= end && s.checkOutDate >= rangeStart,
  );
  if (stayMatch) {
    return `From accommodation: ${stayMatch.name?.trim() || stayCityLabel(stayMatch)}`;
  }

  const legs = [
    ...state.outboundLegs.map((leg) => ({ kind: "outbound" as const, leg })),
    ...state.returnLegs.map((leg) => ({ kind: "return" as const, leg })),
    ...state.intercityLegs.map((leg) => ({ kind: "intercity" as const, leg })),
  ];
  const touching = legs.filter(({ leg }) => legTouchesRange(leg, rangeStart, end));
  if (touching.length) {
    const labels = touching.map(({ kind, leg }) => {
      const num = leg.flightNumber?.trim();
      return num ? `${kind} flight ${num}` : `${kind} transport`;
    });
    return `From transport: ${labels.join(", ")}`;
  }

  const painted = paintedLabelForSelection(
    { rangeStart, rangeEnd: end, startHalf: "full", endHalf: "full" },
    dayPlaces,
  );
  if (painted) return "Painted on the calendar — clear below if it looks wrong.";

  return null;
}

export function SetupLocationsSection(props: {
  state: TripSetupState;
  activeGroupId: string;
  calendar: CalendarApi;
  sectionLabel?: string;
  sectionMessage?: string;
  onChange: (next: TripSetupState) => void;
  onSave: (next: TripSetupState) => void | Promise<void>;
  saving: boolean;
}) {
  const { state, activeGroupId, calendar, sectionLabel, sectionMessage, onChange, onSave, saving } =
    props;
  const isMain = activeGroupId === state.mainGroupId;
  const expanded = useMemo(
    () => expandSelectionToNightPair(calendar.selection),
    [calendar.selection],
  );
  const { rangeStart, rangeEnd, startHalf, endHalf } = expanded;
  const end = rangeEnd || rangeStart;

  const [pendingLocation, setPendingLocation] = useState("");

  const statusItems = useMemo(
    () => locationsStatusItems(state, activeGroupId),
    [state, activeGroupId],
  );

  const paintedLabel = useMemo(
    () => paintedLabelForSelection(calendar.selection, calendar.dayPlaces),
    [calendar.selection, calendar.dayPlaces],
  );

  const sourceHint = useMemo(() => {
    if (!rangeStart) return null;
    return locationSourceHint(state, rangeStart, end, calendar.dayPlaces);
  }, [state, rangeStart, end, calendar.dayPlaces]);

  const rangeLabel = rangeStart ? formatNightPairLabel(expanded) : null;

  useEffect(() => {
    if (paintedLabel && !pendingLocation.trim()) {
      const first = paintedLabel.split(" · ")[0]?.trim() ?? "";
      if (first) setPendingLocation(first);
    }
  }, [rangeStart, paintedLabel, pendingLocation]);

  function dedupeIntercityLegsForState(nextState: TripSetupState) {
    const named = mainAccommodationStays(nextState).filter((s) => s.name?.trim());
    const dayPlaces = nextState.dayPlacesByGroupId[nextState.mainGroupId] ?? [];
    return dedupeCityChangeLegs(nextState.intercityLegs, named, dayPlaces);
  }

  function handleConfirmLocation() {
    calendar.paintLocation(pendingLocation);
    setPendingLocation("");
  }

  function handleClearSelection() {
    calendar.clearSelection();
    setPendingLocation("");
  }

  function handleClearPainted() {
    if (!rangeStart || !isMain) return;
    if (
      !window.confirm(
        `Clear the painted location for ${rangeLabel ?? formatRangeDate(rangeStart)}?`,
      )
    ) {
      return;
    }
    let next = removeAccommodationAndCitiesFromRange(
      state,
      rangeStart,
      end,
      state.mainGroupId,
      { startHalf, endHalf },
    );
    next = {
      ...next,
      intercityLegs: dedupeIntercityLegsForState(next),
    };
    next = applySetupTransportChange(next, { intercityLegs: next.intercityLegs });
    onChange(next);
    void onSave(next);
    handleClearSelection();
  }

  const canEdit = isMain && Boolean(rangeStart);

  return (
    <SetupSectionSplit
      status={
        <SetupSectionStatusPanel
          section={
            sectionLabel
              ? { id: "locations", label: sectionLabel, status: "todo", message: sectionMessage }
              : undefined
          }
          items={statusItems}
        />
      }
      adds={
        <SetupAddsPanel>
          <div className="space-y-5">
            {!isMain ? (
              <p className="text-sm text-zinc-600">
                Switch to Main Group to paint base locations. This group only shows overlay
                differences on the calendar.
              </p>
            ) : (
              <>
                <p className="text-sm text-zinc-600">
                  Tap days on the calendar to select a night, then assign or clear the city shown
                  there. Click a painted half to inspect it — you won&apos;t be sent to Transport.
                </p>

                {rangeStart ? (
                  <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-950">
                    <p className="font-medium">Selected: {rangeLabel}</p>
                    {paintedLabel ? (
                      <p className="mt-1">
                        On calendar: <span className="font-medium">{paintedLabel}</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-sky-800">No location painted on this night yet.</p>
                    )}
                    {sourceHint ? <p className="mt-1 text-xs text-sky-800">{sourceHint}</p> : null}
                  </div>
                ) : null}

                <LocationAssignmentPanel
                  location={pendingLocation}
                  onLocationChange={setPendingLocation}
                  rangeStart={rangeStart}
                  rangeEnd={end}
                  onConfirm={handleConfirmLocation}
                  onClearDates={rangeStart ? handleClearSelection : undefined}
                  countryNames={state.basics.destinationCountries}
                  layout="sidebar"
                />

                {canEdit && paintedLabel ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleClearPainted}
                    className="text-sm font-medium text-red-700 hover:underline disabled:opacity-50"
                  >
                    Clear painted location for this night
                  </button>
                ) : null}
              </>
            )}

            <button
              type="button"
              disabled={saving || !isMain}
              onClick={() => void onSave(state)}
              className="h-10 w-full rounded-lg bg-zinc-900 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save locations"}
            </button>
          </div>
        </SetupAddsPanel>
      }
    />
  );
}
