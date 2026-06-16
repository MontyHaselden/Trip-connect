import type { FlightLookupResult } from "./flight-lookup-types";

type JsonRecord = Record<string, unknown>;

const DEFAULT_BASE_URL = "https://prod.api.market/api/v1/aedbx/aerodatabox";

function readString(obj: unknown, ...keys: string[]): string | null {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as JsonRecord;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function normalizeFlightIata(flightNumber: string): string {
  return flightNumber.replace(/\s+/g, "").toUpperCase();
}

export function parseIsoDateTime(
  value: string | null,
): { date: string; time: string } | null {
  if (!value) return null;
  const normalized = value.replace(" ", "T");
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  return { date: match[1]!, time: `${match[2]}:${match[3]}` };
}

function pickBestTime(...values: Array<string | null>): string | null {
  for (const value of values) {
    const parsed = parseIsoDateTime(value);
    if (parsed) return parsed.time;
  }
  return null;
}

function pickBestDate(...values: Array<string | null>): string | null {
  for (const value of values) {
    const parsed = parseIsoDateTime(value);
    if (parsed) return parsed.date;
  }
  return null;
}

function readDateTime(movement: JsonRecord | undefined, field: string): string | null {
  const block = movement?.[field];
  if (!block || typeof block !== "object") return null;
  const record = block as JsonRecord;
  return readString(record, "local", "utc");
}

function readAirportIata(movement: JsonRecord | undefined): string | null {
  const airport = movement?.airport;
  if (!airport || typeof airport !== "object") return null;
  const record = airport as JsonRecord;
  return readString(record, "iata", "icao")?.toUpperCase() ?? null;
}

export function parseAerodataboxFlight(
  row: JsonRecord,
  requestedFlight: string,
): FlightLookupResult | null {
  const departure = row.departure as JsonRecord | undefined;
  const arrival = row.arrival as JsonRecord | undefined;
  const airline = row.airline as JsonRecord | undefined;

  const flightNumber =
    readString(row, "number") ?? normalizeFlightIata(requestedFlight);

  const departureIata = readAirportIata(departure);
  const arrivalIata = readAirportIata(arrival);

  const depDate = pickBestDate(
    readDateTime(departure, "scheduledTime"),
    readDateTime(departure, "revisedTime"),
    readDateTime(departure, "runwayTime"),
    readDateTime(departure, "predictedTime"),
  );

  const arrDate = pickBestDate(
    readDateTime(arrival, "scheduledTime"),
    readDateTime(arrival, "revisedTime"),
    readDateTime(arrival, "runwayTime"),
    readDateTime(arrival, "predictedTime"),
  );

  if (!departureIata && !arrivalIata && !depDate) return null;

  return {
    flightNumber,
    airline: readString(airline, "name") ?? readString(airline, "iata", "icao"),
    departureAirport: departureIata,
    arrivalAirport: arrivalIata,
    departureIata,
    arrivalIata,
    travelDate: depDate,
    arrivalDate: arrDate && depDate && arrDate !== depDate ? arrDate : null,
    departureTime: pickBestTime(
      readDateTime(departure, "scheduledTime"),
      readDateTime(departure, "revisedTime"),
      readDateTime(departure, "runwayTime"),
      readDateTime(departure, "predictedTime"),
    ),
    arrivalTime: pickBestTime(
      readDateTime(arrival, "scheduledTime"),
      readDateTime(arrival, "revisedTime"),
      readDateTime(arrival, "runwayTime"),
      readDateTime(arrival, "predictedTime"),
    ),
  };
}

function aerodataboxErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const record = body as JsonRecord;
    const message = readString(record, "message", "title", "detail");
    if (status === 401 || status === 403) {
      return (
        message ??
        "AeroDataBox API key is invalid or you are not subscribed on API.market. Check AERODATABOX_API_KEY."
      );
    }
    if (status === 429) {
      return message ?? "AeroDataBox rate limit reached. Try again shortly or enter route details manually.";
    }
    if (message) return message;
  }
  return `AeroDataBox request failed (${status})`;
}

