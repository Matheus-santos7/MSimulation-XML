import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alignCteChaveWithEmitente,
  buildChaveCTe,
  chaveCteMatchesEmitente,
} from "./cte-chave.js";

describe("cte-chave emitente", () => {
  it("chave usa UF e CNPJ do emitente", () => {
    const chave = buildChaveCTe({
      uf: "SP",
      cnpj: "03007331007405",
      serie: 1,
      numero: 100024512,
      cCT: 48581394,
    });

    assert.equal(chave.startsWith("35"), true);
    assert.equal(chave.slice(6, 20), "03007331007405");
    assert.equal(
      chaveCteMatchesEmitente(chave, { uf: "SP", cnpj: "03007331007405" }),
      true,
    );
    assert.equal(
      chaveCteMatchesEmitente(chave, { uf: "RJ", cnpj: "03007331007405" }),
      false,
    );
  });

  it("alignCteChaveWithEmitente preserva cCT e corrige UF/CNPJ", () => {
    const legacy = buildChaveCTe({
      uf: "RJ",
      cnpj: "03007331010295",
      serie: 1,
      numero: 42,
      cCT: 12345678,
    });

    const aligned = alignCteChaveWithEmitente(
      legacy,
      { uf: "SP", cnpj: "03007331007405" },
      1,
      42,
    );

    assert.equal(aligned.startsWith("35"), true);
    assert.equal(aligned.slice(6, 20), "03007331007405");
    assert.equal(aligned.slice(35, 43), "12345678");
  });
});
