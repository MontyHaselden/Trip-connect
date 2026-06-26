import {
  flightRouteAirportLabel,
  flightRouteAirportLabelForDate,
  isAirportPlace,
  placesShareMetro,
} from "@/lib/geo/airport-codes";
import {
  buildConnectionChainFromLeg,
  findInboundConnectionLeg,
} from "@/lib/host/setup/flight-connection-chains";
import {
  MAJOR_TRAVEL_DEST_SLICE,
  MAJOR_TRAVEL_DEST_START,
  MAJOR_TRAVEL_ORIGIN_END,
  MAJOR_TRAVEL_ORIGIN_MIN,
  MAJOR_TRAVEL_TRANSIT_END,
  MAJOR_TRAVEL_TRANSIT_START,
  TRANSPORT_CORRIDOR_LEFT_SHARE,
  TRANSPORT_CORRIDOR_RIGHT_START,
  TRANSPORT_CORRIDOR_WIDTH,
  TRANSPORT_STACK_WIDTH,
} from "@/lib/host/setup/transport-corridor";
import { metroDisplayLabel } from "@/lib/host/setup/infer-flight-calendar";
import { canonicalStayCity } from "@/lib/host/setup/canonical-stay-city";
import { resolveArrivalStayCity } from "@/lib/host/setup/resolve-arrival-stay-city";
import { addDays, DEFAULT_HALF_SHARE, getEmptyHalf, normalizeDayShare, type TripDayCoverageContext } from "./location-stays";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  IntercityLegDraft,
  TransportLegDraft,
  TransportType,
  TripWizardDraft,
} from "./types";

type TripBounds = {
  startDate: string;
  endDate: string;
  departureCity: string;
  returnCity: string;
};

type TransportCalendarInput = Pick<
  TripWizardDraft,
  "outboundLegs" | "returnLegs" | "intercityLegs"
> & {
  dayPlaces?: DayPlaceDraft[];
};

type TransportCalendarDraft = Pick<
  TripWizardDraft,
  "outboundLegs" | "returnLegs" | "intercityLegs" | "dayPlaces"
>;

function normalizeTransportCalendarDraft(draft: TransportCalendarInput): TransportCalendarDraft {
  return { ...draft, dayPlaces: draft.dayPlaces ?? [] };
}

export type TransitOverlay = {
  fromShare: number;
  toShare: number;
  label: string;
};

export type CalendarDaySegment =
  | { kind: "city"; city: string; start: number; end: number; colorOnly?: boolean }
  | { kind: "transit"; label: string; start: number; end: number; tentative?: boolean };

/** Same-day connection: half origin | half destination (transit label in overlay). */
export const TRAVEL_SEGMENT_QUARTER = 0.5;
export const TRAVEL_SEGMENT_MID = 0.5;
export const TRAVEL_SEGMENT_LATE_FLY = 0.5;

/** Arrivals at or after 6pm use half-day landing bands. */
export const LATE_ARRIVAL_MINUTES = 18 * 60;

/** Evening departures keep half the cell for the departure city. */
export const MIN_EVENING_DEPARTURE_TRANSIT = 0.5;

/** Departures from 8pm onward keep a wider flight band (6pm is still proportional). */
export const EVENING_DEPARTURE_MINUTES = 20 * 60;

function parseMinutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

/** Map HH:MM to a 0–1 position on the calendar day (midnight = 0, end of day = 1). */
export function flightTimeShare(time: string | null, fallback: number): number {
  const mins = parseMinutes(time);
  if (mins === null) return fallback;
  return Math.min(1, Math.max(0, mins / (24 * 60)));
}

/** Cap how much of the day stays city paint so late flights stay visible on the calendar. */
export function departureDayCityEndShare(
  departureTime: string | null,
  timeBasedShare: number,
): number {
  const mins = parseMinutes(departureTime);
  if (mins !== null && mins >= EVENING_DEPARTURE_MINUTES) {
    return Math.min(timeBasedShare, 1 - MIN_EVENING_DEPARTURE_TRANSIT);
  }
  return timeBasedShare;
}

function timeToShare(time: string | null, fallback: number): number {
  return flightTimeShare(time, fallback);
}

