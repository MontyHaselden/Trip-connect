import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  ambiguityReply,
  detectImportDateAmbiguity,
} from "@/lib/ai/detect-import-date-ambiguity";

describe("detectImportDateAmbiguity", () => {
  it("flags missing year on weekday + ordinal schedules", () => {
    const text = `Build this trip starting Tuesday 16th of july

DAY DATE LOCATION
Tuesday 16th Christchurch Plane
Wednesday 17th Gatwick Plane`;

    const issues = detectImportDateAmbiguity(text);
    assert.ok(issues.some((issue) => issue.code === "missing_year"));
    assert.ok(ambiguityReply(issues).includes("year"));
  });

  it("accepts explicit ISO dates", () => {
    const issues = detectImportDateAmbiguity(
      "Trip runs 2026-07-16 to 2026-07-24. Tuesday 16 Jul Christchurch.",
    );
    assert.equal(issues.length, 0);
  });
});
