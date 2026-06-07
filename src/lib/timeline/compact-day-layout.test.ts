import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { computeCompactBlockLayouts } from "./compact-day-layout";
import { computeLayoutSpanMinutesById } from "./time-math";

const CONTAINER = 900;
const MIN = CONTAINER / 9;

function layoutFor(
  items: Array<{
    id: string;
    startTime: string;
    endTime: string | null;
    sortOrder?: number;
  }>,
) {
  return computeLayoutSpanMinutesById(items);
}

function heightsFor(
  items: Array<{
    id: string;
    startTime: string;
    endTime: string | null;
    sortOrder?: number;
  }>,
) {
  const layout = layoutFor(items);
  return computeCompactBlockLayouts(items, layout, CONTAINER);
}

describe("computeLayoutSpanMinutesById", () => {
  it("uses full gaps between activities", () => {
    const layout = layoutFor([
      { id: "a", startTime: "09:00:00", endTime: null, sortOrder: 1 },
      { id: "b", startTime: "15:00:00", endTime: null, sortOrder: 2 },
    ]);

    assert.equal(layout.spanById.get("a"), 360);
    assert.equal(layout.lockedMinimumIds.has("b"), true);
  });

  it("fills solo day without end time", () => {
    const items = [{ id: "solo", startTime: "09:00:00", endTime: null, sortOrder: 1 }];
    const layout = layoutFor(items);
    const result = computeCompactBlockLayouts(items, layout, CONTAINER);

    assert.equal(layout.soloFillId, "solo");
    assert.equal(result.heightsById.get("solo"), CONTAINER);
    assert.equal(result.needsScroll, false);
  });
});

describe("computeCompactBlockLayouts", () => {
  it("sizes Hiroshima day with dominant morning block and minimum dinner", () => {
    const items = [
      { id: "depart", startTime: "09:00:00", endTime: null, sortOrder: 1 },
      { id: "miyajima", startTime: "15:00:00", endTime: null, sortOrder: 2 },
      { id: "ferry", startTime: "17:30:00", endTime: null, sortOrder: 3 },
      { id: "dinner", startTime: "18:00:00", endTime: null, sortOrder: 4 },
    ];

    const result = heightsFor(items);
    const depart = result.heightsById.get("depart")!;
    const miyajima = result.heightsById.get("miyajima")!;
    const ferry = result.heightsById.get("ferry")!;
    const dinner = result.heightsById.get("dinner")!;

    assert.ok(Math.abs(dinner - MIN) <= 1, `dinner expected ~${MIN}, got ${dinner}`);
    assert.ok(Math.abs(ferry - MIN) <= 1, `ferry expected ~${MIN}, got ${ferry}`);
    assert.ok(depart > miyajima, "depart should be taller than miyajima");
    assert.ok(miyajima > MIN, "miyajima should be taller than minimum");
    assert.ok(depart > MIN * 3, "depart should dominate the list");

    const total = depart + miyajima + ferry + dinner;
    assert.equal(total, CONTAINER);
  });

  it("bumps small middle segments to minimum and gives the rest to the long gap", () => {
    const items = [
      { id: "short-a", startTime: "08:45:00", endTime: null, sortOrder: 1 },
      { id: "short-b", startTime: "09:16:00", endTime: null, sortOrder: 2 },
      { id: "long", startTime: "10:00:00", endTime: null, sortOrder: 3 },
      { id: "last", startTime: "17:00:00", endTime: null, sortOrder: 4 },
    ];

    const result = heightsFor(items);
    const shortA = result.heightsById.get("short-a")!;
    const shortB = result.heightsById.get("short-b")!;
    const long = result.heightsById.get("long")!;
    const last = result.heightsById.get("last")!;

    assert.ok(Math.abs(shortA - MIN) <= 1);
    assert.ok(Math.abs(shortB - MIN) <= 1);
    assert.ok(Math.abs(last - MIN) <= 1);
    assert.ok(long > shortA * 4, "long gap should take most remaining space");

    const total = shortA + shortB + long + last;
    assert.equal(total, CONTAINER);
  });

  it("sizes last item with end time proportionally", () => {
    const items = [
      { id: "a", startTime: "09:00:00", endTime: null, sortOrder: 1 },
      { id: "b", startTime: "12:00:00", endTime: "15:00:00", sortOrder: 2 },
    ];

    const result = heightsFor(items);
    const a = result.heightsById.get("a")!;
    const b = result.heightsById.get("b")!;

    assert.ok(a >= b, "morning gap should be at least as tall as the last activity");
    assert.equal(a + b, CONTAINER);
  });

  it("scrolls when minimum blocks exceed the container", () => {
    const items = Array.from({ length: 10 }, (_, index) => ({
      id: `item-${index}`,
      startTime: `${String(8 + index).padStart(2, "0")}:00:00`,
      endTime: null,
      sortOrder: index + 1,
    }));

    const result = heightsFor(items);

    assert.equal(result.needsScroll, true);
    assert.ok(result.totalHeight > CONTAINER);
    for (const item of items) {
      assert.ok(Math.abs(result.heightsById.get(item.id)! - MIN) <= 1);
    }
  });
});
