import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dedupeTransportLegs,
  fillGapsBetweenLocationStays,
  fillSparseCalendarAnchors,
  filterInvalidTransportLegs,
  filterMisplacedHomeDirectionLegs,
  mergeImportedDayPlacesWithOutline,
  reconcileImportedDayPlacesWithFlights,
  sanitizeImportedDayPlaces,
} from "@/lib/host/import/sanitize-imported-locations";
import type { DayPlaceDraft, TransportLegDraft } from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";

function day(date: string, primaryCity: string, overrides: Partial<DayPlaceDraft> = {}): DayPlaceDraft {
  return {
    date,
    primaryCity,
    secondaryCity: null,
    primaryShare: 1,
    dayType: "trip",
    includeBuffer: false,
    ...overrides,
  };
}

describe("sanitizeImportedDayPlaces", () => {
  it("converts solo transit paints on return days into travel splits", () => {
    const places = sanitizeImportedDayPlaces(
      [
        day("2026-09-03", "Bangkok"),
        day("2026-09-04", "Melbourne"),
        day("2026-09-05", "Christchurch"),
      ],
      {
        departureCity: "Christchurch",
        returnCity: "Christchurch",
        startDate: "2026-08-23",
        endDate: "2026-09-05",
      },
    );

    assert.deepEqual(places[1], {
      date: "2026-09-04",
      primaryCity: "Bangkok",
      secondaryCity: "Melbourne",
      primaryShare: 0.5,
      dayType: "travel",
      includeBuffer: false,
    });
    assert.deepEqual(places[2], {
      date: "2026-09-05",
      primaryCity: "Melbourne",
      secondaryCity: "Christchurch",
      primaryShare: 0.5,
      dayType: "travel",
      includeBuffer: false,
    });
  });
});

describe("mergeImportedDayPlacesWithOutline", () => {
  it("fills calendar days from outline when structure only has arrival anchors", () => {
    const outline = [
      { date: "2026-07-17", cityLabel: "London" },
      { date: "2026-07-18", cityLabel: "London" },
      { date: "2026-07-19", cityLabel: "London" },
      { date: "2026-07-20", cityLabel: "Pisa" },
      { date: "2026-07-21", cityLabel: "La Spezia" },
    ];
    const structure = [
      day("2026-07-17", "Christchurch", {
        secondaryCity: "London",
        primaryShare: 0.5,
        dayType: "travel",
      }),
      day("2026-07-20", "Pisa"),
    ];

    const merged = mergeImportedDayPlacesWithOutline(structure, outline);
    const filled = fillGapsBetweenLocationStays(merged, {
      startDate: "2026-07-17",
      endDate: "2026-07-21",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
    });

    assert.equal(filled.find((d) => d.date === "2026-07-18")?.primaryCity, "London");
    assert.equal(filled.find((d) => d.date === "2026-07-19")?.primaryCity, "London");
    assert.equal(filled.find((d) => d.date === "2026-07-17")?.dayType, "travel");
  });
});

describe("fillSparseCalendarAnchors", () => {
  it("fills empty days between arrival in a city and departure travel from that city", () => {
    const places: DayPlaceDraft[] = [
      day("2026-12-16", "Kyoto"),
      day("2026-12-17", "Kyoto"),
      day("2026-12-18", "Kyoto"),
      day("2026-12-19", "Kyoto", {
        secondaryCity: "Tokyo",
        primaryShare: 0.5,
        dayType: "travel",
      }),
      day("2026-12-20", ""),
      day("2026-12-21", ""),
      day("2026-12-22", "Tokyo", {
        secondaryCity: "Christchurch",
        primaryShare: 0.5,
        dayType: "travel",
      }),
    ];

    const filled = fillSparseCalendarAnchors(places, {
      startDate: "2026-12-16",
      endDate: "2026-12-22",
      departureCity: "Christchurch",
      returnCity: "Christchurch",
    });

    assert.equal(filled.find((d) => d.date === "2026-12-20")?.primaryCity, "Tokyo");
    assert.equal(filled.find((d) => d.date === "2026-12-21")?.primaryCity, "Tokyo");
    assert.equal(filled.find((d) => d.date === "2026-12-22")?.dayType, "travel");
  });
});

