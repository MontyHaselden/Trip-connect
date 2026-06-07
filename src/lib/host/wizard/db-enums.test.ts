import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { toDbBookingStatus, toDbTransportType } from "./db-enums.ts";

describe("wizard db enum mapping", () => {
  it("maps flexible booking to placeholder", () => {
    assert.equal(toDbBookingStatus("flexible"), "placeholder");
    assert.equal(toDbBookingStatus("booked"), "booked");
  });

  it("maps unsure transport to other", () => {
    assert.equal(toDbTransportType("unsure"), "other");
    assert.equal(toDbTransportType("train"), "train");
  });
});
