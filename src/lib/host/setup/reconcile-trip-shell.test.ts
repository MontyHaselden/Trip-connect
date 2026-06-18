import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { reconcileTripShellState } from "./reconcile-trip-shell";
import { effectiveTripBoundsFromState } from "./sync-trip-bounds";
import type { TripSetupState } from "./types";
import { tripDayHasPaintableStaySlot, isCalendarDaySelectable } from "@/lib/host/wizard/transport-day-placement";

function emptyShellState(overrides?: Partial<TripSetupState>): TripSetupState {
  return {
    basics: {
      name: "New trip",
      schoolName: "School",
      startDate: "2026-07-01",
      endDate: "2026-07-05",
      timezone: "UTC",
      departureCity: "Christchurch, New Zealand",
      returnCity: "Christchurch, New Zealand",
      defaultDepartureAirport: "",
      destinationCountries: [],
    },
    mainGroupId: "main",
    groups: [{ id: "main", name: "Main Group", sortOrder: 0, isMain: true }],
    dayPlacesByGroupId: {
      main: [
        {
          date: "2026-07-01",
          primaryCity: "Patong",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
        {
          date: "2026-07-02",
          primaryCity: "Patong",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
    },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [],
    accommodationStays: [],
    activities: [],
    overlayOps: [],
    ...overrides,
  };
}

describe("reconcileTripShellState", () => {
  it("clears stale stored paint when the calendar shows nothing", () => {
    const next = reconcileTripShellState(emptyShellState());
    const bounds = effectiveTripBoundsFromState(next);
    assert.equal(next.dayPlacesByGroupId.main?.length ?? 0, 0);
    assert.equal(bounds.startDate, "2000-01-01");
    assert.equal(bounds.endDate, "2000-01-01");
  });
});

describe("tripDayHasPaintableStaySlot empty edge days", () => {
  it("allows selecting empty trip start/end days", () => {
    const trip = {
      startDate: "2026-07-01",
      endDate: "2026-07-05",
      departureCity: "Christchurch, New Zealand",
      returnCity: "Christchurch, New Zealand",
    };
    assert.equal(tripDayHasPaintableStaySlot("2026-07-01", trip, undefined, null), true);
    assert.equal(tripDayHasPaintableStaySlot("2026-07-05", trip, undefined, null), true);
  });
});

describe("isCalendarDaySelectable trip edge with location paint", () => {
  it("allows selecting the last trip day when it has orphan location paint to clear", () => {
    const trip = {
      startDate: "2026-07-01",
      endDate: "2026-07-17",
      departureCity: "Christchurch, New Zealand",
      returnCity: "Christchurch, New Zealand",
    };
    assert.equal(
      isCalendarDaySelectable({
        iso: "2026-07-17",
        trip,
        day: {
          dayType: "trip",
          primaryCity: "Paris, France",
          secondaryCity: null,
          primaryShare: 1,
        },
      }),
      true,
    );
  });
});