describe("reconcileImportedDayPlacesWithFlights", () => {
  it("removes Melbourne as a location when it is only a flight connection hub", () => {
    const legs = [
      {
        id: newId(),
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
        id: newId(),
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

    const aiPlaces = sanitizeImportedDayPlaces(
      [
        day("2026-09-03", "Bangkok"),
        day("2026-09-04", "Melbourne"),
        day("2026-09-05", "Christchurch"),
      ],
      {
        departureCity: "Christchurch",
        returnCity: "Christchurch",
        startDate: "2026-08-23",
        endDate: "2026-09-05",
      },
    );

    const reconciled = reconcileImportedDayPlacesWithFlights(aiPlaces, legs);
    const sep4 = reconciled.find((d) => d.date === "2026-09-04");
    const sep5 = reconciled.find((d) => d.date === "2026-09-05");

    assert.equal(sep4?.primaryCity.includes("Bangkok"), true);
    assert.equal(sep4?.secondaryCity, null);
    assert.equal(sep5?.primaryCity.includes("Christchurch"), true);
    assert.equal(sep5?.secondaryCity, null);
    assert.ok(!reconciled.some((d) => d.primaryCity.includes("Melbourne") || d.secondaryCity?.includes("Melbourne")));
  });
});

describe("filterMisplacedHomeDirectionLegs", () => {
  it("drops return-direction leg AI placed on trip start", () => {
    const leg = (from: string, to: string, date: string): TransportLegDraft => ({
      id: newId(),
      transportType: "plane",
      bookingStatus: "not_booked",
      travelDate: date,
      arrivalDate: null,
      departureTime: null,
      arrivalTime: null,
      fromCity: from,
      toCity: to,
      fromStation: null,
      toStation: null,
      operator: null,
      referenceNumber: null,
      flightNumber: null,
      notes: null,
    });

    const ctx = {
      departureCity: "Christchurch",
      returnCity: "Christchurch",
      startDate: "2026-08-23",
      endDate: "2026-09-05",
    };

    const filtered = filterMisplacedHomeDirectionLegs(
      [leg("Melbourne Airport (MEL)", "Christchurch Airport (CHC)", "2026-08-23")],
      ctx,
    );
    assert.equal(filtered.length, 0);

    const kept = filterMisplacedHomeDirectionLegs(
      [leg("Melbourne Airport (MEL)", "Christchurch Airport (CHC)", "2026-09-05")],
      ctx,
    );
    assert.equal(kept.length, 1);
  });
});

describe("sanitizeImportedTransport", () => {
  it("drops same-city legs and dedupes identical routes", () => {
    const leg = (from: string, to: string, date: string): TransportLegDraft => ({
      id: newId(),
      transportType: "plane",
      bookingStatus: "not_booked",
      travelDate: date,
      arrivalDate: null,
      departureTime: null,
      arrivalTime: null,
      fromCity: from,
      toCity: to,
      fromStation: null,
      toStation: null,
      operator: null,
      referenceNumber: null,
      flightNumber: null,
      notes: null,
    });

    const filtered = filterInvalidTransportLegs([
      leg("Phuket", "Phuket", "2026-08-31"),
      leg("Phuket", "Bangkok", "2026-08-31"),
    ]);
    assert.equal(filtered.length, 1);

    const deduped = dedupeTransportLegs([
      leg("Christchurch", "Melbourne", "2026-08-23"),
      leg("Christchurch", "Melbourne", "2026-08-23"),
    ]);
    assert.equal(deduped.length, 1);
  });
});
