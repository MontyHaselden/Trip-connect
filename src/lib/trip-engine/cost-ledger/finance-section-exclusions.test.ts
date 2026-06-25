import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applySectionExclusionPatch,
  filterParticipantsForFinanceSection,
  parseFinanceSectionExclusions,
} from "./finance-section-exclusions";
import type { TripCostSettingsDraft } from "./types";

function settings(exclusions: Record<string, string[]>): TripCostSettingsDraft {
  return {
    baseCurrency: "NZD",
    foreignCurrency: null,
    exchangeRate: null,
    exchangeRateDate: null,
    exchangeRateManual: false,
    financeCustomSections: [],
    financeViewGroups: [],
    financeSectionExclusions: exclusions,
  };
}

describe("parseFinanceSectionExclusions", () => {
  it("parses section maps", () => {
    assert.deepEqual(parseFinanceSectionExclusions({ transport: ["p1", "p2"] }), {
      transport: ["p1", "p2"],
    });
  });
});

describe("filterParticipantsForFinanceSection", () => {
  it("hides excluded participants for a section", () => {
    const pool = [{ id: "p1" }, { id: "p2" }];
    const filtered = filterParticipantsForFinanceSection(
      pool,
      settings({ transport: ["p2"] }),
      "transport",
    );
    assert.deepEqual(filtered.map((p) => p.id), ["p1"]);
  });
});

describe("applySectionExclusionPatch", () => {
  it("adds and removes exclusions", () => {
    let map = applySectionExclusionPatch({}, "transport", "p1", true);
    assert.deepEqual(map, { transport: ["p1"] });
    map = applySectionExclusionPatch(map, "transport", "p1", false);
    assert.deepEqual(map, {});
  });
});
