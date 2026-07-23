import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EBAZAR_REGIME_ESPECIAL_BY_UF_CNPJ,
  resolveRegimeEspecial,
} from "./fulfillment-infcpl.regimes.js";

describe("resolveRegimeEspecial", () => {
  it("resolve os 8 pares UF+CNPJ com texto ASCII da spec", () => {
    assert.equal(EBAZAR_REGIME_ESPECIAL_BY_UF_CNPJ.length, 8);

    assert.equal(
      resolveRegimeEspecial("BA", "03.007.331/0097-93"),
      "Regime Especial BA - Parecer DITRI/GETRI n 3828/2022.",
    );
    assert.equal(
      resolveRegimeEspecial("SC", "03007331012077"),
      "Regime Especial SC - TTD SC n 225000004034256.",
    );
    assert.equal(
      resolveRegimeEspecial("RJ", "03007331010295"),
      "Regime Especial RJ - Parecer n 176/2022/SEFAZ/COOCJT.",
    );
    assert.equal(
      resolveRegimeEspecial("MG", "03007331013715"),
      "Regime Especial MG - E-PTA-RE n 45.000038282-71.",
    );
    assert.equal(
      resolveRegimeEspecial("DF", "03007331004643"),
      "Regime Especial DF - Ato Declaratorio n 2/2024.",
    );
    assert.equal(
      resolveRegimeEspecial("RS", "03007331019160"),
      "Regime Especial RS - Ato Declaratorio n 2023/107.",
    );
    assert.equal(
      resolveRegimeEspecial("PR", "03007331001628"),
      "Regime Especial PR - Regime Especial n 7975/2022.",
    );
    assert.equal(
      resolveRegimeEspecial("PE", "03007331018350"),
      "Regime Especial PE - Edital DPC n 077/2024.",
    );
  });

  it("normaliza UF case-insensitive e CNPJ mascarado", () => {
    assert.equal(
      resolveRegimeEspecial("sc", "03.007.331/0120-77"),
      "Regime Especial SC - TTD SC n 225000004034256.",
    );
  });

  it("retorna null quando UF ou CNPJ nao casam o par", () => {
    assert.equal(resolveRegimeEspecial("SC", "03007331009793"), null);
    assert.equal(resolveRegimeEspecial("SP", "03007331012077"), null);
    assert.equal(resolveRegimeEspecial("", "03007331012077"), null);
    assert.equal(resolveRegimeEspecial("SC", ""), null);
  });
});
