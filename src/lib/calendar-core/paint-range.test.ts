import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sliceToDayPlace } from "./adapters";
import { paintRange } from "./paint-range";
import { emptySlice, travelDaySlice } from "./slice-day";

function legacyDay(
  date: string,
  slice: { am?: string; pm?: string },
) {
  return sliceToDayPlace({
    date,
    amCity: slice.am ?? "",
    pmCity: slice.pm ?? "",
    dayType: "trip",
  });
}

describe("calendar-core paintRange", () => {
  it("paints stay-aligned halves for full/full multi-day on empty calendar", () => {
    const out = paintRange([], "2026-12-05", "2026-12-08", "Kagoshima");
    const dec5 = out.find((d) => d.date === "2026-12-05");
    const dec6 = out.find((d) => d.date === "2026-12-06");
    const dec7 = out.find((d) => d.date === "2026-12-07");
    const dec8 = out.find((d) => d.date === "2026-12-08");
    assert.equal(dec5?.pmCity, "Kagoshima");
    assert.equal(dec5?.amCity, "");
    assert.equal(dec6?.amCity, "Kagoshima");
    assert.equal(dec6?.pmCity, "Kagoshima");
    assert.equal(dec7?.amCity, "Kagoshima");
    assert.equal(dec8?.amCity, "Kagoshima");
    assert.equal(dec8?.pmCity, "");
  });

  it("paints arrival and checkout halves for a two-day Tokyo selection", () => {
    const out = paintRange([], "2026-12-05", "2026-12-06", "Tokyo");
    const dec5 = out.find((d) => d.date === "2026-12-05");
    const dec6 = out.find((d) => d.date === "2026-12-06");
    assert.equal(dec5?.pmCity, "Tokyo");
    assert.equal(dec5?.amCity, "");
    assert.equal(dec6?.amCity, "Tokyo");
    assert.equal(dec6?.pmCity, "");
  });

  it("paints arrival half-day when full/full range starts after a different city", () => {
    const days = [travelDaySlice("2026-12-05", "", "Tokyo")];
    const out = paintRange(days, "2026-12-06", "2026-12-13", "Kagoshima");
    const dec6 = out.find((d) => d.date === "2026-12-06");
    const dec7 = out.find((d) => d.date === "2026-12-07");
    assert.equal(dec6?.amCity, "Tokyo");
    assert.equal(dec6?.pmCity, "Kagoshima");
    assert.equal(dec7?.amCity, "Kagoshima");
    assert.equal(dec7?.pmCity, "Kagoshima");
  });

  it("paints checkout morning on range end when selection starts on second half", () => {
    const days = [
      travelDaySlice("2026-12-05", "", "Tokyo"),
      { date: "2026-12-06", amCity: "Tokyo", pmCity: "", dayType: "trip" as const },
    ];
    const out = paintRange(days, "2026-12-06", "2026-12-13", "Kagoshima", "pm", "full");
    const dec6 = out.find((d) => d.date === "2026-12-06");
    const dec7 = out.find((d) => d.date === "2026-12-07");
    const dec13 = out.find((d) => d.date === "2026-12-13");
    assert.equal(dec6?.amCity, "Tokyo");
    assert.equal(dec6?.pmCity, "Kagoshima");
    assert.equal(dec7?.amCity, "Kagoshima");
    assert.equal(dec13?.amCity, "Kagoshima");
    assert.equal(dec13?.pmCity, "");
  });

  it("preserves departure city when painting from the second half of a travel day", () => {
    const days = [travelDaySlice("2026-12-15", "Hiroshima", "Kyoto", "travel")];
    const out = paintRange(days, "2026-12-15", "2026-12-17", "Kyoto", "pm", "am");
    const dec15 = out.find((d) => d.date === "2026-12-15");
    assert.equal(dec15?.amCity, "Hiroshima");
    assert.equal(dec15?.pmCity, "Kyoto");
  });

  it("round-trips through legacy adapter", () => {
    const out = paintRange([], "2026-12-05", "2026-12-06", "Tokyo");
    const legacy = out.map(sliceToDayPlace);
    assert.equal(legacy[0]?.secondaryCity, "Tokyo");
    assert.equal(legacy[1]?.primaryCity, "Tokyo");
  });
});
