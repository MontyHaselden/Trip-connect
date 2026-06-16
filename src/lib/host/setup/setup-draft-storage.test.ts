import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  mergeDraftOverServer,
  shouldRestoreSetupDraft,
  type SetupDraftBackup,
} from "./setup-draft-storage";
import type { TripSetupState } from "./types";

function emptyState(): TripSetupState {
  return {
    basics: {
      name: "New trip",
      startDate: "2000-01-01",
      endDate: "2000-01-01",
      departureCity: "Christchurch, New Zealand",
      returnCity: "Christchurch, New Zealand",
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
    accommodationStays: [],
    activities: [],
    overlayOps: [],
  };
}

describe("shouldRestoreSetupDraft", () => {
  it("restores when the draft has painted days the server does not", () => {
    const server = emptyState();
    const draftState = {
      ...emptyState(),
      dayPlacesByGroupId: {
        main: [
          {
            date: "2026-08-31",
            primaryCity: "Patong",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip" as const,
            includeBuffer: false,
          },
        ],
      },
    };
    const draft: SetupDraftBackup = {
      tripId: "t1",
      state: draftState,
      updatedAt: Date.now(),
    };
    assert.equal(shouldRestoreSetupDraft(draft, server), true);
  });

  it("keeps server state when both are empty", () => {
    const draft: SetupDraftBackup = {
      tripId: "t1",
      state: emptyState(),
      updatedAt: Date.now(),
    };
    assert.equal(shouldRestoreSetupDraft(draft, emptyState()), false);
  });
});

describe("mergeDraftOverServer", () => {
  it("drops draft-only groups that are not on the server", () => {
    const server = {
      ...emptyState(),
      mainGroupId: "main-db",
      groups: [
        {
          id: "main-db",
          name: "Main Group",
          type: "other",
          description: null,
          sortOrder: 0,
          isMain: true,
        },
      ],
      dayPlacesByGroupId: { "main-db": [] },
    };
    const draft = {
      ...emptyState(),
      mainGroupId: "main-db",
      groups: [
        server.groups[0]!,
        {
          id: "ghost-group",
          name: "mum and i",
          type: "split_travel",
          description: null,
          sortOrder: 1,
          isMain: false,
        },
      ],
      dayPlacesByGroupId: {
        "main-db": [],
        "ghost-group": [
          {
            date: "2026-09-01",
            primaryCity: "Bangkok",
            secondaryCity: null,
            primaryShare: 1,
            dayType: "trip" as const,
            includeBuffer: false,
          },
        ],
      },
    };

    const merged = mergeDraftOverServer(draft, server);
    assert.equal(merged.groups.length, 1);
    assert.equal(merged.groups[0]?.name, "Main Group");
    assert.equal(merged.dayPlacesByGroupId["ghost-group"], undefined);
  });

  it("prefers server main transport when the draft still has deleted legs", () => {
    const leg = (id: string) => ({
      id,
      transportType: "flight" as const,
      bookingStatus: "not_booked" as const,
      travelDate: "2026-08-20",
      fromCity: "CHC",
      toCity: "MEL",
      fromStation: null,
      toStation: null,
      operator: null,
      referenceNumber: null,
      flightNumber: "JQ 172",
      notes: null,
    });
    const server = {
      ...emptyState(),
      outboundLegs: [leg("saved")],
    };
    const draft = {
      ...emptyState(),
      outboundLegs: [leg("saved"), leg("stale")],
    };

    const merged = mergeDraftOverServer(draft, server);
    assert.equal(merged.outboundLegs.length, 1);
    assert.equal(merged.outboundLegs[0]?.id, "saved");
  });
});
