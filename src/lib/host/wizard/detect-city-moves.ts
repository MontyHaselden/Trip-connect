import { detectAirportTransfers, type TripBounds } from "@/lib/host/wizard/detect-airport-transfers";
import {
  flightArrivalDates,
  flightDepartureDates,
} from "@/lib/host/wizard/transport-day-placement";
import type {
  DayPlaceDraft,
  IntercityLegDraft,
  IntercityLegKind,
  TransportLegDraft,
  TripWizardDraft,
} from "./types";
import { newId } from "./types";

export type CityMove = {
  fromCity: string;
  toCity: string;
  date: string;
};

export type SyncIntercityContext = {
  outboundLegs: TripWizardDraft["outboundLegs"];
  returnLegs: TripWizardDraft["returnLegs"];
  trip: TripBounds;
};

function cityOnDay(day: DayPlaceDraft): string {
  return day.primaryCity.trim() || day.secondaryCity?.trim() || "";
}

/** City where the traveller ends the day (right half on crossover days). */
function endingCityOnDay(day: DayPlaceDraft): string {
  const secondary = day.secondaryCity?.trim() ?? "";
  const primary = day.primaryCity.trim();
  if (secondary) return secondary;
  return primary;
}

function previousCity(sorted: DayPlaceDraft[], index: number): string {
  for (let j = index - 1; j >= 0; j--) {
    const city = endingCityOnDay(sorted[j]!);
    if (city) return city;
  }
  return "";
}

export function detectCityMoves(
  dayPlaces: DayPlaceDraft[],
  skipDates?: Set<string>,
): CityMove[] {
  const sorted = [...dayPlaces]
    .filter((d) => d.dayType !== "buffer")
    .sort((a, b) => a.date.localeCompare(b.date));
  const moves: CityMove[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i]!;
    if (skipDates?.has(curr.date)) continue;

    const primary = curr.primaryCity.trim();
    const secondary = curr.secondaryCity?.trim() ?? "";
    const prevCity = previousCity(sorted, i);

    if (secondary && prevCity && prevCity.toLowerCase() !== secondary.toLowerCase()) {
      moves.push({ fromCity: prevCity, toCity: secondary, date: curr.date });
      continue;
    }

    if (!primary || !prevCity) continue;
    if (prevCity.toLowerCase() === primary.toLowerCase()) continue;

    if (curr.dayType === "travel" && secondary) {
      moves.push({ fromCity: prevCity, toCity: secondary, date: curr.date });
    } else {
      moves.push({ fromCity: prevCity, toCity: primary, date: curr.date });
    }
  }

  return moves;
}

function flightEdgeDates(ctx: SyncIntercityContext): Set<string> {
  const draft = {
    outboundLegs: ctx.outboundLegs,
    returnLegs: ctx.returnLegs,
    intercityLegs: [] as IntercityLegDraft[],
  };
  const dates = new Set<string>();
  for (const d of flightArrivalDates(draft, ctx.trip)) dates.add(d);
  for (const d of flightDepartureDates(draft, ctx.trip)) dates.add(d);
  return dates;
}

function findExistingLeg(
  existing: IntercityLegDraft[],
  match: {
    legKind: IntercityLegKind;
    date: string;
    fromCity: string;
    toCity: string;
    anchorLegId?: string;
  },
): IntercityLegDraft | undefined {
  if (match.anchorLegId) {
    const byAnchor = existing.find(
      (l) => l.anchorLegId === match.anchorLegId && l.legKind === match.legKind,
    );
    if (byAnchor) return byAnchor;
  }
  return existing.find(
    (l) =>
      (l.legKind ?? "city_change") === match.legKind &&
      l.travelDate === match.date &&
      l.intercityFromCity === match.fromCity &&
      l.intercityToCity === match.toCity,
  );
}

function newIntercityLeg(
  move: {
    legKind: IntercityLegKind;
    fromCity: string;
    toCity: string;
    date: string;
    anchorLegId?: string;
  },
  transportType: TransportLegDraft["transportType"],
): IntercityLegDraft {
  const base: TransportLegDraft = {
    id: newId(),
    transportType,
    bookingStatus: transportType === "unsure" ? "flexible" : "placeholder",
    travelDate: move.date,
    arrivalDate: null,
    departureTime: null,
    arrivalTime: null,
    fromCity: move.fromCity,
    toCity: move.toCity,
    fromStation: null,
    toStation: null,
    operator: null,
    referenceNumber: null,
    flightNumber: null,
    notes: null,
  };
  return {
    ...base,
    intercityFromCity: move.fromCity,
    intercityToCity: move.toCity,
    legKind: move.legKind,
    anchorLegId: move.anchorLegId ?? null,
  };
}

