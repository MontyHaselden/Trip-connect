import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computeCalendarTransport,
  computeTransitOverlays,
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
  it("omits surface-only intercity legs from transit overlays", () => {
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

    const overlays = computeTransitOverlays(draft, trip);
    assert.equal(overlays.has("2026-12-13"), false);
  });

  it("keeps allocated intercity legs on the calendar", () => {
    const draft = {
      outboundLegs: [],
      returnLegs: [],
      intercityLegs: [intercity()],
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

    const { travelLayouts } = computeCalendarTransport(draft, trip);
    assert.ok(travelLayouts.has("2026-12-13"));
  });

  it("keeps full-width in-flight bands on middle days for multi-day flights", () => {
    const draft = {
      outboundLegs: [
        {
          id: "out-1",
          transportType: "plane",
          bookingStatus: "booked",
          travelDate: "2026-12-05",
          arrivalDate: "2026-12-07",
          departureTime: "10:00",
          arrivalTime: "18:00",
          fromCity: "Christchurch",
          toCity: "Narita",
          fromStation: null,
          toStation: null,
          operator: null,
          referenceNumber: null,
          flightNumber: "NZ99",
          notes: null,
        },
      ],
      returnLegs: [],
      intercityLegs: [],
      dayPlaces: [],
    };

    const { travelLayouts } = computeCalendarTransport(draft, trip);
    assert.ok(travelLayouts.has("2026-12-06"));
  });
});
