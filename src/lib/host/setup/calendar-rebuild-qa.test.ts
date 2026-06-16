import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCalendarInvariant,
  deriveCalendarState,
} from "./derive-calendar";
import { listNightBoundaries, moveNightBoundary } from "./stay-boundaries";
import {
  bangkokStay,
  patongBangkokLeg,
  patongBangkokTrip,
  patongStay,
} from "./calendar-fixtures";

function baseInput(stays = [patongStay(), bangkokStay()]) {
  return {
    stays,
    intercityLegs: [patongBangkokLeg()],
    trip: patongBangkokTrip,
    transportDraft: {
      outboundLegs: [],
      returnLegs: [],
      intercityLegs: [patongBangkokLeg()],
      dayPlaces: [],
    },
    gridStart: "2026-08-20",
    gridEnd: "2026-09-10",
  };
}

describe("Aug 23–31 Patong/Bangkok scenarios", () => {
  it("extends Aug 25 stay end forward with hotel and city locked", () => {
    const stays = [patongStay(), bangkokStay()];
    const state = deriveCalendarState(baseInput(stays));
    const endBoundary = listNightBoundaries(state.dayPlaces, stays).find(
      (b) => b.kind === "city-change" && b.date === "2026-08-31",
    );
    assert.ok(endBoundary);

    const moved = moveNightBoundary(endBoundary!, 1, stays);
    const next = deriveCalendarState(baseInput(moved));
    assert.equal(assertCalendarInvariant(next).length, 0);
    assert.equal(next.accommodationByDate.get("2026-08-30"), "Royal Paradise Hotel");
    assert.equal(
      next.dayPlaces.find((d) => d.date === "2026-08-30")?.primaryCity,
      "Patong",
    );
  });

  it("shrinks Aug 25 area backward without orphan accommodation nights", () => {
    const stays = [
      patongStay({ checkInDate: "2026-08-22", checkOutDate: "2026-08-26" }),
      bangkokStay({ checkInDate: "2026-09-01", checkOutDate: "2026-09-05" }),
    ];
    const state = deriveCalendarState(baseInput(stays));
    const endBoundary = listNightBoundaries(state.dayPlaces, stays).find(
      (b) => b.kind === "city-change" && b.stayId === "patong-stay",
    );
    assert.ok(endBoundary);

    const moved = moveNightBoundary(endBoundary!, -1, stays);
    const next = deriveCalendarState(baseInput(moved));
    assert.equal(assertCalendarInvariant(next).length, 0);
    assert.equal(next.accommodationByDate.get("2026-08-24"), "Royal Paradise Hotel");
    const aug25 = next.dayPlaces.find((d) => d.date === "2026-08-25");
    assert.equal(aug25?.primaryCity, "Patong");
    assert.equal(aug25?.primaryShare, 0.4);
  });

  it("extends trip edge from Aug 23 with hotel and city together", () => {
    const stays = [patongStay({ checkInDate: "2026-08-23" }), bangkokStay()];
    const moved = stays.map((s) =>
      s.id === "patong-stay" ? { ...s, checkInDate: "2026-08-22" } : s,
    );
    const next = deriveCalendarState(baseInput(moved));
    assert.equal(assertCalendarInvariant(next).length, 0);
    assert.equal(next.accommodationByDate.get("2026-08-22"), "Royal Paradise Hotel");
    const aug22 = next.dayPlaces.find((d) => d.date === "2026-08-22");
    const cityOnAug22 =
      aug22?.primaryCity.trim() || aug22?.secondaryCity?.trim() || "";
    assert.ok(cityOnAug22.includes("Patong"));
  });

  it("moves Aug 31 city-change boundary toward Aug 30", () => {
    const stays = [patongStay(), bangkokStay()];
    const state = deriveCalendarState(baseInput(stays));
    const change = listNightBoundaries(state.dayPlaces, stays).find(
      (b) => b.kind === "city-change",
    );
    assert.ok(change);
    assert.equal(change!.date, "2026-08-31");

    const moved = moveNightBoundary(change!, -1, stays);
    const patong = moved.find((s) => s.id === "patong-stay")!;
    const bangkok = moved.find((s) => s.id === "bangkok-stay")!;
    assert.equal(patong.checkOutDate, "2026-08-30");
    assert.equal(bangkok.checkInDate, "2026-08-31");

    const next = deriveCalendarState(baseInput(moved));
    assert.equal(assertCalendarInvariant(next).length, 0);
    const boundaries = listNightBoundaries(next.dayPlaces, moved);
    assert.equal(
      boundaries.filter((b) => b.kind === "city-change").length,
      1,
    );
  });

  it("moves Aug 31 city-change boundary toward Sep 1", () => {
    const stays = [patongStay(), bangkokStay()];
    const state = deriveCalendarState(baseInput(stays));
    const change = listNightBoundaries(state.dayPlaces, stays).find(
      (b) => b.kind === "city-change",
    );
    assert.ok(change);

    const moved = moveNightBoundary(change!, 1, stays);
    const patong = moved.find((s) => s.id === "patong-stay")!;
    const bangkok = moved.find((s) => s.id === "bangkok-stay")!;
    assert.equal(patong.checkOutDate, "2026-09-01");
    assert.equal(bangkok.checkInDate, "2026-09-02");

    const next = deriveCalendarState(baseInput(moved));
    assert.equal(assertCalendarInvariant(next).length, 0);
  });
});
