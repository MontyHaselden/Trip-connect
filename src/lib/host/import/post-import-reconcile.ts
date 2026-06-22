import {
  normalizeAccommodationStayCities,
  normalizeDayPlacesAirports,
} from "@/lib/host/setup/canonical-stay-city";
import { alignAccommodationStaysToLocationStays } from "@/lib/host/setup/accommodation-calendar";
import { reconcileImportedAccommodationStays } from "@/lib/host/import/reconcile-accommodation-stays";
import {
  fillSparseCalendarAnchors,
  reconcileImportedDayPlacesWithFlights,
} from "@/lib/host/import/sanitize-imported-locations";
import { findUnpaintedTripDays } from "@/lib/ai/trip-chat-context";
import { citiesMatch, shortCity } from "@/lib/host/wizard/analyze-import-gaps";
import { syncIntercityLegs } from "@/lib/host/wizard/detect-city-moves";
import { inferDayPlacesFromIntercityLeg } from "@/lib/host/setup-inference";
import type { DayPlaceDraft, IntercityLegDraft } from "@/lib/host/wizard/types";
import type { TripSetupState } from "@/lib/host/setup/types";

export type CalendarGapSummary = {
  unpaintedDates: string[];
  missingTransport: Array<{ date: string; fromCity: string; toCity: string }>;
};

function endingCityOnDay(day: DayPlaceDraft): string {
  const secondary = day.secondaryCity?.trim() ?? "";
  const primary = day.primaryCity.trim();
  if (day.dayType === "travel" && secondary) return secondary;
  return primary || secondary;
}

function departingCityOnDay(day: DayPlaceDraft): string {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  if (day.dayType === "travel" && primary && secondary) return primary;
  return primary || secondary;
}

function legCoversMove(
  legs: IntercityLegDraft[],
  date: string,
  fromCity: string,
  toCity: string,
): boolean {
  return legs.some((leg) => {
    const from = leg.intercityFromCity.trim();
    const to = leg.intercityToCity.trim();
    if (!from || !to) return false;
    if (!citiesMatch(from, fromCity) || !citiesMatch(to, toCity)) return false;
    return leg.travelDate === date;
  });
}

export function summarizeSetupCalendarGaps(state: TripSetupState): CalendarGapSummary {
  const groupId = state.mainGroupId;
  const days = [...(state.dayPlacesByGroupId[groupId] ?? [])].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const { startDate, endDate } = state.basics;

  const unpaintedDates = findUnpaintedTripDays(days, startDate, endDate);

  const missingTransport: CalendarGapSummary["missingTransport"] = [];
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1]!;
    const curr = days[i]!;
    if (curr.date < startDate || curr.date > endDate) continue;

    const fromCity = departingCityOnDay(prev) || endingCityOnDay(prev);
    const toCity = endingCityOnDay(curr);
    if (!fromCity.trim() || !toCity.trim()) continue;
    if (citiesMatch(fromCity, toCity)) continue;

    const travelDayPainted =
      curr.dayType === "travel" &&
      Boolean(curr.secondaryCity?.trim()) &&
      citiesMatch(curr.secondaryCity ?? "", toCity);

    if (travelDayPainted) continue;
    if (legCoversMove(state.intercityLegs, curr.date, fromCity, toCity)) continue;

    missingTransport.push({
      date: curr.date,
      fromCity: shortCity(fromCity),
      toCity: shortCity(toCity),
    });
  }

  return { unpaintedDates, missingTransport };
}

