import { pendingTransportNeedRouteKey } from "./hidden-pending-transport";
import type { PendingTransportNeed } from "./pending-city-moves";
import type { TripScopeSection } from "./section-scope-lists";

export type PendingTransportScopeRef = {
  groupId: string;
  title: string;
  memberNames: string[];
};

export type PendingTransportListItem =
  | {
      type: "grouped";
      routeKey: string;
      need: PendingTransportNeed;
      scopes: PendingTransportScopeRef[];
    }
  | {
      type: "single";
      routeKey: string;
      need: PendingTransportNeed;
      scope: PendingTransportScopeRef;
    };

function scopeRefFromSection(
  section: TripScopeSection<PendingTransportNeed>,
): PendingTransportScopeRef {
  return {
    groupId: section.groupId,
    title: section.title,
    memberNames: section.memberNames,
  };
}

function kindRank(kind: PendingTransportNeed["kind"]): number {
  if (kind === "outbound_flight") return 0;
  if (kind === "return_flight") return 1;
  return 2;
}

function sortListItems(items: PendingTransportListItem[]): PendingTransportListItem[] {
  return [...items].sort((a, b) => {
    const byKind = kindRank(a.need.kind) - kindRank(b.need.kind);
    if (byKind !== 0) return byKind;
    return a.need.date.localeCompare(b.need.date);
  });
}

/** Collapse identical calendar gaps across participant scopes into one shared row. */
export function listPendingTransportNeedsForDisplay(
  sections: TripScopeSection<PendingTransportNeed>[],
  separatedRouteKeys: ReadonlySet<string>,
): PendingTransportListItem[] {
  const byRoute = new Map<
    string,
    { need: PendingTransportNeed; scopes: PendingTransportScopeRef[] }
  >();

  for (const section of sections) {
    const scope = scopeRefFromSection(section);
    for (const need of section.items) {
      const routeKey = pendingTransportNeedRouteKey(need);
      const bucket = byRoute.get(routeKey) ?? { need, scopes: [] };
      if (!byRoute.has(routeKey)) byRoute.set(routeKey, bucket);
      if (!bucket.scopes.some((row) => row.groupId === scope.groupId)) {
        bucket.scopes.push(scope);
      }
    }
  }

  const items: PendingTransportListItem[] = [];
  for (const [routeKey, { need, scopes }] of byRoute) {
    const sortedScopes = [...scopes].sort((a, b) => a.title.localeCompare(b.title));
    if (separatedRouteKeys.has(routeKey) || sortedScopes.length <= 1) {
      for (const scope of sortedScopes) {
        items.push({ type: "single", routeKey, need, scope });
      }
      continue;
    }
    items.push({ type: "grouped", routeKey, need, scopes: sortedScopes });
  }

  return sortListItems(items);
}

export function formatGroupedTravellerLabel(scopes: PendingTransportScopeRef[]): string {
  const names = scopes
    .map((scope) => scope.memberNames[0]?.trim() || scope.title.trim())
    .filter(Boolean);
  if (!names.length) return `${scopes.length} travellers`;
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}
