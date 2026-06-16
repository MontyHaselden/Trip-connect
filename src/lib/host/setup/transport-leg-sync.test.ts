import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { shouldDeleteOrphanTransportLeg } from "./transport-leg-sync";

describe("shouldDeleteOrphanTransportLeg", () => {
  const incoming = new Set(["keep"]);
  const mainGroupId = "main";
  const activeGroups = new Set(["main", "sub"]);

  it("keeps rows that are still in incoming state", () => {
    assert.equal(
      shouldDeleteOrphanTransportLeg(
        { id: "keep", legKind: "outbound", originGroupId: mainGroupId },
        incoming,
        mainGroupId,
        activeGroups,
      ),
      false,
    );
  });

  it("deletes outbound and return legs removed from state", () => {
    assert.equal(
      shouldDeleteOrphanTransportLeg(
        { id: "gone", legKind: "outbound", originGroupId: null },
        incoming,
        mainGroupId,
        activeGroups,
      ),
      true,
    );
    assert.equal(
      shouldDeleteOrphanTransportLeg(
        { id: "gone", legKind: "return", originGroupId: "stale-group" },
        incoming,
        mainGroupId,
        activeGroups,
      ),
      true,
    );
  });

  it("deletes main intercity legs and stale subgroup legs", () => {
    assert.equal(
      shouldDeleteOrphanTransportLeg(
        { id: "gone", legKind: "intercity", originGroupId: null },
        incoming,
        mainGroupId,
        activeGroups,
      ),
      true,
    );
    assert.equal(
      shouldDeleteOrphanTransportLeg(
        { id: "gone", legKind: "intercity", originGroupId: "deleted-group" },
        incoming,
        mainGroupId,
        activeGroups,
      ),
      true,
    );
  });

  it("preserves active subgroup intercity legs until subgroup save runs", () => {
    assert.equal(
      shouldDeleteOrphanTransportLeg(
        { id: "gone", legKind: "intercity", originGroupId: "sub" },
        incoming,
        mainGroupId,
        activeGroups,
      ),
      false,
    );
  });
});
