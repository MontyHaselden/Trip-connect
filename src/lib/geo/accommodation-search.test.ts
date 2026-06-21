import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  friendlyCityFromHotelName,
  inferCityLabelFromAddress,
  looksLikeFormalMapsCityLabel,
  resolveLodgingSearchQuery,
  resolveStayCityOnHotelPick,
  suggestKeepStayCityLabel,
} from "./accommodation-search";
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

describe("friendlyCityFromHotelName", () => {
  it("extracts Patong from Royal Paradise hotel name", () => {
    assert.equal(
      friendlyCityFromHotelName("The Royal Paradise Hotel & Spa Patong Phuket"),
      "Patong",
    );
  });
});

describe("resolveStayCityOnHotelPick", () => {
  it("prefers Patong from hotel name over formal maps label", () => {
    assert.equal(
      resolveStayCityOnHotelPick({
        hotelName: "The Royal Paradise Hotel & Spa Patong Phuket",
        mapsCityLabel: "Amphoe Kathu, Chang Wat Phuket",
        address: "135 Rat Uthit Song Roi Pi Rd, Pa Tong, Kathu District, Phuket, Thailand",
      }),
      "Patong",
    );
  });
});

describe("suggestKeepStayCityLabel", () => {
  it("suggests Patong when maps returns formal admin text", () => {
    assert.equal(
      suggestKeepStayCityLabel({
        hotelName: "The Royal Paradise Hotel & Spa Patong Phuket",
        effectiveCity: "Amphoe Kathu, Chang Wat Phuket",
      }),
      "Patong",
    );
  });

  it("suggests Patong when calendar already says Phuket", () => {
    assert.equal(
      suggestKeepStayCityLabel({
        hotelName: "The Royal Paradise Hotel & Spa Patong Phuket",
        effectiveCity: "Phuket",
      }),
      "Patong",
    );
  });

  it("returns null when city already matches", () => {
    assert.equal(
      suggestKeepStayCityLabel({
        hotelName: "The Royal Paradise Hotel & Spa Patong Phuket",
        effectiveCity: "Patong",
      }),
      null,
    );
  });
});

describe("looksLikeFormalMapsCityLabel", () => {
  it("flags amphoe and comma-separated labels", () => {
    assert.equal(looksLikeFormalMapsCityLabel("Amphoe Kathu, Chang Wat Phuket"), true);
    assert.equal(looksLikeFormalMapsCityLabel("Patong"), false);
  });
});

describe("resolveLodgingSearchQuery", () => {
  it("splits trailing city from hotel name when it conflicts with hint", () => {
    assert.deepEqual(resolveLodgingSearchQuery("THE KNOT HIROSHIMA", "Tottori"), {
      query: "THE KNOT",
      cityHint: "HIROSHIMA",
    });
  });

  it("still splits when trailing city matches the calendar hint", () => {
    assert.deepEqual(resolveLodgingSearchQuery("THE KNOT HIROSHIMA", "Hiroshima"), {
      query: "THE KNOT",
      cityHint: "Hiroshima",
    });
    assert.deepEqual(resolveLodgingSearchQuery("The knot hiroshima", "Hiroshima"), {
      query: "The knot",
      cityHint: "Hiroshima",
    });
  });

  it("keeps single-token queries unchanged", () => {
    assert.deepEqual(resolveLodgingSearchQuery("Hilton", "Hiroshima"), {
      query: "Hilton",
      cityHint: "Hiroshima",
    });
  });
});
