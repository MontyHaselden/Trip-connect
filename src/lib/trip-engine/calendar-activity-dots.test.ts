import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CALENDAR_ACTIVITY_DOT_LIMIT,
  filterCalendarDotActivities,
  isCalendarDotActivity,
} from "@/lib/trip-engine/calendar-activity-dots";

function act(title: string, category: string, id = title) {
  return { id, title, category };
}

describe("isCalendarDotActivity", () => {
  it("includes real outings", () => {
    assert.equal(isCalendarDotActivity(act("Phi Phi day trip", "activity")), true);
    assert.equal(isCalendarDotActivity(act("Kickboxing class", "activity")), true);
    assert.equal(isCalendarDotActivity(act("ICONSIAM visit", "school")), true);
  });

  it("excludes meals, travel, hotel, and routine titles", () => {
    assert.equal(isCalendarDotActivity(act("Breakfast", "meal")), false);
    assert.equal(isCalendarDotActivity(act("Lunch at mall", "other")), false);
    assert.equal(isCalendarDotActivity(act("Check-in", "hotel")), false);
    assert.equal(isCalendarDotActivity(act("Airport transfer", "travel")), false);
    assert.equal(isCalendarDotActivity(act("Traveling to Bangkok", "activity")), false);
    assert.equal(isCalendarDotActivity(act("Free afternoon", "free_time")), false);
  });
});

describe("filterCalendarDotActivities", () => {
  it("caps at twelve dots", () => {
    const items = Array.from({ length: 20 }, (_, i) =>
      act(`Outing ${i}`, "activity", `id-${i}`),
    );
    assert.equal(filterCalendarDotActivities(items).length, CALENDAR_ACTIVITY_DOT_LIMIT);
  });
});
