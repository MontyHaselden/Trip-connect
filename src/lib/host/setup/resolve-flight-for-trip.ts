import type { FlightLookupResult } from "@/lib/host/wizard/flight-lookup-types";
import { lookupFlight } from "@/lib/host/wizard/lookup-flight";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Flight number + departure date → that day's schedule from the API. */
export async function resolveFlightForTrip(
  flightNumber: string,
  departureDate: string,
): Promise<FlightLookupResult | null> {
  const date = departureDate.trim();
  if (!ISO_DATE.test(date)) return null;
  return lookupFlight(flightNumber, { travelDate: date });
}
