import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { TRANSPORT_CORRIDOR_LEFT_SHARE } from "@/lib/host/setup/transport-corridor";

import {
  buildParticipantCityReplacements,
  mergeParticipantLocationOverlay,
} from "./merge-participant-location-overlay";
import type { ProjectedDay } from "./types";

function mainJapanDays(): ProjectedDay[] {
  const base = {
    groupId: "main",
    accommodationLabel: null,
    transportOverlays: [],
    activities: [],
    warnings: [],
    overlayMeta: "inherit" as const,
  };

  return [
    ...["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12"].map(
      (date) => ({
        ...base,
        date,
        primaryCity: "Kagoshima",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip" as const,
      }),
    ),
    {
      ...base,
      date: "2026-12-13",
      primaryCity: "Kagoshima",
      secondaryCity: "Hiroshima",
      primaryShare: TRANSPORT_CORRIDOR_LEFT_SHARE,
      dayType: "travel" as const,
      accommodationLabel: "The Knot",
    },
  ];
}

describe("mergeParticipantLocationOverlay", () => {
  it("maps Kagoshima to Tottori and repairs the travel corridor day", () => {
    const overlay = [
      ...["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12"].map(
        (date) => ({
          date,
          primaryCity: "Tottori",
          secondaryCity: null,
          primaryShare: 1,
          dayType: "trip" as const,
          includeBuffer: false,
        }),
      ),
    ];

    const merged = mergeParticipantLocationOverlay(mainJapanDays(), overlay);
    const dec12 = merged.find((d) => d.date === "2026-12-12");
    const dec13 = merged.find((d) => d.date === "2026-12-13");

    assert.equal(dec12?.primaryCity, "Tottori");
    assert.equal(dec13?.primaryCity, "Tottori");
    assert.equal(dec13?.secondaryCity, "Hiroshima");
    assert.equal(dec13?.accommodationLabel, "The Knot");
    assert.equal(dec13?.overlayMeta, "override");
  });

  it("repairs a corrupt overlay travel day with an empty departure half", () => {
    const merged = mergeParticipantLocationOverlay(mainJapanDays(), [
      {
        date: "2026-12-13",
        primaryCity: "",
        secondaryCity: "Hiroshima",
        primaryShare: TRANSPORT_CORRIDOR_LEFT_SHARE,
        dayType: "trip",
        includeBuffer: false,
      },
      {
        date: "2026-12-12",
        primaryCity: "Tottori",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip",
        includeBuffer: false,
      },
    ]);

    const dec13 = merged.find((d) => d.date === "2026-12-13");
    assert.equal(dec13?.primaryCity, "Tottori");
    assert.equal(dec13?.secondaryCity, "Hiroshima");
  });

  it("builds replacement map from matching dates", () => {
    const replacements = buildParticipantCityReplacements(mainJapanDays(), [
      {
        date: "2026-12-10",
        primaryCity: "Tottori",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip",
        includeBuffer: false,
      },
    ]);

    assert.equal(replacements.get("kagoshima"), "Tottori");
  });
});
