import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { nextCalendarRangeSelection } from "@/lib/host/setup/calendar-range-selection";
import { transportLegDateSpan } from "@/lib/host/setup/transport-block-selection";
import type { TransportLegDraft } from "@/lib/host/wizard/types";

import { daysInSelection } from "./useCalendarInteraction";

describe("calendar interaction golden flows", () => {
  it("G1 range selection builds forward-only span", () => {
    let sel = nextCalendarRangeSelection(
      { rangeStart: "", rangeEnd: "", startHalf: "full", endHalf: "full" },
      "2026-08-23",
    ).selection;
    sel = nextCalendarRangeSelection(sel, "2026-08-31").selection;
    assert.equal(sel.rangeStart, "2026-08-23");
    assert.equal(sel.rangeEnd, "2026-08-31");
  });

  it("G3 transport leg span selects corridor dates", () => {
    const leg: TransportLegDraft = {
      id: "l1",
      transportType: "plane",
      bookingStatus: "not_booked",
      travelDate: "2026-09-04",
      arrivalDate: "2026-09-04",
      departureTime: "21:00",
      arrivalTime: "23:00",
      fromCity: "BKK",
      toCity: "MEL",
      fromStation: "BKK",
      toStation: "MEL",
      operator: null,
      referenceNumber: null,
      flightNumber: "QF1",
      notes: null,
    };
    const span = transportLegDateSpan(leg);
    assert.deepEqual(span, { start: "2026-09-04", end: "2026-09-04" });
  });

  it("daysInSelection filters painted days in range", () => {
    const days = [
      { date: "2026-08-23", primaryCity: "Patong", secondaryCity: null, primaryShare: 1, dayType: "trip" as const, includeBuffer: false },
      { date: "2026-08-24", primaryCity: "Patong", secondaryCity: null, primaryShare: 1, dayType: "trip" as const, includeBuffer: false },
      { date: "2026-08-25", primaryCity: "", secondaryCity: null, primaryShare: 1, dayType: "trip" as const, includeBuffer: false },
    ];
    const slice = daysInSelection(
      { rangeStart: "2026-08-23", rangeEnd: "2026-08-24", startHalf: "full", endHalf: "full" },
      days,
    );
    assert.equal(slice.length, 2);
  });
});
