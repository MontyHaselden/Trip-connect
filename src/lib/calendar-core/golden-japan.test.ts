import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractOverrides, mergeOverrides } from "./merge-overrides";
import { paintRange } from "./paint-range";
import { fullDaySlice, travelDaySlice } from "./slice-day";

const MAIN_CORRIDOR = [
  "2026-12-05",
  "2026-12-06",
  "2026-12-07",
  "2026-12-08",
  "2026-12-09",
  "2026-12-10",
  "2026-12-11",
  "2026-12-12",
  "2026-12-13",
  "2026-12-14",
  "2026-12-15",
  "2026-12-16",
  "2026-12-17",
  "2026-12-18",
  "2026-12-19",
  "2026-12-20",
  "2026-12-21",
];

function paintMainJapanCorridor(): ReturnType<typeof paintRange> {
  let slices: ReturnType<typeof paintRange> = [];
  slices = paintRange(slices, "2026-12-05", "2026-12-06", "Tokyo");
  slices = paintRange(slices, "2026-12-06", "2026-12-09", "Kagoshima");
  slices = paintRange(slices, "2026-12-09", "2026-12-12", "Hiroshima");
  slices = paintRange(slices, "2026-12-12", "2026-12-16", "Kyoto");
  slices = paintRange(slices, "2026-12-16", "2026-12-21", "Tokyo");
  return slices;
}

describe("golden Japan Dec 5–21 corridor", () => {
  it("paints main group Tokyo → Kagoshima → Hiroshima → Kyoto → Tokyo", () => {
    const main = paintMainJapanCorridor();
    assert.equal(main.find((d) => d.date === "2026-12-05")?.pmCity, "Tokyo");
    assert.equal(main.find((d) => d.date === "2026-12-06")?.amCity, "Tokyo");
    assert.equal(main.find((d) => d.date === "2026-12-06")?.pmCity, "Kagoshima");
    assert.equal(main.find((d) => d.date === "2026-12-08")?.amCity, "Kagoshima");
    assert.equal(main.find((d) => d.date === "2026-12-09")?.amCity, "Kagoshima");
    assert.equal(main.find((d) => d.date === "2026-12-09")?.pmCity, "Hiroshima");
    assert.equal(main.find((d) => d.date === "2026-12-12")?.amCity, "Hiroshima");
    assert.equal(main.find((d) => d.date === "2026-12-12")?.pmCity, "Kyoto");
    assert.equal(main.find((d) => d.date === "2026-12-16")?.amCity, "Kyoto");
    assert.equal(main.find((d) => d.date === "2026-12-16")?.pmCity, "Tokyo");
    assert.equal(main.find((d) => d.date === "2026-12-21")?.amCity, "Tokyo");
  });

  it("personal subgroup paints Tokyo → Tottori Dec 6 PM – Dec 13 without corrupting main", () => {
    const main = paintMainJapanCorridor();
    const personalStored = paintRange(
      [],
      "2026-12-06",
      "2026-12-13",
      "Tottori",
      "pm",
      "full",
      { transitionContextSlices: main },
    );
    const stored = extractOverrides(main, personalStored);
    const projected = mergeOverrides(main, stored, "override");

    const dec5 = projected.find((d) => d.date === "2026-12-05");
    const dec6 = projected.find((d) => d.date === "2026-12-06");
    const dec7 = projected.find((d) => d.date === "2026-12-07");
    const dec13 = projected.find((d) => d.date === "2026-12-13");
    const dec14 = projected.find((d) => d.date === "2026-12-14");

    assert.equal(dec5?.pmCity, "Tokyo");
    assert.equal(dec6?.amCity, "Tokyo");
    assert.equal(dec6?.pmCity, "Tottori");
    assert.equal(dec7?.amCity, "Tottori");
    assert.equal(dec7?.pmCity, "Tottori");
    assert.equal(dec13?.amCity, "Tottori");
    assert.equal(dec13?.pmCity, "Kyoto");
    assert.equal(dec14?.amCity, "Kyoto");
  });

  it("reload simulation: stored personal slices project identically", () => {
    const main = paintMainJapanCorridor();
    const storedPersonal = paintRange(
      [],
      "2026-12-06",
      "2026-12-13",
      "Tottori",
      "pm",
      "full",
      { transitionContextSlices: main },
    );
    const stored = extractOverrides(main, storedPersonal);
    const first = mergeOverrides(main, stored, "override");
    const second = mergeOverrides(main, stored, "override");
    assert.deepEqual(first, second);
  });

  it("partial selection Dec 6 PM only paints evening half on start", () => {
    const main = [travelDaySlice("2026-12-05", "", "Tokyo"), travelDaySlice("2026-12-06", "Tokyo", "")];
    const out = paintRange(main, "2026-12-06", "2026-12-13", "Kagoshima", "pm", "full");
    const dec6 = out.find((d) => d.date === "2026-12-06");
    assert.equal(dec6?.amCity, "Tokyo");
    assert.equal(dec6?.pmCity, "Kagoshima");
  });
});
