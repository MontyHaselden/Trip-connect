import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveCalendarState } from "@/lib/host/setup/derive-calendar";
import { dedupeCityChangeLegs } from "@/lib/host/setup/dedupe-intercity-legs";
import { patongBangkokLeg, patongBangkokTrip, patongStay, bangkokStay } from "@/lib/host/setup/calendar-fixtures";
import {
  expandSelectionToNightPair,
  formatCalendarSelectionLabel,
  formatNightPairLabel,
  nightDatesForRemoval,
} from "@/lib/host/setup/night-pair-selection";

describe("night-pair-selection", () => {
  it("expands a second-half click to include the next morning", () => {
    const expanded = expandSelectionToNightPair({
      rangeStart: "2026-09-01",
      rangeEnd: "2026-09-01",
      startHalf: "right",
      endHalf: "right",
    });
    assert.deepEqual(expanded, {
      rangeStart: "2026-09-01",
      rangeEnd: "2026-09-02",
      startHalf: "right",
      endHalf: "left",
    });
    assert.equal(
      formatNightPairLabel(expanded),
      "2026-09-01 second half → 2026-09-02 first half",
    );
  });

  it("expands a first-half click to include the previous evening", () => {
    const expanded = expandSelectionToNightPair({
      rangeStart: "2026-09-01",
      rangeEnd: "2026-09-01",
      startHalf: "left",
      endHalf: "left",
    });
    assert.deepEqual(expanded, {
      rangeStart: "2026-08-31",
      rangeEnd: "2026-09-01",
      startHalf: "right",
      endHalf: "left",
    });
  });

  it("formats a literal half-day selection without expanding", () => {
    assert.equal(
      formatCalendarSelectionLabel({
        rangeStart: "2026-06-20",
        rangeEnd: "2026-06-20",
        startHalf: "right",
        endHalf: "right",
      }),
      "2026-06-20 · second half",
    );
  });

  it("maps a night pair to the booked night date for removal", () => {
    const removal = nightDatesForRemoval({
      rangeStart: "2026-09-01",
      rangeEnd: "2026-09-02",
      startHalf: "right",
      endHalf: "left",
    });
    assert.deepEqual(removal, {
      rangeStart: "2026-09-01",
      rangeEnd: "2026-09-01",
    });
  });
});

describe("dedupeCityChangeLegs", () => {
  it("drops a stale Sep 1 crossover when the boundary is on Aug 31", () => {
    const stays = [
      patongStay({ checkInDate: "2026-08-23", checkOutDate: "2026-09-01" }),
      bangkokStay({ checkInDate: "2026-08-31", checkOutDate: "2026-09-01" }),
    ];
    const legs = [patongBangkokLeg(), { ...patongBangkokLeg(), id: "leg-2", travelDate: "2026-09-01" }];
    const derived = deriveCalendarState({
      stays,
      intercityLegs: legs,
      trip: patongBangkokTrip,
      transportDraft: { outboundLegs: [], returnLegs: [], intercityLegs: legs, dayPlaces: [] },
      gridStart: "2026-08-20",
      gridEnd: "2026-09-10",
    });

    assert.equal(derived.dayPlaces.find((d) => d.date === "2026-09-01")?.secondaryCity, null);

    const deduped = dedupeCityChangeLegs(legs, stays, derived.dayPlaces);
    assert.equal(deduped.filter((l) => l.legKind === "city_change" || !l.legKind).length, 1);
    assert.equal(deduped[0]?.travelDate, "2026-08-31");
  });
});
