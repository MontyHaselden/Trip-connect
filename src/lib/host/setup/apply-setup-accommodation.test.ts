import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applySetupAccommodationChange } from "./apply-setup-accommodation";
import { unallocateLegsForStayRange } from "./transport-allocation";
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
  it("does not paint transport corridors when adding a stay", () => {
    const state = baseState();
    const next = applySetupAccommodationChange(
      { ...state, accommodationStays: [kyotoStay()] },
      "main",
    );
    const dec15 = next.dayPlacesByGroupId.main?.find((d) => d.date === "2026-12-15");
    assert.notEqual(dec15?.primaryCity, "Hiroshima");
    assert.notEqual(
      dec15?.primaryCity === "Hiroshima" && dec15?.secondaryCity === "Kyoto",
      true,
    );
  });

  it("replaces a transport travel day when applying a stay with replaceLocationLabels", () => {
    const kagoshimaStay = (): AccommodationStayDraft => ({
      id: "kagoshima-hotel",
      cityLabel: "Kagoshima",
      stayType: "hotel",
      name: "Kagoshima Hotel",
      url: null,
      address: null,
      phone: null,
      checkInDate: "2026-12-06",
      checkOutDate: "2026-12-13",
      notes: null,
      isHomestayGroup: false,
      multipleInCity: false,
      originGroupId: "main",
    });

    const state: TripSetupState = {
      ...baseState(),
      dayPlacesByGroupId: {
        main: [
          {
            date: "2026-12-13",
            primaryCity: "Tottori",
            secondaryCity: "Hiroshima",
            primaryShare: TRANSPORT_CORRIDOR_LEFT_SHARE,
            dayType: "travel",
            includeBuffer: false,
          },
        ],
      },
      intercityLegs: [
        {
          id: "leg-tottori-hiroshima",
          legKind: "city_change",
          transportType: "train",
          bookingStatus: "not_booked",
          travelDate: "2026-12-13",
          departureTime: null,
          arrivalTime: null,
          fromCity: "Tottori",
          toCity: "Hiroshima",
          fromStation: null,
          toStation: null,
          operator: null,
          referenceNumber: null,
          flightNumber: null,
          notes: null,
          intercityFromCity: "Tottori",
          intercityToCity: "Hiroshima",
          originGroupId: "main",
          sourceEntityId: null,
        },
      ],
      accommodationStays: [kagoshimaStay()],
    };

    const detached = unallocateLegsForStayRange(state, "main", kagoshimaStay());
    assert.equal(detached.intercityLegs[0]?.surfaceOnly, true);

    const next = applySetupAccommodationChange(detached, "main", {
      replaceStayIds: new Set(["kagoshima-hotel"]),
    });
    const dec13 = next.dayPlacesByGroupId.main?.find((d) => d.date === "2026-12-13");
    assert.ok(dec13);
    assert.ok(
      dec13!.primaryCity.toLowerCase().includes("kagoshima") ||
        (dec13!.secondaryCity?.toLowerCase().includes("kagoshima") ?? false),
    );
    assert.ok(!dec13!.primaryCity.toLowerCase().includes("tottori"));
  });
});
