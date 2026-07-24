import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeConferenceDeltas,
  InboundConferenceDeltaError,
} from "./inbound-conference-delta.js";

describe("computeConferenceDeltas", () => {
  it("falta e sobra em linhas distintas", () => {
    const plan = computeConferenceDeltas([
      { lineId: "a", expectedQty: 10, receivedQty: 9 },
      { lineId: "b", expectedQty: 5, receivedQty: 7 },
    ]);
    assert.equal(plan.hasDifferences, true);
    assert.equal(plan.negative.length, 1);
    assert.equal(plan.negative[0]!.absDelta, 1);
    assert.equal(plan.positive.length, 1);
    assert.equal(plan.positive[0]!.absDelta, 2);
  });

  it("reconferência sem diferença → hasDifferences false", () => {
    const plan = computeConferenceDeltas([
      { lineId: "a", expectedQty: 9, receivedQty: 9 },
    ]);
    assert.equal(plan.hasDifferences, false);
    assert.equal(plan.lines[0]!.sign, "none");
  });

  it("rejeita quantidade negativa", () => {
    assert.throws(
      () => computeConferenceDeltas([{ lineId: "a", expectedQty: 1, receivedQty: -1 }]),
      InboundConferenceDeltaError,
    );
  });
});
