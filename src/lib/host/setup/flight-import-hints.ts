import { placesShareMetro } from "@/lib/geo/airport-codes";
import { mainAccommodationStays } from "@/lib/host/setup/entity-scope";
import { TRIP_DATES_UNSET } from "@/lib/host/trip-date-display";
import type { FlightLookupResult } from "@/lib/host/wizard/flight-lookup-types";
import { arrivalDate } from "@/lib/host/wizard/transport-day-placement";
import type { TripSetupState } from "@/lib/host/setup/types";

function isMeaningfulDate(iso: string | null | undefined): iso is string {
  const trimmed = iso?.trim() ?? "";
  return Boolean(trimmed) && trimmed !== TRIP_DATES_UNSET;
}

/** Candidate first-flight lookup dates — prefer return window when stays exist. */
export function flightImportHintCandidates(state: TripSetupState): string[] {
  const hints: string[] = [];
  const named = mainAccommodationStays(state).filter((s) => s.name?.trim());

  if (isMeaningfulDate(state.basics.startDate)) hints.push(state.basics.startDate);

  if (named.length) {
    const firstCheckIn = [...named].map((s) => s.checkInDate).filter(isMeaningfulDate).sort()[0];
    if (firstCheckIn) hints.push(firstCheckIn);

    const lastCheckout = [...named]
      .map((s) => s.checkOutDate)
      .filter(isMeaningfulDate)
      .sort()
      .at(-1);
    if (lastCheckout) hints.push(lastCheckout);

    const lastNight = lastCheckout
      ? (() => {
          const d = new Date(`${lastCheckout}T12:00:00Z`);
          d.setUTCDate(d.getUTCDate() - 1);
          return d.toISOString().slice(0, 10);
        })()
      : null;
    if (lastNight) hints.push(lastNight);
  }

  if (isMeaningfulDate(state.basics.endDate)) hints.push(state.basics.endDate);

  return [...new Set(hints)];
}

/** Date range for enumerating real operating days — not stay checkout slots. */
export function tripFlightLookupWindow(
  state: TripSetupState,
): { from: string; to: string } | null {
  const named = mainAccommodationStays(state).filter((s) => s.name?.trim());
  const firstCheckIn = named.map((s) => s.checkInDate).filter(isMeaningfulDate).sort()[0];
  const lastCheckout = named
    .map((s) => s.checkOutDate)
    .filter(isMeaningfulDate)
    .sort()
    .at(-1);

  let from = isMeaningfulDate(state.basics.startDate)
    ? addDays(state.basics.startDate, -14)
    : firstCheckIn
      ? addDays(firstCheckIn, -21)
      : null;
  let to = isMeaningfulDate(state.basics.endDate)
    ? addDays(state.basics.endDate, 14)
    : lastCheckout
      ? addDays(lastCheckout, 14)
      : null;

  if (!from || !to) return null;
  if (from > to) return null;
  return { from, to };
}

function legDepartsFromHome(leg: FlightLookupResult, state: TripSetupState): boolean {
  const dep = leg.departureIata?.trim() || leg.departureAirport?.trim() || "";
  if (!dep) return false;
  return (
    placesShareMetro(dep, state.basics.departureCity) ||
    placesShareMetro(dep, state.basics.defaultDepartureAirport ?? "")
  );
}

