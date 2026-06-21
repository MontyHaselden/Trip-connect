import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applySetupAccommodationChange } from "./apply-setup-accommodation";
import { TRANSPORT_CORRIDOR_LEFT_SHARE } from "./transport-corridor";
import type { TripSetupState } from "./types";
import type { AccommodationStayDraft } from "@/lib/host/wizard/types";

function baseState(): TripSetupState {
  return {
    basics: {
      name: "Japan",
      schoolName: "School",
      startDate: "2026-12-01",
      endDate: "2026-12-22",
      timezone: "Asia/Tokyo",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      defaultDepartureAirport: "",
      destinationCountries: ["Japan"],
    },
    mainGroupId: "main",
    groups: [
      { id: "main", name: "Main", type: "main", description: null, sortOrder: 0, isMain: true },
    ],
    dayPlacesByGroupId: {
      main: [
        {
          date: "2026-12-14",
          primaryCity: "Hiroshima",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
    },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [
      {
        id: "leg-hiroshima-kyoto",
        legKind: "city_change",
        transportType: "train",
        bookingStatus: "not_booked",
        travelDate: "2026-12-15",
        departureTime: null,
        arrivalTime: null,
        fromCity: "Hiroshima",
        toCity: "Kyoto",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: null,
        notes: null,
        intercityFromCity: "Hiroshima",
        intercityToCity: "Kyoto",
        originGroupId: "main",
        sourceEntityId: null,
      },
    ],
    accommodationStays: [],
    activities: [],
    overlayOps: [],
  };
}

function kyotoStay(): AccommodationStayDraft {
  return {
    id: "kyoto-inn",
    cityLabel: "Kyoto",
    stayType: "hotel",
    name: "VIA INN Prime Kyotoeki Hachijoguchi",
    url: null,
    address: "Kyoto, Japan",
    phone: null,
    checkInDate: "2026-12-15",
    checkOutDate: "2026-12-17",
    notes: null,
    isHomestayGroup: false,
    multipleInCity: false,
    originGroupId: "main",
  };
}

describe("applySetupAccommodationChange", () => {
  it("keeps Hiroshima on the first half when a Kyoto stay checks in on a travel day", () => {
    const state = baseState();
    const next = applySetupAccommodationChange(
      { ...state, accommodationStays: [kyotoStay()] },
      "main",
    );
    const dec15 = next.dayPlacesByGroupId.main?.find((d) => d.date === "2026-12-15");
    assert.equal(dec15?.primaryCity, "Hiroshima");
    assert.equal(dec15?.secondaryCity, "Kyoto");
    assert.equal(dec15?.primaryShare, TRANSPORT_CORRIDOR_LEFT_SHARE);
  });
});
