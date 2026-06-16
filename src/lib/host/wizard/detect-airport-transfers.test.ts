import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseAirportRouteLabel, placesShareMetro } from "@/lib/geo/airport-codes";
import { inferDayPlacesFromFlightLegs } from "@/lib/host/setup/infer-flight-calendar";
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
  it("places origin city before a timed afternoon departure", () => {
    const draft = {
      ...japanDraft(),
      intercityLegs: [
        {
          ...planeLeg({
            fromCity: "Bangkok, Thailand",
            toCity: "Phuket, Thailand",
            travelDate: "2026-06-10",
            departureTime: "18:00",
            arrivalTime: "19:30",
          }),
          intercityFromCity: "Bangkok, Thailand",
          intercityToCity: "Phuket, Thailand",
        },
      ],
    };
    const layouts = computeTravelDayLayouts(draft, trip);
    const jun10 = layouts.get("2026-06-10");
    const city = jun10?.find((s) => s.kind === "city");
    const transit = jun10?.find((s) => s.kind === "transit");
    assert.equal(city?.start, 0);
    assert.equal(city?.end, 0.75);
    assert.equal(transit?.start, 0.75);
    assert.equal(transit?.end, 1);
  });

  it("leaves arrival and departure days paintable without auto city blocks", () => {
    const draft = japanDraft();
    const layouts = computeTravelDayLayouts(draft, trip);

    const jun4 = layouts.get("2026-06-04");
    assert.ok(jun4);
    assert.equal(jun4!.some((s) => s.kind === "city"), false);
    assert.ok(Math.abs(travelLayoutPaintStart(jun4) - 9 / 24 - 40 / 1440) < 0.02);

    const jun20 = layouts.get("2026-06-20");
    assert.ok(jun20);
    const jun20City = jun20!.find((s) => s.kind === "city");
    const jun20Transit = jun20!.find((s) => s.kind === "transit");
    assert.ok(jun20City);
    assert.equal(jun20Transit?.start, 14 * 60 / (24 * 60));
    assert.equal(travelLayoutPaintStart(jun20), 1);
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
    assert.ok(Math.abs((jun21?.find((s) => s.kind === "transit")?.end ?? 0) - 20 / 24) < 0.02);
  });

  it("places afternoon departure and next-morning arrival at scheduled times", () => {
    const draft = {
      outboundLegs: [
        planeLeg({
          fromCity: "Christchurch Airport (CHC), New Zealand",
          toCity: "Melbourne Airport (MEL), Australia",
          travelDate: "2026-08-23",
          arrivalDate: "2026-08-24",
          departureTime: "15:00",
          arrivalTime: "10:00",
          flightNumber: "JQ172",
        }),
      ],
      returnLegs: [],
      intercityLegs: [],
      dayPlaces: [],
    };
    const layouts = computeTravelDayLayouts(draft, {
      startDate: "2026-08-20",
      endDate: "2026-09-10",
      departureCity: "Christchurch, New Zealand",
      returnCity: "Christchurch, New Zealand",
    });

    const dep = layouts.get("2026-08-23");
    const arr = layouts.get("2026-08-24");
    const depTransit = dep?.find((s) => s.kind === "transit");
    const arrTransit = arr?.find((s) => s.kind === "transit");

    assert.equal(depTransit?.start, 15 / 24);
    assert.equal(depTransit?.end, 1);
    assert.equal(arrTransit?.start, 0);
    assert.ok(Math.abs((arrTransit?.end ?? 0) - 10 / 24) < 0.02);
  });

  it("shows one combined outbound route without a hub city band on same-day connections", () => {
    const draft = {
      outboundLegs: [
        planeLeg({
          fromCity: "Christchurch Airport (CHC), New Zealand",
          toCity: "Melbourne Airport (MEL), Australia",
          travelDate: "2026-08-23",
          arrivalDate: "2026-08-23",
          departureTime: "06:20",
          arrivalTime: "10:05",
          flightNumber: "JQ172",
        }),
        planeLeg({
          fromCity: "Melbourne Airport (MEL), Australia",
          toCity: "Phuket International Airport (HKT), Thailand",
          travelDate: "2026-08-23",
          arrivalDate: "2026-08-23",
          departureTime: "14:50",
          arrivalTime: "20:40",
          flightNumber: "JQ17",
        }),
      ],
      returnLegs: [],
      intercityLegs: [],
      dayPlaces: inferDayPlacesFromFlightLegs([], [
        planeLeg({
          fromCity: "Christchurch Airport (CHC), New Zealand",
          toCity: "Melbourne Airport (MEL), Australia",
          travelDate: "2026-08-23",
          arrivalDate: "2026-08-23",
          departureTime: "06:20",
          arrivalTime: "10:05",
        }),
        planeLeg({
          fromCity: "Melbourne Airport (MEL), Australia",
          toCity: "Phuket International Airport (HKT), Thailand",
          travelDate: "2026-08-23",
          arrivalDate: "2026-08-23",
          departureTime: "14:50",
          arrivalTime: "20:40",
        }),
      ]),
    };
    const layouts = computeTravelDayLayouts(draft, {
      startDate: "2026-08-20",
      endDate: "2026-08-30",
      departureCity: "Christchurch, New Zealand",
      returnCity: "Christchurch, New Zealand",
    });
    const aug23 = layouts.get("2026-08-23");
    assert.equal(aug23?.some((s) => s.kind === "city" && s.city.includes("Melbourne")), false);
    assert.equal(aug23?.find((s) => s.kind === "transit")?.label, "CHC → MEL → HKT");
    const painted = draft.dayPlaces.find((d) => d.date === "2026-08-23");
    assert.equal(painted?.primaryCity, "Christchurch");
    assert.equal(painted?.secondaryCity, "Phuket");
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
    const chc = jun21?.find((s) => s.kind === "city" && s.city.includes("Christchurch"));
    assert.deepEqual(parseAirportRouteLabel(jun21?.find((s) => s.kind === "transit")?.label ?? ""), [
      "AKL",
      "CHC",
    ]);
    assert.ok(chc);
    assert.ok(Math.abs((chc?.start ?? 0) - 20 / 24) < 0.02);
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
    const jun22 = layouts.get("2026-06-22");
    assert.ok(!jun21?.some((s) => s.kind === "transit"));
    assert.ok(!jun22?.some((s) => s.kind === "transit"));
    assert.ok(jun22?.some((s) => s.kind === "city" && s.city.includes("Christchurch")));
  });

  it("paints melbourne layover then christchurch on overnight return connection day", () => {
    const draft = {
      outboundLegs: [],
      returnLegs: [],
      intercityLegs: [
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
          travelDate: "2026-09-05",
          arrivalDate: "2026-09-05",
          departureTime: "11:05",
          arrivalTime: "16:25",
          flightNumber: "JQ171",
        }),
      ],
      dayPlaces: [],
    };
    const layouts = computeTravelDayLayouts(draft, {
      startDate: "2026-08-23",
      endDate: "2026-09-05",
      departureCity: "Christchurch, New Zealand",
      returnCity: "Christchurch, New Zealand",
    });
    const painted = inferDayPlacesFromFlightLegs([], [
      ...draft.intercityLegs,
    ]);
    const sep4 = layouts.get("2026-09-04");
    const sep5 = layouts.get("2026-09-05");
    const sep5Paint = painted.find((d) => d.date === "2026-09-05");

    assert.deepEqual(parseAirportRouteLabel(sep4?.find((s) => s.kind === "transit")?.label ?? ""), [
      "BKK",
      "MEL",
    ]);
    assert.deepEqual(parseAirportRouteLabel(sep5?.find((s) => s.kind === "transit")?.label ?? ""), [
      "MEL",
      "CHC",
    ]);
    assert.ok(sep5?.some((s) => s.kind === "city" && s.city.includes("Christchurch")));
    assert.equal(sep5Paint?.primaryCity.includes("Christchurch"), true);
    assert.equal(sep5Paint?.secondaryCity, null);
  });

  it("does not paint airport names as stay locations on departure day", () => {
    const draft = {
      ...japanDraft(),
      returnLegs: [
        planeLeg({
          fromCity: "Suvarnabhumi Airport, Thailand",
          toCity: "Melbourne Airport, Australia",
          travelDate: "2026-09-04",
          arrivalDate: "2026-09-05",
          departureTime: null,
          arrivalTime: null,
        }),
      ],
    };
    const layouts = computeTravelDayLayouts(draft, {
      startDate: "2026-08-24",
      endDate: "2026-09-04",
      departureCity: trip.departureCity,
      returnCity: trip.returnCity,
    });
    const sep4 = layouts.get("2026-09-04");
    assert.ok(sep4?.length);
    assert.equal(sep4!.some((segment) => segment.kind === "city"), false);
    assert.ok(sep4!.some((segment) => segment.kind === "transit"));
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
    assert.equal(
      tripDayHasPaintableStaySlot("2026-06-20", trip, jun20, null),
      true,
    );
    assert.equal(travelLayoutPaintStart(jun20), 0);
    assert.equal(jun20!.some((segment) => segment.kind === "city"), false);
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
  it("uses 40/20/40 city-transit-city for train city changes", () => {
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
    assert.equal(jun11?.[0]?.end, 0.4);
    assert.equal(jun11?.[1]?.kind, "transit");
    assert.equal(jun11?.[1]?.label, "Train");
    assert.equal(jun11?.[1]?.start, 0.4);
    assert.equal(jun11?.[1]?.end, 0.6);
    assert.equal(jun11?.[2]?.kind, "city");
    assert.equal(jun11?.[2]?.start, 0.6);
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
  it("keeps stay city labels on checkout departure days with evening flights", () => {
    const draft = {
      outboundLegs: [],
      returnLegs: [
        planeLeg({
          fromCity: "Suvarnabhumi Airport (BKK), Thailand",
          toCity: "Melbourne Airport (MEL), Australia",
          travelDate: "2026-09-04",
          arrivalDate: "2026-09-05",
          departureTime: "21:40",
          arrivalTime: "09:25",
          flightNumber: "JQ30",
        }),
      ],
      intercityLegs: [],
      dayPlaces: [],
    };
    const layouts = computeTravelDayLayouts(draft, {
      startDate: "2026-08-23",
      endDate: "2026-09-04",
      departureCity: "Christchurch, New Zealand",
      returnCity: "Christchurch, New Zealand",
    });
    const segments = layouts.get("2026-09-04");
    assert.ok(segments?.some((s) => s.kind === "transit"));

    const day: DayPlaceDraft = {
      date: "2026-09-04",
      primaryCity: "Bangkok",
      secondaryCity: null,
      primaryShare: 0.67,
      dayType: "trip",
      includeBuffer: false,
    };

    const { segments: merged, hideMergedStayCity } = mergeTravelWithPaintedStay(segments, day);
    assert.equal(hideMergedStayCity, false);
    assert.ok(merged?.some((s) => s.kind === "transit"));
  });

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
