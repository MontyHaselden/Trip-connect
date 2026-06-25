import { DateTime } from "luxon";

import { citiesMatch, shortCity } from "@/lib/host/wizard/analyze-import-gaps";
import { enumerateDates } from "@/lib/host/wizard/location-stays";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import type { AddActivityCommand, TripCommand } from "@/lib/trip-engine/commands";
import { dayPlacesForGroup } from "@/lib/trip-engine/selectors";
import type { TripEntityGraph } from "@/lib/trip-engine/types";

/** Well-known places → city. Patterns checked against normalized title. */
const LANDMARK_HOME_CITIES: Array<{ patterns: RegExp[]; city: string }> = [
  { patterns: [/golden pavilion/i, /kinkaku/i], city: "Kyoto" },
  { patterns: [/fushimi inari/i], city: "Kyoto" },
  { patterns: [/kiyomizu/i], city: "Kyoto" },
  { patterns: [/arashiyama/i], city: "Kyoto" },
  { patterns: [/nijo castle/i], city: "Kyoto" },
  { patterns: [/sky\s*tree/i, /skytree/i, /tokyo tower/i], city: "Tokyo" },
  { patterns: [/disneyland/i, /disney\s*land/i, /tokyo disney/i, /universal\s*studios?/i], city: "Tokyo" },
  { patterns: [/ueno zoo/i, /ueno park/i], city: "Tokyo" },
  { patterns: [/shibuya/i, /harajuku/i, /akihabara/i, /shinjuku/i], city: "Tokyo" },
  { patterns: [/peace park/i, /hiroshima peace/i, /atomic bomb/i], city: "Hiroshima" },
  { patterns: [/miyajima/i, /itsukushima/i], city: "Hiroshima" },
  { patterns: [/sakurajima/i, /kagoshima/i], city: "Kagoshima" },
  { patterns: [/osaka castle/i, /dotonbori/i], city: "Osaka" },
  { patterns: [/cup noodle museum/i], city: "Yokohama" },
];

const EXPLICIT_CITY_TOKENS = [
  "Tokyo",
  "Kyoto",
  "Hiroshima",
  "Kagoshima",
  "Osaka",
  "Yokohama",
  "Nara",
  "Hakone",
  "Nikko",
  "Sapporo",
  "Fukuoka",
  "Nagasaki",
] as const;

function daysApart(a: string, b: string): number {
  const da = DateTime.fromISO(a);
  const db = DateTime.fromISO(b);
  if (!da.isValid || !db.isValid) return Number.MAX_SAFE_INTEGER;
  return Math.abs(da.diff(db, "days").days);
}

function citiesForDate(dayPlaces: DayPlaceDraft[], date: string): string[] {
  const day = dayPlaces.find((row) => row.date === date);
  if (!day) return [];
  const out: string[] = [];
  if (day.primaryCity.trim()) out.push(day.primaryCity.trim());
  if (day.secondaryCity?.trim()) out.push(day.secondaryCity.trim());
  return out;
}

function calendarIncludesCity(
  dayPlaces: DayPlaceDraft[],
  date: string,
  city: string,
): boolean {
  return citiesForDate(dayPlaces, date).some((label) => citiesMatch(label, city));
}

function primaryCityLabelForDate(
  dayPlaces: DayPlaceDraft[],
  date: string,
  preferredCity?: string | null,
): string | null {
  const cities = citiesForDate(dayPlaces, date);
  if (!cities.length) return preferredCity ?? null;
  if (preferredCity) {
    const match = cities.find((label) => citiesMatch(label, preferredCity));
    if (match) return match;
  }
  return cities[0] ?? null;
}

export function inferCityFromTitle(title: string): string | null {
  const normalized = title.trim();
  if (!normalized) return null;

  for (const landmark of LANDMARK_HOME_CITIES) {
    if (landmark.patterns.some((pattern) => pattern.test(normalized))) {
      return landmark.city;
    }
  }

  for (const city of EXPLICIT_CITY_TOKENS) {
    const pattern = new RegExp(`\\b${city}\\b`, "i");
    if (pattern.test(normalized)) return city;
  }

  const parenMatch = normalized.match(/\(([^)]+)\)\s*$/);
  if (parenMatch?.[1]) {
    const inner = parenMatch[1].trim();
    for (const city of EXPLICIT_CITY_TOKENS) {
      if (inner.toLowerCase().includes(city.toLowerCase())) return city;
    }
    const short = shortCity(inner);
    if (short && short.length > 2) return short;
  }

  return null;
}

function findBestDateForCity(
  dayPlaces: DayPlaceDraft[],
  preferredDate: string,
  city: string,
  startDate: string,
  endDate: string,
): string | null {
  const candidates = enumerateDates(startDate, endDate)
    .filter((date) => calendarIncludesCity(dayPlaces, date, city))
    .sort((a, b) => daysApart(preferredDate, a) - daysApart(preferredDate, b));
  return candidates[0] ?? null;
}

export function repairAddActivityCommand(
  command: AddActivityCommand,
  graph: TripEntityGraph,
  groupId: string,
): { command: AddActivityCommand; warnings: string[] } {
  const warnings: string[] = [];
  const dayPlaces = dayPlacesForGroup(graph, groupId);
  const { basics } = graph;
  const activity = { ...command.activity };
  const homeCity = inferCityFromTitle(activity.title);

  let targetDate = activity.date;

  if (homeCity) {
    if (!calendarIncludesCity(dayPlaces, targetDate, homeCity)) {
      const betterDate = findBestDateForCity(
        dayPlaces,
        targetDate,
        homeCity,
        basics.startDate,
        basics.endDate,
      );
      if (betterDate && betterDate !== targetDate) {
        warnings.push(
          `Moved "${activity.title}" from ${targetDate} to ${betterDate} — the group is in ${homeCity} then, not on the originally suggested day.`,
        );
        targetDate = betterDate;
      } else if (!calendarIncludesCity(dayPlaces, targetDate, homeCity)) {
        warnings.push(
          `"${activity.title}" is usually in ${homeCity}, but the calendar has no ${homeCity} days — check the date.`,
        );
      }
    }
  }

  const calendarCity = primaryCityLabelForDate(dayPlaces, targetDate, homeCity);
  if (calendarCity) {
    activity.locationName = calendarCity;
    activity.isLocationTbc = false;
  } else if (homeCity) {
    activity.locationName = homeCity;
    activity.isLocationTbc = false;
  }

  activity.date = targetDate;

  return {
    command: { ...command, activity },
    warnings,
  };
}

export function repairActivityCommands(
  commands: TripCommand[],
  graph: TripEntityGraph,
  groupId: string,
): { commands: TripCommand[]; warnings: string[] } {
  const warnings: string[] = [];
  const repaired = commands.map((command) => {
    if (command.type !== "addActivity") return command;
    const result = repairAddActivityCommand(command, graph, groupId);
    warnings.push(...result.warnings);
    return result.command;
  });
  return { commands: repaired, warnings };
}
