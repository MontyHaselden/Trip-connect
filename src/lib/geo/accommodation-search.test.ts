import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { inferCityLabelFromAddress } from "./accommodation-search";
import { cityLabelFromAddressComponents } from "./google-places";

describe("inferCityLabelFromAddress", () => {
  it("extracts Pa Tong, Phuket from a Patong hotel address", () => {
    const label = inferCityLabelFromAddress(
      "135, 23 Rat Uthit Song Roi Pi Rd, Pa Tong, Kathu District, Phuket 83150, Thailand",
    );
    assert.equal(label, "Pa Tong, Phuket");
  });

  it("handles Japan-style addresses", () => {
    const label = inferCityLabelFromAddress(
      "1 Chome Marunouchi, Chiyoda City, Tokyo 100-0005, Japan",
    );
    assert.equal(label, "Chiyoda City, Tokyo");
  });
});

describe("cityLabelFromAddressComponents", () => {
  it("builds locality and region from Google components", () => {
    const label = cityLabelFromAddressComponents([
      { longText: "Pa Tong", types: ["locality", "political"] },
      { longText: "Phuket", types: ["administrative_area_level_1", "political"] },
      { longText: "Thailand", types: ["country", "political"] },
    ]);
    assert.equal(label, "Pa Tong, Phuket");
  });
});
