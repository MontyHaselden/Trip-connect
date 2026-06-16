import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { syncChainedTransportLegs, syncConsecutiveFlightLegs } from "./leg-chain";
import { newId, type TransportLegDraft } from "./types";

function planeLeg(
  partial: Partial<TransportLegDraft> & Pick<TransportLegDraft, "fromCity" | "toCity" | "travelDate">,
): TransportLegDraft {
  return {
    id: newId(),
    transportType: "plane",
    bookingStatus: "not_booked",
    arrivalDate: partial.arrivalDate ?? null,
    departureTime: partial.departureTime ?? null,
    arrivalTime: partial.arrivalTime ?? null,
    fromStation: null,
    toStation: null,
    operator: null,
    referenceNumber: null,
    flightNumber: partial.flightNumber ?? null,
    notes: null,
    ...partial,
  };
}

describe("syncConsecutiveFlightLegs", () => {
  it("moves a connection leg to the previous leg's arrival day after overnight travel", () => {
    const legs = [
      planeLeg({
        fromCity: "Suvarnabhumi Airport (BKK), Thailand",
        toCity: "Melbourne Airport (MEL), Australia",
        travelDate: "2026-09-04",
        arrivalDate: "2026-09-05",
        departureTime: "21:40",
        arrivalTime: "09:25",
        flightNumber: "JQ30",
      }),
      planeLeg({
        fromCity: "Melbourne Airport (MEL), Australia",
        toCity: "Christchurch Airport (CHC), New Zealand",
        travelDate: "2026-09-04",
        arrivalDate: "2026-09-04",
        departureTime: "11:05",
        arrivalTime: "16:25",
        flightNumber: "JQ171",
      }),
    ];

    const synced = syncConsecutiveFlightLegs(legs);
    assert.equal(synced[0]?.travelDate, "2026-09-04");
    assert.equal(synced[1]?.travelDate, "2026-09-05");
  });
});

describe("syncChainedTransportLegs", () => {
  it("syncs intercity plane chains without touching unrelated legs", () => {
    const draft = {
      outboundLegs: [],
      returnLegs: [],
      intercityLegs: [
        planeLeg({
          fromCity: "Christchurch Airport (CHC), New Zealand",
          toCity: "Melbourne Airport (MEL), Australia",
          travelDate: "2026-08-23",
          arrivalDate: "2026-08-23",
        }),
        planeLeg({
          fromCity: "Melbourne Airport (MEL), Australia",
          toCity: "Phuket International Airport (HKT), Thailand",
          travelDate: "2026-08-23",
          arrivalDate: "2026-08-23",
        }),
        planeLeg({
          fromCity: "Suvarnabhumi Airport (BKK), Thailand",
          toCity: "Melbourne Airport (MEL), Australia",
          travelDate: "2026-09-04",
          arrivalDate: "2026-09-05",
          departureTime: "21:40",
          arrivalTime: "09:25",
        }),
        planeLeg({
          fromCity: "Melbourne Airport (MEL), Australia",
          toCity: "Christchurch Airport (CHC), New Zealand",
          travelDate: "2026-09-04",
          arrivalDate: "2026-09-04",
          departureTime: "11:05",
          arrivalTime: "16:25",
        }),
      ],
    };

    const synced = syncChainedTransportLegs(draft as never);
    assert.equal(synced.intercityLegs[2]?.travelDate, "2026-09-04");
    assert.equal(synced.intercityLegs[3]?.travelDate, "2026-09-05");
  });
});
