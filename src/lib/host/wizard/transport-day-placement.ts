import { flightRouteAirportLabel } from "@/lib/geo/airport-codes";
import { addDays, DEFAULT_HALF_SHARE, getEmptyHalf, type TripDayCoverageContext } from "./location-stays";
import type { DayPlaceDraft, IntercityLegDraft, TransportLegDraft, TransportType, TripWizardDraft } from "./types";

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
  | { kind: "city"; city: string; start: number; end: number }
  | { kind: "transit"; label: string; start: number; end: number };

/** Same-day connection: ¼ origin | ¼ in transit | ½ destination (only when you land that day). */
export const TRAVEL_SEGMENT_QUARTER = 0.25;
export const TRAVEL_SEGMENT_MID = 0.5;
export const TRAVEL_SEGMENT_LATE_FLY = 0.75;

/** Arrivals at or after 6pm use ¾ flying · ¼ landing on that day. */
export const LATE_ARRIVAL_MINUTES = 18 * 60;

function parseMinutes(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function timeToShare(time: string | null, fallback: number): number {
  const mins = parseMinutes(time);
  if (mins === null) return fallback;
  return Math.min(1, Math.max(0, mins / (24 * 60)));
}

function isInternationalCityPair(fromCity: string, toCity: string): boolean {
  const from = fromCity.trim();
  const to = toCity.trim();
  if (!from || !to || citiesMatch(from, to)) return false;
  return from.includes(",") || to.includes(",");
}

export function arrivalDate(leg: TransportLegDraft): string {
  const travelDate = leg.travelDate?.trim() ?? "";
  if (leg.arrivalDate?.trim()) return leg.arrivalDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) return travelDate;

  const dep = parseMinutes(leg.departureTime);
  const arr = parseMinutes(leg.arrivalTime);
  if (dep !== null && arr !== null && arr < dep) {
    return addDays(travelDate, 1);
  }
  if (
    leg.transportType === "plane" &&
    dep === null &&
    arr === null &&
    isInternationalCityPair(leg.fromCity, leg.toCity)
  ) {
    return addDays(travelDate, 1);
  }
  return travelDate;
}

function legUsesTransitOverlay(leg: TransportLegDraft): boolean {
  if (leg.bookingStatus === "flexible" || leg.transportType === "unsure") return true;
  if (leg.transportType === "plane") return true;
  return Boolean(leg.departureTime);
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

function intercityDestinationLabel(leg: IntercityLegDraft): string {
  const dest = leg.intercityToCity.trim() || leg.toCity.trim();
  return dest.split(",")[0]?.trim() || dest;
}

export function intercityCalendarLabel(leg: IntercityLegDraft): string {
  const dest = intercityDestinationLabel(leg);
  if (leg.bookingStatus === "flexible" || leg.transportType === "unsure") {
    return `Depart for ${dest}`;
  }
  if (leg.transportType === "plane") {
    if (leg.flightNumber?.trim()) return leg.flightNumber.trim();
    return `Fly to ${dest}`;
  }
  return `${MODE_TRANSIT_LABELS[leg.transportType]} to ${dest}`;
}

function transitLabel(leg: TransportLegDraft): string {
  if ("intercityToCity" in leg) {
    return intercityCalendarLabel(leg as IntercityLegDraft);
  }
  if (leg.transportType === "plane" && leg.flightNumber?.trim()) {
    return leg.flightNumber.trim();
  }
  if (leg.transportType === "plane") return "Flying";
  return MODE_TRANSIT_LABELS[leg.transportType] ?? "In transit";
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
    citiesMatch(primary, leg.intercityFromCity) &&
    citiesMatch(secondary, leg.intercityToCity)
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

function buildIntercityCrossoverLayout(leg: IntercityLegDraft): CalendarDaySegment[] {
  const Q = TRAVEL_SEGMENT_QUARTER;
  return [
    { kind: "city", city: leg.intercityFromCity, start: 0, end: Q },
    {
      kind: "transit",
      start: Q,
      end: 1 - Q,
      label: intercityCrossoverTransitLabel(leg),
    },
    { kind: "city", city: leg.intercityToCity, start: 1 - Q, end: 1 },
  ];
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
  return citiesMatch(toCity, trip.returnCity);
}

export function isLateArrival(leg: TransportLegDraft): boolean {
  const arr = parseMinutes(leg.arrivalTime);
  if (arr === null) return false;
  return arr >= LATE_ARRIVAL_MINUTES;
}

export function isHomeReturnLeg(leg: TransportLegDraft, returnCity: string): boolean {
  return Boolean(leg.toCity.trim() && citiesMatch(leg.toCity, returnCity));
}

type ArrivalShares = { transitEnd: number; landingEnd: number };

function arrivalDayShares(leg: TransportLegDraft, homeLanding: boolean): ArrivalShares {
  if (isLateArrival(leg)) {
    return { transitEnd: TRAVEL_SEGMENT_LATE_FLY, landingEnd: 1 };
  }
  if (homeLanding) {
    return { transitEnd: TRAVEL_SEGMENT_QUARTER, landingEnd: TRAVEL_SEGMENT_MID };
  }
  return { transitEnd: TRAVEL_SEGMENT_QUARTER, landingEnd: TRAVEL_SEGMENT_MID };
}

function originCityLabel(fromCity: string, trip: TripBounds, date: string): string {
  if (isHomeDeparture(fromCity, trip, date)) return trip.departureCity.trim();
  return fromCity.trim();
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
  draft: Pick<TripWizardDraft, "outboundLegs" | "returnLegs" | "intercityLegs">,
  trip: TripBounds,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const [date, segments] of computeTravelDayLayouts(draft, trip)) {
    const paintStart = travelLayoutPaintStart(segments);
    if (paintStart > 0 && paintStart < 1) {
      map.set(date, paintStart);
    }
  }
  return map;
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
  segments: CalendarDaySegment[] | undefined,
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
      if (date === trip.startDate) {
        const paintStart = travelLayoutPaintStart(segments);
        if (paintStart > 0 && paintStart < 1) return false;
      }
      return false;
    }
    return true;
  }

  if (date !== trip.startDate && date !== trip.endDate) return true;

  if (date === trip.endDate && hasAfternoonDepartureTravel(segments)) return true;

  const morningTravelEnd = travelLayoutMorningPaintEnd(segments);
  if (date === trip.startDate && morningTravelEnd > 0 && morningTravelEnd < 1) return true;

  const paintStart = travelLayoutPaintStart(segments);
  if (date === trip.startDate && paintStart > 0 && paintStart < 1) return true;

  return false;
}

