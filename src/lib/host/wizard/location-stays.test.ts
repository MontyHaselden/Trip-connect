import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyLocationStays,
  coalesceAdjacentStays,
  DEFAULT_HALF_SHARE,
  hasUncoveredTripDays,
  locationColor,
  locationPaletteKey,
  mergeStaysWithNewRange,
} from "@/lib/host/wizard/location-stays";
import { buildTripDayCoverageContext } from "@/lib/host/wizard/transport-day-placement";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

const trip = {
  startDate: "2026-06-15",
  endDate: "2026-06-28",
  departureCity: "Christchurch, New Zealand",
  returnCity: "Christchurch, New Zealand",
};

function emptyTripDays(): DayPlaceDraft[] {
  const days: DayPlaceDraft[] = [
    {
      date: "2026-06-14",
      primaryCity: trip.departureCity,
      secondaryCity: null,
      primaryShare: 1,
      dayType: "buffer",
      includeBuffer: false,
    },
  ];
  for (let d = 15; d <= 28; d++) {
    const iso = `2026-06-${String(d).padStart(2, "0")}`;
    days.push({
      date: iso,
      primaryCity: "",
      secondaryCity: null,
      primaryShare: 1,
      dayType: d === 28 ? "return" : "trip",
      includeBuffer: false,
    });
  }
  return days;
}

describe("applyLocationStays", () => {
  it("uses half of the last day for multi-day stays so the next city can be painted", () => {
    const days = applyLocationStays(
      emptyTripDays(),
      [{ location: "Tokyo", startDate: "2026-06-16", endDate: "2026-06-18" }],
      trip,
    );
    const jun16 = days.find((d) => d.date === "2026-06-16");
    const jun17 = days.find((d) => d.date === "2026-06-17");
    const jun18 = days.find((d) => d.date === "2026-06-18");

    assert.equal(jun16?.primaryCity, "");
    assert.equal(jun16?.secondaryCity, "Tokyo");
    assert.equal(jun16?.primaryShare, DEFAULT_HALF_SHARE);
    assert.equal(jun17?.primaryCity, "Tokyo");
    assert.equal(jun17?.primaryShare, 1);
    assert.equal(jun18?.primaryCity, "Tokyo");
    assert.equal(jun18?.primaryShare, DEFAULT_HALF_SHARE);
    assert.equal(jun18?.secondaryCity, null);
  });

  it("uses half of the first day when the previous trip day has no stay", () => {
    const days = applyLocationStays(
      emptyTripDays(),
      [{ location: "Osaka", startDate: "2026-06-18", endDate: "2026-06-22" }],
      trip,
    );
    const jun18 = days.find((d) => d.date === "2026-06-18")!;
    assert.equal(jun18.primaryCity, "");
    assert.equal(jun18.secondaryCity, "Osaka");
    assert.equal(jun18.primaryShare, DEFAULT_HALF_SHARE);
  });

  it("keeps the first day full when the previous day ends with the departing city", () => {
    const days = applyLocationStays(
      emptyTripDays(),
      [
        { location: "Kyoto", startDate: "2026-06-16", endDate: "2026-06-17" },
        { location: "Osaka", startDate: "2026-06-18", endDate: "2026-06-22" },
      ],
      trip,
    );
    const jun17 = days.find((d) => d.date === "2026-06-17")!;
    const jun18 = days.find((d) => d.date === "2026-06-18")!;
    assert.equal(jun17.primaryShare, DEFAULT_HALF_SHARE);
    assert.equal(jun18.primaryCity, "Osaka");
    assert.equal(jun18.primaryShare, 1);
  });

  it("uses a full day after a crossover into the same city", () => {
    const days = applyLocationStays(
      emptyTripDays(),
      [
        { location: "Tokyo", startDate: "2026-06-15", endDate: "2026-06-17" },
        { location: "Osaka", startDate: "2026-06-17", endDate: "2026-06-22" },
      ],
      trip,
    );
    const jun18 = days.find((d) => d.date === "2026-06-18")!;
    assert.equal(jun18.primaryCity, "Osaka");
    assert.equal(jun18.secondaryCity, null);
    assert.equal(jun18.primaryShare, 1);
  });

  it("keeps a single-day stay full", () => {
    const days = applyLocationStays(
      emptyTripDays(),
      [{ location: "Tokyo", startDate: "2026-06-18", endDate: "2026-06-18" }],
      trip,
    );
    const jun18 = days.find((d) => d.date === "2026-06-18");
    assert.equal(jun18?.primaryCity, "Tokyo");
    assert.equal(jun18?.primaryShare, 1);
  });
});

