import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toDbBookingStatus, toDbTransportType } from "./db-enums.ts";

describe("wizard db enum mapping", () => {
  it("preserves flexible booking status", () => {
    assert.equal(toDbBookingStatus("flexible"), "flexible");
    assert.equal(toDbBookingStatus("booked"), "booked");
  });

  it("maps unsure transport to other", () => {
    assert.equal(toDbTransportType("unsure"), "other");
    assert.equal(toDbTransportType("train"), "train");
  });
});
