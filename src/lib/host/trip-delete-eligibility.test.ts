import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveTripDeleteStatus } from "./trip-delete-eligibility";

const baseTrip = {
  id: "trip-1",
  startDate: "2026-12-04",
  endDate: "2026-12-22",
  timezone: "Pacific/Auckland",
  publishedVersion: 0,
};

describe("resolveTripDeleteStatus", () => {
  it("allows deleting built trips that are not completed", () => {
    const status = resolveTripDeleteStatus(
      { ...baseTrip, publishedVersion: 1 },
      { dayCount: 10, itemCount: 20, allDaysHaveItems: true },
    );
    assert.equal(status.canDelete, true);
    assert.match(status.deleteWarning ?? "", /published/i);
  });

  it("blocks completed trips", () => {
    const status = resolveTripDeleteStatus(
      {
        ...baseTrip,
        startDate: "2024-01-01",
        endDate: "2024-01-10",
      },
      { dayCount: 5, itemCount: 5, allDaysHaveItems: true },
    );
    assert.equal(status.canDelete, false);
    assert.match(status.reason ?? "", /Completed/i);
  });
});
