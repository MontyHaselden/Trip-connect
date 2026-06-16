import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DateTime } from "luxon";

import { weekStartMonday } from "@/lib/host/setup/calendar-bounds";

import { buildScrollWeeks, planCalendarWeekSections } from "./calendar-weeks";

describe("planCalendarWeekSections", () => {
  it("pads before the 1st so dates align with weekday columns", () => {
    const weeks = buildScrollWeeks(
      weekStartMonday(DateTime.fromISO("2028-07-01")),
      weekStartMonday(DateTime.fromISO("2028-08-31")).plus({ days: 6 }),
    );
    const sections = planCalendarWeekSections(weeks);
    const augustHead = sections.find((s) => s.key.endsWith("-head") && s.monthLabel?.includes("August"));
    assert.ok(augustHead, "expected August head section");

    const aug1Idx = augustHead!.cells.findIndex((c) => c?.iso === "2028-08-01");
    const aug1Column = (DateTime.fromISO("2028-08-01").weekday + 6) % 7;
    assert.equal(aug1Idx, aug1Column, "Aug 1 lands in its weekday column (Mon=0)");

    for (let i = 0; i < aug1Idx; i++) {
      assert.equal(augustHead!.cells[i], null);
    }
  });

  it("places Aug 23 2028 in the Wednesday column", () => {
    const weeks = buildScrollWeeks(
      weekStartMonday(DateTime.fromISO("2028-08-01")),
      weekStartMonday(DateTime.fromISO("2028-08-31")).plus({ days: 6 }),
    );
    const sections = planCalendarWeekSections(weeks);
    const sectionWith23 = sections.find((s) =>
      s.cells.some((c) => c?.iso === "2028-08-23"),
    );
    assert.ok(sectionWith23);
    const idx = sectionWith23!.cells.findIndex((c) => c?.iso === "2028-08-23");
    assert.equal(idx, 2, "Aug 23 2028 is Wednesday — column index 2");
  });
});
