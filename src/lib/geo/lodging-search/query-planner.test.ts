import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planLodgingQueryAttempts, plannerHints } from "./query-planner";

describe("planLodgingQueryAttempts", () => {
  it("splits THE KNOT HIROSHIMA with Hiroshima hint as first attempt", () => {
    const attempts = planLodgingQueryAttempts("THE KNOT HIROSHIMA", "Hiroshima");
    assert.equal(attempts[0]?.query, "THE KNOT");
    assert.equal(attempts[0]?.cityHint, "Hiroshima");
    assert.equal(attempts[0]?.debugAttempt, "resolved");
  });

  it("keeps full name when stay city differs from embedded city", () => {
    const attempts = planLodgingQueryAttempts("THE KNOT HIROSHIMA", "Tottori");
    assert.equal(attempts[0]?.query, "THE KNOT HIROSHIMA");
    assert.equal(attempts[0]?.cityHint, "Tottori");
  });

  it("includes strip-the attempt for The-prefixed names", () => {
    const attempts = planLodgingQueryAttempts("The Knot Hiroshima", "Hiroshima");
    const stripThe = attempts.find((a) => a.debugAttempt === "strip-the");
    assert.ok(stripThe);
    assert.equal(stripThe.query, "Knot");
    assert.equal(stripThe.cityHint, "Hiroshima");
  });

  it("dedupes identical attempts", () => {
    const attempts = planLodgingQueryAttempts("Hilton", "Hiroshima");
    const keys = attempts.map((a) => `${a.query}|${a.cityHint ?? ""}`);
    assert.equal(keys.length, new Set(keys).size);
  });
});

describe("plannerHints", () => {
  it("suggests stripped query and stay city for empty results", () => {
    const hints = plannerHints("THE KNOT HIROSHIMA", "Hiroshima", "Hiroshima");
    assert.ok(hints.some((h) => h.includes("KNOT")));
    assert.ok(hints.some((h) => h.includes("Hiroshima")));
  });
});