export function syncIntercityLegs(
  dayPlaces: DayPlaceDraft[],
  existing: IntercityLegDraft[],
  ctx?: SyncIntercityContext,
): IntercityLegDraft[] {
  const skipDates = ctx ? flightEdgeDates(ctx) : undefined;
  const moves = detectCityMoves(dayPlaces, skipDates);
  const transfers = ctx ? detectAirportTransfers(dayPlaces, ctx, ctx.trip) : [];

  const result: IntercityLegDraft[] = [];

  for (const transfer of transfers) {
    const match = findExistingLeg(existing, {
      legKind: transfer.legKind,
      date: transfer.date,
      fromCity: transfer.fromCity,
      toCity: transfer.toCity,
      anchorLegId: transfer.anchorLegId,
    });
    result.push(
      match ??
        newIntercityLeg(
          {
            legKind: transfer.legKind,
            fromCity: transfer.fromCity,
            toCity: transfer.toCity,
            date: transfer.date,
            anchorLegId: transfer.anchorLegId,
          },
          "train",
        ),
    );
  }

  for (const move of moves) {
    const match = findExistingLeg(existing, {
      legKind: "city_change",
      date: move.date,
      fromCity: move.fromCity,
      toCity: move.toCity,
    });
    result.push(
      match ??
        newIntercityLeg(
          { legKind: "city_change", fromCity: move.fromCity, toCity: move.toCity, date: move.date },
          "unsure",
        ),
    );
  }

  return result;
}

export { intercityLegPrompt } from "@/lib/host/wizard/detect-airport-transfers";

export function syncIntercityFromDraft(
  draft: Pick<
    TripWizardDraft,
    "dayPlaces" | "intercityLegs" | "outboundLegs" | "returnLegs" | "basics"
  >,
): IntercityLegDraft[] {
  if (!draft.basics.startDate || !draft.basics.endDate) {
    return syncIntercityLegs(draft.dayPlaces, draft.intercityLegs);
  }
  return syncIntercityLegs(draft.dayPlaces, draft.intercityLegs, {
    outboundLegs: draft.outboundLegs,
    returnLegs: draft.returnLegs,
    trip: {
      startDate: draft.basics.startDate,
      endDate: draft.basics.endDate,
      departureCity: draft.basics.departureCity,
      returnCity: draft.basics.returnCity,
    },
  });
}

export function suggestAccommodationStays(
  dayPlaces: DayPlaceDraft[],
): Array<{ cityLabel: string; checkInDate: string; checkOutDate: string }> {
  const sorted = [...dayPlaces]
    .filter((d) => d.dayType !== "buffer" || d.includeBuffer)
    .sort((a, b) => a.date.localeCompare(b.date));

  const ranges: Array<{ cityLabel: string; checkInDate: string; checkOutDate: string }> = [];

  let current: { city: string; start: string; end: string } | null = null;

  for (const day of sorted) {
    const city = day.primaryCity.trim();
    if (!city) continue;
    if (!current || current.city.toLowerCase() !== city.toLowerCase()) {
      if (current) {
        ranges.push({
          cityLabel: current.city,
          checkInDate: current.start,
          checkOutDate: current.end,
        });
      }
      current = { city, start: day.date, end: day.date };
    } else {
      current.end = day.date;
    }
  }
  if (current) {
    ranges.push({
      cityLabel: current.city,
      checkInDate: current.start,
      checkOutDate: current.end,
    });
  }

  return ranges;
}

export function buildDefaultDayPlaces(
  startDate: string,
  endDate: string,
  departureCity: string,
  returnCity: string,
  calendarLastDate?: string,
): DayPlaceDraft[] {
  const days: DayPlaceDraft[] = [];
  const bufferBefore = addDays(startDate, -1);
  const bufferAfter = calendarLastDate ?? addDays(endDate, 1);

  days.push({
    date: bufferBefore,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "buffer",
    includeBuffer: false,
  });

  for (const date of enumerateDates(startDate, endDate)) {
    const dayType: DayPlaceDraft["dayType"] = date === endDate ? "return" : "trip";
    days.push({
      date,
      primaryCity: "",
      secondaryCity: null,
      primaryShare: 1,
      dayType,
      includeBuffer: false,
    });
  }

  for (const date of enumerateDates(addDays(endDate, 1), bufferAfter)) {
    days.push({
      date,
      primaryCity: returnCity,
      secondaryCity: null,
      primaryShare: 1,
      dayType: "buffer",
      includeBuffer: false,
    });
  }

  return days;
}

function enumerateDates(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
