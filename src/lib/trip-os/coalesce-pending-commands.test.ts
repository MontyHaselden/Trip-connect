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
});
