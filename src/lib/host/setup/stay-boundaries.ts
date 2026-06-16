import {
  samePropertyStaysAdjacent,
  stayCityLabel,
} from "@/lib/host/setup/accommodation-calendar";
import { TRANSPORT_CORRIDOR_LEFT_SHARE } from "@/lib/host/setup/transport-corridor";
import { DEFAULT_HALF_SHARE, locationsMatch } from "@/lib/host/wizard/location-stays";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  IntercityLegDraft,
} from "@/lib/host/wizard/types";

export type NightBoundaryKind = "stay-end" | "stay-start" | "city-change";

export type NightBoundary = {
  id: string;
  date: string;
  stayId: string;
  /** Second stay involved when kind is city-change */
  pairedStayId?: string;
  kind: NightBoundaryKind;
  anchorShare: number;
};

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function namedStays(stays: AccommodationStayDraft[]): AccommodationStayDraft[] {
  return stays.filter((s) => s.name?.trim());
}

function continuesWithSameProperty(
  stay: AccommodationStayDraft,
  allNamed: AccommodationStayDraft[],
): boolean {
  return allNamed.some(
    (other) => other.id !== stay.id && samePropertyStaysAdjacent(stay, other),
  );
}

function continuesFromSameProperty(
  stay: AccommodationStayDraft,
  allNamed: AccommodationStayDraft[],
): boolean {
  return allNamed.some(
    (other) => other.id !== stay.id && samePropertyStaysAdjacent(other, stay),
  );
}

function paintContinuesSameCity(
  byDate: Map<string, DayPlaceDraft>,
  date: string,
  city: string,
): boolean {
  const next = byDate.get(addDays(date, 1));
  if (!next) return false;
  const primary = next.primaryCity.trim();
  const secondary = next.secondaryCity?.trim() ?? "";
  return (
    locationsMatch(primary, city) &&
    !secondary &&
    (next.primaryShare ?? 1) >= 1
  );
}

function anchorForDay(day: DayPlaceDraft | undefined, kind: NightBoundaryKind): number {
  if (!day) return DEFAULT_HALF_SHARE;
  const share = day.primaryShare ?? 1;
  if (kind === "stay-start" && !day.primaryCity.trim() && day.secondaryCity?.trim()) {
    return share;
  }
  if (kind === "stay-end" && day.primaryCity.trim() && !day.secondaryCity?.trim() && share < 1) {
    return share;
  }
  if (kind === "city-change") return TRANSPORT_CORRIDOR_LEFT_SHARE;
  if (share < 1) return share;
  return DEFAULT_HALF_SHARE;
}

function eveningStayCity(day: DayPlaceDraft, city: string): boolean {
  const secondary = day.secondaryCity?.trim() ?? "";
  const share = day.primaryShare ?? 1;
  return Boolean(secondary && locationsMatch(secondary, city) && share < 1);
}

function morningStayCity(day: DayPlaceDraft, city: string): boolean {
  const primary = day.primaryCity.trim();
  const share = day.primaryShare ?? 1;
  return Boolean(primary && locationsMatch(primary, city) && share < 1 && !day.secondaryCity?.trim());
}

function isCityChangeDay(day: DayPlaceDraft | undefined, city: string): boolean {
  if (!day?.primaryCity.trim() || !day.secondaryCity?.trim()) return false;
  return (
    locationsMatch(day.primaryCity, city) || locationsMatch(day.secondaryCity, city)
  );
}