/** Secondary city matches an overnight flight's hub — a connection, not a stay. */
export function isOvernightHubSecondaryOnDepartureDay(
  date: string,
  day: Pick<DayPlaceDraft, "primaryCity" | "secondaryCity">,
  legs: TransportLegDraft[],
): boolean {
  const secondary = day.secondaryCity?.trim() ?? "";
  if (!secondary || !day.primaryCity.trim()) return false;

  for (const leg of legs) {
    if (leg.transportType !== "plane") continue;
    const dep = leg.travelDate.trim();
    if (dep !== date) continue;
    const arr = arrivalDate(leg);
    if (arr <= dep) continue;
    const hub = metroDisplayLabel(leg.toCity);
    if (
      hub &&
      (placesShareMetro(secondary, hub) || citiesMatch(secondary, hub))
    ) {
      return true;
    }
  }
  return false;
}

type LegTiming = {
  travelDate?: string | null;
  arrivalDate?: string | null;
  departureTime?: string | null;
  arrivalTime?: string | null;
};

export function arrivalDate(leg: LegTiming): string {
  const travelDate = leg.travelDate?.trim() ?? "";
  if (leg.arrivalDate?.trim()) return leg.arrivalDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) return travelDate;

  const dep = parseMinutes(leg.departureTime ?? null);
  const arr = parseMinutes(leg.arrivalTime ?? null);
  if (dep !== null && arr !== null && arr < dep) {
    return addDays(travelDate, 1);
  }
  return travelDate;
}

function legUsesTransitOverlay(leg: TransportLegDraft): boolean {
  if (leg.bookingStatus === "flexible" || leg.transportType === "unsure") return true;
  if (leg.transportType === "plane") return true;
  return Boolean(leg.departureTime);
}

function legIsTentative(leg: TransportLegDraft): boolean {
  return leg.bookingStatus === "not_booked" || leg.bookingStatus === "flexible";
}

function transitSegment(
  label: string,
  start: number,
  end: number,
  leg?: TransportLegDraft,
): CalendarDaySegment {
  return {
    kind: "transit",
    label,
    start,
    end,
    tentative: leg ? legIsTentative(leg) : false,
  };
}

const MODE_TRANSIT_LABELS: Record<TransportType, string> = {
  unsure: "Travel",
  plane: "Flying",
  train: "Train",
  bus: "Bus",
  coach: "Coach",
  ferry: "Ferry",
  car: "Driving",
  taxi: "Transfer",
  walking: "Walking",
  other: "Travel",
};

function legDestinationLabel(leg: TransportLegDraft): string {
  const raw =
    "intercityToCity" in leg && (leg as IntercityLegDraft).intercityToCity.trim()
      ? (leg as IntercityLegDraft).intercityToCity.trim()
      : leg.toCity.trim();
  return canonicalStayCity(raw);
}

export function intercityCalendarLabel(leg: IntercityLegDraft): string {
  return calendarDepartureLabel(leg);
}

/** Calendar transit chip on the departure date of a leg. */
export function calendarDepartureLabel(leg: TransportLegDraft): string {
  const dest = legDestinationLabel(leg);
  if ("intercityToCity" in leg) {
    const ic = leg as IntercityLegDraft;
    if (
      ic.transportType !== "plane" &&
      ic.transportType !== "unsure" &&
      ic.bookingStatus !== "flexible"
    ) {
      return `${MODE_TRANSIT_LABELS[ic.transportType]} to ${dest}`;
    }
  }
  return `Depart for ${dest}`;
}

/** Calendar transit chip on the arrival date of a leg. */
export function calendarArrivalLabel(leg: TransportLegDraft): string {
  return `Arrive in ${legDestinationLabel(leg)}`;
}

function allTransportLegs(
  draft: Pick<TripWizardDraft, "outboundLegs" | "returnLegs" | "intercityLegs">,
): TransportLegDraft[] {
  return [...draft.outboundLegs, ...draft.intercityLegs, ...draft.returnLegs];
}

function normCity(city: string): string {
  return city.trim().toLowerCase();
}

function cityKey(city: string): string {
  return normCity(city).split(",")[0] ?? "";
}

function citiesMatch(a: string, b: string): boolean {
  const ka = cityKey(a);
  const kb = cityKey(b);
  return Boolean(ka && kb && ka === kb);
}

function paintedCitiesMatch(a: string, b: string): boolean {
  return citiesMatch(a, b) || placesShareMetro(a, b);
}

function intercityShowsCalendarTransit(leg: IntercityLegDraft): boolean {
  return leg.transportType === "plane" || leg.transportType === "train";
}

