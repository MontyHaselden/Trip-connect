import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { setupStateToGraph } from "./adapters";
import { applyCommands } from "./apply-commands";
import {
  isTravelSplitDay,
  protectTravelSplitDays,
  wouldReplanLocationRange,
} from "./paint-location-preflight";
import type { TripSetupState } from "@/lib/host/setup/types";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

function day(
  date: string,
  primary: string,
  secondary: string | null = null,
  share = 1,
): DayPlaceDraft {
  return {
    date,
    primaryCity: primary,
    secondaryCity: secondary,
    primaryShare: share,
    dayType: secondary && share < 0.99 ? "travel" : "trip",
    includeBuffer: false,
  };
}

function japanState(): TripSetupState {
  return {
    basics: {
      name: "Japan",
      schoolName: "",
      startDate: "2026-12-05",
      endDate: "2026-12-20",
      timezone: "Asia/Tokyo",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      defaultDepartureAirport: "",
      destinationCountries: ["Japan"],
    },
    mainGroupId: "main",
    groups: [
      {
        id: "main",
        name: "Main",
        type: "main",
        description: null,
        sortOrder: 0,
        isMain: true,
      },
    ],
    dayPlacesByGroupId: {
      main: [
        ...["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12"].map(
          (date) => day(date, "Kagoshima"),
        ),
        day("2026-12-13", "Kagoshima", "Hiroshima", 0.5),
        ...["2026-12-14", "2026-12-15"].map((date) => day(date, "Hiroshima")),
      ],
    },
    outboundLegs: [],
    returnLegs: [],
    intercityLegs: [
      {
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
      },
    ],
    accommodationStays: [
      {
        id: "stay-hiroshima",
        cityLabel: "Hiroshima",
        stayType: "hotel",
        name: "The Knot",
        url: null,
        address: null,
        phone: null,
        checkInDate: "2026-12-13",
        checkOutDate: "2026-12-16",
        notes: null,
        isHomestayGroup: false,
        multipleInCity: false,
      },
    ],
    activities: [],
    overlayOps: [],
  };
}

describe("protectTravelSplitDays", () => {
  it("preserves travel split at range end when painting through it with full edges", () => {
    const originals = new Map([
      ["2026-12-13", day("2026-12-13", "Kagoshima", "Hiroshima", 0.5)],
    ]);
    const painted = [
      day("2026-12-07", "Kagoshima"),
      day("2026-12-12", "Kagoshima"),
      day("2026-12-13", "Kagoshima"),
    ];
    const out = protectTravelSplitDays(
      originals,
      painted,
      "2026-12-07",
      "2026-12-13",
      "full",
      "full",
    );
    const dec13 = out.find((d) => d.date === "2026-12-13");
    assert.equal(isTravelSplitDay(dec13!), true);
    assert.equal(dec13?.primaryCity, "Kagoshima");
    assert.equal(dec13?.secondaryCity, "Hiroshima");
  });
});

describe("wouldReplanLocationRange", () => {
  it("flags when location paint would trim overlapping stays", () => {
    const graph = setupStateToGraph("trip-1", japanState());
    assert.equal(
      wouldReplanLocationRange(
        graph,
        "main",
        "2026-12-13",
        "2026-12-16",
        "Tokyo",
      ),
      true,
    );
  });

  it("does not flag when paint range avoids stay conflicts", () => {
    const graph = setupStateToGraph("trip-1", japanState());
    assert.equal(
      wouldReplanLocationRange(
        graph,
        "main",
        "2026-12-07",
        "2026-12-12",
        "Kagoshima",
      ),
      false,
    );
  });
});

describe("lightweight paintDayRange", () => {
  it("keeps Hiroshima travel split when painting Kagoshima through Dec 12 only", () => {
    const graph = setupStateToGraph("trip-1", japanState());
    const { graph: next } = applyCommands(graph, [
      {
        type: "paintDayRange",
        groupId: "main",
        rangeStart: "2026-12-07",
        rangeEnd: "2026-12-12",
        location: "Kagoshima",
      },
    ]);
    const dec13 = next.dayPlacesByGroupId.main?.find((d) => d.date === "2026-12-13");
    assert.equal(dec13?.primaryCity, "Kagoshima");
    assert.equal(dec13?.secondaryCity, "Hiroshima");
    assert.equal(next.accommodationStays[0]?.checkInDate, "2026-12-13");
  });
});
