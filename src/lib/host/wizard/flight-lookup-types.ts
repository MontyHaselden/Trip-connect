import type { TransportLegDraft } from "./types";

export type FlightLookupResult = {
  flightNumber: string;
  airline: string | null;
  departureAirport: string | null;
  arrivalAirport: string | null;
  departureIata: string | null;
  arrivalIata: string | null;
  travelDate: string | null;
  arrivalDate: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
};

export function applyFlightLookupToLeg(
  leg: TransportLegDraft,
  result: FlightLookupResult,
): TransportLegDraft {
  const travelDate = result.travelDate?.trim();
  if (!travelDate) return leg;

  const arrivalFromApi = result.arrivalDate?.trim() || null;
  const arrivalDate =
    arrivalFromApi && arrivalFromApi !== travelDate ? arrivalFromApi : null;

  return {
    ...leg,
    transportType: "plane",
    flightNumber: result.flightNumber,
    fromCity: result.departureAirport || leg.fromCity,
    toCity: result.arrivalAirport || leg.toCity,
    fromStation: result.departureIata || leg.fromStation,
    toStation: result.arrivalIata || leg.toStation,
    operator: result.airline || leg.operator,
    travelDate,
    arrivalDate,
    departureTime: result.departureTime ?? null,
    arrivalTime: result.arrivalTime ?? null,
    bookingStatus: leg.bookingStatus === "not_booked" ? "placeholder" : leg.bookingStatus,
  };
}