function isIntercityCrossoverDay(
  day: DayPlaceDraft | undefined,
  leg: IntercityLegDraft,
): boolean {
  if (!day) return false;
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  if (!primary || !secondary) return false;
  if ((day.primaryShare ?? 1) >= 1) return false;
  return (
    paintedCitiesMatch(primary, leg.intercityFromCity) &&
    paintedCitiesMatch(secondary, leg.intercityToCity)
  );
}

function intercityCrossoverTransitLabel(leg: IntercityLegDraft): string {
  if (leg.transportType === "plane") {
    return flightRouteAirportLabel([
      {
        fromCity: leg.fromStation?.trim() || leg.intercityFromCity || leg.fromCity,
        toCity: leg.toStation?.trim() || leg.intercityToCity || leg.toCity,
      },
    ]);
  }
  if (leg.transportType === "train") return "Train";
  return MODE_TRANSIT_LABELS[leg.transportType] ?? "Travel";
}

function buildIntercityCrossoverLayout(leg: IntercityLegDraft): CalendarDaySegment[] | null {
  if (TRANSPORT_CORRIDOR_WIDTH <= 0) return null;

  const left = TRANSPORT_CORRIDOR_LEFT_SHARE;
  const right = TRANSPORT_CORRIDOR_RIGHT_START;
  return [
    { kind: "city", city: leg.intercityFromCity, start: 0, end: left },
    transitSegment(intercityCrossoverTransitLabel(leg), left, right, leg),
    { kind: "city", city: leg.intercityToCity, start: right, end: 1 },
  ];
}

function isFlightCrossoverDay(
  day: DayPlaceDraft | undefined,
  plane: TransportLegDraft,
  legs: TransportLegDraft[],
): boolean {
  if (!day) return false;
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  if (!primary || !secondary) return false;
  if ((day.primaryShare ?? 1) >= 0.55) return false;

  const onward = findOnwardLeg(legs, plane.travelDate, plane.toCity.trim(), plane.id);
  const sameDayChain = onward && onward.travelDate === plane.travelDate;
  if (!sameDayChain && plane.travelDate !== arrivalDate(plane)) return false;

  const origin = metroDisplayLabel(plane.fromCity);
  const dest = onward
    ? metroDisplayLabel(onward.toCity)
    : metroDisplayLabel(plane.toCity);

  return paintedCitiesMatch(primary, origin) && paintedCitiesMatch(secondary, dest);
}

function planeLegsOnly(legs: TransportLegDraft[]): TransportLegDraft[] {
  return legs.filter((leg) => leg.transportType === "plane");
}

function connectionChainFrom(
  plane: TransportLegDraft,
  legs: TransportLegDraft[],
): TransportLegDraft[] {
  const chain = buildConnectionChainFromLeg(plane, planeLegsOnly(legs));
  return chain.length >= 2 ? chain : [plane];
}

type MajorTravelShares = {
  originEnd: number;
  transitStart: number;
  transitEnd: number;
  destStart: number;
};

/** Same-day plane connection chains or long same-day legs use ¼·½·¼ layout. */
export function isMajorTravelDay(legs: TransportLegDraft[], date: string): boolean {
  const departing = legs.filter(
    (leg) => leg.transportType === "plane" && leg.travelDate.trim() === date,
  );
  for (const leg of departing) {
    const chain = connectionChainFrom(leg, legs);
    const last = chain[chain.length - 1]!;
    if (chain.length >= 2 && arrivalDate(last) === date) return true;
    if (
      chain.length === 1 &&
      arrivalDate(leg) === date &&
      leg.departureTime &&
      leg.arrivalTime
    ) {
      const dep = parseMinutes(leg.departureTime);
      const arr = parseMinutes(leg.arrivalTime);
      if (dep !== null && arr !== null) {
        const span = arr >= dep ? arr - dep : 24 * 60 - dep + arr;
        if (span >= 6 * 60) return true;
      }
    }
  }
  return false;
}

function majorTravelDayShares(_chain: TransportLegDraft[], _date: string): MajorTravelShares {
  return {
    originEnd: MAJOR_TRAVEL_ORIGIN_END,
    transitStart: MAJOR_TRAVEL_TRANSIT_START,
    transitEnd: MAJOR_TRAVEL_TRANSIT_END,
    destStart: MAJOR_TRAVEL_DEST_START,
  };
}

