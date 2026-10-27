import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { resolveSaleItemXPeds } from "../rules/sale-item-xpeds.js";

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
