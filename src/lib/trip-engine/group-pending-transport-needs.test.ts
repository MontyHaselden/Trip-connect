import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatGroupedTravellerLabel,
  listPendingTransportNeedsForDisplay,
} from "./group-pending-transport-needs";
import { pendingTransportNeedGroupKey, pendingTransportNeedRouteKey } from "./hidden-pending-transport";
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
    const routeKey = pendingTransportNeedGroupKey(shared);

    const items = listPendingTransportNeedsForDisplay(sections, new Set([routeKey]));
    assert.equal(items.length, 2);
    assert.equal(items.every((item) => item.type === "single"), true);
  });

  it("prefers whole group when main and personal scopes share the same route", () => {
    const outbound = need("outbound_flight", "2026-12-05", "Christchurch", "Tokyo");
    const sections = [
      {
        groupId: "g-main",
        title: "Whole group",
        memberNames: [],
        items: [outbound],
      },
      scope("g-amanda", "Amanda", [outbound]),
      scope("g-kaleb", "Kaleb", [outbound]),
      scope("g-mia", "Mia", [outbound]),
      scope("g-trenuela", "Trenuela", [outbound]),
    ];

    const items = listPendingTransportNeedsForDisplay(sections, new Set(), "g-main");
    assert.equal(items.length, 1);
    assert.equal(items[0]?.type, "single");
    if (items[0]?.type === "single") {
      assert.equal(items[0].scope.groupId, "g-main");
      assert.equal(items[0].scope.title, "Whole group");
    }
  });

  it("still groups personal-only routes without whole group", () => {
    const outbound = need("outbound_flight", "2026-12-06", "Christchurch", "Tokyo");
    const sections = [
      scope("g-amanda", "Amanda", [outbound]),
      scope("g-kaleb", "Kaleb", [outbound]),
    ];

    const items = listPendingTransportNeedsForDisplay(sections, new Set(), "g-main");
    assert.equal(items.length, 1);
    assert.equal(items[0]?.type, "grouped");
    if (items[0]?.type === "grouped") {
      assert.equal(items[0].scopes.length, 2);
    }
  });

  it("groups routes when participant calendars use different city label variants", () => {
    const sections = [
      scope("g-amanda", "Amanda", [
        need("intercity", "2026-12-06", "Tokyo", "Tottori"),
      ]),
      scope("g-kaleb", "Kaleb", [
        need("intercity", "2026-12-06", "Tokyo, Japan", "Tottori"),
      ]),
      scope("g-mia", "Mia", [
        need("intercity", "2026-12-06", "Tokyo", "Tottori, Japan"),
      ]),
    ];

    const items = listPendingTransportNeedsForDisplay(sections, new Set());
    assert.equal(items.length, 1);
    assert.equal(items[0]?.type, "grouped");
    if (items[0]?.type === "grouped") {
      assert.equal(items[0].scopes.length, 3);
    }
  });

  it("groups routes when participant calendars split on different dates", () => {
    const sections = [
      scope("g-kaleb", "Kaleb", [need("intercity", "2026-12-06", "Tokyo", "Tottori")]),
      scope("g-mia", "Mia", [need("intercity", "2026-12-06", "Tokyo", "Tottori")]),
      scope("g-trenuela", "Trenuela", [
        need("intercity", "2026-12-07", "Tokyo", "Tottori"),
      ]),
    ];

    const items = listPendingTransportNeedsForDisplay(sections, new Set());
    assert.equal(items.length, 1);
    assert.equal(items[0]?.type, "grouped");
    if (items[0]?.type === "grouped") {
      assert.equal(items[0].scopes.length, 3);
    }
  });
});

describe("formatGroupedTravellerLabel", () => {
  it("joins traveller names naturally", () => {
    const shared = need("intercity", "2026-12-06", "Tokyo", "Tottori");
    const label = formatGroupedTravellerLabel([
      { groupId: "g1", title: "Amanda", memberNames: ["Amanda"], need: shared },
      { groupId: "g2", title: "Kaleb", memberNames: ["Kaleb"], need: shared },
      { groupId: "g3", title: "Mia", memberNames: ["Mia"], need: shared },
      { groupId: "g4", title: "Trenuela", memberNames: ["Trenuela"], need: shared },
    ]);
    assert.equal(label, "Amanda, Kaleb, Mia, and Trenuela");
  });
});
