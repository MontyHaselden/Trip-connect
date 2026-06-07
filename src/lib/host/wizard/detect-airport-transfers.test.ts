import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { placesShareMetro } from "@/lib/geo/airport-codes";
import { computeCalendarBounds } from "@/lib/host/wizard/calendar-bounds";
import { detectAirportTransfers } from "@/lib/host/wizard/detect-airport-transfers";
import { buildDefaultDayPlaces, syncIntercityLegs } from "@/lib/host/wizard/detect-city-moves";
import { deriveCitiesFromTransport } from "@/lib/host/wizard/derive-trip-dates";
import {
  computeTravelDayLayouts,
  hasAfternoonDepartureTravel,
  mergeTravelWithPaintedStay,
  travelLayoutPaintStart,
  tripDayHasPaintableStaySlot,
} from "@/lib/host/wizard/transport-day-placement";
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

describe("computeTravelDayLayouts", () => {
  it("leaves arrival and departure days paintable without auto city blocks", () => {
    const draft = japanDraft();
    const layouts = computeTravelDayLayouts(draft, trip);

    const jun4 = layouts.get("2026-06-04");
    assert.ok(jun4);
    assert.equal(jun4!.some((s) => s.kind === "city"), false);
    assert.equal(travelLayoutPaintStart(jun4), 0.25);

    const jun20 = layouts.get("2026-06-20");
    assert.ok(jun20);
    assert.equal(jun20!.some((s) => s.kind === "city"), false);
    assert.equal(travelLayoutPaintStart(jun20), 0);
    assert.equal(
      computeTravelDayLayouts(draft, trip)
        .get("2026-06-20")!
        .find((s) => s.kind === "transit")?.start,
      0.5,
    );
  });

  it("shows home city band on return arrival day", () => {
    const draft = {
      ...japanDraft(),
      returnLegs: [
        planeLeg({
          fromCity: "Narita International Airport, Japan",
          toCity: "Christchurch, New Zealand",
          travelDate: "2026-06-20",
          arrivalDate: "2026-06-21",
          departureTime: null,
          arrivalTime: null,
        }),
      ],
    };
    const layouts = computeTravelDayLayouts(draft, trip);
    const jun21 = layouts.get("2026-06-21");
    assert.ok(jun21?.some((s) => s.kind === "city" && s.city.includes("Christchurch")));
  });

  it("fills in-flight days between departure and arrival", () => {
    const draft = {
      ...japanDraft(),
      returnLegs: [
        planeLeg({
          fromCity: "Narita International Airport, Japan",
          toCity: "Christchurch, New Zealand",
          travelDate: "2026-06-18",
          arrivalDate: "2026-06-20",
          departureTime: "10:00",
          arrivalTime: "18:00",
        }),
      ],
    };
    const layouts = computeTravelDayLayouts(draft, trip);
    assert.ok(layouts.get("2026-06-19")?.some((s) => s.kind === "transit" && s.end === 1));
  });

  it("shows one combined return route on post-trip connection arrival without stopover bands", () => {
    const draft = {
      ...japanDraft(),
      returnLegs: [
        planeLeg({
          fromCity: "Narita International Airport, Japan",
          toCity: "Auckland, New Zealand",
          travelDate: "2026-06-20",
          arrivalDate: "2026-06-21",
          departureTime: "10:00",
          arrivalTime: "09:00",
        }),
      ],
    };
    const layouts = computeTravelDayLayouts(draft, trip);
    const jun21 = layouts.get("2026-06-21");
    assert.equal(jun21?.some((s) => s.kind === "city"), false);
    assert.equal(jun21?.find((s) => s.kind === "transit")?.label, "NRT → AKL");
  });

  it("shows one combined return route on late post-trip connection arrival", () => {
    const draft = {
      ...japanDraft(),
      returnLegs: [
        planeLeg({
          fromCity: "Narita International Airport, Japan",
          toCity: "Auckland, New Zealand",
          travelDate: "2026-06-20",
          arrivalDate: "2026-06-21",
          departureTime: "10:00",
          arrivalTime: "20:00",
        }),
      ],
    };
    const layouts = computeTravelDayLayouts(draft, trip);
    const jun21 = layouts.get("2026-06-21");
    assert.equal(jun21?.some((s) => s.kind === "city"), false);
    assert.equal(jun21?.find((s) => s.kind === "transit")?.end, 0.75);
  });

  it("shows one combined return route plus home landing on same-day connection return", () => {
    const draft = {
      ...japanDraft(),
      returnLegs: [
        planeLeg({
          fromCity: "Narita International Airport, Japan",
          toCity: "Auckland, New Zealand",
          travelDate: "2026-06-20",
          arrivalDate: "2026-06-21",
          departureTime: "10:00",
          arrivalTime: "09:00",
        }),
        planeLeg({
          fromCity: "Auckland, New Zealand",
          toCity: "Christchurch, New Zealand",
          travelDate: "2026-06-21",
          arrivalDate: "2026-06-21",
          departureTime: "14:00",
          arrivalTime: "20:00",
        }),
      ],
    };
    const layouts = computeTravelDayLayouts(draft, trip);
    const jun21 = layouts.get("2026-06-21");
    assert.equal(jun21?.some((s) => s.kind === "city" && s.city.includes("Auckland")), false);
    assert.equal(jun21?.find((s) => s.kind === "transit")?.label, "NRT → AKL → CHC");
    const chc = jun21?.find((s) => s.kind === "city" && s.city.includes("Christchurch"));
    assert.ok(chc);
    assert.equal(chc?.start, 0.75);
    assert.equal(chc?.end, 1);
  });

  it("shows one combined return route when an onward home leg departs later", () => {
    const draft = {
      ...japanDraft(),
      returnLegs: [
        planeLeg({
          fromCity: "Narita International Airport, Japan",
          toCity: "Auckland, New Zealand",
          travelDate: "2026-06-20",
          arrivalDate: "2026-06-21",
          departureTime: "10:00",
          arrivalTime: "09:00",
        }),
        planeLeg({
          fromCity: "Auckland, New Zealand",
          toCity: "Christchurch, New Zealand",
          travelDate: "2026-06-21",
          arrivalDate: "2026-06-22",
          departureTime: "14:00",
          arrivalTime: "09:00",
        }),
      ],
    };
    const layouts = computeTravelDayLayouts(draft, trip);
    const jun21 = layouts.get("2026-06-21");
    assert.equal(jun21?.some((s) => s.kind === "city"), false);
    assert.equal(jun21?.find((s) => s.kind === "transit")?.label, "NRT → AKL → CHC");
  });

  it("leaves the morning paintable on return departure day", () => {
    const draft = {
      ...japanDraft(),
      returnLegs: [
        planeLeg({
          fromCity: "Narita International Airport, Japan",
          toCity: "Christchurch, New Zealand",
          travelDate: "2026-06-20",
          arrivalDate: "2026-06-21",
          departureTime: "14:00",
          arrivalTime: "08:00",
        }),
      ],
    };
    const layouts = computeTravelDayLayouts(draft, trip);
    const jun20 = layouts.get("2026-06-20");
    assert.ok(hasAfternoonDepartureTravel(jun20));
    assert.ok(tripDayHasPaintableStaySlot("2026-06-20", trip, jun20, null));
    assert.equal(travelLayoutPaintStart(jun20), 0);
    assert.equal(
      tripDayHasPaintableStaySlot("2026-06-20", trip, jun20, {
        primaryCity: "Osaka, Japan",
        secondaryCity: null,
        primaryShare: 0.5,
      }),
      false,
    );
  });

  it("uses final return connection for home city on post-trip buffer", () => {
    const draft = {
      ...japanDraft(),
      returnLegs: [
        planeLeg({
          fromCity: "Narita International Airport, Japan",
          toCity: "Auckland, New Zealand",
          travelDate: "2026-06-20",
          arrivalDate: "2026-06-21",
          departureTime: "10:00",
          arrivalTime: "19:00",
        }),
        planeLeg({
          fromCity: "Auckland, New Zealand",
          toCity: "Christchurch, New Zealand",
          travelDate: "2026-06-21",
          arrivalDate: "2026-06-21",
          departureTime: "19:00",
          arrivalTime: "21:00",
        }),
      ],
    };

    const cities = deriveCitiesFromTransport(draft);
    assert.equal(cities.returnCity, "Christchurch, New Zealand");

    const basics = {
      startDate: trip.startDate,
      endDate: trip.endDate,
      returnCity: cities.returnCity,
    };
    const bounds = computeCalendarBounds(draft, basics);
    assert.ok(bounds);
    const days = buildDefaultDayPlaces(
      basics.startDate,
      basics.endDate,
      trip.departureCity,
      basics.returnCity,
      bounds!.lastDate,
    );
    const postTripBuffers = days.filter(
      (day) => day.dayType === "buffer" && day.date > basics.endDate,
    );
    assert.ok(postTripBuffers.length > 0);
    assert.ok(
      postTripBuffers.every((day) => day.primaryCity.includes("Christchurch")),
      `expected Christchurch on post-trip buffer, got ${postTripBuffers.map((d) => d.primaryCity).join(", ")}`,
    );
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

describe("intercity crossover calendar layout", () => {
  it("uses quarter-city · half-transit · quarter-city for train city changes", () => {
    const draft = {
      ...japanDraft(),
      dayPlaces: [
        {
          date: "2026-06-11",
          primaryCity: "Tokyo, Japan",
          secondaryCity: "Osaka, Japan",
          primaryShare: 0.5,
          dayType: "travel" as const,
          includeBuffer: false,
        },
      ],
      intercityLegs: [
        {
          ...planeLeg({
            fromCity: "Tokyo, Japan",
            toCity: "Osaka, Japan",
            travelDate: "2026-06-11",
          }),
          intercityFromCity: "Tokyo, Japan",
          intercityToCity: "Osaka, Japan",
          legKind: "city_change" as const,
          transportType: "train" as const,
          bookingStatus: "placeholder" as const,
        },
      ],
    };
    const layouts = computeTravelDayLayouts(draft, {
      startDate: "2026-06-03",
      endDate: "2026-06-20",
      departureCity: trip.departureCity,
      returnCity: trip.returnCity,
    });
    const jun11 = layouts.get("2026-06-11");
    assert.equal(jun11?.length, 3);
    assert.equal(jun11?.[0]?.kind, "city");
    assert.equal(jun11?.[0]?.end, 0.25);
    assert.equal(jun11?.[1]?.kind, "transit");
    assert.equal(jun11?.[1]?.label, "Train");
    assert.equal(jun11?.[1]?.start, 0.25);
    assert.equal(jun11?.[1]?.end, 0.75);
    assert.equal(jun11?.[2]?.kind, "city");
    assert.equal(jun11?.[2]?.start, 0.75);
  });

  it("skips grey transit for unsure intercity legs", () => {
    const draft = {
      ...japanDraft(),
      dayPlaces: [
        {
          date: "2026-06-11",
          primaryCity: "Tokyo, Japan",
          secondaryCity: "Osaka, Japan",
          primaryShare: 0.5,
          dayType: "travel" as const,
          includeBuffer: false,
        },
      ],
      intercityLegs: [
        {
          ...planeLeg({
            fromCity: "Tokyo, Japan",
            toCity: "Osaka, Japan",
            travelDate: "2026-06-11",
          }),
          intercityFromCity: "Tokyo, Japan",
          intercityToCity: "Osaka, Japan",
          legKind: "city_change" as const,
          transportType: "unsure" as const,
          bookingStatus: "flexible" as const,
        },
      ],
    };
    const layouts = computeTravelDayLayouts(draft, trip);
    assert.equal(layouts.has("2026-06-11"), false);
  });
});

describe("mergeTravelWithPaintedStay", () => {
  it("extends transit-only arrival days when the stay fills the landing slot", () => {
    const layouts = computeTravelDayLayouts(japanDraft(), {
      startDate: "2026-06-02",
      endDate: "2026-06-22",
      departureCity: "Christchurch, New Zealand",
      returnCity: "Christchurch, New Zealand",
    });
    const segments = layouts.get("2026-06-04");
    assert.ok(segments?.length);
    const paintStart = travelLayoutPaintStart(segments);

    const day: DayPlaceDraft = {
      date: "2026-06-04",
      primaryCity: "",
      secondaryCity: "Tokyo, Japan",
      primaryShare: paintStart,
      dayType: "travel",
      includeBuffer: false,
    };

    const { segments: merged, hideMergedStayCity } = mergeTravelWithPaintedStay(segments, day);
    assert.equal(hideMergedStayCity, true);
    const citySegment = merged?.find((segment) => segment.kind === "city");
    assert.equal(citySegment?.start, paintStart);
    assert.equal(citySegment?.end, 1);
  });
});
