import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { consumeBoundaryDragDelta } from "./boundary-drag-step";

describe("consumeBoundaryDragDelta", () => {
  it("steps one day per horizontal threshold regardless of calendar row", () => {
    const cellWidth = 120;
    const threshold = Math.max(48, cellWidth * 0.38);

    const first = consumeBoundaryDragDelta(0, threshold - 10, cellWidth);
    assert.deepEqual(first.steps, []);

    const second = consumeBoundaryDragDelta(first.accumX, 15, cellWidth);
    assert.deepEqual(second.steps, [1]);
  });

  it("steps backward when dragged left", () => {
    const { steps, accumX } = consumeBoundaryDragDelta(0, -60, 120);
    assert.deepEqual(steps, [-1]);
    assert.ok(accumX > -60);
  });

  it("can emit multiple steps in one move", () => {
    const { steps } = consumeBoundaryDragDelta(0, 200, 100);
    assert.ok(steps.length >= 2);
    assert.ok(steps.every((s) => s === 1));
  });
});
