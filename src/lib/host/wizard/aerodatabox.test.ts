import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeFlightIata,
  parseAerodataboxFlight,
  parseIsoDateTime,
  pickAerodataboxFlight,
  pickClosestOperatingDate,
  pickPreferredOperatingDate,
} from "./aerodatabox";

describe("aerodatabox", () => {
  it("normalizes flight numbers", () => {
    assert.equal(normalizeFlightIata(" jq 30 "), "JQ30");
  });

  it("parses scheduled flight rows", () => {
    const result = parseAerodataboxFlight(
      {
        number: "JQ30",
        codeshareStatus: "IsOperator",
        airline: { name: "Jetstar Airways", iata: "JQ" },
        departure: {
          airport: { iata: "HKT", name: "Phuket" },
          scheduledTime: { local: "2026-08-23T10:15:00+07:00", utc: "2026-08-23T03:15:00Z" },
        },
        arrival: {
          airport: { iata: "BKK", name: "Bangkok Suvarnabhumi" },
          scheduledTime: { local: "2026-08-23T11:45:00+07:00", utc: "2026-08-23T04:45:00Z" },
        },
      },
      "JQ30",
    );

    assert.equal(result?.flightNumber, "JQ30");
    assert.equal(result?.departureIata, "HKT");
    assert.equal(result?.arrivalIata, "BKK");
    assert.equal(result?.travelDate, "2026-08-23");
    assert.equal(result?.departureTime, "10:15");
    assert.equal(result?.arrivalTime, "11:45");
  });

  it("parses rows with airport codes only", () => {
    const result = parseAerodataboxFlight(
      {
        number: "AC91",
        airline: { name: "Air Canada", iata: "AC" },
        departure: { airport: { iata: "GRU" } },
        arrival: { airport: { iata: "YYZ" } },
      },
      "AC91",
    );

    assert.equal(result?.departureIata, "GRU");
    assert.equal(result?.arrivalIata, "YYZ");
    assert.equal(result?.travelDate, null);
  });

  it("prefers operator rows and a row matching the requested travel date", () => {
    const rows = [
      {
        number: "W8569",
        codeshareStatus: "IsCodeshared",
        departure: {
          airport: { iata: "MAD" },
          scheduledTime: { local: "2026-06-01T10:00:00+02:00" },
        },
        arrival: {
          airport: { iata: "GIG" },
          scheduledTime: { local: "2026-06-01T18:00:00-03:00" },
        },
      },
      {
        number: "W8569",
        codeshareStatus: "IsOperator",
        departure: {
          airport: { iata: "MAD" },
          scheduledTime: { local: "2026-06-08T10:00:00+02:00" },
        },
        arrival: {
          airport: { iata: "GIG" },
          scheduledTime: { local: "2026-06-08T18:00:00-03:00" },
        },
      },
    ];

    const picked = pickAerodataboxFlight(rows, "W8569", "2026-06-08");
    assert.equal(picked?.travelDate, "2026-06-08");
  });

  it("parses ISO timestamps", () => {
    assert.deepEqual(parseIsoDateTime("2026-08-23T10:15:00+07:00"), {
      date: "2026-08-23",
      time: "10:15",
    });
  });

  it("prefers a departure on the hinted date over a nearby arrival-only match", () => {
    const rows = [
      {
        number: "JQ30",
        departure: {
          airport: { iata: "BKK" },
          scheduledTime: { local: "2026-08-03 21:40+07:00" },
        },
        arrival: {
          airport: { iata: "MEL" },
          scheduledTime: { local: "2026-08-04 09:25+10:00" },
        },
      },
      {
        number: "JQ30",
        departure: {
          airport: { iata: "BKK" },
          scheduledTime: { local: "2026-09-04 21:40+07:00" },
        },
        arrival: {
          airport: { iata: "MEL" },
          scheduledTime: { local: "2026-09-05 09:25+10:00" },
        },
      },
    ];

    const picked = pickAerodataboxFlight(rows, "JQ30", "2026-09-04");
    assert.equal(picked?.travelDate, "2026-09-04");
    assert.equal(picked?.arrivalDate, "2026-09-05");
  });

  it("picks the closest operating departure date to a hint", () => {
    assert.equal(
      pickClosestOperatingDate(["2026-08-01", "2026-09-04", "2026-09-11"], "2026-09-03"),
      "2026-09-04",
    );
  });

  it("prefers the next future operating date when no hint is provided", () => {
    assert.equal(
      pickPreferredOperatingDate(["2026-01-01", "2026-09-04", "2026-09-11"]),
      "2026-09-04",
    );
  });
});
