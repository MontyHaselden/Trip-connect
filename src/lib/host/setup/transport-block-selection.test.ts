import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clickHitsTransitSegment,
  transportLegDateSpan,
} from "./transport-block-selection";
import type { TransportLegDraft } from "@/lib/host/wizard/types";

function leg(partial: Partial<TransportLegDraft>): TransportLegDraft {
  return {
    id: "l1",
    transportType: "plane",
    bookingStatus: "not_booked",
    travelDate: "2026-08-31",
    arrivalDate: null,
    departureTime: null,
    arrivalTime: null,
    fromCity: "patong",
    toCity: "Suvarnabhumi Airport, Thailand",
    fromStation: null,
    toStation: null,
    operator: null,
    referenceNumber: null,
    flightNumber: null,
    notes: null,
    ...partial,
  };
}

describe("clickHitsTransitSegment", () => {
  it("detects clicks inside transit bands", () => {
    const segments = [
      { kind: "city" as const, city: "patong", start: 0, end: 0.5 },
      { kind: "transit" as const, label: "PAT -> SUV", start: 0.5, end: 1 },
    ];
    assert.equal(clickHitsTransitSegment(0.25, segments), false);
    assert.equal(clickHitsTransitSegment(0.75, segments), true);
  });
});

describe("transportLegDateSpan", () => {
  it("spans departure through inferred overnight arrival", () => {
    const overnight = leg({
      travelDate: "2026-08-31",
      departureTime: "18:00",
      arrivalTime: "08:00",
    });
    assert.deepEqual(transportLegDateSpan(overnight), {
      start: "2026-08-31",
      end: "2026-09-01",
    });
  });
});
