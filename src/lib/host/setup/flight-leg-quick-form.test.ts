import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSubmittableFlightRow, submittableFlightRows } from "./flight-leg-quick-form";

describe("isSubmittableFlightRow", () => {
  it("accepts a flight number without manual route", () => {
    assert.equal(isSubmittableFlightRow({ flight: "JQ172", from: "", to: "", depart: "", arrive: "" }), true);
  });

  it("accepts manual from and to without a flight number", () => {
    assert.equal(
      isSubmittableFlightRow({
        flight: "",
        from: "Narita",
        to: "Christchurch, New Zealand",
        depart: "",
        arrive: "",
      }),
      true,
    );
  });

  it("rejects partial manual route", () => {
    assert.equal(
      isSubmittableFlightRow({ flight: "", from: "Narita", to: "", depart: "", arrive: "" }),
      false,
    );
  });
});

describe("submittableFlightRows", () => {
  it("keeps only rows with flight number or full manual route", () => {
    const rows = [
      { flight: "", from: "Narita", to: "Christchurch", depart: "", arrive: "" },
      { flight: "", from: "Tokyo", to: "", depart: "", arrive: "" },
      { flight: "NZ1", from: "", to: "", depart: "", arrive: "" },
    ];
    assert.deepEqual(submittableFlightRows(rows).map((row) => row.flight || row.from), [
      "Narita",
      "NZ1",
    ]);
  });
});
