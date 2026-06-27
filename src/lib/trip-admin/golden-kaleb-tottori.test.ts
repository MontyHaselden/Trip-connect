import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildTripAdminProjection } from "./build-admin-projection";
import {
  addMainTokyoKagoshimaLeg,
  buildJapanKalebGraph,
  japanKalebRoster,
  paintKalebTottoriFork,
} from "./fixtures/japan-kaleb";

describe("golden Kaleb Tottori admin projection", () => {
  it("keeps main legs visible while surfacing personal Tottori pending", () => {
    const roster = japanKalebRoster();
    const graph = paintKalebTottoriFork(addMainTokyoKagoshimaLeg(buildJapanKalebGraph()));
    const projection = buildTripAdminProjection(graph, roster);

    const dec6Main = projection.wholeGroup.calendar.days.find((d) => d.date === "2026-12-06");
    assert.equal(dec6Main?.primaryCity, "Tokyo");
    assert.equal(dec6Main?.secondaryCity, "Kagoshima");

    const kaleb = projection.personalScopes.find((s) => s.groupId === "g-kaleb");
    assert.ok(kaleb);
    const dec6Kaleb = kaleb.calendar.days.find((d) => d.date === "2026-12-06");
    assert.equal(dec6Kaleb?.primaryCity, "Tokyo");
    assert.equal(dec6Kaleb?.secondaryCity, "Tottori");

    const dec13Kaleb = kaleb.calendar.days.find((d) => d.date === "2026-12-13");
    assert.equal(dec13Kaleb?.primaryCity, "Tottori");
    assert.equal(dec13Kaleb?.secondaryCity, "Kyoto");

    assert.equal(projection.wholeGroup.legs.intercity.length, 1);
    assert.match(projection.wholeGroup.legs.intercity[0]?.toCity ?? "", /Kagoshima/i);

    assert.ok(
      kaleb.pendingTransport.some(
        (need) => need.toCity.includes("Tottori") && need.fromCity.includes("Tokyo"),
      ),
    );
  });
});
