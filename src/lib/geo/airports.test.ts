import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { searchAirports } from "./airports";

describe("searchAirports", () => {
  it("excludes heliports from Tokyo airport search", async () => {
    const results = await searchAirports({ query: "Tokyo", limit: 8 });
    const labels = results.map((r) => r.label.toLowerCase());
    assert.ok(labels.some((l) => l.includes("narita") || l.includes("haneda")));
    assert.equal(
      labels.some((l) => l.includes("heliport")),
      false,
      `unexpected heliport in ${labels.join(", ")}`,
    );
  });
});
