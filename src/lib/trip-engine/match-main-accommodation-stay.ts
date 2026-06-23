import { stayCityLabel } from "@/lib/host/setup/accommodation-calendar";
import { addDays, locationsMatch } from "@/lib/host/wizard/location-stays";
import type { AccommodationStayDraft, DayPlaceDraft } from "@/lib/host/wizard/types";

import { dayPlacesForGroup, staysForGroup } from "./selectors";
import { personalGroupForGroupId } from "./person-lens";
import type { TripEntityGraph } from "./types";

export type MainStayMatchKind = "exact" | "name_only";

export type MainStayMatch = {
  kind: MainStayMatchKind;
  mainStay: AccommodationStayDraft;
};

/** Compare hotel names loosely — ignore trailing "(City)" suffixes. */
export function normalizeStayNameForMatch(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function stayNamesMatch(a: string, b: string): boolean {
  const left = normalizeStayNameForMatch(a);
  const right = normalizeStayNameForMatch(b);
  if (!left || !right) return false;
  return left === right;
}

export function stayDateRangesEqual(
  a: Pick<AccommodationStayDraft, "checkInDate" | "checkOutDate">,
  b: Pick<AccommodationStayDraft, "checkInDate" | "checkOutDate">,
): boolean {
  return a.checkInDate === b.checkInDate && a.checkOutDate === b.checkOutDate;
}

export function stayNightDates(checkIn: string, checkOut: string): string[] {
  const dates: string[] = [];
  let cur = checkIn;
  while (cur < checkOut) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }
  return dates;
}

function mainNamedStays(graph: TripEntityGraph): AccommodationStayDraft[] {
  return staysForGroup(graph, graph.mainGroupId).filter((s) => s.name?.trim());
}

export function findMatchingMainStay(
  graph: TripEntityGraph,
  draft: Pick<AccommodationStayDraft, "name" | "checkInDate" | "checkOutDate" | "cityLabel"> & {
    name: string | null;
  },
): MainStayMatch | null {
  const name = draft.name?.trim();
  if (!name || !draft.checkInDate || !draft.checkOutDate) return null;

  const candidates = mainNamedStays(graph).filter((stay) => stayNamesMatch(stay.name ?? "", name));
  if (!candidates.length) return null;

  const exact = candidates.find((stay) => stayDateRangesEqual(stay, draft));
  if (exact) return { kind: "exact", mainStay: exact };

  const city = draft.cityLabel?.trim();
  const byCity = city
    ? candidates.find((stay) => locationsMatch(stayCityLabel(stay), city))
    : null;

  return { kind: "name_only", mainStay: byCity ?? candidates[0]! };
}

function dayPlacesMatch(a: DayPlaceDraft | undefined, b: DayPlaceDraft | undefined): boolean {
  if (!a || !b) return false;
  if (!a.primaryCity.trim() || !b.primaryCity.trim()) return false;
  if (!locationsMatch(a.primaryCity, b.primaryCity)) return false;
  const aSecondary = a.secondaryCity?.trim() ?? "";
  const bSecondary = b.secondaryCity?.trim() ?? "";
  if (aSecondary || bSecondary) {
    return Boolean(aSecondary && bSecondary && locationsMatch(aSecondary, bSecondary));
  }
  return true;
}

/** True when a participant's painted days match main for every night of this stay. */
export function participantLocationsAlignWithMainStay(
  graph: TripEntityGraph,
  groupId: string,
  stay: Pick<AccommodationStayDraft, "checkInDate" | "checkOutDate">,
): boolean {
  const personalDays = dayPlacesForGroup(graph, groupId);
  const mainDays = dayPlacesForGroup(graph, graph.mainGroupId);
  const nights = stayNightDates(stay.checkInDate, stay.checkOutDate);
  if (!nights.length) return false;
  return nights.every((date) => {
    const personal = personalDays.find((d) => d.date === date);
    const main = mainDays.find((d) => d.date === date);
    return dayPlacesMatch(personal, main);
  });
}

/** Main-group stays this participant is aligned with — shown without duplicating rows. */
export function borrowedMainStaysForParticipant(
  graph: TripEntityGraph,
  groupId: string,
): AccommodationStayDraft[] {
  if (groupId === graph.mainGroupId) return [];

  const personal = personalGroupForGroupId(graph, groupId);
  if (!personal?.personalForParticipantId || personal.inheritMode !== "independent") {
    return [];
  }

  const own = staysForGroup(graph, groupId).filter((s) => s.name?.trim());
  return mainNamedStays(graph).filter((mainStay) => {
    const hasOwnOverlap = own.some(
      (stay) =>
        stayNamesMatch(stay.name ?? "", mainStay.name ?? "") &&
        stay.checkInDate < mainStay.checkOutDate &&
        mainStay.checkInDate < stay.checkOutDate,
    );
    if (hasOwnOverlap) return false;
    return participantLocationsAlignWithMainStay(graph, groupId, mainStay);
  });
}

export function mergePersonalDayPlacesFromMain(
  personalDays: DayPlaceDraft[],
  mainDays: DayPlaceDraft[],
  stay: Pick<AccommodationStayDraft, "checkInDate" | "checkOutDate">,
): DayPlaceDraft[] {
  const byDate = new Map(personalDays.map((d) => [d.date, d]));
  for (const date of stayNightDates(stay.checkInDate, stay.checkOutDate)) {
    const main = mainDays.find((d) => d.date === date);
    if (!main) continue;
    byDate.set(date, {
      ...main,
      date,
      includeBuffer: byDate.get(date)?.includeBuffer ?? false,
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function formatStayNightSpan(checkIn: string, checkOut: string): string {
  return `${checkIn} → ${checkOut}`;
}
