import { TRANSPORT_CORRIDOR_LEFT_SHARE } from "@/lib/host/setup/transport-corridor";
import {
  DEFAULT_HALF_SHARE,
  addDays,
  getEmptyHalf,
  type HalfSide,
} from "@/lib/host/wizard/location-stays";
import { effectiveHotelBandStart } from "@/lib/host/setup/accommodation-calendar";
import { metroDisplayLabel } from "@/lib/host/setup/metro-display";
import type {
  AccommodationStayDraft,
  DayPlaceDraft,
  IntercityLegDraft,
  TransportLegDraft,
} from "@/lib/host/wizard/types";
import type { GroupOverlayOpDraft } from "@/lib/host/setup/types";
import { newId } from "@/lib/host/wizard/types";

function cityOnDay(day: DayPlaceDraft, city: string): boolean {
  const loc = city.trim().toLowerCase();
  return (
    day.primaryCity.trim().toLowerCase() === loc ||
    (day.secondaryCity?.trim().toLowerCase() ?? "") === loc
  );
}

function fillEmptyHalf(day: DayPlaceDraft, city: string, half: HalfSide): DayPlaceDraft {
  const loc = city.trim();
  if (half === "right") {
    return {
      ...day,
      secondaryCity: loc,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: "travel",
    };
  }
  return {
    ...day,
    primaryCity: loc,
    primaryShare: DEFAULT_HALF_SHARE,
    dayType: "travel",
  };
}

function emptyDay(date: string): DayPlaceDraft {
  return {
    date,
    primaryCity: "",
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    includeBuffer: false,
  };
}

function citiesMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Remove one stay's city from a day without wiping the other half's location. */
export function clearStayCityFromDay(day: DayPlaceDraft, city: string): DayPlaceDraft {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const primaryMatches = primary && citiesMatch(primary, city);
  const secondaryMatches = secondary && citiesMatch(secondary, city);

  if (!primaryMatches && !secondaryMatches) return day;

  if (primaryMatches && secondaryMatches) {
    return emptyDay(day.date);
  }
  if (primaryMatches && secondary) {
    return {
      ...day,
      primaryCity: secondary,
      secondaryCity: null,
      primaryShare: 1,
    };
  }
  if (secondaryMatches && primary) {
    return {
      ...day,
      secondaryCity: null,
    };
  }
  return emptyDay(day.date);
}

/** Merge to a full day when the same city already occupies the other half. */
function mergeSameCityHalves(day: DayPlaceDraft, city: string): DayPlaceDraft | null {
  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  if (primary && citiesMatch(primary, city) && secondary && citiesMatch(secondary, city)) {
    return { ...day, primaryCity: city, secondaryCity: null, primaryShare: 1, dayType: "trip" };
  }
  if (primary && citiesMatch(primary, city) && !secondary) {
    return { ...day, primaryCity: city, secondaryCity: null, primaryShare: 1, dayType: "trip" };
  }
  if (secondary && citiesMatch(secondary, city) && !primary) {
    return { ...day, primaryCity: city, secondaryCity: null, primaryShare: 1, dayType: "trip" };
  }
  return null;
}

/** Accommodation night: evening half (right) of the night date. */
function paintStayEveningHalf(day: DayPlaceDraft, city: string): DayPlaceDraft {
  const merged = mergeSameCityHalves(day, city);
  if (merged) return merged;

  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const emptyHalf = getEmptyHalf(day);

  if (secondary && citiesMatch(secondary, city)) {
    if (!primary) {
      return { ...day, primaryCity: city, secondaryCity: null, primaryShare: 1, dayType: "trip" };
    }
    return day;
  }
  if (primary && citiesMatch(primary, city) && !secondary) {
    return { ...day, primaryCity: city, secondaryCity: null, primaryShare: 1, dayType: "trip" };
  }
  if (emptyHalf === "right") return fillEmptyHalf(day, city, "right");
  if (primary && !citiesMatch(primary, city)) {
    return {
      ...day,
      secondaryCity: city,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: day.dayType === "buffer" ? "buffer" : "trip",
    };
  }

  return {
    ...day,
    primaryCity: "",
    secondaryCity: city,
    primaryShare: DEFAULT_HALF_SHARE,
    dayType: day.dayType === "buffer" ? "buffer" : "trip",
  };
}

/** Accommodation night: morning half (left) of the day after the night. */
function paintStayMorningHalf(day: DayPlaceDraft, city: string): DayPlaceDraft {
  const merged = mergeSameCityHalves(day, city);
  if (merged) return merged;

  const primary = day.primaryCity.trim();
  const secondary = day.secondaryCity?.trim() ?? "";
  const emptyHalf = getEmptyHalf(day);

  if (primary && citiesMatch(primary, city)) return day;
  if (secondary && citiesMatch(secondary, city) && !primary) {
    return { ...day, primaryCity: city, secondaryCity: null, primaryShare: 1, dayType: "trip" };
  }
  if (emptyHalf === "left") return fillEmptyHalf(day, city, "left");
  if (secondary && !citiesMatch(secondary, city)) {
    return {
      ...day,
      primaryCity: city,
      primaryShare: DEFAULT_HALF_SHARE,
      dayType: day.dayType === "buffer" ? "buffer" : "trip",
    };
  }

  return {
    ...day,
    primaryCity: city,
    secondaryCity: null,
    primaryShare: DEFAULT_HALF_SHARE,
    dayType: day.dayType === "buffer" ? "buffer" : "trip",
  };
}

