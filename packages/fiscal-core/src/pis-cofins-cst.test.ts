import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NFeTipo } from "./nfe-tipo.js";
import {
  IPI_CST_SYMBOLIC_RETURN,
  mapIpiSaidaToEntrada,
  resolveDefaultModFreteForTipo,
  resolveIpiCstFromSnapshot,
  resolvePisCofinsCstFromSnapshot,
} from "./pis-cofins-cst.js";

describe("resolvePisCofinsCstFromSnapshot", () => {
  it("mantém CST da planilha para remessa", () => {
    assert.equal(resolvePisCofinsCstFromSnapshot("09 - Suspensão", NFeTipo.REMESSA), "09");
  });

  it("força CST 98 no retorno simbólico (ML produção)", () => {
    assert.equal(
      resolvePisCofinsCstFromSnapshot("09 - Suspensão", NFeTipo.RETORNO_SIMBOLICO),
      "98",
    );
  });

  it("modFrete padrão do retorno simbólico é 9 (sem transporte)", () => {
    assert.equal(resolveDefaultModFreteForTipo(NFeTipo.RETORNO_SIMBOLICO), "9");
  });
});

describe("mapIpiSaidaToEntrada (doc ML IPI templates)", () => {
  it("converte saída → entrada (pares 50↔00 … 99↔49)", () => {
    assert.equal(mapIpiSaidaToEntrada("50"), "00");
    assert.equal(mapIpiSaidaToEntrada("51"), "01");
    assert.equal(mapIpiSaidaToEntrada("52"), "02");
    assert.equal(mapIpiSaidaToEntrada("53"), "03");
    assert.equal(mapIpiSaidaToEntrada("54"), "04");
    assert.equal(mapIpiSaidaToEntrada("55"), "05");
    assert.equal(mapIpiSaidaToEntrada("99"), "49");
    assert.equal(mapIpiSaidaToEntrada("99 - Outras saídas"), "49");
  });

  it("mantém CST já de entrada", () => {
    for (const cst of ["00", "01", "02", "03", "04", "05", "49"]) {
      assert.equal(mapIpiSaidaToEntrada(cst), cst);
    }
  });

  it("CST desconhecido permanece (2 dígitos)", () => {
    assert.equal(mapIpiSaidaToEntrada("49"), "49");
    assert.equal(mapIpiSaidaToEntrada("90"), "90");
  });
});

describe("resolveIpiCstFromSnapshot", () => {
  it("retorno simbólico: 55 saída → 05 entrada", () => {
    assert.equal(
      resolveIpiCstFromSnapshot("55 - Saída com Suspensão", NFeTipo.RETORNO_SIMBOLICO),
      IPI_CST_SYMBOLIC_RETURN,
    );
  });

  it("retorno físico: 99 saída → 49 entrada", () => {
    assert.equal(resolveIpiCstFromSnapshot("99", NFeTipo.RETORNO_FISICO), "49");
  });

  it("devolução: 50 saída → 00 entrada", () => {
    assert.equal(resolveIpiCstFromSnapshot("50 - Saída Tributada", NFeTipo.DEVOLUCAO), "00");
  });

  it("insucesso: 51 → 01", () => {
    assert.equal(resolveIpiCstFromSnapshot("51", NFeTipo.INSULCESSO_DE_ENTREGA), "01");
  });

  it("venda/remessa mantém CST de saída da planilha", () => {
    assert.equal(resolveIpiCstFromSnapshot("50 - Saída Tributada", NFeTipo.VENDA), "50");
    assert.equal(resolveIpiCstFromSnapshot("55", NFeTipo.REMESSA), "55");
  });

  it("retorno com CST já de entrada na planilha inbound não altera", () => {
    assert.equal(resolveIpiCstFromSnapshot("05", NFeTipo.RETORNO_SIMBOLICO), "05");
    assert.equal(resolveIpiCstFromSnapshot("49", NFeTipo.RETORNO_FISICO), "49");
  });
});
