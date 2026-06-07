import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deriveTripDatesFromTransport } from "@/lib/host/wizard/derive-trip-dates";

describe("deriveTripDatesFromTransport", () => {
  it("uses the earliest return departure, not leg order in the array", () => {
    const dates = deriveTripDatesFromTransport({
      outboundLegs: [{ travelDate: "2026-06-15" }],
      returnLegs: [
        { travelDate: "2026-06-29" },
        { travelDate: "2026-06-28" },
      ],
    });
    assert.deepEqual(dates, { startDate: "2026-06-15", endDate: "2026-06-28" });
  });
});
