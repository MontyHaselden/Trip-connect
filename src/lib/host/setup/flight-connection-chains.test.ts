import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildConnectionChainFromLeg,
  collectFlightConnectionChains,
} from "@/lib/host/setup/flight-connection-chains";
import type { DayPlaceDraft, TransportLegDraft } from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";

function planeLeg(
  partial: Partial<TransportLegDraft> & Pick<TransportLegDraft, "fromCity" | "toCity" | "travelDate">,
): TransportLegDraft {
  return {
    id: newId(),
    transportType: "plane",
    bookingStatus: "not_booked",
    arrivalDate: partial.arrivalDate ?? partial.travelDate,
    departureTime: "08:00",
    arrivalTime: "12:00",
    fromStation: null,
    toStation: null,
    operator: null,
    referenceNumber: null,
    flightNumber: null,
    notes: null,
    ...partial,
  };
}

describe("flight connection chains", () => {
  it("builds a two-leg same-day outbound chain", () => {
    const legs = [
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
    ];

    const chain = buildConnectionChainFromLeg(legs[0]!, legs);
    assert.equal(chain.length, 2);
    assert.equal(chain[1]!.toCity.includes("Phuket"), true);
  });

  it("collects collapsible chains unless a hub stay exists", () => {
    const legs = [
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
    ];
    const dayByDate = new Map<string, DayPlaceDraft>();

    const collapsed = collectFlightConnectionChains(legs, dayByDate);
    assert.equal(collapsed.length, 1);
    assert.equal(collapsed[0]!.sameDay, true);
    assert.equal(collapsed[0]!.connectionDate, "2026-08-23");

    const withStay = collectFlightConnectionChains(legs, dayByDate, [
      {
        id: newId(),
        cityLabel: "Melbourne, Australia",
        stayType: "hotel",
        name: "Stopover hotel",
        url: null,
        address: null,
        phone: null,
        checkInDate: "2026-08-23",
        checkOutDate: "2026-08-23",
        notes: null,
        isHomestayGroup: false,
      },
    ]);
    assert.equal(withStay.length, 0);
  });

  it("still collapses chains when AI painted a travel crossover through the hub", () => {
    const legs = [
      planeLeg({
        fromCity: "Suvarnabhumi Airport (BKK), Thailand",
        toCity: "Melbourne Airport (MEL), Australia",
        travelDate: "2026-09-04",
        arrivalDate: "2026-09-05",
      }),
      planeLeg({
        fromCity: "Melbourne Airport (MEL), Australia",
        toCity: "Christchurch Airport (CHC), New Zealand",
        travelDate: "2026-09-05",
        arrivalDate: "2026-09-05",
      }),
    ];
    const dayByDate = new Map<string, DayPlaceDraft>([
      [
        "2026-09-04",
        {
          date: "2026-09-04",
          primaryCity: "Bangkok",
          secondaryCity: "Melbourne",
          primaryShare: 0.5,
          dayType: "travel",
          includeBuffer: false,
        },
      ],
    ]);

    const collapsed = collectFlightConnectionChains(legs, dayByDate);
    assert.equal(collapsed.length, 1);
    assert.equal(collapsed[0]!.sameDay, false);
  });
});
