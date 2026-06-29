import { loadRoster } from "@/lib/host/roster-queries";

import type { RosterSummary } from "./types";

type RosterPayloadLike = {
  participants: Array<{
    id: string;
    fullName: string;
    role: string;
    inCostSplit: boolean;
    groupIds: string[];
    roomId: string | null;
  }>;
  groups: Array<{ id: string; name: string }>;
  rooms: Array<{ id: string; roomName: string }>;
};

export function rosterPayloadToSummary(payload: RosterPayloadLike): RosterSummary {
  return {
    participants: payload.participants
      .filter((p) => p.role !== "host")
      .map((p) => ({
        id: p.id,
        fullName: p.fullName,
        role: p.role as RosterSummary["participants"][number]["role"],
        inCostSplit: p.inCostSplit,
        groupIds: p.groupIds,
        roomId: p.roomId,
      })),
    groups: payload.groups.map((g) => ({ id: g.id, name: g.name })),
    rooms: payload.rooms.map((r) => ({ id: r.id, roomName: r.roomName })),
  };
}

export async function loadRosterSummary(tripId: string): Promise<RosterSummary> {
  const roster = await loadRoster(tripId);
  return rosterPayloadToSummary(roster);
}
