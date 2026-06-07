import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatChangeScopePrompt,
  resolveDefaultTodayDate,
  scopeSummaryLabel,
} from "./change-scope";

describe("resolveDefaultTodayDate", () => {
  it("returns today when within trip range", () => {
    const today = resolveDefaultTodayDate("Pacific/Auckland", "2026-01-01", "2026-12-31");
    assert.match(today, /^\d{4}-\d{2}-\d{2}$/);
  });

  it("clamps to start when today is before trip", () => {
    assert.equal(resolveDefaultTodayDate("UTC", "2099-01-01", "2099-01-31"), "2099-01-01");
  });

  it("clamps to end when today is after trip", () => {
    assert.equal(resolveDefaultTodayDate("UTC", "2000-01-01", "2000-01-31"), "2000-01-31");
  });
});

describe("formatChangeScopePrompt", () => {
  it("formats today scope", () => {
    assert.equal(
      formatChangeScopePrompt({ mode: "today", date: "2026-06-03" }),
      "Apply changes to this day only: 2026-06-03.",
    );
  });

  it("formats whole trip scope", () => {
    assert.equal(
      formatChangeScopePrompt({ mode: "whole_trip" }),
      "Apply changes across the whole trip.",
    );
  });

  it("formats selected dates scope", () => {
    assert.equal(
      formatChangeScopePrompt({ mode: "dates", dates: ["2026-06-03", "2026-06-04"] }),
      "Apply changes only on these dates: 2026-06-03, 2026-06-04.",
    );
  });
});

describe("scopeSummaryLabel", () => {
  it("summarizes multi-day selection", () => {
    assert.equal(
      scopeSummaryLabel({ mode: "dates", dates: ["2026-06-03", "2026-06-04"] }),
      "2 days",
    );
  });
});
