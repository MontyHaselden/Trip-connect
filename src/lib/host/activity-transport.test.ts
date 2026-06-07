import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatActivityTransport,
  parseActivityTransport,
  primaryLeaveByTime,
} from "./activity-transport";

describe("activity transport notes", () => {
  it("formats and parses getting there and back", () => {
    const note = formatActivityTransport({
      there: {
        transportType: "train",
        leaveByTime: "08:30",
        durationMinutes: 45,
        note: "JR Pass",
      },
      back: {
        transportType: "taxi",
        leaveByTime: "17:00",
        durationMinutes: 20,
        note: null,
      },
    });

    assert.equal(
      note,
      "Getting there: Train, leave 08:30 (~45 min) — JR Pass\nGetting back: Taxi / shuttle, leave 17:00 (~20 min)",
    );

    const parsed = parseActivityTransport(note, null);
    assert.equal(parsed.there?.transportType, "train");
    assert.equal(parsed.there?.leaveByTime, "08:30");
    assert.equal(parsed.there?.durationMinutes, 45);
    assert.equal(parsed.back?.transportType, "taxi");
    assert.equal(primaryLeaveByTime(parsed), "08:30");
  });

  it("merges legacy leaveByTime with parsed note", () => {
    const parsed = parseActivityTransport("Getting there: Bus, leave 09:00 (~15 min)", "09:00:00");
    assert.equal(parsed.there?.leaveByTime, "09:00");
  });
});
