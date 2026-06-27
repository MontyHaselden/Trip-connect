import { describe, expect, it } from "vitest";

import { allGroupIdsFromCommands } from "./command-group-ids";
import type { TripCommand } from "./commands";

describe("allGroupIdsFromCommands", () => {
  it("collects every unique groupId from a batch transport add", () => {
    const commands = [
      {
        type: "addClassifiedTransportLegs",
        groupId: "g-amanda",
        legs: [],
      },
      {
        type: "addClassifiedTransportLegs",
        groupId: "g-kaleb",
        legs: [],
      },
      {
        type: "addClassifiedTransportLegs",
        groupId: "g-mia",
        legs: [],
      },
      {
        type: "addClassifiedTransportLegs",
        groupId: "g-trenuela",
        legs: [],
      },
    ] as TripCommand[];

    expect(allGroupIdsFromCommands(commands).sort()).toEqual([
      "g-amanda",
      "g-kaleb",
      "g-mia",
      "g-trenuela",
    ]);
  });

  it("dedupes repeated groupIds", () => {
    const commands = [
      { type: "addTransportLeg", groupId: "g-a", leg: {} },
      { type: "updateTransportLeg", groupId: "g-a", legId: "l1", patch: {} },
    ] as TripCommand[];

    expect(allGroupIdsFromCommands(commands)).toEqual(["g-a"]);
  });
});
