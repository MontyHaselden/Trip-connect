import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeCalendarTransport,
  computeTransitOverlays,
  flightArrivalDates,
} from "./transport-day-placement";
import type { DayPlaceDraft, IntercityLegDraft } from "./types";

const trip = {
  startDate: "2026-12-01",
  endDate: "2026-12-31",
  departureCity: "Christchurch",
  returnCity: "Christchurch",
};

function intercity(overrides: Partial<IntercityLegDraft> = {}): IntercityLegDraft {
  return {
    id: "ic-1",
    legKind: "city_change",
    transportType: "train",
    bookingStatus: "not_booked",
    travelDate: "2026-12-13",
    arrivalDate: null,
    departureTime: null,
    arrivalTime: null,
    fromCity: "Kagoshima",
    toCity: "Hiroshima",
    fromStation: null,
    toStation: null,
    operator: null,
    referenceNumber: null,
    flightNumber: null,
    notes: null,
    intercityFromCity: "Kagoshima",
    intercityToCity: "Hiroshima",
    ...overrides,
  };
}

describe("surfaceOnly transport filtering", () => {
  it("omits surface-only intercity legs from arrival date tracking", () => {
    const draft = {
      outboundLegs: [],
      returnLegs: [],
      intercityLegs: [intercity({ surfaceOnly: true })],
      dayPlaces: [
        {
          date: "2026-12-13",
          primaryCity: "Kagoshima",
          secondaryCity: "Hiroshima",
          primaryShare: 0.5,
          dayType: "travel",
          includeBuffer: false,
        } satisfies DayPlaceDraft,
      ],
    };

    const arrivals = flightArrivalDates(draft, trip);
    assert.equal(arrivals.has("2026-12-13"), false);
  });

  it("calendar transport helpers return empty maps (transport is not rendered on calendar)", () => {
    const draft = {
      outboundLegs: [],
      returnLegs: [],
      intercityLegs: [intercity()],
      dayPlaces: [] as DayPlaceDraft[],
    };

    const overlays = computeTransitOverlays(draft, trip);
    const { travelLayouts, transitOverlays } = computeCalendarTransport(draft, trip);
    assert.equal(overlays.size, 0);
    assert.equal(travelLayouts.size, 0);
    assert.equal(transitOverlays.size, 0);
  });
});