/** Second-pass calendar + transport reconcile after structure import and activity build. */
export function reconcileImportedSetupState(state: TripSetupState): {
  state: TripSetupState;
  filledDayCount: number;
} {
  const groupId = state.mainGroupId;
  const beforeDays = state.dayPlacesByGroupId[groupId] ?? [];
  const bounds = {
    startDate: state.basics.startDate,
    endDate: state.basics.endDate,
    departureCity: state.basics.departureCity ?? "",
    returnCity: state.basics.returnCity ?? "",
  };

  const planeLegs = [
    ...state.outboundLegs,
    ...state.returnLegs,
    ...state.intercityLegs.filter((leg) => leg.transportType === "plane"),
  ];

  let dayPlaces = [...beforeDays];
  for (const leg of state.intercityLegs) {
    if (leg.legKind === "airport_arrival" || leg.legKind === "airport_departure") continue;
    dayPlaces = inferDayPlacesFromIntercityLeg(dayPlaces, leg, {
      stays: state.accommodationStays,
    });
  }

  dayPlaces = normalizeDayPlacesAirports(dayPlaces, {
    stays: state.accommodationStays,
    planeLegs,
  });

  // Paint travel splits from flights, then infer empty days between arrival and departure.
  dayPlaces = reconcileImportedDayPlacesWithFlights(
    dayPlaces,
    planeLegs,
    state.accommodationStays,
  );

  dayPlaces = normalizeDayPlacesAirports(dayPlaces, {
    stays: state.accommodationStays,
    planeLegs,
  });

  dayPlaces = fillSparseCalendarAnchors(
    dayPlaces,
    bounds,
    state.accommodationStays,
  );

  const intercityLegs = syncIntercityLegs(dayPlaces, state.intercityLegs, {
    outboundLegs: state.outboundLegs,
    returnLegs: state.returnLegs,
    trip: bounds,
  });

  const allDepartureLegs = [...state.outboundLegs, ...state.returnLegs, ...intercityLegs];
  let accommodationStays = reconcileImportedAccommodationStays(
    state.accommodationStays,
    allDepartureLegs,
  );
  accommodationStays = normalizeAccommodationStayCities(accommodationStays, {
    dayPlaces,
    planeLegs,
  });
  accommodationStays = alignAccommodationStaysToLocationStays(
    accommodationStays,
    dayPlaces,
    bounds.startDate,
    bounds.endDate,
    bounds.departureCity,
    bounds.returnCity,
  );

  const filledDayCount = dayPlaces.filter((day) => {
    const before = beforeDays.find((entry) => entry.date === day.date);
    const wasEmpty =
      !before?.primaryCity.trim() &&
      !before?.secondaryCity?.trim() &&
      before?.dayType !== "buffer";
    const nowPainted = Boolean(day.primaryCity.trim() || day.secondaryCity?.trim());
    return wasEmpty && nowPainted;
  }).length;

  return {
    state: {
      ...state,
      dayPlacesByGroupId: {
        ...state.dayPlacesByGroupId,
        [groupId]: dayPlaces,
      },
      intercityLegs,
      accommodationStays,
    },
    filledDayCount,
  };
}

export function formatPostImportAssistantMessage(params: {
  itemsCreated: number;
  filledDayCount: number;
  calendarGaps: CalendarGapSummary;
  importGapMessages: string[];
}): string {
  const lines = [
    `Imported successfully — ${params.itemsCreated} activity item(s) added.`,
  ];

  if (params.filledDayCount > 0) {
    lines.push(
      `I ran a second pass on the calendar and painted **${params.filledDayCount}** empty day${params.filledDayCount === 1 ? "" : "s"} between your city stays (e.g. continuous London blocks).`,
    );
  }

  if (params.calendarGaps.unpaintedDates.length) {
    const preview = params.calendarGaps.unpaintedDates.slice(0, 10).join(", ");
    lines.push(
      `**${params.calendarGaps.unpaintedDates.length}** day${params.calendarGaps.unpaintedDates.length === 1 ? "" : "s"} still have no city on the calendar: ${preview}${params.calendarGaps.unpaintedDates.length > 10 ? "…" : ""}.`,
    );
  }

  if (params.calendarGaps.missingTransport.length) {
    const preview = params.calendarGaps.missingTransport
      .slice(0, 6)
      .map((move) => `${move.date}: ${move.fromCity} → ${move.toCity}`)
      .join("; ");
    lines.push(
      `**${params.calendarGaps.missingTransport.length}** city change${params.calendarGaps.missingTransport.length === 1 ? "" : "s"} without a transport leg yet: ${preview}${params.calendarGaps.missingTransport.length > 6 ? "…" : ""}.`,
    );
  }

  if (params.importGapMessages.length) {
    const preview = params.importGapMessages.slice(0, 5).join("; ");
    lines.push(`Other items to review: ${preview}${params.importGapMessages.length > 5 ? "…" : ""}.`);
  }

  if (
    params.calendarGaps.unpaintedDates.length ||
    params.calendarGaps.missingTransport.length
  ) {
    lines.push(
      "Check the calendar on the right. Say **fill in the gaps** to paint empty days, or tell me which legs or dates look wrong.",
    );
  } else {
    lines.push("Check the calendar on the right — tell me if any dates, legs, or stays look off.");
  }

  return lines.join("\n\n");
}