/** Matches calendar cell selectability — clicking elsewhere should clear a pending range. */
export function isCalendarDaySelectable(input: {
  iso: string;
  trip: TripBounds;
  day: Pick<DayPlaceDraft, "dayType" | "primaryCity" | "secondaryCity" | "primaryShare"> | null;
  travelSegments?: CalendarDaySegment[];
}): boolean {
  const { iso, trip, day, travelSegments } = input;
  if (iso < trip.startDate || iso > trip.endDate) return false;
  if (day?.dayType === "buffer") return false;
  if (travelLayoutBlocksPainting(travelSegments)) return false;
  const isHomeEdge = iso === trip.startDate || iso === trip.endDate;
  if (isHomeEdge && !tripDayHasPaintableStaySlot(iso, trip, travelSegments, day)) {
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
  day: DayPlaceDraft | null,
): { segments: CalendarDaySegment[] | undefined; hideMergedStayCity: boolean } {
  if (!segments?.length || !day) {
    return { segments, hideMergedStayCity: false };
  }

  const paintStart = travelLayoutPaintStart(segments);
  if (paintStart >= 1 - 0.001) {
    return { segments, hideMergedStayCity: false };
  }

  const painted = paintedStayCity(day);
  if (!painted) return { segments, hideMergedStayCity: false };

  const landingIdx = segments.findLastIndex(
    (segment) => segment.kind === "city" && citiesMatch(segment.city, painted),
  );

  const merged = segments.map((segment) => ({ ...segment }));

  if (landingIdx >= 0) {
    const landing = merged[landingIdx]!;
    if (landing.kind !== "city") return { segments, hideMergedStayCity: false };
    landing.end = 1;
    return { segments: merged, hideMergedStayCity: true };
  }

  merged.push({ kind: "city", city: painted, start: paintStart, end: 1 });
  return { segments: merged, hideMergedStayCity: true };
}

export function travelLayoutBlocksPainting(
  segments: CalendarDaySegment[] | undefined,
): boolean {
  return travelLayoutPaintStart(segments) >= 1 - 0.001;
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
      normCity(leg.fromCity) === normCity(fromCity) &&
      normCity(leg.toCity) !== normCity(fromCity),
  );
}

function preferPlaneLeg(legs: TransportLegDraft[]): TransportLegDraft | undefined {
  return legs.find((leg) => leg.transportType === "plane") ?? legs[0];
}

