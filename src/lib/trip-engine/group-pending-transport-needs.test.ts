import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatGroupedTravellerLabel,
  listPendingTransportNeedsForDisplay,
} from "./group-pending-transport-needs";
import { pendingTransportNeedRouteKey } from "./hidden-pending-transport";
import type { PendingTransportNeed } from "./pending-city-moves";
import type { TripScopeSection } from "./section-scope-lists";

function need(
  kind: PendingTransportNeed["kind"],
  date: string,
  fromCity: string,
  toCity: string,
): PendingTransportNeed {
  return { kind, date, fromCity, toCity };
}

function scope(
  groupId: string,
  title: string,
  items: PendingTransportNeed[],
): TripScopeSection<PendingTransportNeed> {
  return { groupId, title, memberNames: [title], items };
}

describe("listPendingTransportNeedsForDisplay", () => {
  it("groups the same route across four participant scopes", () => {
    const outbound = need("outbound_flight", "2026-12-06", "Christchurch", "Tokyo");
    const cityChange = need("intercity", "2026-12-13", "Tottori", "Hiroshima");
    const sections = [
      scope("g-amanda", "Amanda", [outbound, cityChange]),
      scope("g-kaleb", "Kaleb", [outbound, cityChange]),
      scope("g-mia", "Mia", [outbound, cityChange]),
      scope("g-trenuela", "Trenuela", [outbound, cityChange]),
    ];

    const items = listPendingTransportNeedsForDisplay(sections, new Set());
    assert.equal(items.length, 2);
    assert.equal(items[0]?.type, "grouped");
    assert.equal(items[0]?.need.kind, "outbound_flight");
    if (items[0]?.type === "grouped") {
      assert.equal(items[0].scopes.length, 4);
    }
    assert.equal(items[1]?.type, "grouped");
    if (items[1]?.type === "grouped") {
      assert.equal(items[1].need.fromCity, "Tottori");
      assert.equal(items[1].scopes.length, 4);
    }
  });

  it("expands grouped routes when the host separates flights", () => {
    const shared = need("outbound_flight", "2026-12-06", "Christchurch", "Tokyo");
    const sections = [
      scope("g-amanda", "Amanda", [shared]),
      scope("g-kaleb", "Kaleb", [shared]),
    ];
    const routeKey = pendingTransportNeedRouteKey(shared);

    const items = listPendingTransportNeedsForDisplay(sections, new Set([routeKey]));
    assert.equal(items.length, 2);
    assert.equal(items.every((item) => item.type === "single"), true);
  });
});

describe("formatGroupedTravellerLabel", () => {
  it("joins traveller names naturally", () => {
    const label = formatGroupedTravellerLabel([
      { groupId: "g1", title: "Amanda", memberNames: ["Amanda"] },
      { groupId: "g2", title: "Kaleb", memberNames: ["Kaleb"] },
      { groupId: "g3", title: "Mia", memberNames: ["Mia"] },
      { groupId: "g4", title: "Trenuela", memberNames: ["Trenuela"] },
    ]);
    assert.equal(label, "Amanda, Kaleb, Mia, and Trenuela");
  });
});
