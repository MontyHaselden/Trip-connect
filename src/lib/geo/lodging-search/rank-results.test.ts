import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AddressSuggestion } from "@/lib/geo/google-places";

import {
  candidateMatchesStayCity,
  mapToTripCityVocabulary,
  rankAndFilterLodgingResults,
} from "./rank-results";

function suggestion(
  overrides: Partial<AddressSuggestion> & Pick<AddressSuggestion, "label">,
): AddressSuggestion {
  return {
    id: overrides.id ?? overrides.label,
    source: overrides.source ?? "google",
    ...overrides,
  };
}

describe("candidateMatchesStayCity", () => {
  it("matches exact city in sublabel", () => {
    const tier = candidateMatchesStayCity(
      suggestion({ label: "THE KNOT HIROSHIMA", sublabel: "Hiroshima, Japan" }),
      "Hiroshima",
    );
    assert.equal(tier, "exact");
  });

  it("matches metro areas like NRT and Tokyo", () => {
    const tier = candidateMatchesStayCity(
      suggestion({ label: "Narita Airport Hotel", sublabel: "Narita, Chiba" }),
      "Tokyo",
    );
    assert.equal(tier, "metro");
  });

  it("returns null for wrong city", () => {
    const tier = candidateMatchesStayCity(
      suggestion({ label: "THE KNOT TOTTORI", sublabel: "Tottori, Japan" }),
      "Hiroshima",
    );
    assert.equal(tier, null);
  });
});

describe("rankAndFilterLodgingResults", () => {
  it("prefers Hiroshima results over Tottori for THE KNOT query", () => {
    const candidates = [
      suggestion({
        label: "THE KNOT TOTTORI",
        sublabel: "Tottori, Japan",
        placeId: "tottori",
      }),
      suggestion({
        label: "THE KNOT HIROSHIMA",
        sublabel: "Hiroshima, Japan",
        placeId: "hiroshima",
      }),
    ];

    const { results, widened } = rankAndFilterLodgingResults(
      candidates,
      "THE KNOT",
      "Hiroshima",
    );

    assert.equal(widened, false);
    assert.equal(results[0]?.label, "THE KNOT HIROSHIMA");
    assert.equal(results.length, 1);
  });

  it("returns widened tier when no stay-city matches exist", () => {
    const candidates = [
      suggestion({
        label: "THE KNOT TOTTORI",
        sublabel: "Tottori, Japan",
        placeId: "tottori",
      }),
    ];

    const { results, widened } = rankAndFilterLodgingResults(
      candidates,
      "THE KNOT",
      "Hiroshima",
    );

    assert.equal(widened, true);
    assert.equal(results[0]?.matchTier, "wide");
  });

  it("ranks name similarity higher within same city", () => {
    const candidates = [
      suggestion({
        label: "Knot Hotel Annex",
        sublabel: "Hiroshima, Japan",
        placeId: "annex",
      }),
      suggestion({
        label: "THE KNOT HIROSHIMA",
        sublabel: "Hiroshima, Japan",
        placeId: "knot",
      }),
    ];

    const { results } = rankAndFilterLodgingResults(candidates, "THE KNOT", "Hiroshima");
    assert.equal(results[0]?.label, "THE KNOT HIROSHIMA");
  });
});

describe("mapToTripCityVocabulary", () => {
  it("maps metro match back to trip stay city label", () => {
    assert.equal(mapToTripCityVocabulary("Narita, Chiba", "Tokyo"), "Tokyo");
  });

  it("keeps distinct city when metros differ", () => {
    assert.equal(mapToTripCityVocabulary("Tottori, Japan", "Hiroshima"), "Tottori");
  });
});