/** Major outbound/return crossovers and short hops both use half · half. */
function flightCrossoverShares(
  routeLegs: TransportLegDraft[],
  date: string,
  allLegs: TransportLegDraft[],
): MajorTravelShares {
  if (isMajorTravelDay(allLegs, date)) {
    return majorTravelDayShares(routeLegs, date);
  }
  return {
    originEnd: TRANSPORT_CORRIDOR_LEFT_SHARE,
    transitStart: TRANSPORT_CORRIDOR_LEFT_SHARE,
    transitEnd: TRANSPORT_CORRIDOR_RIGHT_START,
    destStart: TRANSPORT_CORRIDOR_RIGHT_START,
  };
}

function buildFlightCrossoverLayout(
  plane: TransportLegDraft,
  legs: TransportLegDraft[],
  trip: TripBounds,
  stays: AccommodationStayDraft[],
  planeLegs: TransportLegDraft[],
): CalendarDaySegment[] {
  const routeLegs = connectionChainFrom(plane, legs);
  const last = routeLegs[routeLegs.length - 1]!;
  const date = plane.travelDate.trim();
  const shares = flightCrossoverShares(routeLegs, date, legs);
  const origin =
    departureMorningCity(plane.fromCity, trip, date) || metroDisplayLabel(plane.fromCity);
  const dest = resolveArrivalStayCity(
    last.toCity,
    stays,
    planeLegs,
    arrivalDate(last) || date,
  );

  return [
    { kind: "city", city: origin, start: 0, end: shares.originEnd, colorOnly: true },
    ...(shares.transitEnd > shares.transitStart
      ? [
          transitSegment(
            flightRouteAirportLabel(routeLegs),
            shares.transitStart,
            shares.transitEnd,
            plane,
          ),
        ]
      : []),
    {
      kind: "city",
      city: dest,
      start: shares.destStart,
      end: 1,
      colorOnly: true,
    },
  ];
}

/** One stacked airport route on departure day — no separate hub landing bands. */
function buildMultiLegDepartureLayout(
  chain: TransportLegDraft[],
  trip: TripBounds,
  stays: AccommodationStayDraft[],
  planeLegs: TransportLegDraft[],
): CalendarDaySegment[] {
  const first = chain[0]!;
  const last = chain[chain.length - 1]!;
  const origin = metroDisplayLabel(first.fromCity);
  const rawDepShare = timeToShare(first.departureTime, DEFAULT_HALF_SHARE);
  const depShare = departureDayCityEndShare(first.departureTime, rawDepShare);
  const landsSameDay = arrivalDate(last) === first.travelDate;

  if (landsSameDay) {
    return buildFlightCrossoverLayout(first, chain, trip, stays, planeLegs);
  }

  const stackEnd = Math.min(1, depShare + TRANSPORT_STACK_WIDTH);
  const depDate = first.travelDate.trim();
  const routeLabel = flightRouteAirportLabelForDate(chain, depDate, arrivalDate);
  const segments: CalendarDaySegment[] = [];
  if (depShare > 0.02 && origin) {
    segments.push({ kind: "city", city: origin, start: 0, end: depShare, colorOnly: true });
  }
  segments.push(transitSegment(routeLabel, depShare, stackEnd, first));
  return segments;
}

function inTripRange(date: string, trip: TripBounds): boolean {
  return date >= trip.startDate && date <= trip.endDate;
}

/** First return leg — trip endDate is its departure day. */
export function primaryReturnLeg(
  returnLegs: TripWizardDraft["returnLegs"],
): TransportLegDraft | undefined {
  return returnLegs.find((leg) => leg.travelDate.trim());
}

/** Last return leg — final destination after connections. */
export function finalReturnLeg(
  returnLegs: TripWizardDraft["returnLegs"],
): TransportLegDraft | undefined {
  for (let i = returnLegs.length - 1; i >= 0; i--) {
    const leg = returnLegs[i]!;
    if (leg.toCity.trim()) return leg;
  }
  return undefined;
}

function calendarLastDate(
  trip: TripBounds,
  draft?: Pick<TripWizardDraft, "returnLegs">,
): string {
  let last = addDays(trip.endDate, 1);
  if (!draft) return last;
  const returnLeg = finalReturnLeg(draft.returnLegs);
  if (!returnLeg?.travelDate.trim()) return last;
  const arr = arrivalDate(returnLeg);
  if (arr > trip.endDate) last = arr;
  if (isHomeReturnLeg(returnLeg, trip.returnCity)) {
    last = addDays(arr, 1);
  }
  return last;
}

