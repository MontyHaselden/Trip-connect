import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { placesShareMetro } from "@/lib/geo/airport-codes";
import { detectAirportTransfers } from "@/lib/host/wizard/detect-airport-transfers";
import { syncIntercityLegs } from "@/lib/host/wizard/detect-city-moves";
import type { DayPlaceDraft, TransportLegDraft, TripWizardDraft } from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";
const trip = {
  startDate: "2026-06-03",
  endDate: "2026-06-20",
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
    departureTime: partial.departureTime ?? "08:10",
    arrivalTime: partial.arrivalTime ?? "09:40",
    fromStation: null,
    toStation: null,
    operator: null,
    referenceNumber: null,
    flightNumber: null,
    notes: null,
    ...partial,
  };
}

function japanDraft(): Pick<TripWizardDraft, "outboundLegs" | "returnLegs" | "intercityLegs"> {
  return {
    outboundLegs: [
      planeLeg({
        fromCity: "Christchurch, New Zealand",
        toCity: "Auckland, New Zealand",
        travelDate: "2026-06-03",
        arrivalDate: null,
        departureTime: "08:10",
        arrivalTime: "10:15",
      }),
      planeLeg({
        fromCity: "Auckland, New Zealand",
        toCity: "tokyo",
        travelDate: "2026-06-03",
        arrivalDate: "2026-06-04",
        departureTime: "10:15",
        arrivalTime: "09:40",
      }),
    ],
    returnLegs: [
      planeLeg({
        fromCity: "tokyo",
        toCity: "Auckland, New Zealand",
        travelDate: "2026-06-20",
        arrivalDate: "2026-06-21",
        departureTime: "14:00",
        arrivalTime: "20:00",
      }),
    ],
    intercityLegs: [],
  };
}

describe("placesShareMetro", () => {
  it("treats NRT and Tokyo as the same metro", () => {
    assert.equal(placesShareMetro("tokyo", "Narita"), true);
  });

  it("treats Osaka and NRT as different metros", () => {
    assert.equal(placesShareMetro("Osaka", "tokyo"), false);
  });
});

describe("detectAirportTransfers", () => {
  const draft = japanDraft();

  it("detects Narita to Osaka on arrival day", () => {
    const dayPlaces: DayPlaceDraft[] = [
      {
        date: "2026-06-04",
        primaryCity: "",
        secondaryCity: "Osaka",
        primaryShare: 0.25,
        dayType: "travel",
        includeBuffer: false,
      },
    ];

    const transfers = detectAirportTransfers(dayPlaces, draft, trip);
    assert.equal(transfers.length, 1);
    assert.equal(transfers[0]!.legKind, "airport_arrival");
    assert.equal(transfers[0]!.toCity, "Osaka");
  });

  it("skips transfer when painted city matches airport metro", () => {
    const dayPlaces: DayPlaceDraft[] = [
      {
        date: "2026-06-04",
        primaryCity: "",
        secondaryCity: "Tokyo",
        primaryShare: 0.25,
        dayType: "travel",
        includeBuffer: false,
      },
    ];

    const transfers = detectAirportTransfers(dayPlaces, draft, trip);
    assert.equal(transfers.length, 0);
  });

  it("detects Osaka to Narita on departure day", () => {
    const dayPlaces: DayPlaceDraft[] = [
      {
        date: "2026-06-20",
        primaryCity: "Osaka",
        secondaryCity: null,
        primaryShare: 0.5,
        dayType: "trip",
        includeBuffer: false,
      },
    ];

    const transfers = detectAirportTransfers(dayPlaces, draft, trip);
    assert.equal(transfers.length, 1);
    assert.equal(transfers[0]!.legKind, "airport_departure");
    assert.equal(transfers[0]!.fromCity, "Osaka");
  });
});

describe("syncIntercityLegs", () => {
  it("does not invent Christchurch to Osaka on flight arrival day", () => {
    const dayPlaces: DayPlaceDraft[] = [
      {
        date: "2026-06-02",
        primaryCity: "Christchurch, New Zealand",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip",
        includeBuffer: false,
      },
      {
        date: "2026-06-04",
        primaryCity: "",
        secondaryCity: "Osaka",
        primaryShare: 0.25,
        dayType: "travel",
        includeBuffer: false,
      },
    ];

    const legs = syncIntercityLegs(dayPlaces, [], {
      outboundLegs: japanDraft().outboundLegs,
      returnLegs: japanDraft().returnLegs,
      trip,
    });

    assert.equal(legs.some((l) => l.intercityFromCity.includes("Christchurch")), false);
    assert.equal(legs.some((l) => l.legKind === "airport_arrival"), true);
    assert.equal(legs.find((l) => l.legKind === "airport_arrival")?.transportType, "train");
  });
});
