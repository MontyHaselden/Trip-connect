import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  activitiesAttachedToStay,
  activityOverlapsStay,
} from "@/lib/host/setup/accommodation-activities";
import type { AccommodationStayDraft, ActivityDraft } from "@/lib/host/wizard/types";

function activity(overrides: Partial<ActivityDraft> = {}): ActivityDraft {
  return {
    id: "a1",
    title: "Museum",
    date: "2026-03-10",
    endDate: null,
    startTime: "10:00",
    endTime: null,
    isTimeTbc: false,
    category: "activity",
    locationName: null,
    address: null,
    isLocationTbc: true,
    transportNote: null,
    leaveByTime: null,
    bringNote: null,
    description: null,
    audienceType: "everyone",
    audienceId: null,
    bookingStatus: "not_booked",
    ...overrides,
  };
}

const stay: Pick<AccommodationStayDraft, "checkInDate" | "checkOutDate"> = {
  checkInDate: "2026-03-10",
  checkOutDate: "2026-03-13",
};

describe("accommodation-activities", () => {
  it("matches activities on stay nights", () => {
    assert.equal(activityOverlapsStay(activity({ date: "2026-03-11" }), stay), true);
    assert.equal(activityOverlapsStay(activity({ date: "2026-03-13" }), stay), false);
    assert.equal(activityOverlapsStay(activity({ date: "2026-03-09" }), stay), false);
  });

  it("matches multi-day activities spanning stay", () => {
    assert.equal(
      activityOverlapsStay(activity({ date: "2026-03-08", endDate: "2026-03-11" }), stay),
      true,
    );
  });

  it("lists attached activities", () => {
    const activities = [
      activity({ id: "a1", date: "2026-03-10" }),
      activity({ id: "a2", date: "2026-03-20" }),
    ];
    assert.deepEqual(
      activitiesAttachedToStay(activities, stay).map((a) => a.id),
      ["a1"],
    );
  });
});
