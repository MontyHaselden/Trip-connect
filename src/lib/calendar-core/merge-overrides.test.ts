import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractOverrides, mergeOverrides } from "./merge-overrides";
import { fullDaySlice, travelDaySlice } from "./slice-day";

describe("calendar-core mergeOverrides", () => {
  const main = [
    fullDaySlice("2026-12-05", "Tokyo"),
    fullDaySlice("2026-12-06", "Tokyo"),
    fullDaySlice("2026-12-07", "Kagoshima"),
    fullDaySlice("2026-12-08", "Kagoshima"),
  ];

  it("returns main slices in inherit mode", () => {
    const personal = [fullDaySlice("2026-12-06", "Tottori")];
    assert.deepEqual(mergeOverrides(main, personal, "inherit"), main);
  });

  it("merges personal override for forked corridor", () => {
    const personal = [
      travelDaySlice("2026-12-06", "Tokyo", "Tottori"),
      fullDaySlice("2026-12-07", "Tottori"),
      fullDaySlice("2026-12-08", "Tottori"),
      fullDaySlice("2026-12-09", "Tottori"),
      fullDaySlice("2026-12-10", "Tottori"),
      fullDaySlice("2026-12-11", "Tottori"),
      fullDaySlice("2026-12-12", "Tottori"),
      fullDaySlice("2026-12-13", "Tottori"),
    ];
    const merged = mergeOverrides(main, personal, "override");
    const dec6 = merged.find((d) => d.date === "2026-12-06");
    const dec7 = merged.find((d) => d.date === "2026-12-07");
    const dec5 = merged.find((d) => d.date === "2026-12-05");
    assert.equal(dec5?.amCity, "Tokyo");
    assert.equal(dec6?.amCity, "Tokyo");
    assert.equal(dec6?.pmCity, "Tottori");
    assert.equal(dec7?.amCity, "Tottori");
  });

  it("extracts only differing override dates", () => {
    const personal = mergeOverrides(main, [
      travelDaySlice("2026-12-06", "Tokyo", "Tottori"),
      fullDaySlice("2026-12-07", "Tottori"),
    ], "override");
    const overrides = extractOverrides(main, personal);
    assert.ok(overrides.some((d) => d.date === "2026-12-06"));
    assert.ok(!overrides.some((d) => d.date === "2026-12-05"));
  });
});
