import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isValidIsoDate, repairIsoDate } from "@/lib/utils/iso-date";

describe("iso-date", () => {
  it("accepts real calendar days", () => {
    assert.equal(isValidIsoDate("2024-02-29"), true);
    assert.equal(isValidIsoDate("2026-02-28"), true);
  });

  it("rejects impossible calendar days", () => {
    assert.equal(isValidIsoDate("2026-02-29"), false);
    assert.equal(isValidIsoDate("2026-04-31"), false);
  });

  it("repairs Feb 29 in a common year to Feb 28", () => {
    assert.equal(repairIsoDate("2026-02-29"), "2026-02-28");
  });

  it("keeps Feb 29 in a leap year", () => {
    assert.equal(repairIsoDate("2024-02-29"), "2024-02-29");
  });
});
