import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTripAdminProjection } from "./build-admin-projection";
import {
  addMainTokyoKagoshimaLeg,
  buildJapanKalebGraph,
  japanKalebRoster,
  paintKalebTottoriFork,
} from "./fixtures/japan-kaleb";

describe("buildTripAdminProjection", () => {
  it("projects whole-group main corridor with pending city changes", () => {
    const graph = buildJapanKalebGraph();
    const roster = japanKalebRoster();
    const projection = buildTripAdminProjection(graph, roster);

    assert.equal(projection.wholeGroup.groupId, graph.mainGroupId);
    assert.equal(projection.wholeGroup.title, "Whole group");
    assert.ok(projection.wholeGroup.calendar.days.length > 0);

    const dec6 = projection.wholeGroup.calendar.days.find((d) => d.date === "2026-12-06");
    assert.equal(dec6?.primaryCity, "Tokyo");
    assert.equal(dec6?.secondaryCity, "Kagoshima");

    assert.ok(
      projection.wholeGroup.pendingTransport.some(
        (need) =>
          need.kind === "intercity" &&
          need.fromCity.includes("Tokyo") &&
          need.toCity.includes("Kagoshima"),
      ),
      "expected main Tokyo → Kagoshima pending on whole group",
    );
  });

  it("includes Kaleb personal scope after Tottori fork without changing whole-group legs", () => {
    const roster = japanKalebRoster();
    const withLeg = addMainTokyoKagoshimaLeg(buildJapanKalebGraph());
    const painted = paintKalebTottoriFork(withLeg);
    const projection = buildTripAdminProjection(painted, roster);

    assert.equal(projection.wholeGroup.legs.intercity.length, 1);
    assert.equal(projection.wholeGroup.legs.intercity[0]?.fromCity, "Tokyo");

    const kaleb = projection.personalScopes.find((scope) => scope.groupId === "g-kaleb");
    assert.ok(kaleb, "expected Kaleb personal scope");
    assert.equal(kaleb.title, "Kaleb");
    assert.ok(kaleb.differsFromMain);

    assert.ok(
      kaleb.pendingTransport.some(
        (need) =>
          need.kind === "intercity" &&
          need.fromCity.includes("Tokyo") &&
          need.toCity.includes("Tottori"),
      ),
      "expected Kaleb Tokyo → Tottori pending",
    );
  });

  it("does not duplicate whole-group legs on personal scopes", () => {
    const graph = addMainTokyoKagoshimaLeg(buildJapanKalebGraph());
    const projection = buildTripAdminProjection(graph, japanKalebRoster());

    for (const scope of projection.personalScopes) {
      assert.equal(scope.legs.outbound.length, 0);
      assert.equal(scope.legs.return.length, 0);
    }
  });
});
