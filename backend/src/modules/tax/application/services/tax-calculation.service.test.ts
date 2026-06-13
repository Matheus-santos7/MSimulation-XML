import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ResolvedTaxRule } from "../../domain/entities/resolved-tax-rule.entity.js";
import {
  buildFiscalItem,
  calculateInboundInvoice,
  orderLineFromProduct,
} from "./tax-calculation.service.js";
import { DEFAULT_FISCAL_EMITTER_SETTINGS } from "../../../fiscal-settings/domain/services/fiscal-emitter-settings-defaults.js";
import { calcularNotaFiscal } from "../../domain/services/tax-engine.js";

const product = {
  id: "prod-1",
  sku: "4133250001",
  nome: "Liquidificador",
  ncm: "85094010",
  origem: 2,
};

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

describe("calculateInboundInvoice — envio de estoque interestadual", () => {
  it("SP→MG com regra 0% não aplica fallback de 12%", () => {
    const line = orderLineFromProduct(product, {
      cfop: "6949",
      quantidade: 10,
      valorUnitario: 609,
    });

    const result = calculateInboundInvoice(line, inboundRuleZero, "SP", "MG", 4);

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
    const line = orderLineFromProduct(product, {
      cfop: "2949",
      quantidade: 10,
      valorUnitario: 609,
    });

    const result = calculateInboundInvoice(line, inboundRuleZero, "SP", "MG", 12);

    assert.equal(result.aliqIcms, 0);
    assert.equal(result.valorIcms, 0);
    assert.equal(result.nota.totais.vICMS, 0);
    assert.equal(result.nota.totais.vBC, 0);
  });

  it("retorno simbólico usa CST 98 em PIS/COFINS (ML produção)", () => {
    const ruleInboundSuspensao: ResolvedTaxRule = {
      ...inboundRuleZero,
      payload: {
        taxes: {
          icms: { st: "90 - Outras", aliquota: 0 },
          pis: { st: "09 - Operação com Suspensão da Contribuição", aliquota: 0 },
          cofins: { st: "09 - Operação com Suspensão da Contribuição", aliquota: 0 },
          ipi: { st: "55 - Saída com Suspensão", aliquota: 0, codEnq: 103 },
        },
        icmsByUf: { ICMS_SC_PICMS_INTERNAL: 0, ICMS_SC_CST: "90 - Outras" },
      },
    };

    const line = orderLineFromProduct(product, {
      cfop: "2949",
      quantidade: 1,
      valorUnitario: 653.4,
    });

    const result = calculateInboundInvoice(line, ruleInboundSuspensao, "PR", "SC", 12, {
      operationTipo: "RETORNO_SIMBOLICO",
    });

    assert.equal(result.nota.itens[0]!.pis.cst, "98");
    assert.equal(result.nota.itens[0]!.cofins.cst, "98");
    assert.equal(result.nota.itens[0]!.ipi?.cst, "05");
    assert.equal(result.nota.itens[0]!.pis.vBC, 0);
    assert.equal(result.nota.itens[0]!.cofins.vBC, 0);
  });
});

const saleRule: ResolvedTaxRule = {
  ruleId: "sku-SP-non_taxpayer-sale",
  aliquotaIcmsInterna: 18,
  cfop: "5102",
  payload: {
    taxes: {
      pis: { st: "01 - Operação Tributável com Alíquota Básica", aliquota: 1.65 },
      cofins: { st: "01 - Operação Tributável com Alíquota Básica", aliquota: 7.6 },
      ipi: { st: "50 - Saída Tributada", aliquota: 0, codEnq: "999" },
    },
    icmsByUf: { ICMS_SP_CST: "00", ICMS_SP_PICMS_INTERNAL: 18 },
  },
  icms: { cst: "00", pIcmsInternal: 18 },
};

describe("buildFiscalItem — devolução", () => {
  it("mapeia CST de venda para CST de devolução no engine", () => {
    const line = orderLineFromProduct(product, {
      cfop: "1202",
      quantidade: 1,
      valorUnitario: 100,
    });

    const emitterSettings = {
      ...DEFAULT_FISCAL_EMITTER_SETTINGS,
      taxes: {
        ...DEFAULT_FISCAL_EMITTER_SETTINGS.taxes,
        cstDevolucao: {
          ...DEFAULT_FISCAL_EMITTER_SETTINGS.taxes.cstDevolucao,
          icms: [{ venda: "00", devolucao: "41" }],
        },
      },
    };

    const item = buildFiscalItem(
      line,
      saleRule,
      {
        ufOrigem: "SP",
        ufDestino: "SP",
        customerType: "non_taxpayer",
        operationTipo: "DEVOLUCAO",
        emitterSettings,
        cstVendaReferencia: { icms: "00", pis: "01", cofins: "01" },
      },
      18,
    );

    assert.equal(item.icms.cst, "41");
    assert.equal(item.pis.cst, "50");
    assert.equal(item.cofins.cst, "50");

    const nota = calcularNotaFiscal([item]);
    assert.equal(nota.itens[0]!.icms.cst, "41");
    assert.equal(nota.itens[0]!.icms.vBC, 0);
  });

  it("mapeia CSOSN 102 da venda para 41 na devolução (settings padrão)", () => {
    const line = orderLineFromProduct(product, {
      cfop: "1202",
      quantidade: 1,
      valorUnitario: 100,
    });

    const item = buildFiscalItem(
      line,
      saleRule,
      {
        ufOrigem: "SP",
        ufDestino: "SP",
        customerType: "non_taxpayer",
        operationTipo: "DEVOLUCAO",
        emitterSettings: DEFAULT_FISCAL_EMITTER_SETTINGS,
        cstVendaReferencia: { icms: "102", pis: "01", cofins: "01" },
      },
      18,
    );

    assert.equal(item.icms.cst, "41");
    assert.equal(item.pis.cst, "50");
  });
});
