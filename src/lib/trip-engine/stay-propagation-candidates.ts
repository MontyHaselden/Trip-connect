import type { DayPlaceDraft } from "@/lib/host/wizard/types";
import type { TripCommand } from "@/lib/trip-engine/commands";
import { buildParticipantPresenceMap, participantEligibleForStay } from "@/lib/trip-engine/cost-ledger/presence";
import type { RosterSummary, TripEntityGraph } from "@/lib/trip-engine/types";

export type StayPropagationCandidate = {
  groupId: string;
  participantId: string;
  participantName: string;
  hasPersonalStay: boolean;
  hasLocationOverride: boolean;
};

function dayHasPaint(day: Pick<DayPlaceDraft, "primaryCity" | "secondaryCity">): boolean {
  return Boolean(day.primaryCity.trim() || day.secondaryCity?.trim());
}

function daysLocationEqual(a: DayPlaceDraft, b: DayPlaceDraft): boolean {
  return (
    a.primaryCity.trim() === b.primaryCity.trim() &&
    (a.secondaryCity?.trim() ?? "") === (b.secondaryCity?.trim() ?? "") &&
    (a.primaryShare ?? 1) === (b.primaryShare ?? 1) &&
    a.dayType === b.dayType
  );
}

/** Participants on trip during the stay who have personal location/stay overrides in that window. */
export function findStayPropagationCandidates(
  graph: TripEntityGraph,
  roster: RosterSummary,
  range: { checkIn: string; checkOut: string },
  stayCityLabel: string,
): StayPropagationCandidate[] {
  const presence = buildParticipantPresenceMap(graph, roster);
  const draftStay = {
    id: "__draft__",
    cityLabel: stayCityLabel,
    checkInDate: range.checkIn,
    checkOutDate: range.checkOut,
  };
  const mainDays = graph.dayPlacesByGroupId[graph.mainGroupId] ?? [];
  const candidates: StayPropagationCandidate[] = [];

  for (const participant of roster.participants) {
    if (participant.role === "host") continue;

    const plan = presence.get(participant.id);
    if (!plan || !participantEligibleForStay(plan, draftStay)) continue;

    const personalGroup = graph.groups.find(
      (g) => g.personalForParticipantId === participant.id && !g.isMain,
    );
    if (!personalGroup) continue;

    const personalStays = graph.accommodationStays.filter(
      (stay) =>
        stay.originGroupId === personalGroup.id &&
        stay.checkInDate < range.checkOut &&
        range.checkIn < stay.checkOutDate,
    );

    const overlayDays = graph.dayPlacesByGroupId[personalGroup.id] ?? [];
    const hasLocationOverride = overlayDays.some((overlayDay) => {
      if (overlayDay.date < range.checkIn || overlayDay.date >= range.checkOut) return false;
      if (!dayHasPaint(overlayDay)) return false;
      const mainDay = mainDays.find((d) => d.date === overlayDay.date);
      return mainDay ? !daysLocationEqual(overlayDay, mainDay) : true;
    });

    if (!personalStays.length && !hasLocationOverride) continue;

    candidates.push({
      groupId: personalGroup.id,
      participantId: participant.id,
      participantName: participant.fullName.trim() || "Participant",
      hasPersonalStay: personalStays.length > 0,
      hasLocationOverride,
    });
  }

  return candidates;
}

export function buildStayPropagationCommands(
  graph: TripEntityGraph,
  range: { checkIn: string; checkOut: string },
  candidateGroupIds: string[],
): TripCommand[] {
  const commands: TripCommand[] = [];
  const groupSet = new Set(candidateGroupIds);

  for (const groupId of groupSet) {
    for (const stay of graph.accommodationStays) {
      if (stay.originGroupId !== groupId) continue;
      if (stay.checkInDate >= range.checkOut || stay.checkOutDate <= range.checkIn) continue;
      commands.push({ type: "removeStay", groupId, stayId: stay.id });
    }

    const overlay = graph.dayPlacesByGroupId[groupId] ?? [];
    const trimmed = overlay.filter(
      (day) => day.date < range.checkIn || day.date >= range.checkOut,
    );
    if (trimmed.length !== overlay.length) {
      commands.push({ type: "setDayPlaces", groupId, days: trimmed });
    }
  }

  return commands;
}
