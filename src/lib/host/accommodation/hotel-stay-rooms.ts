import type { AccommodationStayDraft } from "@/lib/host/wizard/types";
import type { AccommodationAssignmentRow } from "@/lib/host/accommodation-assignment-queries";
import {
  buildParticipantPresenceMap,
  participantEligibleForStay,
} from "@/lib/trip-engine/cost-ledger/presence";
import type { RosterSummary, TripEntityGraph } from "@/lib/trip-engine/types";

export function normalizeHotelLabel(name: string): string {
  return name.trim().toLowerCase();
}

export function hotelNameMatchesStay(
  roomHotelName: string | null | undefined,
  stay: Pick<AccommodationStayDraft, "name" | "cityLabel">,
): boolean {
  const roomKey = normalizeHotelLabel(roomHotelName ?? "");
  if (!roomKey) return false;
  const stayName = normalizeHotelLabel(stay.name ?? "");
  const stayCity = normalizeHotelLabel(stay.cityLabel ?? "");
  if (stayName && (roomKey === stayName || roomKey.startsWith(stayName) || stayName.startsWith(roomKey))) {
    return true;
  }
  return Boolean(stayCity && roomKey.includes(stayCity));
}

export function eligibleStudentsForStay(
  graph: TripEntityGraph,
  roster: RosterSummary,
  stay: Pick<
    AccommodationStayDraft,
    "id" | "cityLabel" | "checkInDate" | "checkOutDate" | "name"
  >,
) {
  const presence = buildParticipantPresenceMap(graph, roster);
  return roster.participants.filter((participant) => {
    if (participant.role !== "student") return false;
    const plan = presence.get(participant.id);
    return plan ? participantEligibleForStay(plan, stay, graph) : false;
  });
}

export type StayRoomGroup = {
  roomId: string;
  roomName: string;
  participantIds: string[];
  participants: Array<{ id: string; fullName: string }>;
};

export function groupStayRoomAssignments(
  assignments: AccommodationAssignmentRow[],
  stayId: string,
  roster: RosterSummary,
): StayRoomGroup[] {
  const participantById = new Map(roster.participants.map((p) => [p.id, p]));
  const byRoom = new Map<string, StayRoomGroup>();

  for (const assignment of assignments) {
    if (assignment.stayId !== stayId || !assignment.roomId || !assignment.participantId) continue;
    const participant = participantById.get(assignment.participantId);
    if (!participant) continue;

    let group = byRoom.get(assignment.roomId);
    if (!group) {
      group = {
        roomId: assignment.roomId,
        roomName: assignment.roomName?.trim() || "Room",
        participantIds: [],
        participants: [],
      };
      byRoom.set(assignment.roomId, group);
    }
    if (!group.participantIds.includes(participant.id)) {
      group.participantIds.push(participant.id);
      group.participants.push({ id: participant.id, fullName: participant.fullName });
    }
  }

  return [...byRoom.values()].sort((a, b) => a.roomName.localeCompare(b.roomName));
}

export function assignedRoomNameByParticipantAtStay(
  assignments: AccommodationAssignmentRow[],
  stayId: string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const assignment of assignments) {
    if (assignment.stayId !== stayId || !assignment.participantId || !assignment.roomId) continue;
    map.set(assignment.participantId, assignment.roomName?.trim() || "Room");
  }
  return map;
}
