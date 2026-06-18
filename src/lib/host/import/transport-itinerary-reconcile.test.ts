import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSpuriousImportedTransportActivity } from "@/lib/host/import/transport-itinerary-reconcile";

describe("isSpuriousImportedTransportActivity", () => {
  it("flags AI duplicate transport activities", () => {
    assert.equal(isSpuriousImportedTransportActivity("Train: Melbourne -> Christchurch"), true);
    assert.equal(isSpuriousImportedTransportActivity("Flight NZ123: Christchurch -> Melbourne"), true);
    assert.equal(isSpuriousImportedTransportActivity("Fly Christchurch to Melbourne"), true);
  });

  it("keeps real activities", () => {
    assert.equal(isSpuriousImportedTransportActivity("ICONSIAM visit"), false);
    assert.equal(isSpuriousImportedTransportActivity("Morning kickboxing"), false);
  });
});