function legArrivesHome(leg: FlightLookupResult, state: TripSetupState): boolean {
  const arr = leg.arrivalIata?.trim() || leg.arrivalAirport?.trim() || "";
  if (!arr) return false;
  return placesShareMetro(arr, state.basics.returnCity);
}

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function legSpans(date: string, leg: Pick<FlightLookupResult, "travelDate" | "arrivalDate">): string[] {
  const dep = leg.travelDate?.trim();
  const arr = leg.arrivalDate?.trim() || dep;
  if (!dep || !arr) return [];
  const dates: string[] = [];
  let cursor = dep;
  while (cursor <= arr) {
    dates.push(cursor);
    const next = new Date(`${cursor}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = next.toISOString().slice(0, 10);
  }
  return dates;
}

function chainIsOutboundConnection(
  lookups: FlightLookupResult[],
  state: TripSetupState,
): boolean {
  return lookups.every((leg) => legDepartsFromHome(leg, state) && !legArrivesHome(leg, state));
}

function chainIsReturnHome(
  lookups: FlightLookupResult[],
  state: TripSetupState,
): boolean {
  const last = lookups[lookups.length - 1];
  if (last && legArrivesHome(last, state)) return true;
  if (chainIsOutboundConnection(lookups, state)) return false;

  const named = mainAccommodationStays(state).filter((s) => s.name?.trim());
  const firstDep = lookups[0]!.travelDate?.trim() ?? "";
  if (!named.length || !firstDep) return false;

  const lastCheckOut = [...named].map((s) => s.checkOutDate).sort().at(-1)!;
  const lastStayNight = addDays(lastCheckOut, -1);
  return firstDep >= lastStayNight;
}

/** Prefer chains that sit before the first stay or after the last — not inside a stay. */
export function scoreFlightChainForTrip(
  lookups: FlightLookupResult[],
  state: TripSetupState,
): number {
  if (!lookups.length) return -1000;

  const named = mainAccommodationStays(state).filter((s) => s.name?.trim());
  let score = 0;

  const firstDep = lookups[0]!.travelDate?.trim() ?? "";
  const lastArr =
    lookups[lookups.length - 1]!.arrivalDate?.trim() ||
    lookups[lookups.length - 1]!.travelDate?.trim() ||
    "";

  const outboundConnection = chainIsOutboundConnection(lookups, state);
  const returnHome = chainIsReturnHome(lookups, state);

  if (named.length) {
    const firstCheckIn = [...named].map((s) => s.checkInDate).sort()[0]!;
    const lastCheckOut = [...named].map((s) => s.checkOutDate).sort().at(-1)!;
    const lastStayNight = addDays(lastCheckOut, -1);

    if (firstDep && !returnHome && !outboundConnection) {
      if (firstDep <= firstCheckIn) score += 40;
      if (firstDep > firstCheckIn && firstDep <= lastCheckOut) score -= 75;
      if (firstDep > lastCheckOut) score += 35;
    }

    if (returnHome && lastArr && lastArr >= firstCheckIn) score += 20;

    if (returnHome && lastCheckOut && firstDep) {
      const daysBeforeCheckout = Math.round(
        (new Date(`${lastCheckOut}T12:00:00Z`).getTime() -
          new Date(`${firstDep}T12:00:00Z`).getTime()) /
          86400000,
      );
      if (daysBeforeCheckout >= 0 && daysBeforeCheckout <= 2) score += 60;
      if (firstDep > lastCheckOut) score += 40;
      if (lastArr && lastArr < lastCheckOut) score -= 50;
    }

    if (returnHome && firstDep && firstDep < firstCheckIn) {
      if (lastArr && lastArr >= lastCheckOut) score += 15;
      else score -= 20;
    }

    if (outboundConnection && firstDep) {
      if (firstCheckIn && firstDep <= addDays(firstCheckIn, 3)) score += 55;
      if (isMeaningfulDate(state.basics.startDate)) {
        const daysFromStart = Math.round(
          (new Date(`${firstDep}T12:00:00Z`).getTime() -
            new Date(`${state.basics.startDate}T12:00:00Z`).getTime()) /
            86400000,
        );
        score += Math.max(0, 42 - Math.abs(daysFromStart) * 2);
      }
      if (firstDep > lastStayNight) score -= 80;
    }

    for (const leg of lookups) {
      if (legDepartsFromHome(leg, state)) continue;

      for (const date of legSpans(leg.travelDate ?? "", leg)) {
        for (const stay of named) {
          if (date > stay.checkInDate && date < addDays(stay.checkOutDate, -1)) {
            score -= 40;
          }
        }
      }
    }
  }

  if (returnHome && isMeaningfulDate(state.basics.endDate) && lastArr) {
    const end = state.basics.endDate;
    const daysFromEnd = Math.abs(
      (new Date(`${lastArr}T12:00:00Z`).getTime() - new Date(`${end}T12:00:00Z`).getTime()) /
        86400000,
    );
    score += Math.max(0, 14 - daysFromEnd);
  }

  return score;
}

export function arrivalDateFromLookup(leg: FlightLookupResult): string {
  const explicit = leg.arrivalDate?.trim();
  if (explicit) return explicit;
  return arrivalDate({
    travelDate: leg.travelDate ?? "",
    arrivalDate: leg.arrivalDate,
    departureTime: leg.departureTime,
    arrivalTime: leg.arrivalTime,
  });
}
