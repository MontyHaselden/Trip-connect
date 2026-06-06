import type { DayPlaceDraft, IntercityLegDraft, TransportLegDraft } from "./types";
import { newId } from "./types";

export type CityMove = {
  fromCity: string;
  toCity: string;
  date: string;
};

export function detectCityMoves(dayPlaces: DayPlaceDraft[]): CityMove[] {
  const sorted = [...dayPlaces].sort((a, b) => a.date.localeCompare(b.date));
  const moves: CityMove[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const prevCity = prev.primaryCity.trim();
    const currCity = curr.primaryCity.trim();
    if (!prevCity || !currCity) continue;
    if (prevCity.toLowerCase() === currCity.toLowerCase()) continue;

    if (curr.dayType === "travel" && curr.secondaryCity?.trim()) {
      moves.push({
        fromCity: prevCity,
        toCity: curr.secondaryCity.trim(),
        date: curr.date,
      });
    } else {
      moves.push({ fromCity: prevCity, toCity: currCity, date: curr.date });
    }
  }

  return moves;
}

export function syncIntercityLegs(
  dayPlaces: DayPlaceDraft[],
  existing: IntercityLegDraft[],
): IntercityLegDraft[] {
  const moves = detectCityMoves(dayPlaces);
  const result: IntercityLegDraft[] = [];

  for (const move of moves) {
    const match = existing.find(
      (l) =>
        l.intercityFromCity === move.fromCity &&
        l.intercityToCity === move.toCity &&
        l.travelDate === move.date,
    );
    if (match) {
      result.push(match);
    } else {
      const base: TransportLegDraft = {
        id: newId(),
        transportType: "train",
        bookingStatus: "not_booked",
        travelDate: move.date,
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
      result.push({
        ...base,
        intercityFromCity: move.fromCity,
        intercityToCity: move.toCity,
      });
    }
  }

  return result;
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
): DayPlaceDraft[] {
  const days: DayPlaceDraft[] = [];
  const dates = enumerateDates(startDate, endDate);
  const bufferBefore = addDays(startDate, -1);
  const bufferAfter = addDays(endDate, 1);

  days.push({
    date: bufferBefore,
    primaryCity: departureCity,
    secondaryCity: null,
    primaryShare: 0.5,
    dayType: "buffer",
    includeBuffer: false,
  });

  for (const date of dates) {
    let dayType: DayPlaceDraft["dayType"] = "trip";
    if (date === startDate) dayType = "trip";
    else if (date === endDate) dayType = "return";
    days.push({
      date,
      primaryCity: "",
      secondaryCity: null,
      primaryShare: 1,
      dayType,
      includeBuffer: false,
    });
  }

  days.push({
    date: bufferAfter,
    primaryCity: returnCity,
    secondaryCity: null,
    primaryShare: 0.5,
    dayType: "buffer",
    includeBuffer: false,
  });

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