function aerodataboxBaseUrl(): string {
  return (process.env.AERODATABOX_API_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
}

function aerodataboxUrl(path: string, query?: Record<string, string>): string {
  const url = new URL(path, `${aerodataboxBaseUrl()}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function isOperatorFlight(codeshareStatus: string | null): boolean {
  if (!codeshareStatus) return true;
  const normalized = codeshareStatus.toLowerCase();
  return normalized === "isoperator" || normalized === "unknown";
}

export type AerodataboxDateRole = "Departure" | "Arrival" | "Both";

export function shiftIsoDate(iso: string, days: number): string {
  const anchor = new Date(`${iso}T12:00:00Z`);
  anchor.setUTCDate(anchor.getUTCDate() + days);
  return anchor.toISOString().slice(0, 10);
}

export function pickClosestOperatingDate(dates: string[], hint: string): string | null {
  const valid = dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
  if (!valid.length) return null;

  const hintMs = new Date(`${hint}T12:00:00Z`).getTime();
  return [...valid].sort((left, right) => {
    const leftDistance = Math.abs(new Date(`${left}T12:00:00Z`).getTime() - hintMs);
    const rightDistance = Math.abs(new Date(`${right}T12:00:00Z`).getTime() - hintMs);
    return leftDistance - rightDistance;
  })[0] ?? null;
}

export function pickPreferredOperatingDate(dates: string[], hint?: string): string | null {
  const valid = dates.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
  if (!valid.length) return null;
  if (hint) return pickClosestOperatingDate(valid, hint);

  const today = new Date().toISOString().slice(0, 10);
  const future = [...valid].filter((date) => date >= today).sort();
  if (future[0]) return future[0];
  return [...valid].sort().at(-1) ?? null;
}

export async function fetchAerodataboxFlightDates(
  flightIata: string,
  apiKey: string,
  options?: { fromLocal?: string; toLocal?: string },
): Promise<string[]> {
  const normalized = normalizeFlightIata(flightIata);
  const path =
    options?.fromLocal && options?.toLocal
      ? `flights/number/${encodeURIComponent(normalized)}/dates/${options.fromLocal}/${options.toLocal}`
      : `flights/number/${encodeURIComponent(normalized)}/dates`;

  const res = await fetch(aerodataboxUrl(path), {
    cache: "no-store",
    headers: {
      "x-api-market-key": apiKey,
      Accept: "application/json",
    },
  });

  if (res.status === 204) return [];

  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    throw new Error(aerodataboxErrorMessage(body, res.status));
  }

  if (!Array.isArray(body)) return [];
  return body.filter((date): date is string => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date));
}

export async function fetchAerodataboxFlights(
  flightIata: string,
  apiKey: string,
  options?: { travelDate?: string; dateLocalRole?: AerodataboxDateRole },
): Promise<JsonRecord[]> {
  const normalized = normalizeFlightIata(flightIata);
  const path = options?.travelDate
    ? `flights/number/${encodeURIComponent(normalized)}/${options.travelDate}`
    : `flights/number/${encodeURIComponent(normalized)}`;

  const res = await fetch(
    aerodataboxUrl(
      path,
      options?.dateLocalRole ? { dateLocalRole: options.dateLocalRole } : undefined,
    ),
    {
      cache: "no-store",
      headers: {
        "x-api-market-key": apiKey,
        Accept: "application/json",
      },
    },
  );

  if (res.status === 204) return [];

  const body = (await res.json().catch(() => null)) as unknown;

  if (!res.ok) {
    throw new Error(aerodataboxErrorMessage(body, res.status));
  }

  if (!Array.isArray(body)) return [];

  return body.filter((row): row is JsonRecord => Boolean(row && typeof row === "object"));
}

function flightMatchesDate(flight: FlightLookupResult, date: string): boolean {
  return flight.travelDate === date || flight.arrivalDate === date;
}

function dateDistance(left: string, right: string): number {
  return Math.abs(new Date(`${left}T12:00:00Z`).getTime() - new Date(`${right}T12:00:00Z`).getTime());
}

function pickBestCandidate(
  candidates: FlightLookupResult[],
  preferredDate?: string,
): FlightLookupResult | null {
  if (!candidates.length) return null;
  if (!preferredDate) return candidates[0] ?? null;

  const exactDeparture = candidates.find((row) => row.travelDate === preferredDate);
  if (exactDeparture) return exactDeparture;

  const onRelatedDate = candidates.find((row) => flightMatchesDate(row, preferredDate));
  if (onRelatedDate) return onRelatedDate;

  return [...candidates].sort((left, right) => {
    const leftAnchor = left.travelDate ?? left.arrivalDate ?? preferredDate;
    const rightAnchor = right.travelDate ?? right.arrivalDate ?? preferredDate;
    return dateDistance(leftAnchor, preferredDate) - dateDistance(rightAnchor, preferredDate);
  })[0] ?? null;
}

export function pickAerodataboxFlight(
  rows: JsonRecord[],
  requestedFlight: string,
  preferredDate?: string,
): FlightLookupResult | null {
  const normalized = normalizeFlightIata(requestedFlight);

  const operatorRows = rows.filter((row) => isOperatorFlight(readString(row, "codeshareStatus")));
  const candidates = (operatorRows.length ? operatorRows : rows)
    .map((row) => parseAerodataboxFlight(row, normalized))
    .filter((row): row is FlightLookupResult => Boolean(row));

  return pickBestCandidate(candidates, preferredDate);
}
