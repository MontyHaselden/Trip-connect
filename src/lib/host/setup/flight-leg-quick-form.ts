export type FlightLegRowInput = {
  flight: string;
  from: string;
  to: string;
  depart: string;
  arrive: string;
};

/** A row can be saved with a flight number or a manual from/to route. */
export function isSubmittableFlightRow(row: FlightLegRowInput): boolean {
  if (row.flight.trim()) return true;
  return Boolean(row.from.trim() && row.to.trim());
}

export function submittableFlightRows<T extends FlightLegRowInput>(rows: T[]): T[] {
  return rows.filter(isSubmittableFlightRow);
}
