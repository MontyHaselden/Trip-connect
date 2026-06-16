import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildPlaneLegChain,
  parseFlightNumbers,
  sortFlightLookupsByDeparture,
} from "./flight-leg-chain";
import type { FlightLookupResult } from "./flight-lookup-types";

const seed = {
  startDate: "2026-09-01",
  endDate: "2026-09-10",
  departureCity: "Sydney",
  returnCity: "Sydney",
};

describe("flight-leg-chain", () => {
  it("parses flight numbers from mixed separators", () => {
    assert.deepEqual(parseFlightNumbers("jq30\nJQ171, nz123;JQ30"), ["JQ30", "JQ171", "NZ123"]);
  });

  it("sorts lookups by departure date", () => {
    const sorted = sortFlightLookupsByDeparture([
      { flightNumber: "B", travelDate: "2026-09-05" } as FlightLookupResult,
      { flightNumber: "A", travelDate: "2026-09-04" } as FlightLookupResult,
    ]);
    assert.equal(sorted[0]?.flightNumber, "A");
  });

  it("chains outbound plane legs in departure order", () => {
    const legs = buildPlaneLegChain(
      [
        {
          flightNumber: "JQ171",
          airline: "Jetstar",
          departureAirport: "Melbourne",
          arrivalAirport: "Christchurch",
          departureIata: "MEL",
          arrivalIata: "CHC",
          travelDate: "2026-09-05",
          arrivalDate: null,
          departureTime: "11:05",
          arrivalTime: "16:25",
        },
        {
          flightNumber: "JQ30",
          airline: "Jetstar",
          departureAirport: "Bangkok",
          arrivalAirport: "Melbourne",
          departureIata: "BKK",
          arrivalIata: "MEL",
          travelDate: "2026-09-04",
          arrivalDate: "2026-09-05",
          departureTime: "21:40",
          arrivalTime: "09:25",
        },
      ],
      { placement: "outbound", seed },
    );

    assert.equal(legs.length, 2);
    assert.equal(legs[0]?.flightNumber, "JQ30");
    assert.equal(legs[0]?.fromStation, "BKK");
    assert.equal(legs[1]?.flightNumber, "JQ171");
    assert.equal(legs[1]?.fromCity, "Melbourne");
    assert.equal(legs[1]?.travelDate, "2026-09-05");
  });
});
