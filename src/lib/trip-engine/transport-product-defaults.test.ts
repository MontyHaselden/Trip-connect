import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultPassProductIdForMode } from "./transport-product-defaults";

describe("defaultPassProductIdForMode", () => {
  it("prefers a train pass when adding a train leg", () => {
    const id = defaultPassProductIdForMode("train", [
      { id: "jr", kind: "train_pass" },
      { id: "suica", kind: "ic_card" },
    ]);
    assert.equal(id, "jr");
  });

  it("falls back to the first pass when no kind match exists", () => {
    const id = defaultPassProductIdForMode("bus", [
      { id: "jr", kind: "train_pass" },
    ]);
    assert.equal(id, "jr");
  });

  it("returns new when no passes exist", () => {
    assert.equal(defaultPassProductIdForMode("train", []), "new");
  });
});
