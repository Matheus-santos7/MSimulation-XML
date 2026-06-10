import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ResolvedTaxRule } from "./tax-rule-service.js";
import {
  calcularNotaInbound,
  linhaPedidoFromProduto,
} from "./tax-calculation-service.js";

const product = {
  id: "prod-1",
  sku: "4133250001",
  nome: "Liquidificador",
  ncm: "85094010",
  origem: 2,
};

/** Regra inbound ML típica: CST 90, ICMS 0% (sem alíquota interestadual na planilha). */
const inboundRuleZero: ResolvedTaxRule = {
  ruleId: "4133250001-SP-taxpayer-inbound",
  aliquotaIcmsInterna: 0,
  payload: {
    taxes: {
      icms: { st: "90 - Outras", aliquota: 0 },
      pis: { st: "98 - Outras", aliquota: 0 },
      cofins: { st: "98 - Outras", aliquota: 0 },
      ipi: { st: "55 - Saída com Suspensão", aliquota: 0, codEnq: 103 },
    },
    icmsByUf: {
      ICMS_MG_PICMS_INTERNAL: 0,
      ICMS_MG_CST: "90 - Outras",
    },
  },
  icms: {
    cst: "90",
    pIcmsInternal: 0,
  },
};

describe("calcularNotaInbound — envio de estoque interestadual", () => {
  it("SP→MG com regra 0% não aplica fallback de 12%", () => {
    const linha = linhaPedidoFromProduto(product, {
      cfop: "6949",
      quantidade: 10,
      valorUnitario: 609,
    });

    const result = calcularNotaInbound(
      linha,
      inboundRuleZero,
      "SP",
      "MG",
      4,
    );

    assert.equal(result.aliqIcms, 0);
    assert.equal(result.valorIcms, 0);
    assert.equal(result.nota.totais.vICMS, 0);
    assert.equal(result.nota.itens[0]!.icms.cst, "90");
    assert.equal(result.nota.itens[0]!.icms.pICMS, 0);
    assert.equal(result.nota.itens[0]!.icms.vICMS, 0);
    assert.equal(result.nota.itens[0]!.icms.vBC, 0);
    assert.equal(result.nota.totais.vBC, 0);
    assert.equal(result.nota.itens[0]!.pis.vBC, 0);
    assert.equal(result.nota.itens[0]!.cofins.vBC, 0);
    assert.equal(result.nota.itens[0]!.ipi?.vBC, 0);
  });

  it("retorno simbólico SP→MG (CFOP 2949) mantém ICMS zerado", () => {
    const linha = linhaPedidoFromProduto(product, {
      cfop: "2949",
      quantidade: 10,
      valorUnitario: 609,
    });

    const result = calcularNotaInbound(
      linha,
      inboundRuleZero,
      "SP",
      "MG",
      12,
    );

    assert.equal(result.aliqIcms, 0);
    assert.equal(result.valorIcms, 0);
    assert.equal(result.nota.totais.vICMS, 0);
    assert.equal(result.nota.totais.vBC, 0);
  });
});
