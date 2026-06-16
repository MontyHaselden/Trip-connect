import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  accommodationLocationConflict,
  currentAccommodationLocationLabel,
  currentDayLocationLabel,
  effectiveDayPlacesForLocationCheck,
} from "@/lib/host/setup/accommodation-location-prompt";
import { bangkokStay, patongStay } from "@/lib/host/setup/calendar-fixtures";
import type { TripSetupState } from "@/lib/host/setup/types";
import type { DayPlaceDraft } from "@/lib/host/wizard/types";

describe("accommodation-location-prompt", () => {
  it("detects conflict when current and proposed differ", () => {
    const conflict = accommodationLocationConflict("Amphoe Kathu", "Patong");
    assert.deepEqual(conflict, { current: "Amphoe Kathu", proposed: "Patong" });
    assert.equal(accommodationLocationConflict("Patong", "Patong"), null);
  });

  it("returns empty when no days in range have location paint", () => {
    const days: DayPlaceDraft[] = [
      {
        date: "2026-08-31",
        primaryCity: "",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip",
        includeBuffer: false,
      },
    ];
    assert.equal(
      currentDayLocationLabel(days, "2026-08-31", "2026-09-04", "full"),
      "",
    );
    assert.equal(accommodationLocationConflict("", "Bangkok"), null);
  });

  it("skips location prompt when selection is past a stay checkout edge", () => {
    const state: TripSetupState = {
      basics: {
        name: "Trip",
        startDate: "2000-01-01",
        endDate: "2000-01-01",
        departureCity: "",
        returnCity: "",
        destinationCountries: [],
        timezone: "Pacific/Auckland",
        schoolName: "",
      },
      mainGroupId: "main",
      groups: [],
      dayPlacesByGroupId: { main: [] },
      outboundLegs: [],
      returnLegs: [],
      intercityLegs: [],
      accommodationStays: [
        patongStay({ checkInDate: "2026-08-23", checkOutDate: "2026-09-01" }),
      ],
      activities: [],
      overlayOps: [],
    };

    const current = currentAccommodationLocationLabel(
      state,
      "2026-08-31",
      "2026-09-04",
      "full",
    );
    assert.equal(current, "");
    assert.equal(accommodationLocationConflict(current, "bangkok"), null);
  });

  it("skips location prompt on empty days after an existing stay", () => {
    const state: TripSetupState = {
      basics: {
        name: "Trip",
        startDate: "2000-01-01",
        endDate: "2000-01-01",
        departureCity: "",
        returnCity: "",
        destinationCountries: [],
        timezone: "Pacific/Auckland",
        schoolName: "",
      },
      mainGroupId: "main",
      groups: [],
      dayPlacesByGroupId: { main: [] },
      outboundLegs: [],
      returnLegs: [],
      intercityLegs: [],
      accommodationStays: [
        patongStay({ checkInDate: "2026-08-22", checkOutDate: "2026-08-28" }),
      ],
      activities: [],
      overlayOps: [],
    };

    const current = currentAccommodationLocationLabel(
      state,
      "2026-08-31",
      "2026-09-04",
      "full",
    );
    assert.equal(current, "");
    assert.equal(accommodationLocationConflict(current, "Bangkok"), null);
  });

  it("reads checkout-morning location from derived calendar paint", () => {
    const state: TripSetupState = {
      basics: {
        name: "Trip",
        startDate: "2000-01-01",
        endDate: "2000-01-01",
        departureCity: "",
        returnCity: "",
        destinationCountries: [],
        timezone: "Pacific/Auckland",
        schoolName: "",
      },
      mainGroupId: "main",
      groups: [],
      dayPlacesByGroupId: { main: [] },
      outboundLegs: [],
      returnLegs: [],
      intercityLegs: [],
      accommodationStays: [
        bangkokStay({ checkInDate: "2026-08-31", checkOutDate: "2026-09-03" }),
      ],
      activities: [],
      overlayOps: [],
    };

    const current = currentAccommodationLocationLabel(
      state,
      "2026-09-03",
      "2026-09-03",
      "left",
    );
    assert.equal(current, "Bangkok");
  });

  it("reads current location from day places in range", () => {
    const days: DayPlaceDraft[] = [
      {
        date: "2026-08-22",
        primaryCity: "Amphoe Kathu",
        secondaryCity: null,
        primaryShare: 1,
        dayType: "trip",
        includeBuffer: false,
      },
    ];
    assert.equal(
      currentDayLocationLabel(days, "2026-08-22", "2026-08-22", "full"),
      "Amphoe Kathu",
    );
  });
});
