import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  withEnsuredItemXPeds,
  withEnsuredPackId,
} from "./order-item-xped.js";

describe("order-item-xped", () => {
  it("gera xPed distinto por item quando ausente", () => {
    let n = 0;
    const generate = () => `ORDER-${++n}`;
    const out = withEnsuredItemXPeds(
      [{ productId: "a" }, { productId: "b", xPed: "  " }, { productId: "c", xPed: "KEEP" }],
      generate,
    );
    assert.deepEqual(
      out.map((i) => i.xPed),
      ["ORDER-1", "ORDER-2", "KEEP"],
    );
  });

  it("gera packId quando pedidoMl ausente", () => {
    assert.equal(withEnsuredPackId(undefined, () => "PACK-1"), "PACK-1");
    assert.equal(withEnsuredPackId("  PACK-OK  ", () => "PACK-1"), "PACK-OK");
  });
});
