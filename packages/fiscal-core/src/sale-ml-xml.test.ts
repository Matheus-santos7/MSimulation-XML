import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeTaxPercent, parseTaxPercent } from "./tax-percent.js";
import {
  assertTaxRuleCfopMatchesTree,
  CFOP_VENDA_NAO_CONTRIB_INTRA,
  CFOP_VENDA_NAO_CONTRIB_INTER,
  ML_NFE_VER_PROC,
  resolveSaleCfop,
  resolveUniformProdutoSt,
  SaleCfopConsistencyError,
  saleRoutingFromEmitterSettings,
  VENDA_ML_NAT_OP,
} from "./sale-cfop.js";

describe("normalizeTaxPercent", () => {
  it("converte alíquotas ML sem decimal (260 → 2,6)", () => {
    assert.equal(normalizeTaxPercent(260), 2.6);
    assert.equal(normalizeTaxPercent(165), 1.65);
    assert.equal(normalizeTaxPercent(760), 7.6);
  });

  it("mantém percentuais já decimais", () => {
    assert.equal(normalizeTaxPercent(2.6), 2.6);
    assert.equal(normalizeTaxPercent(18), 18);
  });

  it("parseTaxPercent aceita string com vírgula", () => {
    assert.equal(parseTaxPercent("2,6000"), 2.6);
  });
});

describe("resolveSaleCfop", () => {
  it("usa CFOP explícito da regra quando compatível com a operação", () => {
    assert.equal(resolveSaleCfop("PR", "PR", "non_taxpayer", "5101"), "5101");
  });

  it("5106 intraestadual para não contribuinte (emitente → comprador)", () => {
    assert.equal(resolveSaleCfop("PR", "PR", "non_taxpayer", ""), CFOP_VENDA_NAO_CONTRIB_INTRA);
  });

  it("6106 interestadual para não contribuinte", () => {
    assert.equal(resolveSaleCfop("PR", "SC", "non_taxpayer", null), CFOP_VENDA_NAO_CONTRIB_INTER);
  });

  it("normaliza CFOP legado 5105 para 6106 em operação interestadual SP→MG", () => {
    assert.equal(resolveSaleCfop("SP", "MG", "non_taxpayer", "5105"), CFOP_VENDA_NAO_CONTRIB_INTER);
  });

  it("normaliza CFOP legado 6105 para 5106 em operação intraestadual", () => {
    assert.equal(resolveSaleCfop("SP", "SP", "non_taxpayer", "6105"), CFOP_VENDA_NAO_CONTRIB_INTRA);
  });

  it("não usa UF do CD: MG→MG com emitente SP deve ser interestadual", () => {
    assert.equal(resolveSaleCfop("SP", "MG", "non_taxpayer", ""), CFOP_VENDA_NAO_CONTRIB_INTER);
  });

  it("com routing armazem_geral usa árvore (industria → 5105/6105)", () => {
    assert.equal(
      resolveSaleCfop("SP", "SP", "non_taxpayer", "5102", {
        logistica: "armazem_geral",
        perfilVendedor: "industria",
      }),
      "5105",
    );
    assert.equal(
      resolveSaleCfop("SP", "MG", "non_taxpayer", null, {
        logistica: "armazem_geral",
        perfilVendedor: "industria",
      }),
      "6105",
    );
  });

  it("com routing estoque_proprio comercio NC interestadual → 6108", () => {
    assert.equal(
      resolveSaleCfop("PR", "SC", "non_taxpayer", "6106", {
        logistica: "estoque_proprio",
        perfilVendedor: "comercio",
      }),
      "6108",
    );
  });
});

describe("saleRoutingFromEmitterSettings", () => {
  it("lê perfil e logística das settings; ST só com estoque_proprio", () => {
    const routing = saleRoutingFromEmitterSettings(
      {
        basic: {
          formaFaturamento: "EMISSOR_PROPRIO",
          dadosFiscaisAnunciosOk: false,
          perfilVendedor: "industria",
          logisticaPadrao: "armazem_geral",
        },
      },
      { produtoSt: true },
    );
    assert.equal(routing.perfilVendedor, "industria");
    assert.equal(routing.logistica, "armazem_geral");
    assert.equal(routing.produtoSt, false);

    const st = saleRoutingFromEmitterSettings(
      {
        basic: {
          formaFaturamento: "EMISSOR_PROPRIO",
          dadosFiscaisAnunciosOk: false,
          logisticaPadrao: "estoque_proprio",
          stInterestadualMode: "protocolo",
        },
      },
      { produtoSt: true },
    );
    assert.equal(st.produtoSt, true);
    assert.equal(st.stInterestadualMode, "protocolo");
  });
});

describe("resolveUniformProdutoSt", () => {
  it("aceita flags homogêneas", () => {
    assert.equal(resolveUniformProdutoSt([false, false]), false);
    assert.equal(resolveUniformProdutoSt([true, true]), true);
  });

  it("rejeita mistos ST / não-ST", () => {
    assert.throws(() => resolveUniformProdutoSt([true, false]), SaleCfopConsistencyError);
  });
});

describe("assertTaxRuleCfopMatchesTree", () => {
  it("aceita regra sem CFOP ou com prefixo 5↔6 alinhado", () => {
    assertTaxRuleCfopMatchesTree("6106", undefined, "SP", "MG");
    assertTaxRuleCfopMatchesTree("6106", "5106", "SP", "MG");
    assertTaxRuleCfopMatchesTree("5106", "6106", "SP", "SP");
  });

  it("rejeita natureza divergente (5102 vs 5106)", () => {
    assert.throws(
      () => assertTaxRuleCfopMatchesTree("5106", "5102", "SP", "SP"),
      SaleCfopConsistencyError,
    );
  });

  it("integra árvore Full comércio + TaxRule 5106", () => {
    const routing = saleRoutingFromEmitterSettings({
      basic: {
        formaFaturamento: "EMISSOR_PROPRIO",
        dadosFiscaisAnunciosOk: false,
        perfilVendedor: "comercio",
        logisticaPadrao: "armazem_geral",
      },
    });
    const treeCfop = resolveSaleCfop("PR", "PR", "non_taxpayer", "5102", routing);
    assert.equal(treeCfop, "5106");
    assertTaxRuleCfopMatchesTree(treeCfop, "5106", "PR", "PR");
    assert.throws(
      () => assertTaxRuleCfopMatchesTree(treeCfop, "5102", "PR", "PR"),
      SaleCfopConsistencyError,
    );
  });
});

describe("constantes ML venda", () => {
  it("natOp e verProc alinhados ao emissor ML", () => {
    assert.equal(VENDA_ML_NAT_OP, "Venda de mercadorias");
    assert.equal(ML_NFE_VER_PROC, "mercadolivre.invoice");
  });
});