/** Draggable night boundaries from named stays and crossover days. */
export function listNightBoundaries(
  dayPlaces: DayPlaceDraft[],
  stays: AccommodationStayDraft[],
): NightBoundary[] {
  const byDate = new Map(dayPlaces.map((d) => [d.date, d]));
  const boundaries: NightBoundary[] = [];
  const named = [...namedStays(stays)].sort((a, b) =>
    a.checkInDate.localeCompare(b.checkInDate),
  );

  for (const stay of named) {
    const city = stayCityLabel(stay);
    if (!city) continue;
    const interiorJunction = continuesWithSameProperty(stay, named);
    const lastNight = addDays(stay.checkOutDate, -1);
    const multiNight = stay.checkInDate < lastNight;

    if (multiNight && !interiorJunction) {
      const endDay = byDate.get(lastNight);
      const checkoutMorningDay = byDate.get(stay.checkOutDate);
      const isCrossover =
        endDay?.primaryCity.trim() &&
        endDay.secondaryCity?.trim() &&
        (locationsMatch(endDay.primaryCity, city) ||
          locationsMatch(endDay.secondaryCity ?? "", city));

      const endShare = endDay?.primaryShare ?? 1;
      const endIsSplit =
        endShare < 1 || Boolean(endDay?.primaryCity.trim() && endDay?.secondaryCity?.trim());
      const checkoutShare = checkoutMorningDay?.primaryShare ?? 1;
      const checkoutMorningSplit =
        Boolean(checkoutMorningDay?.primaryCity.trim()) &&
        checkoutShare < 1 &&
        !checkoutMorningDay?.secondaryCity?.trim();

      if (!isCrossover && endIsSplit) {
        boundaries.push({
          id: `${stay.id}:end`,
          date: lastNight,
          stayId: stay.id,
          kind: "stay-end",
          anchorShare: anchorForDay(endDay, "stay-end"),
        });
      } else if (!isCrossover && checkoutMorningSplit) {
        boundaries.push({
          id: `${stay.id}:end`,
          date: stay.checkOutDate,
          stayId: stay.id,
          kind: "stay-end",
          anchorShare: anchorForDay(checkoutMorningDay, "stay-end"),
        });
      } else if (
        !isCrossover &&
        !isCityChangeDay(checkoutMorningDay, city) &&
        !paintContinuesSameCity(byDate, lastNight, city) &&
        endDay?.primaryCity.trim() &&
        locationsMatch(endDay.primaryCity, city) &&
        (endDay.primaryShare ?? 1) >= 1 &&
        !endDay.secondaryCity?.trim()
      ) {
        boundaries.push({
          id: `${stay.id}:end`,
          date: lastNight,
          stayId: stay.id,
          kind: "stay-end",
          anchorShare: DEFAULT_HALF_SHARE,
        });
      }
    }

    const startDay = byDate.get(stay.checkInDate);
    const startIsCrossover =
      startDay &&
      startDay.primaryCity.trim() &&
      startDay.secondaryCity?.trim() &&
      (locationsMatch(startDay.primaryCity, city) ||
        locationsMatch(startDay.secondaryCity ?? "", city));

    if (
      startDay &&
      eveningStayCity(startDay, city) &&
      !startIsCrossover &&
      !continuesFromSameProperty(stay, named) &&
      !boundaries.some((b) => b.id === `${stay.id}:start`)
    ) {
      boundaries.push({
        id: `${stay.id}:start`,
        date: stay.checkInDate,
        stayId: stay.id,
        kind: "stay-start",
        anchorShare: anchorForDay(startDay, "stay-start"),
      });
    }

    const checkoutDay = byDate.get(stay.checkOutDate);
    const checkoutIsCrossover = isCityChangeDay(checkoutDay, city);
    if (
      checkoutDay &&
      morningStayCity(checkoutDay, city) &&
      !checkoutIsCrossover &&
      !interiorJunction &&
      !boundaries.some((b) => b.id === `${stay.id}:end` && b.date === stay.checkOutDate)
    ) {
      boundaries.push({
        id: `${stay.id}:end`,
        date: stay.checkOutDate,
        stayId: stay.id,
        kind: "stay-end",
        anchorShare: anchorForDay(checkoutDay, "stay-end"),
      });
    }
  }

  for (let i = 0; i < named.length - 1; i++) {
    const left = named[i]!;
    const right = named[i + 1]!;
    const leftCity = stayCityLabel(left);
    const rightCity = stayCityLabel(right);
    if (!leftCity || !rightCity || locationsMatch(leftCity, rightCity)) continue;

    const candidates = [
      left.checkOutDate,
      addDays(left.checkOutDate, -1),
      right.checkInDate,
      addDays(right.checkInDate, -1),
    ];

    let transitionDate: string | null = null;
    for (const date of [...new Set(candidates)].sort()) {
      const day = byDate.get(date);
      if (!day?.primaryCity.trim() || !day.secondaryCity?.trim()) continue;
      const matches =
        (locationsMatch(day.primaryCity, leftCity) &&
          locationsMatch(day.secondaryCity, rightCity)) ||
        (locationsMatch(day.primaryCity, rightCity) &&
          locationsMatch(day.secondaryCity, leftCity));
      if (matches) {
        transitionDate = date;
        break;
      }
    }

    if (
      transitionDate &&
      !boundaries.some((b) => b.kind === "city-change" && b.date === transitionDate)
    ) {
      const day = byDate.get(transitionDate)!;
      boundaries.push({
        id: `${left.id}:${right.id}:change`,
        date: transitionDate,
        stayId: left.id,
        pairedStayId: right.id,
        kind: "city-change",
        anchorShare: anchorForDay(day, "city-change"),
      });
    }
  }

  return boundaries;
}

