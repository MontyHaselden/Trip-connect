import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateCalculatorExpression,
  formatCalculatorResult,
} from "./finance-calculator-engine";

describe("evaluateCalculatorExpression", () => {
  it("evaluates chained arithmetic", () => {
    assert.equal(evaluateCalculatorExpression("1047.5*19"), 19902.5);
    assert.equal(evaluateCalculatorExpression("(1000+50)/2"), 525);
  });

  it("rejects invalid input", () => {
    assert.equal(evaluateCalculatorExpression("alert(1)"), null);
    assert.equal(evaluateCalculatorExpression("1 & 2"), null);
  });
});

describe("formatCalculatorResult", () => {
  it("formats integers and decimals", () => {
    assert.equal(formatCalculatorResult(19902.5), "19,902.5");
    assert.equal(formatCalculatorResult(500), "500");
  });
});
