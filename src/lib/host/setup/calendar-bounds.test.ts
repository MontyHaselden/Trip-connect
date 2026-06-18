import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DateTime } from "luxon";

import {
  calendarGridBounds,
  calendarGridFromToday,
  calendarScrollBounds,
  ensureDaysForRange,
  resolveCalendarScrollAnchor,
  visibleCalendarScrollAnchor,
  tripCalendarScrollAnchor,
  weekStartMonday,
} from "./calendar-bounds";

describe("tripCalendarScrollAnchor", () => {
  it("returns the middle day of a trip range", () => {
    assert.equal(tripCalendarScrollAnchor("2026-08-23", "2026-09-01"), "2026-08-27");
    assert.equal(tripCalendarScrollAnchor("2026-06-01", "2026-06-01"), "2026-06-01");
  });
});

describe("calendarScrollBounds", () => {
  it("aligns scroll start to Monday", () => {
    const { scrollStart } = calendarScrollBounds(
      "2000-01-01",
      "2000-01-01",
      "Pacific/Auckland",
      "2026-06-06",
    );
    const monday = weekStartMonday(DateTime.fromISO(scrollStart));
    assert.equal(scrollStart, monday.toISODate());
  });
});

describe("ensureDaysForRange", () => {
  it("fills the grid with open trip days — never buffer or closed cells", () => {
    const days = ensureDaysForRange([], "2026-06-01", "2026-06-07");
    assert.ok(days.every((d) => d.dayType === "trip" && !d.includeBuffer));
    assert.equal(days.length, 7);
    assert.equal(days[0]?.date, "2026-06-01");
    assert.equal(days[6]?.date, "2026-06-07");
  });

  it("preserves painted days from the input", () => {
    const days = ensureDaysForRange(
      [
        {
          date: "2026-06-04",
          primaryCity: "Tokyo",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
      "2026-06-01",
      "2026-06-03",
    );
    assert.equal(days.find((d) => d.date === "2026-06-04"), undefined);
    assert.equal(days.find((d) => d.date === "2026-06-02")?.primaryCity, "");
  });
});

describe("resolveCalendarScrollAnchor", () => {
  it("uses earliest painted day when trip dates are unset", () => {
    const anchor = resolveCalendarScrollAnchor({
      startDate: "2000-01-01",
      endDate: "2000-01-01",
      timezone: "Pacific/Auckland",
      dayPlaces: [
        {
          date: "2026-08-24",
          primaryCity: "Patong",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
        },
        {
          date: "2026-09-04",
          primaryCity: "Bangkok",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
        },
      ],
      fallbackAnchor: "2026-12-01",
    });
    assert.equal(anchor, "2026-08-24");
  });

  it("ignores day selection — anchor stays on existing content", () => {
    const anchor = resolveCalendarScrollAnchor({
      startDate: "2000-01-01",
      endDate: "2000-01-01",
      timezone: "Pacific/Auckland",
      dayPlaces: [
        {
          date: "2026-08-24",
          primaryCity: "Patong",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
        },
      ],
      fallbackAnchor: "2026-06-06",
    });
    assert.equal(anchor, "2026-08-24");
  });

  it("uses trip start when dates are set and no content yet", () => {
    const anchor = resolveCalendarScrollAnchor({
      startDate: "2026-08-23",
      endDate: "2026-09-01",
      timezone: "Pacific/Auckland",
      fallbackAnchor: "2026-12-01",
    });
    assert.equal(anchor, "2026-08-23");
  });

  it("uses earliest on-trip content, skipping pre-trip buffer dates", () => {
    const anchor = resolveCalendarScrollAnchor({
      startDate: "2026-08-23",
      endDate: "2026-09-05",
      timezone: "Pacific/Auckland",
      dayPlaces: [
        {
          date: "2026-08-20",
          primaryCity: "Christchurch",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "buffer",
        },
        {
          date: "2026-08-24",
          primaryCity: "Phuket",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
        },
      ],
      transportDates: ["2026-08-20"],
    });
    assert.equal(anchor, "2026-08-24");
  });
});

describe("visibleCalendarScrollAnchor", () => {
  it("uses first on-trip content on or after today when earlier content is not rendered", () => {
    const anchor = visibleCalendarScrollAnchor({
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      timezone: "UTC",
      dayPlaces: [
        {
          date: "2026-01-10",
          primaryCity: "Tokyo",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
        },
        {
          date: "2026-08-01",
          primaryCity: "Osaka",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
        },
      ],
      fallbackAnchor: "2026-06-17",
    });
    assert.equal(anchor, "2026-08-01");
  });
});

describe("calendarGridBounds", () => {
  it("returns scroll range unchanged", () => {
    const bounds = calendarGridBounds("2026-03-02", "2026-09-06");
    assert.deepEqual(bounds, { gridStart: "2026-03-02", gridEnd: "2026-09-06" });
  });
});

describe("calendarGridFromToday", () => {
  it("never starts grid before today when trip dates are unset", () => {
    const result = calendarGridFromToday({
      startDate: "2000-01-01",
      endDate: "2000-01-01",
      timezone: "Pacific/Auckland",
    });
    const todayMonday = weekStartMonday(DateTime.fromISO(result.todayIso)).toISODate()!;
    assert.ok(result.gridStart >= todayMonday);
    assert.equal(result.interactionStart, result.todayIso);
    assert.ok(result.gridEnd > result.gridStart);
    assert.ok(!result.gridStart.startsWith("1999"));
  });

  it("anchors scroll on today when the trip is entirely in the past", () => {
    const result = calendarGridFromToday({
      startDate: "2024-01-01",
      endDate: "2024-01-14",
      timezone: "UTC",
    });
    assert.equal(result.scrollAnchorDate, result.todayIso);
  });

  it("anchors scroll on the first content day of a future trip", () => {
    const result = calendarGridFromToday({
      startDate: "2026-08-23",
      endDate: "2026-09-04",
      timezone: "UTC",
    });
    assert.equal(result.scrollAnchorDate, "2026-08-23");
  });

  it("clamps grid start when trip started in the past", () => {
    const result = calendarGridFromToday({
      startDate: "2024-01-01",
      endDate: "2024-01-14",
      timezone: "UTC",
    });
    const todayMonday = weekStartMonday(DateTime.fromISO(result.todayIso)).toISODate()!;
    assert.ok(result.gridStart >= todayMonday);
  });

  it("starts grid at today's week for a future trip", () => {
    const result = calendarGridFromToday({
      startDate: "2026-11-29",
      endDate: "2026-12-17",
      timezone: "UTC",
    });
    const todayMonday = weekStartMonday(DateTime.fromISO(result.todayIso)).toISODate()!;
    assert.equal(result.gridStart, todayMonday);
    assert.ok(result.gridEnd >= "2026-12-17");
  });
});
