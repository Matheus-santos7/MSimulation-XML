import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { distinctRemessaChaves } from "./distinct-remessa-chaves.js";

describe("distinctRemessaChaves", () => {
  it("retorna chaves distintas na ordem de primeira aparição", () => {
    const a = "35260612345678000199550010000000011000000012";
    const b = "35260612345678000199550010000000021000000023";
    assert.deepEqual(
      distinctRemessaChaves([
        { remessaChave: a },
        { remessaChave: b },
        { remessaChave: a },
        { remessaChave: ` ${b} ` },
      ]),
      [a, b],
    );
  });

  it("ignora chaves inválidas", () => {
    assert.deepEqual(distinctRemessaChaves([{ remessaChave: "curta" }, { remessaChave: "" }]), []);
  });
});
