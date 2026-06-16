import type {
  PublishedGroupDayPlace,
  PublishedGroupOverlayOp,
  PublishedTripSnapshotV1,
} from "@/types/published-trip";

type LayerEntity = {
  id: string;
  originGroupId?: string | null;
};

function getMainGroupId(snapshot: PublishedTripSnapshotV1): string | null {
  return snapshot.groups.find((g) => g.isMain)?.id ?? null;
}

function participantGroupIds(
  snapshot: PublishedTripSnapshotV1,
  participantId: string,
): Set<string> {
  const ids = new Set(
    snapshot.participantGroups
      .filter((pg) => pg.participantId === participantId)
      .map((pg) => pg.groupId),
  );
  const mainId = getMainGroupId(snapshot);
  if (mainId) ids.delete(mainId);
  return ids;
}

function opsForGroup(
  ops: PublishedGroupOverlayOp[],
  groupId: string,
  entityType: PublishedGroupOverlayOp["entityType"],
): PublishedGroupOverlayOp[] {
  return ops.filter((o) => o.groupId === groupId && o.entityType === entityType);
}

function opAppliesOnDate(
  op: PublishedGroupOverlayOp,
  dateISO: string | null,
): boolean {
  if (!dateISO) return true;
  if (op.effectiveFrom && dateISO < op.effectiveFrom) return false;
  if (op.effectiveTo && dateISO > op.effectiveTo) return false;
  return true;
}

export function mergeGroupDayPlaces(
  mainPlaces: PublishedGroupDayPlace[],
  overlayPlaces: PublishedGroupDayPlace[],
  participantGroupIds: Set<string>,
): Map<string, PublishedGroupDayPlace> {
  const byDate = new Map<string, PublishedGroupDayPlace>();
  for (const p of mainPlaces) byDate.set(p.date, p);
  for (const gid of participantGroupIds) {
    for (const p of overlayPlaces.filter((x) => x.groupId === gid)) {
      byDate.set(p.date, p);
    }
  }
  return byDate;
}

function entityOverlapsOp(
  entity: { checkInDate?: string; checkOutDate?: string; travelDate?: string },
  op: PublishedGroupOverlayOp,
): boolean {
  if (!op.effectiveFrom && !op.effectiveTo) return true;
  const from = op.effectiveFrom ?? "0000-01-01";
  const to = op.effectiveTo ?? "9999-12-31";
  if (entity.checkInDate && entity.checkOutDate) {
    return entity.checkInDate <= to && entity.checkOutDate >= from;
  }
  if (entity.travelDate) {
    return entity.travelDate >= from && entity.travelDate <= to;
  }
  return true;
}

export function resolveEntitySet<T extends LayerEntity>(
  all: T[],
  entityType: PublishedGroupOverlayOp["entityType"],
  overlayOps: PublishedGroupOverlayOp[],
  mainGroupId: string | null,
  participantGroups: Set<string>,
  rangeForEntity?: (entity: T) => {
    checkInDate?: string;
    checkOutDate?: string;
    travelDate?: string;
  } | null,
): T[] {
  const mainId = mainGroupId;
  const isMainOwned = (e: T) =>
    !e.originGroupId || e.originGroupId === mainId;

  const result = new Map<string, T>();
  for (const e of all) {
    if (isMainOwned(e)) result.set(e.id, e);
  }

  for (const gid of participantGroups) {
    const groupOps = opsForGroup(overlayOps, gid, entityType);
    for (const op of groupOps) {
      const base = all.find((x) => x.id === op.baseEntityId);
      const range = base && rangeForEntity ? rangeForEntity(base) : null;
      if (range && !entityOverlapsOp(range, op)) continue;
      if (!range && !opAppliesOnDate(op, null)) continue;

      if (op.op === "hide") {
        result.delete(op.baseEntityId);
      } else if (op.op === "replace" && op.replacementEntityId) {
        result.delete(op.baseEntityId);
        const replacement = all.find((x) => x.id === op.replacementEntityId);
        if (replacement) result.set(replacement.id, replacement);
      }
    }
  }

  for (const e of all) {
    if (
      e.originGroupId &&
      participantGroups.has(e.originGroupId) &&
      e.originGroupId !== mainId
    ) {
      result.set(e.id, e);
    }
  }

  return [...result.values()];
}

/** Apply Main Group + group overlay resolution before visibility filtering. */
export function resolveLayersForParticipant(
  snapshot: PublishedTripSnapshotV1,
  participantId: string,
): PublishedTripSnapshotV1 {
  const mainGroupId = getMainGroupId(snapshot);
  const pGroupIds = participantGroupIds(snapshot, participantId);
  const allDayPlaces = snapshot.groupDayPlaces ?? [];
  const overlayOps = snapshot.groupOverlayOps ?? [];

  const mainPlaces = mainGroupId
    ? allDayPlaces.filter((p) => p.groupId === mainGroupId)
    : allDayPlaces;
  const overlayPlaces = allDayPlaces.filter((p) => pGroupIds.has(p.groupId));

  const mergedByDate =
    pGroupIds.size > 0
      ? mergeGroupDayPlaces(mainPlaces, overlayPlaces, pGroupIds)
      : new Map(mainPlaces.map((p) => [p.date, p]));

  const days = snapshot.days.map((day) => {
    const place = mergedByDate.get(day.date);
    if (!place) return day;
    return {
      ...day,
      cityLabel: place.primaryCity.trim() || day.cityLabel,
      secondaryCityLabel: place.secondaryCity ?? day.secondaryCityLabel,
      calendarLabel: place.calendarLabel ?? day.calendarLabel,
      dayType: place.dayType ?? day.dayType,
    };
  });

  const stayRange = (s: { checkInDate: string; checkOutDate: string }) => s;

  const itineraryItems = resolveEntitySet(
    snapshot.itineraryItems,
    "itinerary_item",
    overlayOps,
    mainGroupId,
    pGroupIds,
  );

  const transportLegs = resolveEntitySet(
    snapshot.transportLegs ?? [],
    "transport_leg",
    overlayOps,
    mainGroupId,
    pGroupIds,
    (leg) => ({ travelDate: (leg as { travelDate: string }).travelDate }),
  );

  const accommodationStays = resolveEntitySet(
    snapshot.accommodationStays ?? [],
    "accommodation_stay",
    overlayOps,
    mainGroupId,
    pGroupIds,
    (stay) =>
      stayRange(stay as { checkInDate: string; checkOutDate: string }),
  );

  return {
    ...snapshot,
    days,
    itineraryItems,
    transportLegs,
    accommodationStays,
  };
}
