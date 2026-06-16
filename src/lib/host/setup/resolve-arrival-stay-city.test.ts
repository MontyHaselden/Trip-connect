import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { patongStay } from "@/lib/host/setup/calendar-fixtures";
import { resolveArrivalStayCity } from "@/lib/host/setup/resolve-arrival-stay-city";
import type { TransportLegDraft } from "@/lib/host/wizard/types";
import { newId } from "@/lib/host/wizard/types";

describe("resolveArrivalStayCity", () => {
  const patong = patongStay({
    checkInDate: "2026-08-23",
    checkOutDate: "2026-08-31",
    name: "The Royal Paradise Hotel & Spa",
  });

  const outbound: TransportLegDraft[] = [
    {
      id: newId(),
      transportType: "plane",
      bookingStatus: "booked",
      travelDate: "2026-08-23",
      arrivalDate: "2026-08-23",
      departureTime: "14:50",
      arrivalTime: "20:40",
      fromCity: "Melbourne Airport (MEL), Australia",
      toCity: "Phuket International Airport (HKT), Thailand",
      fromStation: null,
      toStation: null,
      operator: "Jetstar",
      referenceNumber: null,
      flightNumber: "JQ 17",
      notes: null,
    },
  ];

  it("maps HKT airport to Patong when a named stay exists in the metro", () => {
    const city = resolveArrivalStayCity(
      "Phuket International Airport (HKT), Thailand",
      [patong],
      outbound,
      "2026-08-23",
    );
    assert.equal(city, "Patong");
  });

  it("falls back to metro label when no matching stay", () => {
    const city = resolveArrivalStayCity(
      "Suvarnabhumi Airport (BKK), Thailand",
      [patong],
      outbound,
      "2026-09-04",
    );
    assert.equal(city, "Bangkok");
  });
});
