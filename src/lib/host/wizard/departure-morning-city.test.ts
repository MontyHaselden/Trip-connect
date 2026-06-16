import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeTravelDayLayouts,
  departureMorningCity,
} from "./transport-day-placement";
import type { TransportLegDraft } from "./types";
import { newId } from "./types";

const trip = {
  startDate: "2026-08-31",
  endDate: "2026-09-10",
  departureCity: "Christchurch, New Zealand",
  returnCity: "Christchurch, New Zealand",
};

function planeLeg(
  partial: Partial<TransportLegDraft> & Pick<TransportLegDraft, "fromCity" | "toCity" | "travelDate">,
): TransportLegDraft {
  return {
    id: newId(),
    transportType: "plane",
    bookingStatus: "not_booked",
    arrivalDate: partial.arrivalDate ?? null,
    departureTime: partial.departureTime ?? "14:00",
    arrivalTime: partial.arrivalTime ?? "18:00",
    fromStation: null,
    toStation: null,
    operator: null,
    referenceNumber: null,
    flightNumber: null,
    notes: null,
    ...partial,
  };
}

describe("departureMorningCity", () => {
  it("uses home city when departing from the default airport", () => {
    assert.equal(
      departureMorningCity("Christchurch International Airport, New Zealand", trip, trip.startDate),
      "Christchurch, New Zealand",
    );
  });
});

describe("computeTravelDayLayouts home airport departure", () => {
  it("paints home city before an afternoon flight from the default airport", () => {
    const draft = {
      outboundLegs: [
        planeLeg({
          fromCity: "Christchurch International Airport, New Zealand",
          toCity: "Suvarnabhumi Airport, Thailand",
          travelDate: "2026-08-31",
          departureTime: "18:00",
          arrivalTime: "08:00",
        }),
      ],
      returnLegs: [],
      intercityLegs: [],
    };
    const layouts = computeTravelDayLayouts(draft, trip);
    const segments = layouts.get("2026-08-31");
    const city = segments?.find((s) => s.kind === "city");
    assert.ok(city);
    assert.equal(city?.city, "Christchurch, New Zealand");
    assert.ok(city!.end > 0.4);
  });

  it("fills the rest of the day after landing at the home airport", () => {
    const draft = {
      outboundLegs: [],
      returnLegs: [
        planeLeg({
          fromCity: "Suvarnabhumi Airport, Thailand",
          toCity: "Christchurch International Airport, New Zealand",
          travelDate: "2026-09-09",
          departureTime: "22:00",
          arrivalTime: "06:00",
        }),
      ],
      intercityLegs: [],
    };
    const layouts = computeTravelDayLayouts(draft, trip);
    const segments = layouts.get("2026-09-10");
    const city = segments?.find((s) => s.kind === "city");
    assert.ok(city);
    assert.equal(city?.city, "Christchurch, New Zealand");
    assert.equal(city?.end, 1);
  });
});
