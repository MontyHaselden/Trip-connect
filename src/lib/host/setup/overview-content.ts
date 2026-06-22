import { stayCityLabel } from "@/lib/host/setup/accommodation-calendar";
import { mainAccommodationStays } from "@/lib/host/setup/entity-scope";
import {
  getVisibleCalendarDayPlaces,
  tripHasPlannedContent,
} from "@/lib/host/setup/reconcile-trip-shell";
import {
  effectiveTripBoundsFromState,
  uncoveredTripDays,
} from "@/lib/host/setup/sync-trip-bounds";
import { tripNameNeedsAttention } from "@/lib/host/setup/trip-naming";
import type { SetupSectionId, TripSetupState } from "@/lib/host/setup/types";
import {
  formatTripDateRangeLabel,
  tripDatesAreUnset,
} from "@/lib/host/trip-date-display";

export type OverviewSummaryLine = {
  id: string;
  label: string;
  value: string;
};

export type OverviewNavTarget = SetupSectionId | "ingest" | "map";

export type OverviewNextStep = {
  id: string;
  title: string;
  detail: string;
  section?: OverviewNavTarget;
};

function legRoute(from: string, to: string): string {
  const route = [from.trim(), to.trim()].filter(Boolean).join(" → ");
  return route || "Route TBC";
}

function uniqueCities(days: TripSetupState["dayPlacesByGroupId"][string]): string[] {
  const cities = new Set<string>();
  for (const day of days) {
    const primary = day.primaryCity.trim();
    const secondary = day.secondaryCity?.trim() ?? "";
    if (primary) cities.add(primary.split(",")[0]!.trim());
    if (secondary) cities.add(secondary.split(",")[0]!.trim());
  }
  return [...cities];
}

/** Group-wide snapshot — only lines that have real data. */
export function buildOverviewSummary(state: TripSetupState): OverviewSummaryLine[] {
  const lines: OverviewSummaryLine[] = [];
  const paintedDays = getVisibleCalendarDayPlaces(state);

  const tripBounds = effectiveTripBoundsFromState(state);
  if (!tripDatesAreUnset(tripBounds.startDate, tripBounds.endDate)) {
    lines.push({
      id: "dates",
      label: "Dates",
      value: formatTripDateRangeLabel(tripBounds.startDate, tripBounds.endDate),
    });
  }

  if (paintedDays.length) {
    const cities = uniqueCities(paintedDays);
    lines.push({
      id: "locations",
      label: "Locations",
      value:
        cities.length > 0
          ? `${cities.join(", ")} · ${paintedDays.length} day${paintedDays.length === 1 ? "" : "s"}`
          : `${paintedDays.length} day${paintedDays.length === 1 ? "" : "s"} planned`,
    });
  }

  const stays = mainAccommodationStays(state).filter((s) => s.name?.trim());
  for (const stay of stays) {
    lines.push({
      id: `stay-${stay.id}`,
      label: "Accommodation",
      value: `${stay.name!.trim()} · ${stayCityLabel(stay)} · ${stay.checkInDate} – ${stay.checkOutDate}`,
    });
  }

  for (const leg of state.outboundLegs) {
    lines.push({
      id: `out-${leg.id}`,
      label: "Outbound",
      value: `${legRoute(leg.fromCity, leg.toCity)} · ${leg.travelDate || "Date TBC"}`,
    });
  }
  for (const leg of state.returnLegs) {
    lines.push({
      id: `ret-${leg.id}`,
      label: "Return",
      value: `${legRoute(leg.fromCity, leg.toCity)} · ${leg.travelDate || "Date TBC"}`,
    });
  }
  for (const leg of state.intercityLegs) {
    lines.push({
      id: `ic-${leg.id}`,
      label: "Between cities",
      value: `${legRoute(leg.intercityFromCity, leg.intercityToCity)} · ${leg.travelDate || "Date TBC"}`,
    });
  }

  if (state.activities.length) {
    lines.push({
      id: "activities",
      label: "Activities",
      value: `${state.activities.length} planned`,
    });
  }

  return lines;
}

/** True when the host has not yet added locations, stays, transport, or activities. */
export function isTripWelcomeState(state: TripSetupState): boolean {
  return !tripHasPlannedContent(state);
}

/** Friendly first-visit suggestions — no warning labels. */
export function buildWelcomeSuggestions(state: TripSetupState): OverviewNextStep[] {
  const steps: OverviewNextStep[] = [
    {
      id: "locations",
      title: "Pick cities and locations",
      detail:
        "Select days on the calendar (right) and paint where the group will be — Tokyo, Kyoto, a region, or home city.",
      section: "locations",
    },
    {
      id: "accommodation",
      title: "Already have a hotel booked?",
      detail:
        "Tap the nights you need on the calendar and add the property — booked or still to confirm.",
      section: "accommodation",
    },
    {
      id: "transport",
      title: "Flights and transfers (when ready)",
      detail:
        "Select travel days on the calendar and add legs — you will see Depart for Tokyo style labels on the grid.",
      section: "locations",
    },
  ];

  if (tripNameNeedsAttention(state.basics.name)) {
    steps.unshift({
      id: "trip-name",
      title: "Give this trip a name",
      detail: "Rename “New trip” above so it is easy to find on your dashboard.",
    });
  }

  return steps;
}

/** Suggested next actions in priority order. */
export function buildOverviewNextSteps(state: TripSetupState): OverviewNextStep[] {
  if (isTripWelcomeState(state)) {
    return buildWelcomeSuggestions(state);
  }

  const steps: OverviewNextStep[] = [];
  const mainDays = state.dayPlacesByGroupId[state.mainGroupId] ?? [];
  const tripBounds = effectiveTripBoundsFromState(state);
  const uncovered = uncoveredTripDays(
    mainDays,
    tripBounds.startDate,
    tripBounds.endDate,
  );
  const hasTransport =
    state.outboundLegs.length > 0 ||
    state.returnLegs.length > 0 ||
    state.intercityLegs.length > 0;
  const hasStays = mainAccommodationStays(state).some((s) => s.name?.trim());

  if (tripNameNeedsAttention(state.basics.name)) {
    steps.push({
      id: "trip-name",
      title: "Name this trip",
      detail: "Give the itinerary a clear title in the header above the menu.",
    });
  }

  if (uncovered.length) {
    steps.push({
      id: "locations",
      title: "Daily locations",
      detail: `${uncovered.length} day${uncovered.length === 1 ? "" : "s"} still need a location — select them on the calendar and assign a city.`,
      section: "locations",
    });
  }

  if (!hasStays) {
    steps.push({
      id: "accommodation",
      title: "Accommodation",
      detail: "Add hotels or homestays — select days on the calendar or open Accommodation.",
      section: "accommodation",
    });
  }

  if (!hasTransport) {
    steps.push({
      id: "transport",
      title: "Transportation",
      detail:
        "Select travel days on the calendar and add how the group moves — Depart for… labels appear on the grid.",
      section: "locations",
    });
  }

  if (!state.activities.length) {
    steps.push({
      id: "activities",
      title: "Activities",
      detail: "Add visits, meals, or meetings once transport and stays are sketched in.",
      section: "activities",
    });
  }

  return steps;
}