/** Trip days plus buffer days shown on the calendar. */
function inCalendarRange(
  date: string,
  trip: TripBounds,
  draft?: Pick<TripWizardDraft, "returnLegs">,
): boolean {
  return date >= addDays(trip.startDate, -1) && date <= calendarLastDate(trip, draft);
}

/** Departure city uses the home label when it matches — keeps the same calendar color. */
function isHomeDeparture(fromCity: string, trip: TripBounds, date: string): boolean {
  return date === trip.startDate && citiesMatch(fromCity, trip.departureCity);
}

function isHomeReturnArrival(toCity: string, trip: TripBounds): boolean {
  const home = trip.returnCity.trim();
  if (!home || !toCity.trim()) return false;
  if (citiesMatch(toCity, home)) return true;
  return isAirportPlace(toCity) && placesShareMetro(toCity, home);
}

export function isLateArrival(leg: TransportLegDraft): boolean {
  const arr = parseMinutes(leg.arrivalTime);
  if (arr === null) return false;
  return arr >= LATE_ARRIVAL_MINUTES;
}

export function isHomeReturnLeg(leg: TransportLegDraft, returnCity: string): boolean {
  const to = leg.toCity.trim();
  const home = returnCity.trim();
  if (!to || !home) return false;
  if (citiesMatch(to, home)) return true;
  return isAirportPlace(to) && placesShareMetro(to, home);
}

type ArrivalShares = { transitEnd: number; landingEnd: number };

function arrivalDayShares(leg: TransportLegDraft, homeLanding: boolean): ArrivalShares {
  const arrShare = flightTimeShare(leg.arrivalTime, TRAVEL_SEGMENT_QUARTER);

  if (isLateArrival(leg)) {
    const transitEnd = flightTimeShare(leg.arrivalTime, TRAVEL_SEGMENT_LATE_FLY);
    return { transitEnd, landingEnd: 1 };
  }

  if (homeLanding) {
    const landingEnd = Math.max(arrShare, TRAVEL_SEGMENT_MID);
    return { transitEnd: arrShare, landingEnd };
  }

  return { transitEnd: arrShare, landingEnd: arrShare };
}

function originCityLabel(fromCity: string, trip: TripBounds, date: string): string {
  if (isHomeDeparture(fromCity, trip, date)) return trip.departureCity.trim();
  return fromCity.trim();
}

/** Morning city before a flight — home metro when the leg departs from the default airport. */
export function departureMorningCity(
  fromCity: string,
  trip: TripBounds,
  date: string,
): string {
  const home = trip.departureCity.trim();
  if (!fromCity.trim()) return "";
  if (isHomeDeparture(fromCity, trip, date) && home) return home;
  if (home && isAirportPlace(fromCity) && placesShareMetro(fromCity, home)) return home;
  if (!isAirportPlace(fromCity)) return originCityLabel(fromCity, trip, date);
  return "";
}

function withoutAirportCitySegments(
  segments: CalendarDaySegment[] | undefined,
): CalendarDaySegment[] | undefined {
  if (!segments?.length) return segments;
  const filtered = segments.filter(
    (segment) => segment.kind !== "city" || !isAirportPlace(segment.city),
  );
  return filtered.length ? filtered : undefined;
}

/** Dates with a plane departing — home-edge locks should not override these. */
export function flightDepartureDates(
  draft: Pick<TripWizardDraft, "outboundLegs" | "returnLegs" | "intercityLegs">,
  trip: TripBounds,
): Set<string> {
  const dates = new Set<string>();
  for (const leg of allTransportLegs(draft)) {
    if (
      leg.transportType === "plane" &&
      leg.fromCity.trim() &&
      inCalendarRange(leg.travelDate, trip, draft)
    ) {
      dates.add(leg.travelDate);
    }
  }
  return dates;
}

