import { loadRoster } from "@/lib/host/roster-queries";

import type { RosterSummary } from "./types";

export async function loadRosterSummary(tripId: string): Promise<RosterSummary> {
  const roster = await loadRoster(tripId);
  return {
    participants: roster.participants
      .filter((p) => p.role !== "host")
      .map((p) => ({
        id: p.id,
        fullName: p.fullName,
        role: p.role,
        inCostSplit: p.inCostSplit,
        groupIds: p.groupIds,
        roomId: p.roomId,
      })),
    groups: roster.groups.map((g) => ({ id: g.id, name: g.name })),
    rooms: roster.rooms.map((r) => ({ id: r.id, roomName: r.roomName })),
  };
}
