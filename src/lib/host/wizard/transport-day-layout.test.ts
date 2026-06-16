import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseAirportRouteLabel } from "@/lib/geo/airport-codes";
import {
  bangkokStay,
  haseldenIntercityLeg,
  patongStay,
} from "@/lib/host/setup/calendar-fixtures";
import {
  MAJOR_TRAVEL_DEST_START,
  MAJOR_TRAVEL_ORIGIN_END,
  MAJOR_TRAVEL_TRANSIT_END,
  MAJOR_TRAVEL_TRANSIT_START,
  TRANSPORT_CORRIDOR_LEFT_SHARE,
  TRANSPORT_CORRIDOR_RIGHT_START,
} from "@/lib/host/setup/transport-corridor";
import { computeTravelDayLayouts } from "@/lib/host/wizard/transport-day-placement";
import { newId } from "@/lib/host/wizard/types";
import type { DayPlaceDraft, TransportLegDraft } from "@/lib/host/wizard/types";

describe("computeTravelDayLayouts outbound crossover", () => {
  it("uses wide stack layout with airport route for same-day connections", () => {
    const chcMel: TransportLegDraft = {
      id: newId(),
      transportType: "plane",
      bookingStatus: "not_booked",
      travelDate: "2026-08-23",
      arrivalDate: "2026-08-23",
      departureTime: "08:00",
      arrivalTime: "11:00",
      fromCity: "Christchurch Airport (CHC), New Zealand",
      toCity: "Melbourne Airport (MEL), Australia",
      fromStation: null,
      toStation: null,
      operator: null,
      referenceNumber: null,
      flightNumber: "JQ123",
      notes: null,
    };
    const melHkt: TransportLegDraft = {
      id: newId(),
      transportType: "plane",
      bookingStatus: "not_booked",
      travelDate: "2026-08-23",
      arrivalDate: "2026-08-23",
      departureTime: "13:00",
      arrivalTime: "19:00",
      fromCity: "Melbourne Airport (MEL), Australia",
      toCity: "Phuket International Airport (HKT), Thailand",
      fromStation: null,
      toStation: null,
      operator: null,
      referenceNumber: null,
      flightNumber: "JQ456",
      notes: null,
    };

    const dayPlaces: DayPlaceDraft[] = [
      {
        date: "2026-08-23",
        primaryCity: "Christchurch, New Zealand",
        secondaryCity: "Patong, Thailand",
        primaryShare: 0.25,
        dayType: "travel",
        includeBuffer: false,
      },
    ];

    const layouts = computeTravelDayLayouts(
      { outboundLegs: [chcMel, melHkt], returnLegs: [], intercityLegs: [], dayPlaces },
      {
        startDate: "2026-08-23",
        endDate: "2026-09-04",
        departureCity: "Christchurch, New Zealand",
        returnCity: "Christchurch, New Zealand",
      },
      { stays: [patongStay({ checkInDate: "2026-08-23", checkOutDate: "2026-08-31" })] },
    );

    const segments = layouts.get("2026-08-23");
    assert.ok(segments?.length === 3);
    assert.equal(segments?.[0]?.kind, "city");
    assert.equal(segments?.[1]?.kind, "transit");
    assert.equal(segments?.[2]?.kind, "city");
    assert.equal(segments?.[0]?.end, MAJOR_TRAVEL_ORIGIN_END);
    assert.equal(segments?.[1]?.start, MAJOR_TRAVEL_TRANSIT_START);
    assert.equal(segments?.[1]?.end, MAJOR_TRAVEL_TRANSIT_END);
    assert.equal(segments?.[2]?.start, MAJOR_TRAVEL_DEST_START);
    assert.equal(segments?.[0]?.colorOnly, true);
    assert.equal(segments?.[2]?.colorOnly, true);
    assert.ok(segments?.[2]?.kind === "city" && segments[2].city === "Patong");
    assert.deepEqual(parseAirportRouteLabel(segments?.[1]?.label ?? ""), ["CHC", "MEL", "HKT"]);
  });

  it("uses one stacked route on departure day for overnight home connections", () => {
    const legs: TransportLegDraft[] = [
      {
        id: newId(),
        transportType: "plane",
        bookingStatus: "not_booked",
        travelDate: "2026-09-04",
        arrivalDate: "2026-09-05",
        departureTime: "21:40",
        arrivalTime: "09:25",
        fromCity: "Suvarnabhumi Airport (BKK), Thailand",
        toCity: "Melbourne Airport (MEL), Australia",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "JQ30",
        notes: null,
      },
      {
        id: newId(),
        transportType: "plane",
        bookingStatus: "not_booked",
        travelDate: "2026-09-05",
        arrivalDate: "2026-09-05",
        departureTime: "11:05",
        arrivalTime: "16:25",
        fromCity: "Melbourne Airport (MEL), Australia",
        toCity: "Christchurch Airport (CHC), New Zealand",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "JQ171",
        notes: null,
      },
    ];

    const layouts = computeTravelDayLayouts(
      { outboundLegs: [], returnLegs: [], intercityLegs: legs, dayPlaces: [] },
      {
        startDate: "2026-08-23",
        endDate: "2026-09-05",
        departureCity: "Christchurch, New Zealand",
        returnCity: "Christchurch, New Zealand",
      },
    );

    const sep4 = layouts.get("2026-09-04");
    const sep5 = layouts.get("2026-09-05");
    assert.deepEqual(parseAirportRouteLabel(sep4?.find((s) => s.kind === "transit")?.label ?? ""), [
      "BKK",
      "MEL",
    ]);
    assert.deepEqual(parseAirportRouteLabel(sep5?.find((s) => s.kind === "transit")?.label ?? ""), [
      "MEL",
      "CHC",
    ]);
    assert.ok(sep5?.some((s) => s.kind === "city" && s.city.includes("Christchurch")));
  });

  it("uses 40/20/40 corridor for short intercity hops", () => {
    const intercity = haseldenIntercityLeg();
    const dayPlaces: DayPlaceDraft[] = [
      {
        date: "2026-08-31",
        primaryCity: "Patong",
        secondaryCity: "Bangkok",
        primaryShare: TRANSPORT_CORRIDOR_LEFT_SHARE,
        dayType: "travel",
        includeBuffer: false,
      },
    ];

    const layouts = computeTravelDayLayouts(
      { outboundLegs: [], returnLegs: [], intercityLegs: [intercity], dayPlaces },
      {
        startDate: "2026-08-23",
        endDate: "2026-09-04",
        departureCity: "Christchurch, New Zealand",
        returnCity: "Christchurch, New Zealand",
      },
      {
        stays: [
          patongStay({ checkOutDate: "2026-08-31" }),
          bangkokStay({ checkInDate: "2026-08-31", checkOutDate: "2026-09-04" }),
        ],
      },
    );

    const segments = layouts.get("2026-08-31");
    assert.ok(segments?.length === 3);
    assert.equal(segments?.[0]?.end, TRANSPORT_CORRIDOR_LEFT_SHARE);
    assert.equal(segments?.[1]?.start, TRANSPORT_CORRIDOR_LEFT_SHARE);
    assert.equal(segments?.[1]?.end, TRANSPORT_CORRIDOR_RIGHT_START);
    assert.equal(segments?.[2]?.start, TRANSPORT_CORRIDOR_RIGHT_START);
    assert.deepEqual(parseAirportRouteLabel(segments?.[1]?.label ?? ""), ["HKT", "DMK"]);
  });
});
