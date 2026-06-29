import {
  accommodationLabelByDate,
  coalesceAdjacentNamedStays,
  stayCityLabel,
} from "@/lib/host/setup/accommodation-calendar";
import { stripConnectionHubsFromImportedDayPlaces } from "@/lib/host/import/sanitize-imported-locations";
import { normalizeDayPlacesAirports } from "@/lib/host/setup/canonical-stay-city";
import { locationsMatch } from "@/lib/host/wizard/location-stays";
import {
  inferDayPlacesFromIntercityLeg,
  inferDayPlacesFromStay,
  normalizeInteriorStayDays,
} from "@/lib/host/setup-inference";
import { fillAccommodationInteriorGaps } from "@/lib/host/setup/fill-accommodation-gaps";
import { deriveHomeArrivalDay } from "@/lib/host/setup/derive-trip-bounds";
import {
  clearOrphanOutboundHomePaint,
  clearOrphanReturnHomePaint,
  enforceHomeLocks,
  ensurePostTripHomeBuffer,
  ensurePreTripHomeBuffer,
  type TripPlaceContext,
} from "@/lib/host/setup/home-locks";
import { listNightBoundaries, type NightBoundary } from "@/lib/host/setup/stay-boundaries";
import { enumerateDates } from "@/lib/host/wizard/location-stays";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  IntercityLegDraft,
  TripWizardDraft,
} from "@/lib/host/wizard/types";
import {
  allPlaneLegsFromState,
  inferDayPlacesFromFlightLegs,
  isExplicitHostLocationPaint,
  stripOrphanFlightPaint,
} from "@/lib/host/setup/infer-flight-calendar";
import {
  flightArrivalDates,
  flightDepartureDates,
  hasScheduledOutboundTransport,
  hasScheduledReturnTransport,
  returnDepartsAfterTripEnd,
} from "@/lib/host/wizard/transport-day-placement";

export type DerivedCalendarState = {
  dayPlaces: DayPlaceDraft[];
  accommodationByDate: Map<string, string>;
  boundaries: NightBoundary[];
};

/** Paint city-change legs on the stay-derived crossover day, not a stale checkout date. */
export function cityChangePaintDate(
  leg: IntercityLegDraft,
  named: AccommodationStayDraft[],
  dayPlaces: DayPlaceDraft[],
): string | null {
  const from = leg.intercityFromCity.trim();
  const to = leg.intercityToCity.trim();
  if (!from || !to || !leg.travelDate) return null;

  const departing = named.find(
    (s) => s.name?.trim() && locationsMatch(stayCityLabel(s), from),
  );
  const arriving = named.find(
    (s) => s.name?.trim() && locationsMatch(stayCityLabel(s), to),
  );
  if (departing && arriving) {
    const boundary = listNightBoundaries(dayPlaces, named).find(
      (b) =>
        b.kind === "city-change" &&
        b.stayId === departing.id &&
        b.pairedStayId === arriving.id,
    );
    if (boundary) return boundary.date;
    return departing.checkOutDate;
  }
  return leg.travelDate;
}

function dayHasLocationPaint(day: DayPlaceDraft): boolean {
  return Boolean(day.primaryCity.trim() || day.secondaryCity?.trim());
}

/** Drop stored location paint that extends past a named stay for the same city. */
export function pruneOrphanStoredLocations(
  stored: DayPlaceDraft[],
  named: AccommodationStayDraft[],
): DayPlaceDraft[] {
  if (!named.length) return stored;

  return stored.filter((day) => {
    const cities = [day.primaryCity.trim(), day.secondaryCity?.trim() ?? ""].filter(Boolean);
    if (!cities.length) return false;

    for (const city of cities) {
      let matchedStay = false;
      for (const stay of named) {
        if (!locationsMatch(stayCityLabel(stay), city)) continue;
        matchedStay = true;
        if (day.date >= stay.checkInDate && day.date <= stay.checkOutDate) return true;
      }
      if (matchedStay) return false;
    }
    return true;
  });
}

