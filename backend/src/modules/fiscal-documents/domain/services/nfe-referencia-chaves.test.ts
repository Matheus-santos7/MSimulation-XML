import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveNfeReferenciaChaves } from "./nfe-referencia-chaves.js";

const chaveA = "3".repeat(44);
const chaveB = "4".repeat(44);

describe("resolveNfeReferenciaChaves", () => {
  it("prioriza chaves de consumo e inclui a principal se faltar", () => {
    assert.deepEqual(
      resolveNfeReferenciaChaves({
        primaryChave: chaveA,
        consumoChaves: [chaveB, chaveA],
      }),
      [chaveB, chaveA],
    );
  });

  it("fallback para chave principal sozinha", () => {
    assert.deepEqual(
      resolveNfeReferenciaChaves({
        primaryChave: chaveA,
        consumoChaves: [],
      }),
      [chaveA],
    );
  });
});