/** Latest return-leg departure — may be after trip.endDate. */
export function latestReturnDepartureDate(
  draft: Pick<TripWizardDraft, "returnLegs">,
): string | null {
  let latest: string | null = null;
  for (const leg of draft.returnLegs) {
    const date = leg.travelDate.trim();
    if (!date) continue;
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

export function returnDepartsAfterTripEnd(
  draft: Pick<TripWizardDraft, "returnLegs">,
  tripEnd: string,
): boolean {
  const latest = latestReturnDepartureDate(draft);
  return Boolean(latest && latest > tripEnd);
}

/** True when a booked/planned leg travels home on or after the last trip day. */
export function hasScheduledOutboundTransport(
  draft: Pick<TripWizardDraft, "outboundLegs">,
): boolean {
  return draft.outboundLegs.some((leg) => leg.travelDate?.trim());
}

export function hasScheduledReturnTransport(
  draft: Pick<TripWizardDraft, "outboundLegs" | "returnLegs" | "intercityLegs">,
  trip: Pick<TripBounds, "endDate" | "returnCity">,
): boolean {
  const ret = trip.returnCity.trim();
  if (!ret) return false;

  const homeDay = addDays(trip.endDate, 1);

  for (const leg of allTransportLegs(draft)) {
    const dep = leg.travelDate?.trim() ?? "";
    if (!dep) continue;

    const intercity = leg as IntercityLegDraft;
    const dest = intercity.intercityToCity?.trim() || leg.toCity.trim();
    if (!paintedCitiesMatch(dest, ret)) continue;

    if (dep >= trip.endDate) return true;
    if (arrivalDate(leg) === homeDay) return true;
  }

  return false;
}

export function flightArrivalDates(
  draft: Pick<TripWizardDraft, "outboundLegs" | "returnLegs" | "intercityLegs">,
  trip: TripBounds,
): Set<string> {
  const dates = new Set<string>();
  for (const leg of allTransportLegs(draft)) {
    if (!legUsesTransitOverlay(leg) || !leg.toCity.trim()) continue;
    const arr = arrivalDate(leg);
    if (inCalendarRange(arr, trip, draft)) {
      dates.add(arr);
    }
  }
  return dates;
}

export function travelPaintStartByDate(
  _draft: Pick<TripWizardDraft, "outboundLegs" | "returnLegs" | "intercityLegs">,
  _trip: TripBounds,
): Map<string, number> {
  return new Map();
}

/** Afternoon flight out — morning share is still paintable for the last stay. */
export function hasAfternoonDepartureTravel(
  segments: CalendarDaySegment[] | undefined,
): boolean {
  return Boolean(
    segments?.some(
      (segment) =>
        segment.kind === "transit" &&
        segment.start >= DEFAULT_HALF_SHARE - 0.001 &&
        segment.end > segment.start,
    ),
  );
}

/** Trip first/last day when part of the cell can still be painted with a stay. */
export function tripDayHasPaintableStaySlot(
  date: string,
  trip: TripBounds,
  _segments?: CalendarDaySegment[] | undefined,
  day?: Pick<DayPlaceDraft, "primaryCity" | "secondaryCity" | "primaryShare"> | null,
): boolean {
  if (date < trip.startDate || date > trip.endDate) return false;

  const emptyHalf = day ? getEmptyHalf(day as DayPlaceDraft) : null;
  if (emptyHalf) {
    const share = day?.primaryShare ?? 1;
    if (
      emptyHalf === "right" &&
      day?.primaryCity?.trim() &&
      !day?.secondaryCity?.trim() &&
      share < 1
    ) {
      return false;
    }
    if (
      emptyHalf === "left" &&
      !day?.primaryCity?.trim() &&
      day?.secondaryCity?.trim() &&
      share < 1
    ) {
      return false;
    }
    return true;
  }

  return true;
}

/** Matches calendar cell selectability — clicking elsewhere should clear a pending range. */
export function isCalendarDayInteractive(input: {
  iso: string;
  trip: TripBounds;
  day: Pick<DayPlaceDraft, "dayType" | "primaryCity" | "secondaryCity" | "primaryShare"> | null;
  travelSegments?: CalendarDaySegment[];
  paintStart?: string;
  paintEnd?: string;
}): boolean {
  const { iso, trip, day, travelSegments, paintStart, paintEnd } = input;
  const rangeStart = paintStart ?? trip.startDate;
  const rangeEnd = paintEnd ?? trip.endDate;
  const homeBufferDay = addDays(trip.endDate, 1);

  if (iso === homeBufferDay && day?.dayType === "buffer") {
    return iso >= rangeStart;
  }

  if (iso < rangeStart || iso > rangeEnd) return false;
  if (day?.dayType === "buffer") return false;

  const secondary = day?.secondaryCity?.trim() ?? "";
  const share = day?.primaryShare ?? 1;
  if (secondary || (day?.primaryCity.trim() && share < 1)) return true;

  return isCalendarDaySelectable(input);
}

/** Matches calendar cell selectability — clicking elsewhere should clear a pending range. */
export function isCalendarDaySelectable(input: {
  iso: string;
  trip: TripBounds;
  day: Pick<DayPlaceDraft, "dayType" | "primaryCity" | "secondaryCity" | "primaryShare"> | null;
  travelSegments?: CalendarDaySegment[];
  /** Setup scroll calendar: paintable window (defaults to trip dates). */
  paintStart?: string;
  paintEnd?: string;
}): boolean {
  const { iso, trip, day, travelSegments, paintStart, paintEnd } = input;
  const rangeStart = paintStart ?? trip.startDate;
  const rangeEnd = paintEnd ?? trip.endDate;
  if (iso < rangeStart || iso > rangeEnd) return false;
  if (day?.dayType === "buffer") return false;
  const isHomeEdge = iso === trip.startDate || iso === trip.endDate;
  if (isHomeEdge && !tripDayHasPaintableStaySlot(iso, trip, undefined, day)) {
    return false;
  }
  return true;
}

export function travelLayoutPaintStart(segments: CalendarDaySegment[] | undefined): number {
  if (!segments?.length) return 0;
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  if (sorted[0]!.start > 0) return 0;
  return Math.max(...segments.map((segment) => segment.end));
}

/** Location bands use full or half shares only — not travel-segment fractions. */
export function stayCityPaintShareForDay(
  day: Pick<DayPlaceDraft, "primaryCity" | "secondaryCity" | "primaryShare">,
  _segments?: CalendarDaySegment[] | undefined,
): number {
  return normalizeDayShare(day.primaryShare ?? 1);
}

/** When afternoon transit starts mid-day, morning share 0 → this value is paintable. */
export function travelLayoutMorningPaintEnd(
  segments: CalendarDaySegment[] | undefined,
): number {
  if (!segments?.length) return 0;
  const afternoonTransit = segments.find(
    (segment) =>
      segment.kind === "transit" &&
      segment.start >= DEFAULT_HALF_SHARE - 0.001 &&
      segment.end > segment.start,
  );
  return afternoonTransit ? afternoonTransit.start : 0;
}

/** Trailing destination city band after the last transit slice on a travel day. */
export function trailingCitySliceAfterTransit(
  segments: CalendarDaySegment[] | undefined,
): { start: number; end: number } | null {
  if (!segments?.length) return null;

  let lastTransitIndex = -1;
  for (let i = 0; i < segments.length; i += 1) {
    if (segments[i]!.kind === "transit") lastTransitIndex = i;
  }
  if (lastTransitIndex < 0) return null;

  for (let i = lastTransitIndex + 1; i < segments.length; i += 1) {
    const segment = segments[i]!;
    if (segment.kind === "city") {
      return { start: segment.start, end: segment.end };
    }
  }
  return null;
}

/** Selection ring for the right / arrival slice — uses the trailing city band when present. */
export function rightHalfSelectionBounds(
  day: Pick<DayPlaceDraft, "primaryShare" | "secondaryCity">,
  segments: CalendarDaySegment[] | undefined,
): { start: number; width: number } {
  const trailing = trailingCitySliceAfterTransit(segments);
  if (trailing) {
    return {
      start: trailing.start,
      width: trailing.end - trailing.start,
    };
  }

  const secondary = day.secondaryCity?.trim() ?? "";
  const divider =
    secondary && (day.primaryShare ?? 1) < 0.99 ? (day.primaryShare ?? DEFAULT_HALF_SHARE) : DEFAULT_HALF_SHARE;
  return {
    start: divider,
    width: 1 - divider,
  };
}

/** One-line summary for calendar cell tooltips. */
export function travelLayoutSummary(segments: CalendarDaySegment[] | undefined): string {
  if (!segments?.length) return "";
  return segments
    .map((segment) => {
      if (segment.kind === "city") {
        const city = segment.city.split(",")[0]?.trim() || segment.city;
        return city;
      }
      return segment.label;
    })
    .join(" · ");
}

function paintedStayCity(day: DayPlaceDraft | null): string {
  if (!day) return "";
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;

  if (secondary && !primary) return secondary;
  if (primary && !secondary) return primary;
  if (primary && secondary) return secondary;
  return "";
}

/**
 * When the painted stay matches the flight landing city, merge into one continuous block.
 * e.g. ¼ flying · ¼ Tokyo · ½ Tokyo (painted) → ¼ flying · ¾ Tokyo
 */
export function mergeTravelWithPaintedStay(
  segments: CalendarDaySegment[] | undefined,
  _day: DayPlaceDraft | null,
): { segments: CalendarDaySegment[] | undefined; hideMergedStayCity: boolean } {
  return { segments, hideMergedStayCity: false };
}

export function travelLayoutBlocksPainting(
  _segments: CalendarDaySegment[] | undefined,
): boolean {
  return false;
}

function findOnwardLeg(
  legs: TransportLegDraft[],
  date: string,
  fromCity: string,
  excludeId: string,
): TransportLegDraft | undefined {
  return legs.find(
    (leg) =>
      leg.id !== excludeId &&
      leg.travelDate === date &&
      leg.fromCity.trim() &&
      leg.toCity.trim() &&
      placesShareMetro(leg.fromCity, fromCity) &&
      !placesShareMetro(leg.toCity, fromCity),
  );
}

function preferPlaneLeg(legs: TransportLegDraft[]): TransportLegDraft | undefined {
  return legs.find((leg) => leg.transportType === "plane") ?? legs[0];
}

export type CalendarTransportOptions = {
  /** Between-city legs belong on step 4 — hide them on the dates & places calendar. */
  includeIntercity?: boolean;
  stays?: AccommodationStayDraft[];
};

function calendarTransportDraft(
  draft: TransportCalendarDraft,
  options?: CalendarTransportOptions,
): TransportCalendarDraft {
  if (options?.includeIntercity !== false) return draft;
  return { ...draft, intercityLegs: [] };
}

function intercityLegIds(
  draft: Pick<TripWizardDraft, "intercityLegs">,
): Set<string> {
  return new Set(draft.intercityLegs.map((leg) => leg.id));
}

/** Calendar no longer renders transport layouts — kept for API compatibility. */
export function computeTravelDayLayouts(
  _draft: TransportCalendarInput,
  _trip: TripBounds,
  _options?: CalendarTransportOptions,
): Map<string, CalendarDaySegment[]> {
  return new Map();
}

/** Calendar no longer renders transit overlays — kept for API compatibility. */
export function computeTransitOverlays(
  _draft: TransportCalendarInput,
  _trip: TripBounds,
  _options?: CalendarTransportOptions,
): Map<string, TransitOverlay[]> {
  return new Map();
}

export function computeCalendarTransport(
  draft: TransportCalendarInput,
  trip: TripBounds,
  options?: CalendarTransportOptions,
): {
  travelLayouts: Map<string, CalendarDaySegment[]>;
  transitOverlays: Map<string, TransitOverlay[]>;
} {
  const travelLayouts = computeTravelDayLayouts(draft, trip, options);
  const transitOverlays = computeTransitOverlays(draft, trip, options);
  return { travelLayouts, transitOverlays };
}

export function buildTripDayCoverageContext(
  draft: Pick<TripWizardDraft, "outboundLegs" | "returnLegs" | "intercityLegs" | "dayPlaces">,
  trip: TripBounds,
  _options?: CalendarTransportOptions,
): TripDayCoverageContext {
  return {
    flightDepartureDates: flightDepartureDates(draft, trip),
    flightArrivalDates: flightArrivalDates(draft, trip),
    hasPaintableStaySlot: (date, day) =>
      tripDayHasPaintableStaySlot(date, trip, undefined, day),
    isTravelOnlyDay: (date) => {
      const day = draft.dayPlaces.find((d) => d.date === date) ?? null;
      if (day?.primaryCity.trim() || day?.secondaryCity?.trim()) return false;
      for (const leg of allTransportLegs(draft)) {
        if (leg.surfaceOnly) continue;
        if (leg.travelDate === date || arrivalDate(leg) === date) return true;
      }
      return false;
    },
  };
}

/** True when a plane leg still needs a departure time to size the calendar block. */
export function planeLegNeedsTimes(leg: TransportLegDraft): boolean {
  if (leg.bookingStatus === "flexible" || leg.transportType === "unsure") return false;
  return leg.transportType === "plane" && !leg.departureTime;
}

/** Human-readable placement hint for a transport leg. */
export function transportPlacementHint(leg: TransportLegDraft): string {
  const arr = arrivalDate(leg);
  if (leg.travelDate === arr) {
    return `${leg.fromCity} → ${leg.toCity} on ${leg.travelDate}`;
  }
  return `${leg.fromCity} on ${leg.travelDate} → ${leg.toCity} on ${arr}`;
}
