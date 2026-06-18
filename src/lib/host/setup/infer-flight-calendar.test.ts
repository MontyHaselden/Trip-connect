import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  inferDayPlacesFromFlightLegs,
  metroDisplayLabel,
  stripOrphanFlightPaint,
} from "@/lib/host/setup/infer-flight-calendar";
import { departureDayCityEndShare } from "@/lib/host/wizard/transport-day-placement";
import { newId } from "@/lib/host/wizard/types";

describe("departureDayCityEndShare", () => {
  it("reserves at least one third of the day for evening departures", () => {
    const raw = 21 / 24 + 40 / 1440;
    assert.ok(Math.abs(departureDayCityEndShare("21:40", raw) - 2 / 3) < 0.02);
    assert.ok(Math.abs(departureDayCityEndShare("09:00", 9 / 24) - 9 / 24) < 0.02);
  });
});

describe("metroDisplayLabel", () => {
  it("resolves airport labels to metro cities", () => {
    assert.equal(metroDisplayLabel("Melbourne Airport (MEL)"), "Melbourne");
    assert.equal(metroDisplayLabel("Christchurch Airport (CHC)"), "Christchurch");
  });
});

describe("inferDayPlacesFromFlightLegs", () => {
  it("paints origin before departure time and destination on arrival morning", () => {
    const legs = [
      {
        id: newId(),
        transportType: "plane" as const,
        bookingStatus: "not_booked" as const,
        travelDate: "2026-08-21",
        arrivalDate: "2026-08-22",
        departureTime: "21:40",
        arrivalTime: "09:25",
        fromCity: "Christchurch Airport (CHC)",
        toCity: "Melbourne Airport (MEL)",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "JQ30",
        notes: null,
      },
    ];

    const painted = inferDayPlacesFromFlightLegs([], legs);
    const dep = painted.find((d) => d.date === "2026-08-21");
    const arr = painted.find((d) => d.date === "2026-08-22");

    assert.equal(dep?.primaryCity, "Christchurch");
    assert.ok(Math.abs((dep?.primaryShare ?? 0) - 2 / 3) < 0.02);
    assert.equal(arr?.primaryCity, "Melbourne");
    assert.ok(Math.abs((arr?.primaryShare ?? 0) - 9 / 24 - 25 / 1440) < 0.02);
    assert.equal(painted.find((d) => d.date === "2026-08-23"), undefined);
  });

  it("paints same-day crossover with origin and destination halves", () => {
    const legs = [
      {
        id: newId(),
        transportType: "plane" as const,
        bookingStatus: "not_booked" as const,
        travelDate: "2026-08-21",
        arrivalDate: "2026-08-21",
        departureTime: "09:00",
        arrivalTime: "14:00",
        fromCity: "Christchurch Airport (CHC)",
        toCity: "Melbourne Airport (MEL)",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "NZ123",
        notes: null,
      },
    ];

    const painted = inferDayPlacesFromFlightLegs([], legs);
    const day = painted.find((d) => d.date === "2026-08-21");
    assert.equal(day?.primaryCity, "Christchurch");
    assert.equal(day?.secondaryCity, "Melbourne");
    assert.ok(Math.abs((day?.primaryShare ?? 0) - 9 / 24) < 0.02);
  });

  it("cuts out same-day connection hubs and paints origin to final destination", () => {
    const legs = [
      {
        id: "leg-1",
        transportType: "plane" as const,
        bookingStatus: "not_booked" as const,
        travelDate: "2026-08-23",
        arrivalDate: "2026-08-23",
        departureTime: "06:20",
        arrivalTime: "10:05",
        fromCity: "Christchurch Airport (CHC), New Zealand",
        toCity: "Melbourne Airport (MEL), Australia",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "JQ172",
        notes: null,
      },
      {
        id: "leg-2",
        transportType: "plane" as const,
        bookingStatus: "not_booked" as const,
        travelDate: "2026-08-23",
        arrivalDate: "2026-08-23",
        departureTime: "14:50",
        arrivalTime: "20:40",
        fromCity: "Melbourne Airport (MEL), Australia",
        toCity: "Phuket International Airport (HKT), Thailand",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "JQ17",
        notes: null,
      },
    ];

    const painted = inferDayPlacesFromFlightLegs([], legs);
    const day = painted.find((d) => d.date === "2026-08-23");

    assert.equal(day?.primaryCity, "Christchurch");
    assert.equal(day?.secondaryCity, "Phuket");
    assert.ok(Math.abs((day?.primaryShare ?? 0) - (6 / 24 + 20 / 1440)) < 0.02);
  });

  it("keeps the hub visible when a named stay covers the connection day", () => {
    const legs = [
      {
        id: "leg-1",
        transportType: "plane" as const,
        bookingStatus: "not_booked" as const,
        travelDate: "2026-08-23",
        arrivalDate: "2026-08-23",
        departureTime: "06:20",
        arrivalTime: "10:05",
        fromCity: "Christchurch Airport (CHC), New Zealand",
        toCity: "Melbourne Airport (MEL), Australia",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "JQ172",
        notes: null,
      },
      {
        id: "leg-2",
        transportType: "plane" as const,
        bookingStatus: "not_booked" as const,
        travelDate: "2026-08-23",
        arrivalDate: "2026-08-23",
        departureTime: "14:50",
        arrivalTime: "20:40",
        fromCity: "Melbourne Airport (MEL), Australia",
        toCity: "Phuket International Airport (HKT), Thailand",
        fromStation: null,
        toStation: null,
        operator: null,
        referenceNumber: null,
        flightNumber: "JQ17",
        notes: null,
      },
    ];

    const painted = inferDayPlacesFromFlightLegs([], legs, {
      stays: [
        {
          id: "stay-mel",
          cityLabel: "Melbourne, Australia",
          stayType: "hotel",
          name: "Conference hotel",
          url: null,
          address: null,
          phone: null,
          checkInDate: "2026-08-23",
          checkOutDate: "2026-08-23",
          notes: null,
          isHomestayGroup: false,
        },
      ],
    });
    const day = painted.find((d) => d.date === "2026-08-23");

    assert.equal(day?.primaryCity, "Christchurch");
    assert.equal(day?.secondaryCity, "Melbourne, Australia");
  });

  it("strips hub city from overnight departure days without a stay at the hub", () => {
    const legs = [
      {
        id: "jq30",
        transportType: "plane" as const,
        bookingStatus: "not_booked" as const,
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
    ];
    const polluted = [
      {
        date: "2026-09-04",
        primaryCity: "Bangkok",
        secondaryCity: "Melbourne",
        primaryShare: 0.5,
        dayType: "trip" as const,
        includeBuffer: false,
      },
    ];
    const fixed = inferDayPlacesFromFlightLegs(polluted, legs);
    const sep4 = fixed.find((d) => d.date === "2026-09-04");
    assert.equal(sep4?.primaryCity, "Bangkok");
    assert.equal(sep4?.secondaryCity, null);
    assert.ok(Math.abs((sep4?.primaryShare ?? 0) - 2 / 3) < 0.02);
  });

  it("paints hub-to-home crossover on overnight return connection day", () => {
    const legs = [
      {
        id: "jq30",
        transportType: "plane" as const,
        bookingStatus: "not_booked" as const,
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
        id: "jq171",
        transportType: "plane" as const,
        bookingStatus: "not_booked" as const,
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

    const painted = inferDayPlacesFromFlightLegs([], legs);
    const sep5 = painted.find((d) => d.date === "2026-09-05");

    assert.ok(sep5?.primaryCity.includes("Christchurch"));
    assert.equal(sep5?.secondaryCity, null);
    assert.ok(Math.abs((sep5?.primaryShare ?? 0) - 16 / 24 - 25 / 1440) < 0.02);
  });

  it("clears flight paint when the leg is removed", () => {
    const leg = {
      id: newId(),
      transportType: "plane" as const,
      bookingStatus: "not_booked" as const,
      travelDate: "2026-08-19",
      arrivalDate: "2026-08-19",
      departureTime: "08:20",
      arrivalTime: "10:05",
      fromCity: "Christchurch Airport (CHC)",
      toCity: "Melbourne Airport (MEL)",
      fromStation: null,
      toStation: null,
      operator: null,
      referenceNumber: null,
      flightNumber: "JQ172",
      notes: null,
    };

    const painted = inferDayPlacesFromFlightLegs([], [leg]);
    const aug19 = painted.find((d) => d.date === "2026-08-19");
    assert.equal(aug19?.primaryCity, "Christchurch");
    assert.equal(aug19?.secondaryCity, "Melbourne");

    const cleared = stripOrphanFlightPaint(painted, []);
    assert.equal(cleared.find((d) => d.date === "2026-08-19"), undefined);
  });

  it("preserves host-painted gap days beyond named stays", () => {
    const cleared = stripOrphanFlightPaint(
      [
        {
          date: "2026-07-12",
          primaryCity: "Paris, France",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
      [],
      [
        {
          id: "stay",
          cityLabel: "Bangkok",
          stayType: "hotel",
          name: "Centre Point Plus",
          url: null,
          address: null,
          phone: null,
          checkInDate: "2026-07-06",
          checkOutDate: "2026-07-10",
          notes: null,
          isHomestayGroup: false,
          multipleInCity: false,
        },
      ],
    );
    assert.equal(cleared[0]?.primaryCity, "Paris, France");
  });
});
