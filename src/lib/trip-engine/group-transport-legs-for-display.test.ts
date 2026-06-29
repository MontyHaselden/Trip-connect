import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  groupPersonalTransportScopesForDisplay,
  transportLegRouteKey,
} from "./group-transport-legs-for-display";
import type { ScopedTransportLeg, TripScopeSection } from "./section-scope-lists";

function leg(
  id: string,
  travelDate: string,
  from: string,
  to: string,
  originGroupId: string,
): ScopedTransportLeg {
  return {
    id,
    transportType: "plane",
    bookingStatus: "not_booked",
    travelDate,
    fromCity: from,
    toCity: to,
    intercityFromCity: from,
    intercityToCity: to,
    originGroupId,
    transportProductId: null,
    billingMode: "single",
  };
}

function scope(
  groupId: string,
  title: string,
  items: ScopedTransportLeg[],
): TripScopeSection<ScopedTransportLeg> {
  return { groupId, title, memberNames: [title], items };
}

describe("groupPersonalTransportScopesForDisplay", () => {
  it("merges identical personal legs across participants", () => {
    const sections = [
      scope("g-amanda", "Amanda", [leg("l1", "2026-12-06", "Tokyo", "Tottori", "g-amanda")]),
      scope("g-kaleb", "Kaleb", [leg("l2", "2026-12-06", "Tokyo, Japan", "Tottori", "g-kaleb")]),
      scope("g-mia", "Mia", [leg("l3", "2026-12-06", "Tokyo", "Tottori, Japan", "g-mia")]),
    ];

    const display = groupPersonalTransportScopesForDisplay(sections);
    assert.equal(display.length, 1);
    assert.equal(display[0]?.items.length, 1);
    assert.equal(display[0]?.groupedLegTargets?.length, 3);
    assert.match(display[0]?.title ?? "", /Amanda/);
  });

  it("keeps different routes as separate sections", () => {
    const sections = [
      scope("g-amanda", "Amanda", [leg("l1", "2026-12-06", "Tokyo", "Tottori", "g-amanda")]),
      scope("g-kaleb", "Kaleb", [leg("l2", "2026-12-13", "Tottori", "Hiroshima", "g-kaleb")]),
    ];

    const display = groupPersonalTransportScopesForDisplay(sections);
    assert.equal(display.length, 2);
    assert.equal(display[0]?.groupedLegTargets, undefined);
  });

  it("treats different flight numbers as separate legs", () => {
    const a = leg("l1", "2026-12-06", "Tokyo", "Tottori", "g-amanda");
    a.flightNumber = "NH123";
    const b = leg("l2", "2026-12-06", "Tokyo", "Tottori", "g-kaleb");
    b.flightNumber = "NH456";
    assert.notEqual(transportLegRouteKey(a), transportLegRouteKey(b));

    const display = groupPersonalTransportScopesForDisplay([
      scope("g-amanda", "Amanda", [a]),
      scope("g-kaleb", "Kaleb", [b]),
    ]);
    assert.equal(display.length, 2);
  });

  it("groups the same route even when transport types differ", () => {
    const train = leg("l1", "2026-12-06", "Tokyo", "Tottori", "g-kaleb");
    train.transportType = "train";
    const plane = leg("l2", "2026-12-06", "Tokyo", "Tottori", "g-mia");
    plane.transportType = "plane";

    const display = groupPersonalTransportScopesForDisplay([
      scope("g-kaleb", "Kaleb", [train]),
      scope("g-mia", "Mia", [plane]),
    ]);
    assert.equal(display.length, 1);
    assert.equal(display[0]?.groupedLegTargets?.length, 2);
  });

  it("merges duplicate personal legs within one participant scope", () => {
    const sections = [
      scope("g-amanda", "Amanda", [
        leg("l1", "2026-12-13", "Tottori", "Hiroshima", "g-amanda"),
        leg("l2", "2026-12-13", "Tottori", "Hiroshima", "g-amanda"),
        leg("l3", "2026-12-13", "Tottori", "Hiroshima", "g-amanda"),
      ]),
    ];

    const display = groupPersonalTransportScopesForDisplay(sections);
    assert.equal(display.length, 1);
    assert.equal(display[0]?.items.length, 1);
    assert.equal(display[0]?.groupedLegTargets?.length, 3);
  });
});
