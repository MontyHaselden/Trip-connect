import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tripHomeDefaultsFromAccount } from "./account-home";

describe("tripHomeDefaultsFromAccount", () => {
  it("copies home city to both trip endpoints and keeps the airport", () => {
    assert.deepEqual(
      tripHomeDefaultsFromAccount({
        homeCity: "Christchurch, New Zealand",
        defaultAirport: "Christchurch International Airport, New Zealand",
        schoolName: "Darfield High School",
      }),
      {
        departureCity: "Christchurch, New Zealand",
        returnCity: "Christchurch, New Zealand",
        defaultDepartureAirport: "Christchurch International Airport, New Zealand",
        schoolName: "Darfield High School",
      },
    );
  });
});
