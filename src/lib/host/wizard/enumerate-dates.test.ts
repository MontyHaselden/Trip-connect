import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { enumerateDates, MAX_DATE_ENUMERATION_DAYS } from "./location-stays";

describe("enumerateDates", () => {
  it("returns inclusive span for normal trips", () => {
    const dates = enumerateDates("2026-06-01", "2026-06-05");
    assert.equal(dates.length, 5);
    assert.deepEqual(dates, [
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
    ]);
  });

  it("caps corrupt far-future end dates instead of freezing the browser", () => {
    const dates = enumerateDates("2026-01-01", "9999-12-31");
    assert.equal(dates.length, MAX_DATE_ENUMERATION_DAYS);
    assert.equal(dates[0], "2026-01-01");
    assert.equal(dates[dates.length - 1], "2028-03-10");
  });
});
