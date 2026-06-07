import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  citiesMatch,
  dayNeedsCityLabel,
  formatCityLegLabel,
  intercityLegCoversChange,
  shortCity,
} from "./analyze-import-gaps.ts";

describe("analyze-import-gaps helpers", () => {
  it("shortCity strips country suffix", () => {
    assert.equal(shortCity("Tokyo, Japan"), "Tokyo");
    assert.equal(shortCity("Christchurch, New Zealand"), "Christchurch");
  });

  it("citiesMatch ignores country suffix", () => {
    assert.equal(citiesMatch("Tokyo, Japan", "Tokyo"), true);
    assert.equal(citiesMatch("Osaka, Japan", "Tokyo, Japan"), false);
  });

  it("formatCityLegLabel uses short city names", () => {
    assert.equal(
      formatCityLegLabel("Tokyo, Japan", "Osaka, Japan"),
      "Tokyo to Osaka",
    );
  });

  it("intercityLegCoversChange matches short and long city labels", () => {
    assert.equal(
      intercityLegCoversChange(
        {
          legKind: "intercity",
          travelDate: "2026-06-11",
          fromCity: "Tokyo",
          toCity: "Osaka",
          intercityFromCity: "Tokyo, Japan",
          intercityToCity: "Osaka, Japan",
        },
        "2026-06-11",
        "2026-06-12",
        "Tokyo, Japan",
        "Osaka, Japan",
      ),
      true,
    );
  });

  it("dayNeedsCityLabel skips travel days with legs or travel items", () => {
    const ctx = {
      legDates: new Set(["2026-06-03"]),
      travelItemDates: new Set(["2026-06-04"]),
    };

    assert.equal(
      dayNeedsCityLabel(
        {
          date: "2026-06-03",
          cityLabel: "TBC",
          secondaryCityLabel: null,
          dayType: "trip",
        },
        ctx,
      ),
      false,
    );

    assert.equal(
      dayNeedsCityLabel(
        {
          date: "2026-06-04",
          cityLabel: "TBC",
          secondaryCityLabel: null,
          dayType: "trip",
        },
        ctx,
      ),
      false,
    );

    assert.equal(
      dayNeedsCityLabel(
        {
          date: "2026-06-05",
          cityLabel: "TBC",
          secondaryCityLabel: null,
          dayType: "trip",
        },
        ctx,
      ),
      true,
    );
  });
});
