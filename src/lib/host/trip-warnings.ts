import type { PublishedTripSnapshotV1 } from "@/types/published-trip";
import { timeToMinutes } from "@/lib/timeline/time-math";
import { targetsForEntity } from "@/lib/visibility/types";
import { isVisibleToParticipant } from "@/lib/visibility/resolve-visible";
import { buildParticipantContext } from "@/lib/student/resolve-accommodation-for-date";
import { resolveAccommodationForDate } from "@/lib/student/resolve-accommodation-for-date";

export type TripWarning = {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
};

function nightsBetween(startDate: string, endDate: string): string[] {
  const nights: string[] = [];
  let cursor = startDate;
  while (cursor < endDate) {
    nights.push(cursor);
    const d = new Date(`${cursor}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    cursor = d.toISOString().slice(0, 10);
  }
  return nights;
}

export function computeTripWarnings(snapshot: PublishedTripSnapshotV1): TripWarning[] {
  const warnings: TripWarning[] = [];
  const allTargets = snapshot.visibilityTargets ?? [];
  const studentIds = snapshot.participants
    .filter((p) => p.role === "student")
    .map((p) => p.id);

  for (const participantId of studentIds) {
    const participant = snapshot.participants.find((p) => p.id === participantId)!;
    for (const night of nightsBetween(snapshot.trip.startDate, snapshot.trip.endDate)) {
      const acc = resolveAccommodationForDate(snapshot, participantId, night);
      if (!acc) {
        warnings.push({
          id: `no-acc-${participantId}-${night}`,
          severity: "warning",
          message: `${participant.fullName} has no accommodation assigned for the night of ${night}.`,
        });
      }
    }
  }

  for (const group of snapshot.groups) {
    const members = snapshot.participantGroups.filter((pg) => pg.groupId === group.id);
    const customTargets = allTargets.filter(
      (t) => t.targetType === "group" && t.targetId === group.id,
    );
    if (customTargets.length > 0 && members.length === 0) {
      warnings.push({
        id: `empty-group-${group.id}`,
        severity: "warning",
        message: `Group “${group.name}” is targeted by visibility rules but has no members.`,
      });
    }
  }

  for (const participantId of studentIds) {
    const ctx = buildParticipantContext(snapshot, participantId);
    const visibleItems = snapshot.itineraryItems.filter((item) =>
      isVisibleToParticipant(
        {
          id: item.id,
          visibilityMode: item.visibilityMode ?? "everyone",
          audienceType: item.audienceType,
          audienceId: item.audienceId,
        },
        ctx,
        targetsForEntity("itinerary_item", item.id, allTargets),
      ),
    );

    const byDay = new Map<string, typeof visibleItems>();
    for (const item of visibleItems) {
      const list = byDay.get(item.tripDayId) ?? [];
      list.push(item);
      byDay.set(item.tripDayId, list);
    }

    for (const [, items] of byDay) {
      const sorted = [...items].sort((a, b) => a.startTime.localeCompare(b.startTime));
      for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i]!;
        const b = sorted[i + 1]!;
        const aEnd = a.endTime ? timeToMinutes(a.endTime) : timeToMinutes(a.startTime) + 60;
        const bStart = timeToMinutes(b.startTime);
        if (bStart < aEnd && a.visibilityMode === "custom" && b.visibilityMode === "custom") {
          const p = snapshot.participants.find((x) => x.id === participantId)!;
          warnings.push({
            id: `overlap-${participantId}-${a.id}-${b.id}`,
            severity: "info",
            message: `${p.fullName} may see overlapping activities (${a.title} / ${b.title}).`,
          });
        }
      }
    }
  }

  return warnings;
}
