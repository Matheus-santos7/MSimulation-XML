import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ResolvedTaxRule } from "../../domain/entities/resolved-tax-rule.entity.js";
import {
  buildFiscalItem,
  calculateInboundInvoice,
  orderLineFromProduct,
} from "./tax-calculation.service.js";
import { DEFAULT_FISCAL_EMITTER_SETTINGS } from "../../../fiscal-settings/domain/services/fiscal-emitter-settings-defaults.js";
import { calcularNotaFiscal, round2 } from "../../domain/services/tax-engine.js";

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

  it("retorno simbólico mantém CST ICMS da planilha (sem override)", () => {
    const ruleCst00: ResolvedTaxRule = {
      ...inboundRuleZero,
      payload: {
        taxes: {
          icms: { st: "00 - Tributada integralmente", aliquota: 0 },
          pis: { st: "98 - Outras", aliquota: 0 },
          cofins: { st: "98 - Outras", aliquota: 0 },
          ipi: { st: "55 - Saída com Suspensão", aliquota: 0, codEnq: 103 },
        },
        icmsByUf: { ICMS_SP_CST: "00", ICMS_SP_PICMS_INTERNAL: 0 },
      },
      icms: { cst: "00", pIcmsInternal: 0 },
    };

    const line = orderLineFromProduct(product, {
      cfop: "2949",
      quantidade: 1,
      valorUnitario: 609,
    });

    const result = calculateInboundInvoice(line, ruleCst00, "BA", "SP", 12, {
      operationTipo: "RETORNO_SIMBOLICO",
    });

    assert.equal(result.nota.itens[0]!.icms.cst, "00");
    assert.equal(result.nota.itens[0]!.icms.pICMS, 4);
    assert.equal(result.nota.itens[0]!.icms.vBC, 609);
    assert.equal(result.nota.itens[0]!.icms.vICMS, 24.36);
  });

  it("remessa interestadual SP→BA com CST 00 e origem importada aplica 4% Senado", () => {
    const ruleCst00Zero: ResolvedTaxRule = {
      ruleId: "sku-BA-taxpayer-inbound",
      aliquotaIcmsInterna: 0,
      payload: {
        taxes: {
          icms: { st: "00 - Tributada integralmente", aliquota: 0 },
          pis: { st: "98 - Outras", aliquota: 0 },
          cofins: { st: "98 - Outras", aliquota: 0 },
          ipi: { st: "55 - Saída com Suspensão", aliquota: 0, codEnq: 103 },
        },
        icmsByUf: { ICMS_BA_CST: "00", ICMS_BA_PICMS_INTERNAL: 0 },
      },
      icms: { cst: "00", pIcmsInternal: 0 },
    };

    const line = orderLineFromProduct(product, {
      cfop: "6949",
      quantidade: 1,
      valorUnitario: 609,
    });

    const result = calculateInboundInvoice(line, ruleCst00Zero, "SP", "BA", 4, {
      operationTipo: "REMESSA",
    });

    assert.equal(result.nota.itens[0]!.icms.cst, "00");
    assert.equal(result.nota.itens[0]!.icms.pICMS, 4);
    assert.equal(result.nota.itens[0]!.icms.vBC, 609);
    assert.equal(result.nota.itens[0]!.icms.vICMS, 24.36);
    assert.equal(result.nota.totais.vICMS, 24.36);
  });

  it("retorno simbólico SP→MG (CFOP 2949) mantém CST 90 da planilha", () => {
    const line = orderLineFromProduct(product, {
      cfop: "2949",
      quantidade: 10,
      valorUnitario: 609,
    });

    const result = calculateInboundInvoice(line, inboundRuleZero, "SP", "MG", 12, {
      operationTipo: "RETORNO_SIMBOLICO",
    });

    assert.equal(result.nota.itens[0]!.icms.cst, "90");
    assert.equal(result.aliqIcms, 0);
    assert.equal(result.valorIcms, 0);
    assert.equal(result.nota.totais.vICMS, 0);
    assert.equal(result.nota.totais.vBC, 0);
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

const importedSaleRule: ResolvedTaxRule = {
  ruleId: "sku-SC-non_taxpayer-sale",
  aliquotaIcmsInterna: 19.5,
  cfop: "6105",
  payload: {
    taxes: {
      pis: { st: "01 - Operação Tributável com Alíquota Básica", aliquota: 1.65, pRedBc: 18.4675 },
      cofins: { st: "01 - Operação Tributável com Alíquota Básica", aliquota: 7.6, pRedBc: 18.4675 },
      ipi: { st: "50 - Saída Tributada", aliquota: 2.6, codEnq: "999" },
    },
    icmsByUf: {
      ICMS_SP_CST: "00",
      ICMS_SP_PICMS_INTERNAL: 19.5,
      ICMS_SP_PICMS_INTERSTATE: 12,
    },
  },
  icms: { cst: "00", pIcmsInternal: 19.5, pIcmsInterstate: 12 },
};

describe("buildFiscalItem — venda ML Full importada interestadual", () => {
  it("origem 2 (SC→SP) aplica 4% de ICMS e calcula DIFAL para consumidor final", () => {
    const line = orderLineFromProduct(product, {
      cfop: "6105",
      quantidade: 1,
      valorUnitario: 500,
    });

    const item = buildFiscalItem(
      { ...line, frete: 25 },
      importedSaleRule,
      {
        ufOrigem: "PR",
        ufSaidaFisica: "SC",
        ufDestino: "SP",
        customerType: "non_taxpayer",
        operationTipo: "VENDA",
        emitterSettings: DEFAULT_FISCAL_EMITTER_SETTINGS,
      },
      12,
    );

    assert.equal(item.icms.pICMS, 4);
    assert.ok(item.difal);
    assert.equal(item.difal!.pICMSInter, 4);
    assert.equal(item.difal!.pICMSUFDest, 19.5);
    assert.equal(item.difal!.pICMSInterPart, 100);

    const nota = calcularNotaFiscal([item]);
    const r = nota.itens[0]!;
    assert.equal(r.icms.pICMS, 4);
    assert.ok(r.difal);
    assert.equal(r.difal!.vBCUFDest, r.icms.vBC);
    assert.ok(r.difal!.vICMSUFDest > 0);
    assert.equal(r.difal!.vICMSUFRemet, 0);
    assert.equal(nota.totais.vICMSUFDest, r.difal!.vICMSUFDest);
  });
});

describe("buildFiscalItem — composição base PIS/COFINS por canal (fiscal-settings)", () => {
  /**
   * Cenário paridade ML Full: VENDA interestadual com consumidor final.
   * Settings = default (`DEFAULT_FISCAL_EMITTER_SETTINGS`), em que a coluna
   * "Sobre a venda" tem `icms: SUBTRAIR_DA_BASE` e `difal: SUBTRAIR_DA_BASE`
   * (Tese do Século). Verifica end-to-end: (1) wiring do baseConfig vindo do
   * tenant, (2) impacto correto da Tese na base PIS/COFINS.
   */
  it("VENDA: aplica composição da coluna 'Sobre a venda' (default = Tese do Século)", () => {
    // Produto com origem nacional (origem 0) para evitar override de 4% Senado.
    const nationalProduct = { ...product, origem: 0 };
    const stfRule: ResolvedTaxRule = {
      ruleId: "sku-PR-non_taxpayer-sale",
      // pICMS interna 26.1738% → DIFAL = (26.1738 − 7)% = 19.1738%
      aliquotaIcmsInterna: 26.1738,
      cfop: "6108",
      payload: {
        taxes: {
          pis: { st: "01 - Operação Tributável com Alíquota Básica", aliquota: 1.65 },
          cofins: { st: "01 - Operação Tributável com Alíquota Básica", aliquota: 7.6 },
          ipi: { st: "50 - Saída Tributada", aliquota: 0, codEnq: "999" },
        },
        icmsByUf: {
          ICMS_SP_CST: "00",
          ICMS_SP_PICMS_INTERNAL: 26.1738,
          ICMS_SP_PICMS_INTERSTATE: 7,
        },
      },
      icms: { cst: "00", pIcmsInternal: 26.1738, pIcmsInterstate: 7 },
    };

    const line = orderLineFromProduct(nationalProduct, {
      cfop: "6108",
      quantidade: 1,
      valorUnitario: 857.84,
    });

    const item = buildFiscalItem(
      { ...line, frete: 12.99 },
      stfRule,
      {
        ufOrigem: "PR",
        ufDestino: "SP",
        customerType: "non_taxpayer",
        operationTipo: "VENDA",
        emitterSettings: DEFAULT_FISCAL_EMITTER_SETTINGS,
      },
      7,
    );
    // Partilha 65/35 — espelha XML real do fulfillment ML.
    item.difal = { ...(item.difal as NonNullable<typeof item.difal>), pICMSInterPart: 65 };

    const nota = calcularNotaFiscal([item]);
    const r = nota.itens[0]!;

    // pICMS interestadual = 7% (rule.icms.pIcmsInterstate), origem 0 nacional.
    assert.equal(r.icms.pICMS, 7);
    // baseBruta = 857.84 + 12.99 = 870.83; vICMS = round2(870.83 × 0.07) = 60.96.
    assert.equal(r.icms.vICMS, 60.96);
    // vBCUFDest = 870.83; vDifal = round2(870.83×0.18) − round2(870.83×0.07)
    //                            = 156.75 − 60.96 = 95.79; partilha 65/35.
    const vDifalTotal = round2((r.difal?.vICMSUFDest ?? 0) + (r.difal?.vICMSUFRemet ?? 0));
    // base PIS/COFINS (Tese do Século) = baseBruta − vICMS − vDifal
    //                                  = 870.83 − 60.96 − 95.79 = 714.08.
    const baseEsperada = round2(870.83 - r.icms.vICMS - vDifalTotal);
    assert.equal(r.pis.vBC, baseEsperada);
    assert.equal(r.cofins.vBC, baseEsperada);
    // Em particular: a base é menor que a bruta — prova que a exclusão fluiu.
    assert.ok(r.pis.vBC < 870.83, "base PIS deve ser menor que baseBruta com STF ativo");

    // Confirma que a config injetada veio da coluna "venda" do default.
    assert.equal(item.pis.baseConfig?.icms, "DEDUCT");
    assert.equal(item.pis.baseConfig?.difal, "DEDUCT");
    assert.equal(item.pis.baseConfig?.frete, "INCLUDE");
    assert.equal(item.pis.baseConfig?.desconto, "DEDUCT");
  });

  /**
   * RETORNO_SIMBOLICO usa a coluna "Sobre a remessa". No default ela é idêntica
   * à "venda", mas o teste prova que o canal selecionado é o correto.
   */
  it("REMESSA: aplica composição da coluna 'Sobre a remessa' (canal distinto)", () => {
    // Settings customizadas: venda mantém Tese do Século; remessa
    // intencionalmente NÃO subtrai ICMS (para diferenciar do canal venda).
    const settings = {
      ...DEFAULT_FISCAL_EMITTER_SETTINGS,
      taxes: {
        ...DEFAULT_FISCAL_EMITTER_SETTINGS.taxes,
        composicaoBaseCalculo: {
          ...DEFAULT_FISCAL_EMITTER_SETTINGS.taxes.composicaoBaseCalculo,
          pisCofins: {
            ...DEFAULT_FISCAL_EMITTER_SETTINGS.taxes.composicaoBaseCalculo.pisCofins,
            icms: {
              ...DEFAULT_FISCAL_EMITTER_SETTINGS.taxes.composicaoBaseCalculo.pisCofins.icms,
              remessa: "NAO_SUBTRAIR" as const,
            },
          },
        },
      },
    };

    const line = orderLineFromProduct(product, {
      cfop: "2949",
      quantidade: 1,
      valorUnitario: 609,
    });

    const item = buildFiscalItem(
      line,
      inboundRuleZero,
      {
        ufOrigem: "SP",
        ufDestino: "MG",
        customerType: "taxpayer",
        operationTipo: "RETORNO_SIMBOLICO",
        emitterSettings: settings,
      },
      4,
    );

    // Canal "remessa" — alterado para NAO_SUBTRAIR.
    assert.equal(item.pis.baseConfig?.icms, "NONE");
    assert.equal(item.cofins.baseConfig?.icms, "NONE");
    // Demais lados (defaults da remessa) continuam idênticos à venda.
    assert.equal(item.pis.baseConfig?.frete, "INCLUDE");
    assert.equal(item.pis.baseConfig?.desconto, "DEDUCT");
    assert.equal(item.pis.baseConfig?.difal, "DEDUCT");
  });

  it("sem emitterSettings: cai no default conservador (LEGACY) sem exclusão ICMS/DIFAL", () => {
    const line = orderLineFromProduct(product, {
      cfop: "5102",
      quantidade: 1,
      valorUnitario: 1000,
    });

    const item = buildFiscalItem(
      { ...line, frete: 50, desconto: 20 },
      saleRule,
      {
        ufOrigem: "SP",
        ufDestino: "SP",
        customerType: "non_taxpayer",
        operationTipo: "VENDA",
      },
      18,
    );

    assert.equal(item.pis.baseConfig?.icms, "NONE");
    assert.equal(item.pis.baseConfig?.difal, "NONE");
    assert.equal(item.pis.baseConfig?.frete, "INCLUDE");
    assert.equal(item.pis.baseConfig?.desconto, "DEDUCT");

    const nota = calcularNotaFiscal([item]);
    // base = vProd + vFrete − vDesc = 1000 + 50 − 20 = 1030.
    assert.equal(nota.itens[0]!.pis.vBC, 1030);
    assert.equal(nota.itens[0]!.cofins.vBC, 1030);
  });
});
