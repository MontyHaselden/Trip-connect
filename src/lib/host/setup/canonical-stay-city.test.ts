import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  canonicalStayCity,
  isAirportEndpoint,
  normalizeDayPlacesAirports,
} from "@/lib/host/setup/canonical-stay-city";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

function day(
  date: string,
  primaryCity: string,
  overrides: Partial<DayPlaceDraft> = {},
): DayPlaceDraft {
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

describe("isAirportEndpoint", () => {
  it("treats Haneda and Narita as airports, not Tokyo", () => {
    assert.equal(isAirportEndpoint("Haneda"), true);
    assert.equal(isAirportEndpoint("Narita"), true);
    assert.equal(isAirportEndpoint("HND"), true);
    assert.equal(isAirportEndpoint("NRT"), true);
    assert.equal(isAirportEndpoint("Tokyo"), false);
    assert.equal(isAirportEndpoint("Minato City, Tokyo"), false);
  });

  it("does not treat stay suburbs as airports", () => {
    assert.equal(isAirportEndpoint("Patong"), false);
    assert.equal(isAirportEndpoint("Osaka"), false);
  });
});

describe("canonicalStayCity", () => {
  it("uses trip context when AI painted Haneda but neighbors are Tokyo", () => {
    const dayPlaces = [
      day("2026-12-17", "Osaka"),
      day("2026-12-18", "Osaka", {
        secondaryCity: "Haneda",
        primaryShare: 0.5,
        dayType: "travel",
      }),
      day("2026-12-19", "Tokyo"),
      day("2026-12-20", "Tokyo"),
    ];

    assert.equal(
      canonicalStayCity("Haneda", { dayPlaces, date: "2026-12-18" }),
      "Tokyo",
    );
  });

  it("uses hotel city in the same metro", () => {
    assert.equal(
      canonicalStayCity("Haneda", {
        date: "2026-12-19",
        stays: [
          {
            id: "1",
            cityLabel: "Shinjuku, Tokyo",
            name: "Hotel Gracery",
            checkInDate: "2026-12-19",
            checkOutDate: "2026-12-22",
            stayType: "hotel",
          },
        ],
      }),
      "Tokyo",
    );
  });

  it("falls back to metro when no context", () => {
    assert.equal(canonicalStayCity("Narita"), "Tokyo");
  });
});

describe("normalizeDayPlacesAirports", () => {
  it("rewrites AI-imported airport splits to stay cities", () => {
    const input = [
      day("2026-12-05", "Christchurch", {
        secondaryCity: "Narita",
        primaryShare: 0.5,
        dayType: "travel",
      }),
      day("2026-12-06", "Narita", {
        secondaryCity: "Kagoshima",
        primaryShare: 0.5,
        dayType: "travel",
      }),
      day("2026-12-19", "Tokyo"),
    ];

    const normalized = normalizeDayPlacesAirports(input, {
      stays: [
        {
          id: "h1",
          cityLabel: "Tokyo",
          name: "Shinjuku Hotel",
          checkInDate: "2026-12-19",
          checkOutDate: "2026-12-22",
          stayType: "hotel",
        },
      ],
    });

    assert.equal(normalized[0]!.secondaryCity, "Tokyo");
    assert.equal(normalized[1]!.primaryCity, "Tokyo");
    assert.equal(normalized[1]!.secondaryCity, "Kagoshima");
  });

  it("keeps Tokyo as the corridor city instead of a hotel ward on the last day", () => {
    const input = [
      day("2026-12-18", "Tokyo"),
      day("2026-12-19", "Tokyo"),
      day("2026-12-20", "Tokyo"),
      day("2026-12-21", "Chuo City"),
    ];

    const normalized = normalizeDayPlacesAirports(input, {
      stays: [
        {
          id: "h1",
          cityLabel: "Chuo City, Tokyo",
          name: "Hotel Sunroute",
          checkInDate: "2026-12-18",
          checkOutDate: "2026-12-22",
          stayType: "hotel",
        },
      ],
    });

    const dec21 = normalized.find((row) => row.date === "2026-12-21");
    assert.equal(dec21?.primaryCity, "Tokyo");
  });
});
