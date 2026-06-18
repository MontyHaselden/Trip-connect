import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeTripOutlineDates,
  sanitizeTripStructureDates,
} from "@/lib/host/import/sanitize-imported-dates";
import type { TripOutlineResult } from "@/lib/ai/parse-trip-outline";
import type { TripStructureResult } from "@/lib/ai/parse-trip-structure-from-document";

describe("sanitizeTripOutlineDates", () => {
  it("repairs impossible outline days before import", () => {
    const outline: TripOutlineResult = {
      name: "Euro trip",
      schoolName: "School",
      startDate: "2026-02-28",
      endDate: "2026-03-02",
      timezone: "Europe/Rome",
      destinationCountry: "Italy",
      destinationLanguage: "it",
      days: [
        { date: "2026-02-28", cityLabel: "Rome", summary: null },
        { date: "2026-02-29", cityLabel: "Rome", summary: null },
        { date: "2026-03-01", cityLabel: "Florence", summary: null },
      ],
    };

    const sanitized = sanitizeTripOutlineDates(outline);
    assert.deepEqual(
      sanitized.days.map((day) => day.date),
      ["2026-02-28", "2026-03-01"],
    );
    assert.equal(sanitized.days[0]!.cityLabel, "Rome");
  });
});

describe("sanitizeTripStructureDates", () => {
  it("repairs impossible day place dates", () => {
    const structure: TripStructureResult = {
      departureCity: "Melbourne",
      returnCity: "Melbourne",
      dayPlaces: [
        {
          date: "2026-02-29",
          primaryCity: "Rome",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip",
          includeBuffer: false,
        },
      ],
      outboundLegs: [],
      returnLegs: [],
      intercityLegs: [],
      accommodationStays: [],
    };

    const sanitized = sanitizeTripStructureDates(structure);
    assert.equal(sanitized.dayPlaces[0]!.date, "2026-02-28");
  });
});
