import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  visibilityTargets,
} from "@/lib/db/schema";
import type {
  VisibilityEntityType,
  VisibilityMode,
  VisibilityTarget,
  VisibilityTargetType,
} from "./types";

export async function loadVisibilityTargetsForTrip(
  tripId: string,
): Promise<
  Array<{
    entityType: VisibilityEntityType;
    entityId: string;
    targetType: VisibilityTargetType;
    targetId: string;
  }>
> {
  const rows = await db
    .select({
      entityType: visibilityTargets.entityType,
      entityId: visibilityTargets.entityId,
      targetType: visibilityTargets.targetType,
      targetId: visibilityTargets.targetId,
    })
    .from(visibilityTargets)
    .where(eq(visibilityTargets.tripId, tripId));

  return rows.map((r) => ({
    entityType: r.entityType as VisibilityEntityType,
    entityId: r.entityId,
    targetType: r.targetType as VisibilityTargetType,
    targetId: r.targetId,
  }));
}

export async function replaceVisibilityTargets(
  tripId: string,
  entityType: VisibilityEntityType,
  entityId: string,
  targets: VisibilityTarget[],
): Promise<void> {
  await db
    .delete(visibilityTargets)
    .where(
      and(
        eq(visibilityTargets.tripId, tripId),
        eq(visibilityTargets.entityType, entityType),
        eq(visibilityTargets.entityId, entityId),
      ),
    );

  if (!targets.length) return;

  await db.insert(visibilityTargets).values(
    targets.map((t) => ({
      tripId,
      entityType: entityType,
      entityId,
      targetType: t.targetType as "group" | "participant" | "room",
      targetId: t.targetId,
    })),
  );
}

export async function syncEntityVisibility(
  tripId: string,
  entityType: VisibilityEntityType,
  entityId: string,
  visibilityMode: VisibilityMode,
  targets: VisibilityTarget[],
): Promise<void> {
  if (visibilityMode === "custom") {
    await replaceVisibilityTargets(tripId, entityType, entityId, targets);
  } else {
    await replaceVisibilityTargets(tripId, entityType, entityId, []);
  }
}

export type VisibilityInput = {
  visibilityMode: VisibilityMode;
  targets?: VisibilityTarget[];
};

export function parseVisibilityInput(body: {
  visibilityMode?: VisibilityMode;
  targets?: Array<{ targetType: VisibilityTargetType; targetId: string }>;
}): VisibilityInput {
  const visibilityMode = body.visibilityMode ?? "everyone";
  const targets =
    visibilityMode === "custom"
      ? (body.targets ?? []).filter((t) => t.targetId && t.targetType)
      : [];
  return { visibilityMode, targets };
}

export function groupTargetsByEntity(
  rows: Array<{
    entityType: VisibilityEntityType;
    entityId: string;
    targetType: VisibilityTargetType;
    targetId: string;
  }>,
): Map<string, VisibilityTarget[]> {
  const map = new Map<string, VisibilityTarget[]>();
  for (const row of rows) {
    const key = `${row.entityType}:${row.entityId}`;
    const list = map.get(key) ?? [];
    list.push({ targetType: row.targetType, targetId: row.targetId });
    map.set(key, list);
  }
  return map;
}
