import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSaleItemXPeds } from "./sale-item-xpeds.js";

describe("resolveSaleItemXPeds", () => {
  it("usa xPed do item ou fallback pack", () => {
    assert.deepEqual(
      resolveSaleItemXPeds(
        [{ xPed: "A" }, { xPed: "  " }, { xPed: undefined }, { xPed: "B" }],
        "PACK",
      ),
      ["A", "PACK", "PACK", "B"],
    );
  });
});
