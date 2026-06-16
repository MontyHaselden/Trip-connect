import { searchAirports } from "@/lib/geo/airports";

import {
  fetchAerodataboxFlightDates,
  fetchAerodataboxFlights,
  normalizeFlightIata,
  pickAerodataboxFlight,
  type AerodataboxDateRole,
} from "./aerodatabox";
import type { FlightLookupResult } from "./flight-lookup-types";

export type { FlightLookupResult } from "./flight-lookup-types";
export { applyFlightLookupToLeg } from "./flight-lookup-types";

async function airportLabel(iata: string | null): Promise<string | null> {
  if (!iata) return null;
  const hits = await searchAirports({ query: iata, limit: 1 });
  if (hits[0]?.label) return hits[0].label;
  return iata;
}

async function enrichFlightResult(result: FlightLookupResult): Promise<FlightLookupResult> {
  const [departureAirport, arrivalAirport] = await Promise.all([
    airportLabel(result.departureIata),
    airportLabel(result.arrivalIata),
  ]);

  return {
    ...result,
    departureAirport: departureAirport ?? result.departureIata,
    arrivalAirport: arrivalAirport ?? result.arrivalIata,
  };
}

async function lookupOnDate(
  normalized: string,
  apiKey: string,
  travelDate: string,
  preferredDate: string | undefined,
  dateLocalRole?: AerodataboxDateRole,
): Promise<FlightLookupResult | null> {
  const rows = await fetchAerodataboxFlights(normalized, apiKey, { travelDate, dateLocalRole });
  const picked = pickAerodataboxFlight(rows, normalized, preferredDate);
  return picked ? enrichFlightResult(picked) : null;
}

export async function lookupFlight(
  flightNumber: string,
  options?: { travelDate?: string },
): Promise<FlightLookupResult | null> {
  const apiKey = process.env.AERODATABOX_API_KEY?.trim();
  if (!apiKey) return null;

  const normalized = normalizeFlightIata(flightNumber);
  if (!normalized) return null;

  const hint = options?.travelDate;

  if (hint) {
    const byDeparture = await lookupOnDate(normalized, apiKey, hint, hint, "Departure");
    if (byDeparture) return byDeparture;

    const byEither = await lookupOnDate(normalized, apiKey, hint, hint, "Both");
    if (byEither) return byEither;

    return null;
  }

  const undatedRows = await fetchAerodataboxFlights(normalized, apiKey);
  const undated = pickAerodataboxFlight(undatedRows, normalized);
  return undated ? enrichFlightResult(undated) : null;
}

/** Every scheduled departure in a date window — used to pick the real operating day. */
export async function lookupFlightCandidatesInWindow(
  flightNumber: string,
  window: { from: string; to: string },
): Promise<FlightLookupResult[]> {
  const apiKey = process.env.AERODATABOX_API_KEY?.trim();
  if (!apiKey) return [];

  const normalized = normalizeFlightIata(flightNumber);
  if (!normalized) return [];

  const operatingDates = await fetchAerodataboxFlightDates(normalized, apiKey, {
    fromLocal: window.from,
    toLocal: window.to,
  });

  const seen = new Set<string>();
  const results: FlightLookupResult[] = [];

  for (const date of operatingDates) {
    const row = await lookupOnDate(normalized, apiKey, date, date, "Departure");
    if (!row?.travelDate) continue;
    const key = `${row.flightNumber}|${row.travelDate}|${row.arrivalDate ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push(row);
  }

  return results;
}