/** Infer day city labels from an accommodation stay for a group calendar. */
export function inferDayPlacesFromStay(
  existing: DayPlaceDraft[],
  stay: Pick<AccommodationStayDraft, "cityLabel" | "checkInDate" | "checkOutDate">,
  options?: { replaceExisting?: boolean; planeLegs?: TransportLegDraft[] },
): DayPlaceDraft[] {
  const city = stay.cityLabel.trim();
  if (!city) return existing;

  const byDate = new Map(existing.map((d) => [d.date, d]));

  if (options?.replaceExisting) {
    let clear = stay.checkInDate;
    while (clear <= stay.checkOutDate) {
      const current = byDate.get(clear);
      if (current) {
        const hasSplitCities = Boolean(
          current.primaryCity.trim() && current.secondaryCity?.trim(),
        );
        byDate.set(
          clear,
          hasSplitCities ? clearStayCityFromDay(current, city) : emptyDay(clear),
        );
      }
      clear = addDays(clear, 1);
    }
  }

  let cursor = effectiveHotelBandStart(stay, options?.planeLegs ?? []);
  while (cursor < stay.checkOutDate) {
    const nightDate = cursor;
    const morningDate = addDays(cursor, 1);

    const eveningDay = byDate.get(nightDate) ?? emptyDay(nightDate);
    byDate.set(nightDate, paintStayEveningHalf(eveningDay, city));

    const morningDay = byDate.get(morningDate) ?? emptyDay(morningDate);
    byDate.set(morningDate, paintStayMorningHalf(morningDay, city));

    cursor = addDays(cursor, 1);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function addDaysIso(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Full single-city nights between check-in and checkout — not arrival/departure halves. */
export function normalizeInteriorStayDays(
  dayPlaces: DayPlaceDraft[],
  stays: Pick<AccommodationStayDraft, "cityLabel" | "checkInDate" | "checkOutDate" | "name">[],
): DayPlaceDraft[] {
  const byDate = new Map(dayPlaces.map((d) => [d.date, d]));

  for (const stay of stays) {
    if (!stay.name?.trim()) continue;
    const city = stay.cityLabel.trim();
    if (!city) continue;

    const lastNight = addDaysIso(stay.checkOutDate, -1);
    if (stay.checkInDate > lastNight) continue;

    let cursor = stay.checkInDate;
    while (cursor <= lastNight) {
      const day = byDate.get(cursor);
      if (day && cursor !== stay.checkInDate) {
        const primary = day.primaryCity.trim();
        const secondary = day.secondaryCity?.trim() ?? "";
        const share = day.primaryShare ?? 1;
        if (!primary && secondary && citiesMatch(secondary, city)) {
          byDate.set(cursor, {
            ...day,
            primaryCity: city,
            secondaryCity: null,
            primaryShare: 1,
            dayType: day.dayType === "buffer" ? "buffer" : "trip",
          });
        } else if (primary && citiesMatch(primary, city) && !secondary && share < 1) {
          byDate.set(cursor, { ...day, primaryShare: 1, dayType: "trip" });
        }
      }
      cursor = addDaysIso(cursor, 1);
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function hasGroupDayOverride(
  groupPlaces: DayPlaceDraft[],
  date: string,
): boolean {
  return groupPlaces.some(
    (d) => d.date === date && d.primaryCity.trim() && d.secondaryCity?.trim(),
  );
}

function datesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/** Suggest hide overlay ops when a group stay replaces main stay nights. */
export function inferHideOpsForGroupStays(
  groupId: string,
  mainStays: AccommodationStayDraft[],
  groupStays: AccommodationStayDraft[],
  existingOps: GroupOverlayOpDraft[],
): GroupOverlayOpDraft[] {
  const ops = [...existingOps.filter((o) => !(o.groupId === groupId && o.entityType === "accommodation_stay" && o.op === "hide"))];

  for (const main of mainStays) {
    for (const group of groupStays) {
      if (
        datesOverlap(
          main.checkInDate,
          main.checkOutDate,
          group.checkInDate,
          group.checkOutDate,
        ) &&
        main.cityLabel.toLowerCase() !== group.cityLabel.toLowerCase()
      ) {
        const from = group.checkInDate > main.checkInDate ? group.checkInDate : main.checkInDate;
        const to =
          group.checkOutDate < main.checkOutDate ? group.checkOutDate : main.checkOutDate;
        const dup = ops.find(
          (o) =>
            o.groupId === groupId &&
            o.baseEntityId === main.id &&
            o.op === "hide" &&
            o.effectiveFrom === from &&
            o.effectiveTo === to,
        );
        if (!dup) {
          ops.push({
            id: newId(),
            groupId,
            entityType: "accommodation_stay",
            baseEntityId: main.id,
            op: "hide",
            replacementEntityId: null,
            effectiveFrom: from,
            effectiveTo: to,
          });
        }
      }
    }
  }

  return ops;
}

/** Mark a travel day when an intercity leg is added for a group. */
export function inferDayPlacesFromIntercityLeg(
  existing: DayPlaceDraft[],
  leg: Pick<IntercityLegDraft, "travelDate" | "intercityFromCity" | "intercityToCity">,
): DayPlaceDraft[] {
  const from = metroDisplayLabel(leg.intercityFromCity.trim());
  const to = metroDisplayLabel(leg.intercityToCity.trim());
  if (!from || !to || !leg.travelDate) return existing;

  const byDate = new Map(existing.map((d) => [d.date, d]));
  const prev = byDate.get(leg.travelDate);
  if (prev && hasGroupDayOverride(existing, leg.travelDate)) return existing;

  byDate.set(leg.travelDate, {
    date: leg.travelDate,
    primaryCity: from,
    secondaryCity: to,
    primaryShare: TRANSPORT_CORRIDOR_LEFT_SHARE,
    dayType: "travel",
    includeBuffer: false,
  });

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