function findStay(stays: AccommodationStayDraft[], id: string): AccommodationStayDraft | undefined {
  return stays.find((s) => s.id === id);
}

/** Move a night boundary by one day; returns updated stays array. */
export function moveNightBoundary(
  boundary: NightBoundary,
  deltaDays: -1 | 1,
  stays: AccommodationStayDraft[],
): AccommodationStayDraft[] {
  if (deltaDays !== 1 && deltaDays !== -1) return stays;

  if (boundary.kind === "city-change" && boundary.pairedStayId) {
    const left = findStay(stays, boundary.stayId);
    const right = findStay(stays, boundary.pairedStayId);
    if (!left || !right) return stays;

    const nextLeftOut = addDays(left.checkOutDate, deltaDays);
    const nextRightIn = addDays(right.checkInDate, deltaDays);

    if (nextLeftOut <= left.checkInDate) return stays;
    if (nextRightIn >= right.checkOutDate) return stays;
    if (nextLeftOut > right.checkOutDate) return stays;

    return stays.map((s) => {
      if (s.id === left.id) return { ...s, checkOutDate: nextLeftOut };
      if (s.id === right.id) return { ...s, checkInDate: nextRightIn };
      return s;
    });
  }

  const stay = findStay(stays, boundary.stayId);
  if (!stay) return stays;

  if (boundary.kind === "stay-end") {
    const nextOut = addDays(stay.checkOutDate, deltaDays);
    if (nextOut <= stay.checkInDate) return stays;
    return stays.map((s) => (s.id === stay.id ? { ...s, checkOutDate: nextOut } : s));
  }

  if (boundary.kind === "stay-start") {
    const nextIn = addDays(stay.checkInDate, deltaDays);
    if (nextIn >= stay.checkOutDate) return stays;
    return stays.map((s) => (s.id === stay.id ? { ...s, checkInDate: nextIn } : s));
  }

  return stays;
}

/** Keep Patong→Bangkok (etc.) transfer legs on the same day as the city-change boundary. */
export function syncIntercityLegsForBoundaryMove(
  boundary: NightBoundary,
  deltaDays: -1 | 1,
  legs: IntercityLegDraft[],
  stays: AccommodationStayDraft[],
): IntercityLegDraft[] {
  if (boundary.kind !== "city-change" || !boundary.pairedStayId) return legs;

  const left = findStay(stays, boundary.stayId);
  const right = findStay(stays, boundary.pairedStayId);
  if (!left || !right) return legs;

  const nextDate = addDays(boundary.date, deltaDays);
  const leftCity = stayCityLabel(left);
  const rightCity = stayCityLabel(right);

  return legs.map((leg) => {
    const isCityChange = leg.legKind === "city_change" || !leg.legKind;
    if (!isCityChange) return leg;
    if (leg.travelDate !== boundary.date) return leg;
    if (!locationsMatch(leg.intercityFromCity, leftCity)) return leg;
    if (!locationsMatch(leg.intercityToCity, rightCity)) return leg;

    return {
      ...leg,
      travelDate: nextDate,
      fromCity: leftCity,
      toCity: rightCity,
      intercityFromCity: leftCity,
      intercityToCity: rightCity,
    };
  });
}
