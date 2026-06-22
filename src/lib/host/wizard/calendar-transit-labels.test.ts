import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calendarArrivalLabel,
  calendarDepartureLabel,
  computeTransitOverlays,
} from "@/lib/host/wizard/transport-day-placement";
import { destinationCoveredByOverlays } from "@/components/trip-os/calendar/cells/transit-overlay-labels";
import { newId } from "@/lib/host/wizard/types";

describe("calendarDepartureLabel", () => {
  it("uses Depart for instead of Flying on plane legs", () => {
    assert.equal(
      calendarDepartureLabel({
        id: newId(),
        transportType: "plane",
        travelDate: "2026-12-21",
        fromCity: "Tokyo",
        toCity: "Haneda",
        bookingStatus: "booked",
      }),
      "Depart for Tokyo",
    );
  });

  it("uses metro stay city for airport destinations", () => {
    assert.equal(
      calendarDepartureLabel({
        id: newId(),
        transportType: "plane",
        travelDate: "2026-12-21",
        fromCity: "Tokyo",
        toCity: "Christchurch",
        bookingStatus: "booked",
      }),
      "Depart for Christchurch",
    );
  });
});

describe("computeTransitOverlays", () => {
  it("dedupes duplicate departure labels on the same day", () => {
    const leg = {
      id: newId(),
      transportType: "plane" as const,
      travelDate: "2026-12-04",
      fromCity: "Christchurch",
      toCity: "Narita",
      bookingStatus: "booked" as const,
    };
    const overlays = computeTransitOverlays(
      {
        outboundLegs: [leg, { ...leg, id: newId() }],
        returnLegs: [],
        intercityLegs: [],
        dayPlaces: [],
      },
      {
        startDate: "2026-12-05",
        endDate: "2026-12-22",
        departureCity: "Christchurch",
        returnCity: "Christchurch",
      },
    );

    const dec4 = overlays.get("2026-12-04") ?? [];
    assert.equal(dec4.length, 1);
    assert.equal(dec4[0]!.label, "Depart for Tokyo");
  });

  it("uses Arrive in on the arrival date", () => {
    const overlays = computeTransitOverlays(
      {
        outboundLegs: [],
        returnLegs: [
          {
            id: newId(),
            transportType: "plane",
            travelDate: "2026-12-21",
            departureTime: "20:00",
            arrivalTime: "10:00",
            fromCity: "Tokyo",
            toCity: "Christchurch",
            bookingStatus: "booked",
          },
        ],
        intercityLegs: [],
        dayPlaces: [],
      },
      {
        startDate: "2026-12-05",
        endDate: "2026-12-22",
        departureCity: "Christchurch",
        returnCity: "Christchurch",
      },
    );

    assert.equal(calendarArrivalLabel({
      id: newId(),
      transportType: "plane",
      travelDate: "2026-12-21",
      fromCity: "Tokyo",
      toCity: "Christchurch",
      bookingStatus: "booked",
    }), "Arrive in Christchurch");

    const dec22 = overlays.get("2026-12-22") ?? [];
    assert.ok(dec22.some((overlay) => overlay.label === "Arrive in Christchurch"));
  });
});

describe("destinationCoveredByOverlays", () => {
  it("hides a city already named in the transit chip", () => {
    assert.equal(
      destinationCoveredByOverlays("Christchurch", [
        { fromShare: 0.5, toShare: 1, label: "Depart for Christchurch" },
      ]),
      true,
    );
    assert.equal(
      destinationCoveredByOverlays("Tokyo", [
        { fromShare: 0.5, toShare: 1, label: "Depart for Christchurch" },
      ]),
      false,
    );
  });
});
