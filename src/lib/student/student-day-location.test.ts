import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatStudentInCityLabel,
  studentDayLocationLabel,
} from "./student-day-location";

describe("studentDayLocationLabel", () => {
  it("prefers calendar label over TBC city", () => {
    assert.equal(
      studentDayLocationLabel({
        cityLabel: "TBC",
        calendarLabel: "Christchurch",
      }),
      "Christchurch",
    );
  });

  it("formats travel days", () => {
    assert.equal(
      studentDayLocationLabel({
        cityLabel: "Kyoto",
        calendarLabel: null,
        dayType: "travel",
        secondaryCityLabel: "Tokyo",
      }),
      "Kyoto → Tokyo",
    );
  });
});

describe("formatStudentInCityLabel", () => {
  it("skips placeholder cities", () => {
    assert.equal(formatStudentInCityLabel("TBC"), null);
    assert.equal(formatStudentInCityLabel("Christchurch"), "In Christchurch");
  });
});
