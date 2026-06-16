import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { legTouchesDate, legTouchesRange } from "./transport-leg-dates";
import type { TransportLegDraft } from "./types";

function leg(partial: Partial<TransportLegDraft>): TransportLegDraft {
  return {
    id: "l1",
    transportType: "plane",
    bookingStatus: "not_booked",
    travelDate: "2026-09-04",
    arrivalDate: null,
    departureTime: null,
    arrivalTime: null,
    fromCity: "Bangkok",
    toCity: "Auckland",
    fromStation: null,
    toStation: null,
    operator: null,
    referenceNumber: null,
    flightNumber: null,
    notes: null,
    ...partial,
  };
}

describe("legTouchesDate", () => {
  it("matches departure and overnight arrival days", () => {
    const overnight = leg({
      travelDate: "2026-09-04",
      departureTime: "22:00",
      arrivalTime: "06:00",
    });
    assert.equal(legTouchesDate(overnight, "2026-09-04"), true);
    assert.equal(legTouchesDate(overnight, "2026-09-05"), true);
    assert.equal(legTouchesDate(overnight, "2026-09-03"), false);
  });

  it("matches any day in a selected range", () => {
    const overnight = leg({
      travelDate: "2026-09-04",
      departureTime: "22:00",
      arrivalTime: "06:00",
    });
    assert.equal(legTouchesRange(overnight, "2026-09-01", "2026-09-04"), true);
    assert.equal(legTouchesRange(overnight, "2026-09-01", "2026-09-03"), false);
  });
});
