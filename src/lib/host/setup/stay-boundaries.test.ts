import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertCalendarInvariant,
  deriveCalendarState,
} from "./derive-calendar";
import {
  listNightBoundaries,
  moveNightBoundary,
  syncIntercityLegsForBoundaryMove,
} from "./stay-boundaries";
import {
  bangkokStay,
  patongBangkokLeg,
  patongBangkokTrip,
  patongStay,
} from "./calendar-fixtures";

function baseState() {
  return deriveCalendarState({
    stays: [patongStay(), bangkokStay()],
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
  });
}

describe("listNightBoundaries", () => {
  it("shows stay-start divider on check-in evening and stay-end on checkout morning", () => {
    const state = baseState();
    const boundaries = listNightBoundaries(state.dayPlaces, [patongStay(), bangkokStay()]);
    const patongStart = boundaries.find(
      (b) => b.kind === "stay-start" && b.stayId === "patong-stay",
    );
    assert.ok(patongStart);
    assert.equal(patongStart?.date, "2026-08-22");
    assert.equal(patongStart?.anchorShare, 0.5);
  });

  it("hides interior dividers when adjacent same-property stays continue", () => {
    const stay1 = patongStay({
      id: "patong-a",
      checkInDate: "2026-08-20",
      checkOutDate: "2026-08-28",
    });
    const stay2 = patongStay({
      id: "patong-b",
      checkInDate: "2026-08-29",
      checkOutDate: "2026-08-31",
    });
    const state = deriveCalendarState({
      stays: [stay1, stay2],
      intercityLegs: [patongBangkokLeg()],
      trip: patongBangkokTrip,
      transportDraft: {
        outboundLegs: [],
        returnLegs: [],
        intercityLegs: [patongBangkokLeg()],
        dayPlaces: [],
      },
      gridStart: "2026-08-17",
      gridEnd: "2026-09-10",
    });

    const junctionBoundaries = state.boundaries.filter(
      (b) => b.date >= "2026-08-21" && b.date <= "2026-08-29",
    );
    assert.equal(junctionBoundaries.length, 0);

    for (const date of ["2026-08-25", "2026-08-27", "2026-08-28"]) {
      const day = state.dayPlaces.find((d) => d.date === date);
      assert.equal(day?.primaryCity, "Patong");
      assert.equal(day?.primaryShare, 1);
      assert.equal(day?.secondaryCity, null);
    }
  });

  it("hides dividers when the same hotel resumes after a one-night gap", () => {
    const stay1 = patongStay({
      id: "patong-a",
      checkInDate: "2026-08-23",
      checkOutDate: "2026-08-29",
    });
    const stay2 = patongStay({
      id: "patong-b",
      checkInDate: "2026-08-30",
      checkOutDate: "2026-09-03",
    });
    const state = deriveCalendarState({
      stays: [stay1, stay2, bangkokStay({ checkInDate: "2026-09-03" })],
      intercityLegs: [patongBangkokLeg({ travelDate: "2026-09-03" })],
      trip: patongBangkokTrip,
      transportDraft: {
        outboundLegs: [],
        returnLegs: [],
        intercityLegs: [patongBangkokLeg({ travelDate: "2026-09-03" })],
        dayPlaces: [],
      },
      gridStart: "2026-08-20",
      gridEnd: "2026-09-10",
    });

    const interior = state.boundaries.filter(
      (b) => b.date === "2026-08-28" || b.date === "2026-09-02",
    );
    assert.equal(interior.length, 0);
    assert.ok(
      state.boundaries.some((b) => b.kind === "city-change" && b.date === "2026-09-03"),
    );
  });

  it("anchors stay-end dividers in the middle of the last night, never on the cell edge", () => {
    const state = baseState();
    const boundaries = listNightBoundaries(state.dayPlaces, [patongStay(), bangkokStay()]);
    const bangkokEnd = boundaries.find(
      (b) => b.kind === "stay-end" && b.stayId === "bangkok-stay",
    );
    assert.ok(bangkokEnd);
    assert.equal(bangkokEnd?.date, "2026-09-05");
    assert.equal(bangkokEnd?.anchorShare, 0.5);

    const sep4 = state.dayPlaces.find((d) => d.date === "2026-09-04");
    const sep5 = state.dayPlaces.find((d) => d.date === "2026-09-05");
    assert.equal(sep4?.primaryCity, "Bangkok");
    assert.equal(sep4?.primaryShare, 1);
    assert.equal(sep5?.primaryCity, "Bangkok");
    assert.equal(sep5?.primaryShare, 0.5);
  });
});

describe("moveNightBoundary", () => {
  it("extends patong stay end forward with city and accom locked", () => {
    const stays = [patongStay(), bangkokStay()];
    const state = baseState();
    const endBoundary = listNightBoundaries(state.dayPlaces, stays).find(
      (b) => b.kind === "city-change" && b.stayId === "patong-stay",
    );
    assert.ok(endBoundary);

    const moved = moveNightBoundary(endBoundary!, 1, stays);
    const patong = moved.find((s) => s.id === "patong-stay")!;
    assert.equal(patong.checkOutDate, "2026-09-01");

    const next = deriveCalendarState({
      stays: moved,
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
    });
    assert.equal(assertCalendarInvariant(next).length, 0);
    assert.equal(next.accommodationByDate.get("2026-08-30"), "Royal Paradise Hotel");
  });

  it("syncs intercity leg travel date when city-change boundary moves", () => {
    const stays = [patongStay(), bangkokStay()];
    const leg = patongBangkokLeg();
    const state = baseState();
    const change = listNightBoundaries(state.dayPlaces, stays).find(
      (b) => b.kind === "city-change",
    );
    assert.ok(change);

    const movedStays = moveNightBoundary(change!, -1, stays);
    const movedLegs = syncIntercityLegsForBoundaryMove(change!, -1, [leg], movedStays);
    assert.equal(movedLegs[0]?.travelDate, "2026-08-30");

    const next = deriveCalendarState({
      stays: movedStays,
      intercityLegs: movedLegs,
      trip: patongBangkokTrip,
      transportDraft: {
        outboundLegs: [],
        returnLegs: [],
        intercityLegs: movedLegs,
        dayPlaces: [],
      },
      gridStart: "2026-08-20",
      gridEnd: "2026-09-10",
    });
    const aug31 = next.dayPlaces.find((d) => d.date === "2026-08-31");
    assert.notEqual(aug31?.primaryCity, "Patong");
    const aug30 = next.dayPlaces.find((d) => d.date === "2026-08-30");
    assert.equal(aug30?.primaryCity, "Patong");
    assert.equal(aug30?.secondaryCity, "Bangkok");
    assert.equal(aug30?.primaryShare, 0.4);
    const changeAfter = listNightBoundaries(next.dayPlaces, movedStays).find(
      (b) => b.kind === "city-change",
    );
    assert.equal(changeAfter?.date, "2026-08-30");
    assert.equal(changeAfter?.anchorShare, 0.4);
  });

  it("moves city-change boundary forward", () => {
    const stays = [patongStay(), bangkokStay()];
    const state = baseState();
    const change = listNightBoundaries(state.dayPlaces, stays).find(
      (b) => b.kind === "city-change",
    );
    assert.ok(change);

    const moved = moveNightBoundary(change!, 1, stays);
    const patong = moved.find((s) => s.id === "patong-stay")!;
    const bangkok = moved.find((s) => s.id === "bangkok-stay")!;
    assert.equal(patong.checkOutDate, "2026-09-01");
    assert.equal(bangkok.checkInDate, "2026-09-02");
  });
});