export type CalendarTransportOptions = {
  /** Between-city legs belong on step 4 — hide them on the dates & places calendar. */
  includeIntercity?: boolean;
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

/**
 * Travel days show grey in-transit blocks only — painted stays come from Dates & Places.
 * Arrival days: transit band then paintable remainder. Departure days: paintable then transit.
 */
export function computeTravelDayLayouts(
  draft: TransportCalendarInput,
  trip: TripBounds,
  options?: CalendarTransportOptions,
): Map<string, CalendarDaySegment[]> {
  const skipInFlightIds = intercityLegIds(draft);
  draft = calendarTransportDraft(normalizeTransportCalendarDraft(draft), options);
  const map = new Map<string, CalendarDaySegment[]>();
  const legs = allTransportLegs(draft);
  const Q = TRAVEL_SEGMENT_QUARTER;
  const HALF = DEFAULT_HALF_SHARE;

  const candidateDates = new Set<string>();
  for (const leg of legs) {
    if (inCalendarRange(leg.travelDate, trip, draft)) candidateDates.add(leg.travelDate);
    const arr = arrivalDate(leg);
    if (inCalendarRange(arr, trip, draft)) candidateDates.add(arr);
  }

  function setChainedReturnHomeArrivalLayout(
    date: string,
    connectionLeg: TransportLegDraft,
    homeLeg: TransportLegDraft,
  ): void {
    const homeShares = arrivalDayShares(homeLeg, true);
    const segments: CalendarDaySegment[] = [
      {
        kind: "transit",
        start: 0,
        end: homeShares.transitEnd,
        label: flightRouteAirportLabel([connectionLeg, homeLeg]),
      },
    ];

    if (homeShares.landingEnd > homeShares.transitEnd) {
      segments.push({
        kind: "city",
        start: homeShares.transitEnd,
        end: homeShares.landingEnd,
        city: trip.returnCity.trim() || homeLeg.toCity.trim(),
      });
    }

    map.set(date, segments);
  }

  function setArrivalLayout(date: string, plane: TransportLegDraft): void {
    const homeLanding = isHomeReturnArrival(plane.toCity, trip);
    const shares = arrivalDayShares(plane, homeLanding);
    const onward = findOnwardLeg(legs, date, plane.toCity.trim(), plane.id);
    const onwardHomeSameDay =
      onward &&
      isHomeReturnLeg(onward, trip.returnCity) &&
      arrivalDate(onward) === date;

    if (onwardHomeSameDay && onward) {
      setChainedReturnHomeArrivalLayout(date, plane, onward);
      return;
    }

    const routeLegs = onward ? [plane, onward] : [plane];
    const segments: CalendarDaySegment[] = [
      {
        kind: "transit",
        start: 0,
        end: shares.transitEnd,
        label: flightRouteAirportLabel(routeLegs),
      },
    ];

    if (!onward && homeLanding && shares.landingEnd > shares.transitEnd) {
      segments.push({
        kind: "city",
        start: shares.transitEnd,
        end: shares.landingEnd,
        city: trip.returnCity.trim() || plane.toCity.trim(),
      });
    }

    map.set(date, segments);
  }

  function setChainedSameDayLayout(date: string, plane: TransportLegDraft, onward: TransportLegDraft): void {
    const origin = originCityLabel(plane.fromCity, trip, date);
    const routeLabel = flightRouteAirportLabel([plane, onward]);

    map.set(date, [
      { kind: "city", start: 0, end: Q, city: origin },
      { kind: "transit", start: Q, end: 1, label: routeLabel },
    ]);
  }

  for (const date of candidateDates) {
    const arrivingLegs = legs.filter(
      (leg) =>
        legUsesTransitOverlay(leg) &&
        leg.toCity.trim() &&
        arrivalDate(leg) === date &&
        leg.travelDate !== date,
    );

    const arrivingPlane = preferPlaneLeg(
      arrivingLegs.filter((leg) => leg.transportType === "plane"),
    );
    if (arrivingPlane) {
      setArrivalLayout(date, arrivingPlane);
      continue;
    }

    const departingLegs = legs.filter(
      (leg) =>
        legUsesTransitOverlay(leg) &&
        leg.travelDate === date &&
        leg.fromCity.trim(),
    );
    const departingPlane = preferPlaneLeg(
      departingLegs.filter((leg) => leg.transportType === "plane"),
    );
    if (departingPlane) {
      const sameDayLanding =
        arrivalDate(departingPlane) === date && departingPlane.toCity.trim();
      const onward =
        sameDayLanding &&
        findOnwardLeg(legs, date, departingPlane.toCity.trim(), departingPlane.id);
      if (onward) {
        setChainedSameDayLayout(date, departingPlane, onward);
        continue;
      }

      map.set(date, [
        {
          kind: "transit",
          start: HALF,
          end: 1,
          label: flightRouteAirportLabel([departingPlane]),
        },
      ]);
      continue;
    }

    const sameDayArrivals = legs.filter(
      (leg) =>
        legUsesTransitOverlay(leg) &&
        leg.travelDate === date &&
        arrivalDate(leg) === date &&
        leg.toCity.trim() &&
        !isHomeDeparture(leg.fromCity, trip, date),
    );
    const sameDayArrival = preferPlaneLeg(
      sameDayArrivals.filter((leg) => leg.transportType === "plane"),
    );
    if (sameDayArrival) {
      setArrivalLayout(date, sameDayArrival);
    }
  }

  for (const leg of legs) {
    if (skipInFlightIds.has(leg.id)) continue;
    if (!legUsesTransitOverlay(leg) || leg.transportType !== "plane") continue;
    const dep = leg.travelDate.trim();
    const arr = arrivalDate(leg);
    if (!dep || arr <= dep) continue;
    let cursor = addDays(dep, 1);
    while (cursor < arr) {
      if (inCalendarRange(cursor, trip, draft) && !map.has(cursor)) {
        map.set(cursor, [
          { kind: "transit", start: 0, end: 1, label: flightRouteAirportLabel([leg]) },
        ]);
      }
      cursor = addDays(cursor, 1);
    }
  }

  for (const leg of draft.intercityLegs) {
    const date = leg.travelDate.trim();
    if (!date || !inCalendarRange(date, trip, draft) || map.has(date)) continue;
    if (!intercityShowsCalendarTransit(leg)) continue;

    const day = (draft.dayPlaces ?? []).find((d) => d.date === date);
    if (isIntercityCrossoverDay(day, leg)) {
      map.set(date, buildIntercityCrossoverLayout(leg));
    }
  }

  return map;
}

function pushOverlay(
  map: Map<string, TransitOverlay[]>,
  date: string,
  overlay: TransitOverlay,
): void {
  const list = map.get(date) ?? [];
  list.push(overlay);
  map.set(date, list);
}

/** Grey in-transit blocks on the calendar — does not paint destination cities. */
export function computeTransitOverlays(
  draft: TransportCalendarInput,
  trip: TripBounds,
  options?: CalendarTransportOptions,
): Map<string, TransitOverlay[]> {
  draft = calendarTransportDraft(normalizeTransportCalendarDraft(draft), options);
  const travelLayouts = computeTravelDayLayouts(draft, trip, options);
  const map = new Map<string, TransitOverlay[]>();

  for (const leg of allTransportLegs(draft)) {
    if (!legUsesTransitOverlay(leg) || !leg.fromCity.trim() || !leg.toCity.trim()) continue;

    const depDate = leg.travelDate;
    const arrDate = arrivalDate(leg);
    const label = transitLabel(leg);
    const depShare = timeToShare(leg.departureTime, 0.375);
    const arrShare = timeToShare(leg.arrivalTime, 0.625);

    if (depDate === arrDate) {
      if (inCalendarRange(depDate, trip, draft) && !travelLayouts.has(depDate)) {
        pushOverlay(map, depDate, {
          fromShare: depShare,
          toShare: Math.max(depShare + 0.08, arrShare),
          label,
        });
      }
      continue;
    }

    if (inCalendarRange(depDate, trip, draft) && !travelLayouts.has(depDate)) {
      pushOverlay(map, depDate, { fromShare: depShare, toShare: 1, label });
    }
    if (inCalendarRange(arrDate, trip, draft) && !travelLayouts.has(arrDate)) {
      pushOverlay(map, arrDate, { fromShare: 0, toShare: arrShare, label });
    }
  }

  return map;
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
  options?: CalendarTransportOptions,
): TripDayCoverageContext {
  const { travelLayouts } = computeCalendarTransport(draft, trip, options);
  return {
    flightDepartureDates: flightDepartureDates(draft, trip),
    flightArrivalDates: flightArrivalDates(draft, trip),
    hasPaintableStaySlot: (date, day) =>
      tripDayHasPaintableStaySlot(date, trip, travelLayouts.get(date), day),
    isTravelOnlyDay: (date) => {
      const segments = travelLayouts.get(date);
      if (!segments?.length) return false;
      const day = draft.dayPlaces.find((d) => d.date === date) ?? null;
      return !tripDayHasPaintableStaySlot(date, trip, segments, day);
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
