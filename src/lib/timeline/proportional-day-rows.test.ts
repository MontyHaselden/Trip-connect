import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildProportionalDayRows,
  computeEventDurationsById,
  DEFAULT_LAST_EVENT_DURATION_MINUTES,
  PROPORTIONAL_MIN_ROW_HEIGHT_PX,
} from "./proportional-day-rows";

const CONTAINER = 504;

describe("computeEventDurationsById", () => {
  it("uses gap until next start when endTime is missing", () => {
    const durations = computeEventDurationsById([
      { id: "a", startTime: "09:00:00", endTime: null },
      { id: "b", startTime: "15:00:00", endTime: null },
    ]);

    assert.equal(durations.get("a"), 360);
    assert.equal(durations.get("b"), DEFAULT_LAST_EVENT_DURATION_MINUTES);
  });

  it("uses explicit endTime when present", () => {
    const durations = computeEventDurationsById([
      { id: "a", startTime: "09:00:00", endTime: "12:00:00" },
    ]);

    assert.equal(durations.get("a"), 180);
  });
});

describe("buildProportionalDayRows", () => {
  it("gives long morning gap more height than short evening items", () => {
    const result = buildProportionalDayRows(
      [
        { id: "depart", startTime: "09:00:00", endTime: null, sortOrder: 1 },
        { id: "miyajima", startTime: "15:00:00", endTime: null, sortOrder: 2 },
        { id: "ferry", startTime: "17:30:00", endTime: null, sortOrder: 3 },
        { id: "dinner", startTime: "18:00:00", endTime: null, sortOrder: 4 },
      ],
      CONTAINER,
    );

    const depart = result.heightsById.get("depart")!;
    const miyajima = result.heightsById.get("miyajima")!;
    const ferry = result.heightsById.get("ferry")!;
    const dinner = result.heightsById.get("dinner")!;

    assert.ok(depart > miyajima, "morning gap should dominate");
    assert.ok(miyajima > PROPORTIONAL_MIN_ROW_HEIGHT_PX, "afternoon block should exceed minimum");
    assert.ok(Math.abs(ferry - PROPORTIONAL_MIN_ROW_HEIGHT_PX) <= 1);
    assert.ok(Math.abs(dinner - PROPORTIONAL_MIN_ROW_HEIGHT_PX) <= 1);
    assert.equal(depart + miyajima + ferry + dinner, CONTAINER);
  });

  it("bumps short middle segments to minimum and gives the rest to the long gap", () => {
    const result = buildProportionalDayRows(
      [
        { id: "short-a", startTime: "08:45:00", endTime: null, sortOrder: 1 },
        { id: "short-b", startTime: "09:16:00", endTime: null, sortOrder: 2 },
        { id: "long", startTime: "10:00:00", endTime: null, sortOrder: 3 },
        { id: "last", startTime: "17:00:00", endTime: null, sortOrder: 4 },
      ],
      CONTAINER,
    );

    const shortA = result.heightsById.get("short-a")!;
    const shortB = result.heightsById.get("short-b")!;
    const long = result.heightsById.get("long")!;
    const last = result.heightsById.get("last")!;

    assert.ok(Math.abs(shortA - PROPORTIONAL_MIN_ROW_HEIGHT_PX) <= 1);
    assert.ok(Math.abs(shortB - PROPORTIONAL_MIN_ROW_HEIGHT_PX) <= 1);
    assert.ok(Math.abs(last - PROPORTIONAL_MIN_ROW_HEIGHT_PX) <= 1);
    assert.ok(long > shortA * 4);
    assert.equal(shortA + shortB + long + last, CONTAINER);
  });
});
