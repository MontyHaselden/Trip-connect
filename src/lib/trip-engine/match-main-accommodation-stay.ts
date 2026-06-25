import { stayCityLabel } from "@/lib/host/setup/accommodation-calendar";
import { addDays, enumerateDates, locationsMatch } from "@/lib/host/wizard/location-stays";
import type { AccommodationStayDraft, ActivityDraft, DayPlaceDraft } from "@/lib/host/wizard/types";

import { activitiesForGroup, dayPlacesForGroup, staysForGroup } from "./selectors";
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

export function stayRangesOverlap(
  a: Pick<AccommodationStayDraft, "checkInDate" | "checkOutDate">,
  b: Pick<AccommodationStayDraft, "checkInDate" | "checkOutDate">,
): boolean {
  return a.checkInDate < b.checkOutDate && b.checkInDate < a.checkOutDate;
}

export function mainStaysOverlappingRange(
  graph: TripEntityGraph,
  checkIn: string,
  checkOut: string,
): AccommodationStayDraft[] {
  if (!checkIn || !checkOut || checkIn >= checkOut) return [];
  return mainNamedStays(graph).filter((stay) =>
    stayRangesOverlap(stay, { checkInDate: checkIn, checkOutDate: checkOut }),
  );
}

/** Main-group hotels overlapping the participant's selected dates — for add-stay prompts. */
export function suggestedMainStaysForParticipantEdit(
  graph: TripEntityGraph,
  groupId: string,
  checkIn: string,
  checkOut: string,
  typedName?: string,
): AccommodationStayDraft[] {
  if (groupId === graph.mainGroupId) return [];

  const personal = personalGroupForGroupId(graph, groupId);
  if (!personal?.personalForParticipantId || personal.inheritMode !== "independent") {
    return [];
  }

  const overlapping = mainStaysOverlappingRange(graph, checkIn, checkOut);
  const ownStays = staysForGroup(graph, groupId).filter((s) => s.name?.trim());

  return overlapping.filter((main) => {
    if (typedName?.trim() && stayNamesMatch(typedName, main.name ?? "")) {
      return false;
    }
    const hasOwnSameHotel = ownStays.some(
      (stay) =>
        stayNamesMatch(stay.name ?? "", main.name ?? "") && stayRangesOverlap(stay, main),
    );
    return !hasOwnSameHotel;
  });
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

/** True when adopting the main stay would show it on the participant calendar (same dates + aligned cities). */
export function canAdoptMainGroupStayForParticipant(
  graph: TripEntityGraph,
  groupId: string,
  mainStay: AccommodationStayDraft,
  participantDates: Pick<AccommodationStayDraft, "checkInDate" | "checkOutDate">,
): boolean {
  if (groupId === graph.mainGroupId) return false;
  if (!stayDateRangesEqual(mainStay, participantDates)) return false;

  const personalDays = dayPlacesForGroup(graph, groupId);
  const mainDays = dayPlacesForGroup(graph, graph.mainGroupId);
  const merged = mergePersonalDayPlacesFromMain(personalDays, mainDays, mainStay);
  const nights = stayNightDates(mainStay.checkInDate, mainStay.checkOutDate);
  if (!nights.length) return false;

  return nights.every((date) => {
    const personal = merged.find((d) => d.date === date);
    const main = mainDays.find((d) => d.date === date);
    return dayPlacesMatch(personal, main);
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

/** True when a participant's painted day matches the main group on that date. */
export function participantAlignedWithMainOnDate(
  graph: TripEntityGraph,
  groupId: string,
  date: string,
): boolean {
  const personalDay = dayPlacesForGroup(graph, groupId).find((d) => d.date === date);
  const mainDay = dayPlacesForGroup(graph, graph.mainGroupId).find((d) => d.date === date);
  return dayPlacesMatch(personalDay, mainDay);
}

/** True when participant shares main-group context on a date (same cities or aligned main stay). */
export function participantSharesMainContextOnDate(
  graph: TripEntityGraph,
  groupId: string,
  date: string,
): boolean {
  if (participantAlignedWithMainOnDate(graph, groupId, date)) return true;
  return borrowedMainStaysForParticipant(graph, groupId).some(
    (stay) => date >= stay.checkInDate && date < stay.checkOutDate,
  );
}

function isMainGroupSharedActivity(activity: ActivityDraft, graph: TripEntityGraph): boolean {
  const mainOwned = !activity.originGroupId || activity.originGroupId === graph.mainGroupId;
  if (!mainOwned) return false;
  if (activity.audienceType === "everyone") return true;
  return activity.audienceType === "group" && activity.audienceId === graph.mainGroupId;
}

function activitySpansDate(activity: ActivityDraft, date: string): boolean {
  const end = activity.endDate?.trim() || activity.date;
  return activity.date <= date && date <= end;
}

/** Main-group activities inherited when an independent participant is co-located on those dates. */
export function borrowedMainActivitiesForParticipant(
  graph: TripEntityGraph,
  groupId: string,
): ActivityDraft[] {
  if (groupId === graph.mainGroupId) return [];

  const personal = personalGroupForGroupId(graph, groupId);
  if (!personal?.personalForParticipantId || personal.inheritMode !== "independent") {
    return [];
  }

  const ownIds = new Set(activitiesForGroup(graph, groupId).map((activity) => activity.id));

  return activitiesForGroup(graph, graph.mainGroupId).filter((activity) => {
    if (ownIds.has(activity.id)) return false;
    if (!isMainGroupSharedActivity(activity, graph)) return false;

    const end = activity.endDate?.trim() || activity.date;
    for (const date of enumerateDates(activity.date, end)) {
      if (participantSharesMainContextOnDate(graph, groupId, date)) return true;
    }
    return false;
  });
}

export function mainActivitiesOnDateForParticipant(
  graph: TripEntityGraph,
  groupId: string,
  date: string,
): ActivityDraft[] {
  return borrowedMainActivitiesForParticipant(graph, groupId).filter((activity) =>
    activitySpansDate(activity, date),
  );
}
