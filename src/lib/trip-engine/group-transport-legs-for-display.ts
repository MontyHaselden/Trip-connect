import { locationPaletteKey } from "@/lib/host/wizard/location-stays";
import type { IntercityLegDraft, TransportLegDraft } from "@/lib/host/wizard/types";

import { formatGroupedTravellerLabel } from "./group-pending-transport-needs";
import type { ScopedTransportLeg, TripScopeSection } from "./section-scope-lists";

export type TransportLegGroupedTarget = {
  legId: string;
  groupId: string;
};

export type TransportLegDisplayScope = TripScopeSection<ScopedTransportLeg> & {
  groupedLegTargets?: TransportLegGroupedTarget[];
};

type TransportLegScopeRef = {
  groupId: string;
  title: string;
  memberNames: string[];
};

function scopeRefFromSection(section: TripScopeSection<ScopedTransportLeg>): TransportLegScopeRef {
  return {
    groupId: section.groupId,
    title: section.title,
    memberNames: section.memberNames,
  };
}

function legEndpoints(leg: TransportLegDraft | IntercityLegDraft): {
  from: string;
  to: string;
} {
  if ("intercityFromCity" in leg && leg.intercityFromCity?.trim()) {
    return {
      from: leg.intercityFromCity.trim(),
      to: (leg.intercityToCity || leg.toCity).trim(),
    };
  }
  return { from: leg.fromCity.trim(), to: leg.toCity.trim() };
}

/** Shared journey identity — date + endpoints (+ flight number when set). */
export function transportLegRouteKey(leg: ScopedTransportLeg): string {
  const { from, to } = legEndpoints(leg);
  const flight =
    leg.transportType === "plane" ? (leg.flightNumber?.trim() ?? "") : "";
  return [
    leg.travelDate?.trim() ?? "",
    locationPaletteKey(from),
    locationPaletteKey(to),
    flight,
  ].join("|");
}

/** @deprecated alias — use {@link transportLegRouteKey}. */
export function transportLegDisplayKey(leg: ScopedTransportLeg): string {
  return transportLegRouteKey(leg);
}

/** Merge identical personal-scope legs into one shared section (whole group unchanged). */
export function groupPersonalTransportScopesForDisplay(
  otherScopes: TripScopeSection<ScopedTransportLeg>[],
): TransportLegDisplayScope[] {
  if (!otherScopes.length) return [];

  type Pair = {
    scope: TransportLegScopeRef;
    leg: ScopedTransportLeg;
  };

  const pairs: Pair[] = [];
  for (const section of otherScopes) {
    const scope = scopeRefFromSection(section);
    for (const leg of section.items) {
      pairs.push({ scope, leg });
    }
  }

  const byKey = new Map<string, Pair[]>();
  for (const pair of pairs) {
    const key = transportLegRouteKey(pair.leg);
    const bucket = byKey.get(key) ?? [];
    bucket.push(pair);
    byKey.set(key, bucket);
  }

  const consumedLegIds = new Set<string>();
  const merged: TransportLegDisplayScope[] = [];

  for (const [key, bucket] of byKey) {
    const scopeIds = new Set(bucket.map((row) => row.scope.groupId));
    if (scopeIds.size <= 1) continue;

    const scopes = [...new Map(bucket.map((row) => [row.scope.groupId, row.scope])).values()].sort(
      (a, b) => a.title.localeCompare(b.title),
    );
    const representative = bucket[0]!.leg;
    for (const row of bucket) consumedLegIds.add(row.leg.id);

    merged.push({
      groupId: `grouped:${key}`,
      title: formatGroupedTravellerLabel(scopes),
      memberNames: scopes.flatMap((scope) => scope.memberNames),
      items: [representative],
      groupedLegTargets: bucket.map((row) => ({
        legId: row.leg.id,
        groupId: row.scope.groupId,
      })),
    });
  }

  const unmerged: TransportLegDisplayScope[] = [];
  for (const section of otherScopes) {
    const items = section.items.filter((leg) => !consumedLegIds.has(leg.id));
    if (!items.length) continue;
    unmerged.push({ ...section, items });
  }

  return [...merged, ...unmerged].sort((a, b) => a.title.localeCompare(b.title));
}
