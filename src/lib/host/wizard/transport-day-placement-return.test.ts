import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hasScheduledReturnTransport } from "./transport-day-placement";

describe("hasScheduledReturnTransport", () => {
  const trip = {
    endDate: "2026-09-04",
    returnCity: "Christchurch, New Zealand",
  };

  it("is false with no return legs", () => {
    assert.equal(
      hasScheduledReturnTransport(
        { outboundLegs: [], returnLegs: [], intercityLegs: [] },
        trip,
      ),
      false,
    );
  });

  it("is true when an intercity leg flies home on trip end", () => {
    assert.equal(
      hasScheduledReturnTransport(
        {
          outboundLegs: [],
          returnLegs: [],
          intercityLegs: [
            {
              id: "ret",
              transportType: "plane",
              bookingStatus: "not_booked",
              travelDate: "2026-09-04",
              arrivalDate: "2026-09-05",
              departureTime: null,
              arrivalTime: null,
              fromCity: "Bangkok",
              toCity: "Christchurch Airport (CHC), New Zealand",
              fromStation: null,
              toStation: null,
              operator: null,
              referenceNumber: null,
              intercityFromCity: "Bangkok",
              intercityToCity: "Christchurch, New Zealand",
              legKind: "city_change",
              flightNumber: null,
              notes: null,
            },
          ],
        },
        trip,
      ),
      true,
    );
  });
});
