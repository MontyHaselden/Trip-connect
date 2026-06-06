/** Stub for optional flight API integration. Returns null until a provider is configured. */
export type FlightLookupResult = {
  flightNumber: string;
  airline: string | null;
  departureAirport: string | null;
  arrivalAirport: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
};

export async function lookupFlight(
  _flightNumber: string,
): Promise<FlightLookupResult | null> {
  return null;
}