describe("hasUncoveredTripDays", () => {
  it("treats flight-only days as covered", () => {
    const days = emptyTripDays();
    for (let d = 15; d <= 27; d++) {
      const iso = `2026-06-${String(d).padStart(2, "0")}`;
      const day = days.find((row) => row.date === iso)!;
      day.primaryCity = "Tokyo";
      day.primaryShare = 1;
      day.secondaryCity = null;
    }
    const jun28 = days.find((d) => d.date === "2026-06-28");
    assert.ok(jun28);
    jun28!.primaryCity = "";
    jun28!.secondaryCity = null;
    assert.equal(
      hasUncoveredTripDays(days, trip.startDate, trip.endDate, {
        flightDepartureDates: new Set(["2026-06-28"]),
      }),
      false,
    );
  });

  it("still requires completely blank trip days to be filled", () => {
    const days = applyLocationStays(
      emptyTripDays(),
      [
        { location: "Osaka", startDate: "2026-06-18", endDate: "2026-06-22" },
        { location: "Tokyo", startDate: "2026-06-25", endDate: "2026-06-28" },
      ],
      trip,
    );
    assert.equal(hasUncoveredTripDays(days, trip.startDate, trip.endDate), true);
  });

  it("treats half-painted days as uncovered", () => {
    const days = emptyTripDays();
    const jun19 = days.find((d) => d.date === "2026-06-19")!;
    jun19.primaryCity = "Osaka";
    jun19.primaryShare = DEFAULT_HALF_SHARE;
    assert.equal(hasUncoveredTripDays(days, trip.startDate, trip.endDate), true);
  });

  it("treats arrival-day stay paint after late travel as covered", () => {
    const day: DayPlaceDraft = {
      date: "2026-06-16",
      primaryCity: "",
      secondaryCity: "Tokyo",
      primaryShare: 0.75,
      dayType: "travel",
      includeBuffer: false,
    };
    assert.equal(
      hasUncoveredTripDays([day], "2026-06-16", "2026-06-16", {
        hasPaintableStaySlot: () => false,
      }),
      false,
    );
  });

  it("treats stay departure halves as covered when travel fills the open side", () => {
    const days = applyLocationStays(
      emptyTripDays(),
      [
        { location: "Tokyo", startDate: "2026-06-16", endDate: "2026-06-18" },
        { location: "Osaka", startDate: "2026-06-18", endDate: "2026-06-28" },
      ],
      trip,
    );
    const ctx = buildTripDayCoverageContext(
      {
        outboundLegs: [],
        returnLegs: [
          {
            id: "ret",
            transportType: "plane",
            bookingStatus: "not_booked",
            travelDate: "2026-06-28",
            arrivalDate: null,
            fromCity: "Tokyo",
            toCity: trip.returnCity,
            departureTime: "14:00",
            arrivalTime: "08:00",
            fromStation: null,
            toStation: null,
            operator: null,
            referenceNumber: null,
            flightNumber: null,
            notes: null,
          },
        ],
        intercityLegs: [],
        dayPlaces: days,
      },
      trip,
    );
    // First stay is Jun 16 — start date has no outbound flight and should not require home paint.
    assert.equal(hasUncoveredTripDays(days, "2026-06-16", trip.endDate, ctx), false);
  });
});

describe("coalesceAdjacentStays", () => {
  it("merges same-city stays separated by one day", () => {
    const merged = coalesceAdjacentStays([
      { location: "Kyoto, Japan", startDate: "2026-06-04", endDate: "2026-06-05" },
      { location: "Kyoto, Japan", startDate: "2026-06-06", endDate: "2026-06-10" },
    ]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.startDate, "2026-06-04");
    assert.equal(merged[0]!.endDate, "2026-06-10");
  });
});

describe("locationColor", () => {
  it("uses the same palette for city label variants", () => {
    assert.equal(locationPaletteKey("Bangkok"), locationPaletteKey("Bangkok, Thailand"));
    assert.equal(locationColor("Bangkok"), locationColor("Bangkok, Thailand"));
    assert.equal(
      locationColor("Christchurch, New Zealand"),
      locationColor("Christchurch"),
    );
  });
});

describe("mergeStaysWithNewRange", () => {
  it("bridges two same-city stays when filling the gap day", () => {
    const existing = [
      { location: "Kyoto, Japan", startDate: "2026-06-04", endDate: "2026-06-04" },
      { location: "Kyoto, Japan", startDate: "2026-06-06", endDate: "2026-06-10" },
    ];
    const merged = mergeStaysWithNewRange(existing, "Kyoto, Japan", "2026-06-05", "2026-06-05");
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.startDate, "2026-06-04");
    assert.equal(merged[0]!.endDate, "2026-06-10");
  });
});