/** Location-only paint saved on days not covered by named stays. */
function fillStoredLocationGaps(
  dayPlaces: DayPlaceDraft[],
  stored: DayPlaceDraft[],
): DayPlaceDraft[] {
  const storedByDate = new Map(stored.map((d) => [d.date, d]));
  return dayPlaces.map((day) => {
    if (dayHasLocationPaint(day)) return day;
    const storedDay = storedByDate.get(day.date);
    if (!storedDay || !dayHasLocationPaint(storedDay)) return day;
    return {
      ...day,
      primaryCity: storedDay.primaryCity,
      secondaryCity: storedDay.secondaryCity,
      primaryShare: storedDay.primaryShare,
    };
  });
}

/** Merge DB-stored host location paint over stay-derived calendar days. */
export function overlayStoredHostLocations(
  derived: DayPlaceDraft[],
  stored: DayPlaceDraft[],
  namedStays: AccommodationStayDraft[],
): DayPlaceDraft[] {
  const pruned = pruneOrphanStoredLocations(stored, namedStays);
  const storedByDate = new Map(pruned.map((d) => [d.date, d]));
  const derivedDates = new Set(derived.map((d) => d.date));

  let merged = fillStoredLocationGaps(derived, pruned);

  merged = merged.map((day) => {
    const storedDay = storedByDate.get(day.date);
    if (!storedDay || !dayHasLocationPaint(storedDay)) return day;
    if (isExplicitHostLocationPaint(storedDay, namedStays)) return storedDay;
    if (
      storedDay.secondaryCity?.trim() &&
      !day.secondaryCity?.trim() &&
      day.primaryCity.trim()
    ) {
      return {
        ...day,
        secondaryCity: storedDay.secondaryCity,
        primaryShare: storedDay.primaryShare ?? day.primaryShare,
        dayType: storedDay.dayType ?? day.dayType,
      };
    }
    return day;
  });

  for (const storedDay of pruned) {
    if (derivedDates.has(storedDay.date) || !dayHasLocationPaint(storedDay)) continue;
    if (isExplicitHostLocationPaint(storedDay, namedStays)) {
      merged.push(storedDay);
    }
  }

  return merged
    .filter((d) => d.primaryCity.trim() || d.secondaryCity?.trim())
    .sort((a, b) => a.date.localeCompare(b.date));
}

function emptyDay(date: string): DayPlaceDraft {
  return {
    date,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    includeBuffer: false,
  };
}

