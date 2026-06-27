import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { coalescePendingCommands } from "./coalesce-pending-commands";

describe("coalescePendingCommands", () => {
  it("keeps the last paintDayRange for the same group and range", () => {
    const out = coalescePendingCommands([
      {
        type: "paintDayRange",
        groupId: "g-kaleb",
        rangeStart: "2026-12-06",
        rangeEnd: "2026-12-13",
        location: "Kagoshima",
      },
      {
        type: "paintDayRange",
        groupId: "g-kaleb",
        rangeStart: "2026-12-06",
        rangeEnd: "2026-12-13",
        location: "Tottori",
      },
    ]);

    assert.equal(out.length, 1);
    assert.equal(out[0]?.type === "paintDayRange" ? out[0].location : "", "Tottori");
  });

  it("preserves separate party paints and collapses duplicate hides", () => {
    const out = coalescePendingCommands([
      {
        type: "paintDayRange",
        groupId: "g-amanda",
        rangeStart: "2026-12-06",
        rangeEnd: "2026-12-13",
        location: "Tottori",
      },
      {
        type: "paintDayRange",
        groupId: "g-kaleb",
        rangeStart: "2026-12-06",
        rangeEnd: "2026-12-13",
        location: "Tottori",
      },
      {
        type: "hidePendingTransportNeed",
        groupId: "g-amanda",
        need: {
          kind: "intercity",
          date: "2026-12-06",
          fromCity: "Tokyo",
          toCity: "Kagoshima",
        },
      },
      {
        type: "unhidePendingTransportNeed",
        groupId: "g-amanda",
        need: {
          kind: "intercity",
          date: "2026-12-06",
          fromCity: "Tokyo",
          toCity: "Kagoshima",
        },
      },
    ]);

    assert.equal(out.length, 3);
    assert.equal(out[2]?.type, "unhidePendingTransportNeed");
  });

  it("merges updateTransportLeg patches for the same leg", () => {
    const out = coalescePendingCommands([
      {
        type: "updateTransportLeg",
        groupId: "g-amanda",
        bucket: "intercity",
        legId: "leg-1",
        patch: { fromCity: "Tokyo" },
      },
      {
        type: "updateTransportLeg",
        groupId: "g-amanda",
        bucket: "intercity",
        legId: "leg-1",
        patch: { transportType: "plane", toCity: "Tottori" },
      },
    ]);

    assert.equal(out.length, 1);
    assert.equal(out[0]?.type, "updateTransportLeg");
    if (out[0]?.type === "updateTransportLeg") {
      assert.equal(out[0].patch.fromCity, "Tokyo");
      assert.equal(out[0].patch.transportType, "plane");
      assert.equal(out[0].patch.toCity, "Tottori");
    }
  });

  it("merges setDayPlaces for the same group", () => {
    const out = coalescePendingCommands([
      {
        type: "setDayPlaces",
        groupId: "g-amanda",
        days: [{ date: "2026-12-06", primaryCity: "Tokyo", dayType: "trip" }],
      },
      {
        type: "setDayPlaces",
        groupId: "g-amanda",
        days: [{ date: "2026-12-07", primaryCity: "Tottori", dayType: "trip" }],
      },
    ]);

    assert.equal(out.length, 1);
    if (out[0]?.type === "setDayPlaces") {
      assert.equal(out[0].days.length, 2);
    }
  });
});
