import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { tripHiddenTransportNeeds } from "@/lib/db/schema";

import type { PendingTransportKind, PendingTransportNeed } from "./pending-city-moves";

function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

export function pendingTransportNeedKey(
  groupId: string,
  need: Pick<PendingTransportNeed, "kind" | "date" | "fromCity" | "toCity">,
): string {
  return [groupId, pendingTransportNeedRouteKey(need)].join("|");
}

/** Route identity shared across participant calendars (no group id). */
export function pendingTransportNeedRouteKey(
  need: Pick<PendingTransportNeed, "kind" | "date" | "fromCity" | "toCity">,
): string {
  return [
    need.kind,
    need.date,
    normalizeCity(need.fromCity),
    normalizeCity(need.toCity),
  ].join("|");
}

export function parsePendingTransportNeedKey(key: string): {
  groupId: string;
  kind: PendingTransportKind;
  date: string;
  fromCity: string;
  toCity: string;
} | null {
  const parts = key.split("|");
  if (parts.length !== 5) return null;
  const [groupId, kind, date, fromCity, toCity] = parts;
  if (
    kind !== "outbound_flight" &&
    kind !== "return_flight" &&
    kind !== "intercity"
  ) {
    return null;
  }
  return { groupId, kind, date, fromCity, toCity };
}

export async function loadHiddenPendingTransportNeedKeys(
  tripId: string,
): Promise<string[]> {
  const rows = await db
    .select({ needKey: tripHiddenTransportNeeds.needKey })
    .from(tripHiddenTransportNeeds)
    .where(eq(tripHiddenTransportNeeds.tripId, tripId));
  return rows.map((row) => row.needKey);
}

export function isPendingTransportNeedHidden(
  hiddenKeys: ReadonlySet<string> | readonly string[] | undefined,
  groupId: string,
  need: PendingTransportNeed,
): boolean {
  const set = hiddenKeys instanceof Set ? hiddenKeys : new Set(hiddenKeys ?? []);
  return set.has(pendingTransportNeedKey(groupId, need));
}

export async function hidePendingTransportNeed(
  tripId: string,
  groupId: string,
  need: PendingTransportNeed,
): Promise<void> {
  const needKey = pendingTransportNeedKey(groupId, need);
  await db
    .insert(tripHiddenTransportNeeds)
    .values({ tripId, needKey })
    .onConflictDoNothing();
}

export async function unhidePendingTransportNeed(
  tripId: string,
  groupId: string,
  need: PendingTransportNeed,
): Promise<void> {
  const needKey = pendingTransportNeedKey(groupId, need);
  await db
    .delete(tripHiddenTransportNeeds)
    .where(
      and(
        eq(tripHiddenTransportNeeds.tripId, tripId),
        eq(tripHiddenTransportNeeds.needKey, needKey),
      ),
    );
}