/** Derive calendar paint, hotel bands, and draggable boundaries from named stays. */
export function deriveCalendarState(input: {
  stays: AccommodationStayDraft[];
  intercityLegs: IntercityLegDraft[];
  trip: TripPlaceContext;
  transportDraft: Pick<TripWizardDraft, "outboundLegs" | "returnLegs" | "intercityLegs" | "dayPlaces">;
  gridStart: string;
  gridEnd: string;
  /** When false, calendar city paint comes only from stays + stored host paint — not transport legs. */
  inferLocationsFromTransport?: boolean;
  /** When false, only named stays (+ transport legs) paint location — no stored gap fill. */
  overlayStoredLocationGaps?: boolean;
}): DerivedCalendarState {
  const {
    stays,
    intercityLegs,
    trip,
    transportDraft,
    gridStart,
    gridEnd,
    inferLocationsFromTransport = true,
    overlayStoredLocationGaps = true,
  } = input;

  const named = coalesceAdjacentNamedStays(stays.filter((s) => s.name?.trim()));
  let dayPlaces: DayPlaceDraft[] = enumerateDates(gridStart, gridEnd).map((date) =>
    emptyDay(date),
  );

  const planeLegs = allPlaneLegsFromState(transportDraft);

  for (const stay of named) {
    const city = stayCityLabel(stay);
    if (!city) continue;
    dayPlaces = inferDayPlacesFromStay(
      dayPlaces,
      {
        cityLabel: city,
        checkInDate: stay.checkInDate,
        checkOutDate: stay.checkOutDate,
      },
      { planeLegs },
    );
  }

  const paintedCityChange = new Set<string>();

  if (inferLocationsFromTransport) {
    for (const leg of intercityLegs) {
      if (leg.surfaceOnly) continue;
      if (leg.legKind === "city_change" || !leg.legKind) {
        const paintDate = cityChangePaintDate(leg, named, dayPlaces);
        if (!paintDate) continue;
        const routeKey = `${leg.intercityFromCity.trim().toLowerCase()}→${leg.intercityToCity.trim().toLowerCase()}`;
        if (paintedCityChange.has(routeKey)) continue;
        paintedCityChange.add(routeKey);
        dayPlaces = inferDayPlacesFromIntercityLeg(dayPlaces, {
          ...leg,
          travelDate: paintDate,
        }, { stays: named });
      }
    }
  }

  const hasReturnTransport =
    inferLocationsFromTransport && hasScheduledReturnTransport(transportDraft, trip);
  const skipEndHomeLock = returnDepartsAfterTripEnd(transportDraft, trip.endDate);

  if (overlayStoredLocationGaps) {
    const storedDayPlaces = normalizeDayPlacesAirports(
      stripConnectionHubsFromImportedDayPlaces(
        transportDraft.dayPlaces,
        planeLegs,
        named,
      ),
      { stays: named, planeLegs, dayPlaces: transportDraft.dayPlaces },
    );
    dayPlaces = overlayStoredHostLocations(dayPlaces, storedDayPlaces, named);
  }

  if (inferLocationsFromTransport) {
    dayPlaces = inferDayPlacesFromFlightLegs(dayPlaces, planeLegs, { stays: named });
  }

  if (overlayStoredLocationGaps) {
    const storedDayPlaces = normalizeDayPlacesAirports(
      stripConnectionHubsFromImportedDayPlaces(
        transportDraft.dayPlaces,
        planeLegs,
        named,
      ),
      { stays: named, planeLegs, dayPlaces: transportDraft.dayPlaces },
    );
    dayPlaces = overlayStoredHostLocations(dayPlaces, storedDayPlaces, named);
  }

  dayPlaces = normalizeDayPlacesAirports(dayPlaces, {
    stays: named,
    planeLegs,
    dayPlaces,
  });

  dayPlaces = enforceHomeLocks(
    dayPlaces,
    trip,
    inferLocationsFromTransport ? flightDepartureDates(transportDraft, trip) : new Set<string>(),
    inferLocationsFromTransport ? flightArrivalDates(transportDraft, trip) : new Set<string>(),
    skipEndHomeLock,
  );

  const hasOutboundTransport =
    inferLocationsFromTransport && hasScheduledOutboundTransport(transportDraft);
  dayPlaces = clearOrphanOutboundHomePaint(dayPlaces, trip, hasOutboundTransport);
  dayPlaces = clearOrphanReturnHomePaint(dayPlaces, trip, hasReturnTransport);
  dayPlaces = ensurePreTripHomeBuffer(dayPlaces, trip, hasOutboundTransport);
  const homeArrival = deriveHomeArrivalDay(
    {
      outboundLegs: transportDraft.outboundLegs,
      returnLegs: transportDraft.returnLegs,
      intercityLegs: transportDraft.intercityLegs,
      returnCity: trip.returnCity,
    },
    trip.endDate,
  );
  dayPlaces = ensurePostTripHomeBuffer(
    dayPlaces,
    trip,
    hasReturnTransport,
    homeArrival,
  );

  dayPlaces = normalizeInteriorStayDays(dayPlaces, named);
  dayPlaces = fillAccommodationInteriorGaps(dayPlaces, named);

  const accommodationByDate = accommodationLabelByDate(named, planeLegs);
  const boundaries = listNightBoundaries(dayPlaces, named);

  return { dayPlaces, accommodationByDate, boundaries };
}

/** Every accommodation night must have matching city paint. */
export function assertCalendarInvariant(state: DerivedCalendarState): string[] {
  const errors: string[] = [];
  const byDate = new Map(state.dayPlaces.map((d) => [d.date, d]));

  for (const [date] of state.accommodationByDate) {
    const day = byDate.get(date);
    const hasCity =
      day &&
      (day.primaryCity.trim() || day.secondaryCity?.trim());
    if (!hasCity) {
      errors.push(`Accommodation on ${date} without city paint`);
    }
  }

  for (const day of state.dayPlaces) {
    const hasAccom = state.accommodationByDate.has(day.date);
    const hasCity = day.primaryCity.trim() || day.secondaryCity?.trim();
    if (hasAccom && !hasCity) {
      errors.push(`City missing on accommodated night ${day.date}`);
    }
  }

  return errors;
}
