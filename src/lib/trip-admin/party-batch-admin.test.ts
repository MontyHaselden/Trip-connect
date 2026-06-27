import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTripAdminProjection } from "./build-admin-projection";
import {
  buildJapanPartyGraph,
  japanPartyRoster,
  paintPartyTottoriFork,
} from "./fixtures/japan-kaleb";

describe("party batch admin projection", () => {
  it("party paint surfaces four personal scopes", () => {
    const roster = japanPartyRoster();
    const graph = paintPartyTottoriFork(buildJapanPartyGraph(), roster);
    const projection = buildTripAdminProjection(graph, roster);

    assert.equal(projection.personalScopes.length, 4);

    const groupIds = projection.personalScopes.map((scope) => scope.groupId).sort();
    assert.deepEqual(groupIds, ["g-amanda", "g-kaleb", "g-mia", "g-trenuela"]);

    for (const scope of projection.personalScopes) {
      assert.ok(scope.differsFromMain, `expected ${scope.title} to differ from main`);
      const dec7 = scope.calendar.days.find((d) => d.date === "2026-12-07");
      assert.equal(dec7?.primaryCity, "Tottori");
    }
  });
});
