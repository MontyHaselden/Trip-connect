import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildGroupedTransportLegCommands } from "./grouped-transport-leg-commands";

describe("buildGroupedTransportLegCommands", () => {
  const draft = {
    id: "leg-rep",
    transportType: "train" as const,
    bookingStatus: "not_booked" as const,
    travelDate: "2026-12-13",
    arrivalDate: null,
    departureTime: null,
    arrivalTime: null,
    fromCity: "Tottori",
    toCity: "Hiroshima",
    fromStation: null,
    toStation: null,
    operator: null,
    referenceNumber: null,
    flightNumber: null,
    notes: null,
    intercityFromCity: "Tottori",
    intercityToCity: "Hiroshima",
    originGroupId: "g-amanda",
    transportProductId: null,
    billingMode: "single" as const,
  };

  const targets = [
    { legId: "leg-a", groupId: "g-amanda" },
    { legId: "leg-k", groupId: "g-kaleb" },
    { legId: "leg-m", groupId: "g-mia" },
  ];

  it("updates existing legs and adds a leg for a newly selected traveller", () => {
    const commands = buildGroupedTransportLegCommands({
      draft,
      bucket: "intercity",
      groupedLegTargets: targets,
      selectedGroupIds: ["g-amanda", "g-kaleb", "g-mia", "g-trenuela"],
    });

    assert.equal(
      commands.filter((command) => command.type === "updateTransportLeg").length,
      3,
    );
    assert.equal(
      commands.filter((command) => command.type === "addClassifiedTransportLegs").length,
      1,
    );
    const added = commands.find((command) => command.type === "addClassifiedTransportLegs");
    assert.equal(added?.groupId, "g-trenuela");
  });

  it("removes legs for travellers who were unchecked", () => {
    const commands = buildGroupedTransportLegCommands({
      draft,
      bucket: "intercity",
      groupedLegTargets: targets,
      selectedGroupIds: ["g-amanda", "g-kaleb"],
    });

    assert.deepEqual(
      commands.filter((command) => command.type === "removeTransportLeg").map((command) => command.legId),
      ["leg-m"],
    );
  });

  it("applies transport product billing on every grouped leg update", () => {
    const commands = buildGroupedTransportLegCommands({
      draft: {
        ...draft,
        transportProductId: "jr-pass",
        billingMode: "product",
      },
      bucket: "intercity",
      groupedLegTargets: targets,
      selectedGroupIds: ["g-amanda", "g-kaleb", "g-mia"],
    });

    const updates = commands.filter((command) => command.type === "updateTransportLeg");
    assert.equal(updates.length, 3);
    for (const command of updates) {
      if (command.type !== "updateTransportLeg") continue;
      assert.equal(command.patch.transportProductId, "jr-pass");
      assert.equal(command.patch.billingMode, "product");
    }
  });
});
