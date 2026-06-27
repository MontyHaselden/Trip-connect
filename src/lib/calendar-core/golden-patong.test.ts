import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { paintRange } from "./paint-range";
import { alignStayToSlices } from "./set-days";
import { fullDaySlice, travelDaySlice } from "./slice-day";

describe("golden Patong/Bangkok scenarios", () => {
  it("paints Patong full range with stay-aligned edges", () => {
    const out = paintRange([], "2026-08-22", "2026-08-31", "Patong");
    const aug22 = out.find((d) => d.date === "2026-08-22");
    const aug30 = out.find((d) => d.date === "2026-08-30");
    const aug31 = out.find((d) => d.date === "2026-08-31");
    assert.equal(aug22?.pmCity, "Patong");
    assert.equal(aug30?.amCity, "Patong");
    assert.equal(aug30?.pmCity, "Patong");
    assert.equal(aug31?.amCity, "Patong");
  });

  it("paints Bangkok after Patong with travel split on transition day", () => {
    let slices = paintRange([], "2026-08-22", "2026-08-31", "Patong");
    slices = paintRange(slices, "2026-08-31", "2026-09-05", "Bangkok");
    const aug31 = slices.find((d) => d.date === "2026-08-31");
    const sep1 = slices.find((d) => d.date === "2026-09-01");
    assert.equal(aug31?.amCity, "Patong");
    assert.equal(aug31?.pmCity, "Bangkok");
    assert.equal(sep1?.amCity, "Bangkok");
    assert.equal(sep1?.pmCity, "Bangkok");
  });

  it("alignStayToSlices writes check-in PM and check-out AM", () => {
    const slices = alignStayToSlices([], "Patong", "2026-08-25", "2026-08-31");
    const checkIn = slices.find((d) => d.date === "2026-08-25");
    const checkOut = slices.find((d) => d.date === "2026-08-31");
    const interior = slices.find((d) => d.date === "2026-08-28");
    assert.equal(checkIn?.pmCity, "Patong");
    assert.equal(checkOut?.amCity, "Patong");
    assert.equal(interior?.amCity, "Patong");
    assert.equal(interior?.pmCity, "Patong");
  });

  it("does not touch days before a full/full Hiroshima paint", () => {
    const existing = [{ date: "2026-12-12", amCity: "Kagoshima", pmCity: "", dayType: "trip" as const }];
    const out = paintRange(existing, "2026-12-13", "2026-12-15", "Hiroshima");
    const dec12 = out.find((d) => d.date === "2026-12-12");
    const dec13 = out.find((d) => d.date === "2026-12-13");
    const dec15 = out.find((d) => d.date === "2026-12-15");
    assert.equal(dec12?.amCity, "Kagoshima");
    assert.equal(dec13?.amCity, "Kagoshima");
    assert.equal(dec13?.pmCity, "Hiroshima");
    assert.equal(dec15?.amCity, "Hiroshima");
  });
});
