import type { FlightLookupResult } from "@/lib/host/wizard/flight-lookup-types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Load the schedule for a flight number on its departure date. */
export async function resolveFlightLookupForTrip(
  flightNumber: string,
  departureDate: string,
): Promise<{ flight?: FlightLookupResult; error?: string }> {
  const date = departureDate.trim();
  if (!ISO_DATE.test(date)) {
    return { error: "Enter the departure date (YYYY-MM-DD)." };
  }

  const res = await fetch("/api/geo/flight-lookup/resolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ flight: flightNumber, departureDate: date }),
  });

  const body = (await res.json()) as { flight?: FlightLookupResult; error?: string };
  if (!res.ok || !body.flight) {
    return { error: body.error ?? "No flight schedule found." };
  }

  return { flight: body.flight };
}
