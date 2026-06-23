import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calcularItem,
  calcularNotaFiscal,
  calcularTotais,
  round2,
  type BasePisCofinsConfig,
  type ItemFiscalInput,
  type ItemFiscalResult,
} from "./tax-engine.js";

/** Config padrão (pós-STF): exclui ICMS e DIFAL; demais componentes neutros. */
const BASE_CONFIG_STF: BasePisCofinsConfig = {
  frete: "INCLUDE",
  desconto: "DEDUCT",
  icms: "DEDUCT",
  difal: "DEDUCT",
  fcpIcms: "NONE",
  fcpDifal: "NONE",
  ipi: "NONE",
  acrescimo: "NONE",
};

/** Caso golden NF 781 (PR→SP, consumidor final) — espelha `tmp-engine-check.ts` / XML real. */
const itemNf781: ItemFiscalInput = {
  numeroItem: 1,
  codigo: "300002137",
  descricao: "Fogao 4 Bocas Atlas",
  ncm: "73211100",
  cfop: "6105",
  unidade: "UNID",
  quantidade: 1,
  valorUnitario: 1033.42,
  icms: { cst: "00", orig: 5, pICMS: 12, pRedBC: 0, pFCP: 0 },
  ipi: { cst: "50", pIPI: 2.6, cEnq: "999" },
  pis: { cst: "01", aliquota: 1.65, pRedBC: 18.4675 },
  cofins: { cst: "01", aliquota: 7.6, pRedBC: 18.4675 },
  difal: { pICMSInter: 12, pICMSUFDest: 18, pFCPUFDest: 0 },
  incluirIpiNaBaseIcms: true,
};

function sumItens(
  itens: ItemFiscalResult[],
  pick: (item: ItemFiscalResult) => number,
): number {
  return itens.reduce((acc, item) => round2(acc + pick(item)), 0);
}

describe("tax-engine", () => {
  it("round2 arredonda comercialmente para 2 casas", () => {
    assert.equal(round2(1.005), 1.01);
    assert.equal(round2(10.994), 10.99);
  });

  it("NF 781 — valores batem com XML de referência", () => {
    const nota = calcularNotaFiscal([itemNf781]);
    const r = nota.itens[0]!;

    assert.equal(r.vProd, 1033.42);
    assert.equal(r.icms.vBC, 1060.29);
    assert.equal(r.icms.vICMS, 127.23);
    assert.equal(r.ipi?.vIPI, 26.87);
    assert.equal(r.pis.vPIS, 13.9);
    assert.equal(r.cofins.vCOFINS, 64.04);
    assert.equal(r.difal?.vICMSUFDest, 63.62);
    assert.equal(r.difal?.pICMSInterPart, 100);
    assert.equal(r.difal?.vICMSUFRemet, 0);
    assert.equal(nota.totais.vNF, 1060.29);
  });

  it("ICMSTot é soma dos itens já arredondados (anti 532/533)", () => {
    const nota = calcularNotaFiscal([itemNf781, itemNf781]);
    const { itens, totais } = nota;

    assert.equal(totais.vBC, sumItens(itens, (i) => i.icms.vBC));
    assert.equal(totais.vICMS, sumItens(itens, (i) => i.icms.vICMS));
    assert.equal(totais.vFCP, sumItens(itens, (i) => i.icms.vFCP));
    assert.equal(totais.vProd, sumItens(itens, (i) => i.vProd));
    assert.equal(totais.vIPI, sumItens(itens, (i) => i.ipi?.vIPI ?? 0));
    assert.equal(totais.vPIS, sumItens(itens, (i) => i.pis.vPIS));
    assert.equal(totais.vCOFINS, sumItens(itens, (i) => i.cofins.vCOFINS));
    assert.equal(totais.vICMSUFDest, sumItens(itens, (i) => i.difal?.vICMSUFDest ?? 0));
  });

  it("vNF segue fórmula SEFAZ a partir dos totais agregados", () => {
    const nota = calcularNotaFiscal([itemNf781]);
    const t = nota.totais;
    const vNFEsperado = round2(
      t.vProd + t.vST + t.vFrete + t.vSeg + t.vOutro + t.vIPI - t.vDesc,
    );
    assert.equal(t.vNF, vNFEsperado);
    assert.equal(calcularTotais(nota.itens).vNF, t.vNF);
  });

  it("FCP não entra no pICMS — tags separadas", () => {
    const item = calcularItem({
      numeroItem: 1,
      codigo: "A",
      descricao: "Teste",
      ncm: "00000000",
      cfop: "5102",
      unidade: "UN",
      quantidade: 1,
      valorUnitario: 100,
      icms: { cst: "00", orig: 0, pICMS: 18, pFCP: 2 },
      pis: { cst: "01", aliquota: 0 },
      cofins: { cst: "01", aliquota: 0 },
    });
    assert.equal(item.icms.pICMS, 18);
    assert.equal(item.icms.pFCP, 2);
    assert.equal(item.icms.vFCP, round2(item.icms.vBC * 0.02));
    assert.equal(item.icms.vICMS, round2(item.icms.vBC * 0.18));
  });

  it("item intraestadual simples sem IPI na base do ICMS", () => {
    const item = calcularItem({
      numeroItem: 1,
      codigo: "B",
      descricao: "Simples",
      ncm: "00000000",
      cfop: "5102",
      unidade: "UN",
      quantidade: 2,
      valorUnitario: 50,
      icms: { cst: "00", orig: 0, pICMS: 18 },
      pis: { cst: "01", aliquota: 1.65 },
      cofins: { cst: "01", aliquota: 7.6 },
      incluirIpiNaBaseIcms: false,
    });
    assert.equal(item.vProd, 100);
    assert.equal(item.icms.vBC, 100);
    assert.equal(item.icms.vICMS, 18);
  });

  it("zera vBC quando CST é isento/não tributado (40/41/50/60)", () => {
    const item = calcularItem({
      numeroItem: 1,
      codigo: "D",
      descricao: "Isento",
      ncm: "00000000",
      cfop: "5949",
      unidade: "UN",
      quantidade: 1,
      valorUnitario: 100,
      icms: { cst: "40", orig: 0, pICMS: 18 },
      pis: { cst: "01", aliquota: 1.65 },
      cofins: { cst: "01", aliquota: 7.6 },
    });
    assert.equal(item.icms.vBC, 0);
    assert.equal(item.icms.vICMS, 0);
  });

  it("desconto e frete por item compõem a base do ICMS e somam corretamente em <ICMSTot>", () => {
    const item: ItemFiscalInput = {
      numeroItem: 1,
      codigo: "PROD-DESC-FRETE",
      descricao: "Produto com desconto e frete",
      ncm: "73211100",
      cfop: "5102",
      unidade: "UN",
      quantidade: 1,
      valorUnitario: 1000,
      frete: 50,
      desconto: 20,
      icms: { cst: "00", orig: 0, pICMS: 19.5 },
      pis: { cst: "01", aliquota: 1.65 },
      cofins: { cst: "01", aliquota: 7.6 },
      incluirIpiNaBaseIcms: false,
    };

    const nota = calcularNotaFiscal([item, item]);
    const r = nota.itens[0]!;

    // vBC do ICMS = vProd + vFrete - vDesc (imposto por dentro, MOC 7.0).
    assert.equal(r.vProd, 1000);
    assert.equal(r.vFrete, 50);
    assert.equal(r.vDesc, 20);
    assert.equal(r.icms.vBC, 1030);
    assert.equal(r.icms.vICMS, round2(1030 * 0.195));

    // <ICMSTot> = soma (reduce) dos itens já arredondados.
    assert.equal(nota.totais.vFrete, sumItens(nota.itens, (i) => i.vFrete));
    assert.equal(nota.totais.vDesc, sumItens(nota.itens, (i) => i.vDesc));
    assert.equal(nota.totais.vProd, sumItens(nota.itens, (i) => i.vProd));

    // vNF fecha pela fórmula SEFAZ: vProd + vFrete + vIPI - vDesc.
    const t = nota.totais;
    assert.equal(t.vNF, round2(t.vProd + t.vFrete + t.vIPI - t.vDesc));
  });

  it(
    "PIS/COFINS — baseConfig pós-STF: exclui ICMS e DIFAL da base (caso real ML Full)",
    () => {
      // Caso real (paridade ML Full): vProd 857.84, vFrete 12.99, vICMS 57.14,
      // vICMSUFDest 108.53, vICMSUFRemet 58.44 → base esperada 646.72.
      // Alíquotas escolhidas para produzir EXATAMENTE esses valores após round2.
      const item = calcularItem({
        numeroItem: 1,
        codigo: "ML-FULL-CASO-REAL",
        descricao: "Item paridade Mercado Livre Fulfillment",
        ncm: "73211100",
        cfop: "6108",
        unidade: "UN",
        quantidade: 1,
        valorUnitario: 857.84,
        frete: 12.99,
        // baseBruta = 870.83; pICMS 6.5618 → vICMS = round2(57.14)
        icms: { cst: "00", orig: 0, pICMS: 6.5618 },
        pis: { cst: "01", aliquota: 1.65, baseConfig: BASE_CONFIG_STF },
        cofins: { cst: "01", aliquota: 7.6, baseConfig: BASE_CONFIG_STF },
        // DIFAL: pDiff = 19.1738 → vDifalTotal 166.97 (= 108.53 + 58.44);
        // partilha 65/35 → vICMSUFDest 108.53 e vICMSUFRemet 58.44.
        difal: {
          pICMSInter: 7,
          pICMSUFDest: 26.1738,
          pICMSInterPart: 65,
        },
        incluirIpiNaBaseIcms: false,
      });

      assert.equal(item.icms.vICMS, 57.14);
      assert.equal(item.difal?.vICMSUFDest, 108.53);
      assert.equal(item.difal?.vICMSUFRemet, 58.44);
      assert.equal(item.pis.vBC, 646.72);
      assert.equal(item.cofins.vBC, 646.72);
      assert.equal(item.pis.vPIS, round2(646.72 * 0.0165));
      assert.equal(item.cofins.vCOFINS, round2(646.72 * 0.076));
    },
  );

  it(
    "PIS/COFINS — baseConfig default (sem baseConfig) mantém base bruta (frete na base, desc subtraído)",
    () => {
      const baseInput: ItemFiscalInput = {
        numeroItem: 1,
        codigo: "ML-FULL-LEGADO",
        descricao: "Item sem exclusão da base PIS/COFINS",
        ncm: "73211100",
        cfop: "6108",
        unidade: "UN",
        quantidade: 1,
        valorUnitario: 857.84,
        frete: 12.99,
        icms: { cst: "00", orig: 0, pICMS: 6.5618 },
        pis: { cst: "01", aliquota: 1.65 },
        cofins: { cst: "01", aliquota: 7.6 },
        difal: { pICMSInter: 7, pICMSUFDest: 26.1738, pICMSInterPart: 65 },
        incluirIpiNaBaseIcms: false,
      };

      const item = calcularItem(baseInput);
      // Default conservador (LEGACY_BASE_PIS_COFINS_CONFIG): frete inclui +
      // desconto subtrai, mas ICMS/DIFAL/FCP/IPI/acréscimo todos neutros.
      // → base = vProd + vFrete = 857.84 + 12.99 = 870.83.
      assert.equal(item.pis.vBC, 870.83);
      assert.equal(item.cofins.vBC, 870.83);
    },
  );

  it(
    "PIS/COFINS — baseConfig pós-STF respeita pRedBC: dedução ANTES da redução por benefício",
    () => {
      // NF 781: pRedBC 18.4675% continua valendo. Com BASE_CONFIG_STF, tanto
      // vICMS quanto a parcela do DIFAL (vICMSUFDest + vICMSUFRemet) são
      // deduzidas, e A REDUÇÃO POR BENEFÍCIO é aplicada DEPOIS.
      const item = calcularItem({
        ...itemNf781,
        pis: { ...itemNf781.pis, baseConfig: BASE_CONFIG_STF },
        cofins: { ...itemNf781.cofins, baseConfig: BASE_CONFIG_STF },
      });
      // baseBruta = 1033.42; vICMS = 127.23; vDifal (partilha 100%) = 63.62.
      // baseAposExclusao = 1033.42 − 127.23 − 63.62 = 842.57.
      // redução 18.4675% → vBC = round2(842.57 × 0.815325) = 686.97.
      const exclusaoDifal = round2(
        (item.difal?.vICMSUFDest ?? 0) + (item.difal?.vICMSUFRemet ?? 0),
      );
      const baseExcl = round2(1033.42 - item.icms.vICMS - exclusaoDifal);
      const vBcEsperado = round2(baseExcl * (1 - 0.184675));
      assert.equal(item.pis.vBC, vBcEsperado);
      assert.equal(item.cofins.vBC, vBcEsperado);
    },
  );

  it(
    "PIS/COFINS — base trava em 0 quando exclusão > base bruta (descontos atípicos)",
    () => {
      const item = calcularItem({
        numeroItem: 1,
        codigo: "TRAVA-ZERO",
        descricao: "Cenário de borda",
        ncm: "00000000",
        cfop: "5102",
        unidade: "UN",
        quantidade: 1,
        valorUnitario: 10,
        desconto: 0,
        // pICMS irrealisticamente alto só para forçar exclusão maior que base.
        icms: { cst: "00", orig: 0, pICMS: 150 },
        pis: { cst: "01", aliquota: 1.65, baseConfig: BASE_CONFIG_STF },
        cofins: { cst: "01", aliquota: 7.6, baseConfig: BASE_CONFIG_STF },
      });
      assert.equal(item.pis.vBC, 0);
      assert.equal(item.cofins.vBC, 0);
      assert.equal(item.pis.vPIS, 0);
      assert.equal(item.cofins.vCOFINS, 0);
    },
  );

  it(
    "PIS/COFINS — acrescimo INCLUDE compõe vOutro na base, IPI INCLUDE compõe vIPI",
    () => {
      const config: BasePisCofinsConfig = {
        frete: "INCLUDE",
        desconto: "DEDUCT",
        icms: "NONE",
        difal: "NONE",
        fcpIcms: "NONE",
        fcpDifal: "NONE",
        ipi: "INCLUDE",
        acrescimo: "INCLUDE",
      };
      const item = calcularItem({
        numeroItem: 1,
        codigo: "ACR-IPI",
        descricao: "Item com IPI e acréscimo na base",
        ncm: "00000000",
        cfop: "5102",
        unidade: "UN",
        quantidade: 1,
        valorUnitario: 100,
        frete: 10,
        despesasAcessorias: 5,
        desconto: 2,
        // pICMS 0 para isolar a base; pIPI 10% sobre baseBruta = 113.
        icms: { cst: "00", orig: 0, pICMS: 0 },
        ipi: { cst: "50", pIPI: 10 },
        pis: { cst: "01", aliquota: 1.65, baseConfig: config },
        cofins: { cst: "01", aliquota: 7.6, baseConfig: config },
        incluirIpiNaBaseIcms: false,
      });
      // baseBruta = vProd+vFrete+vOutro−vDesc = 100+10+5−2 = 113
      // vIPI = round2(113 × 0.10) = 11.30
      // base PIS/COFINS = vProd + vSeg + vFrete + vOutro + vIPI − vDesc
      //                  = 100 + 0 + 10 + 5 + 11.30 − 2 = 124.30
      assert.equal(item.ipi?.vIPI, 11.3);
      assert.equal(item.pis.vBC, 124.3);
      assert.equal(item.cofins.vBC, 124.3);
    },
  );

  it(
    "PIS/COFINS — config restritiva 'tudo NONE' isola só vProd+vSeg na base",
    () => {
      const config: BasePisCofinsConfig = {
        frete: "NONE",
        desconto: "NONE",
        icms: "NONE",
        difal: "NONE",
        fcpIcms: "NONE",
        fcpDifal: "NONE",
        ipi: "NONE",
        acrescimo: "NONE",
      };
      const item = calcularItem({
        numeroItem: 1,
        codigo: "ISOLATE-VPROD",
        descricao: "Apenas vProd compõe a base",
        ncm: "00000000",
        cfop: "5102",
        unidade: "UN",
        quantidade: 1,
        valorUnitario: 200,
        frete: 50,
        desconto: 20,
        seguro: 7,
        icms: { cst: "00", orig: 0, pICMS: 18 },
        pis: { cst: "01", aliquota: 1.65, baseConfig: config },
        cofins: { cst: "01", aliquota: 7.6, baseConfig: config },
      });
      // base = vProd + vSeg = 200 + 7 = 207 (frete, desconto, ICMS ignorados).
      assert.equal(item.pis.vBC, 207);
      assert.equal(item.cofins.vBC, 207);
    },
  );

  it(
    "PIS/COFINS — FCP do ICMS DEDUCT e FCP do DIFAL DEDUCT subtraem os valores corretos",
    () => {
      const config: BasePisCofinsConfig = {
        frete: "INCLUDE",
        desconto: "DEDUCT",
        icms: "NONE",
        difal: "NONE",
        fcpIcms: "DEDUCT",
        fcpDifal: "DEDUCT",
        ipi: "NONE",
        acrescimo: "NONE",
      };
      const item = calcularItem({
        numeroItem: 1,
        codigo: "FCP-DEDUCT",
        descricao: "Item com FCP do ICMS e FCP do DIFAL deduzidos",
        ncm: "00000000",
        cfop: "6108",
        unidade: "UN",
        quantidade: 1,
        valorUnitario: 1000,
        icms: { cst: "00", orig: 0, pICMS: 12, pFCP: 2 },
        pis: { cst: "01", aliquota: 1.65, baseConfig: config },
        cofins: { cst: "01", aliquota: 7.6, baseConfig: config },
        difal: { pICMSInter: 12, pICMSUFDest: 18, pFCPUFDest: 1, pICMSInterPart: 100 },
      });
      // vBC ICMS = 1000; vFCP = round2(1000 × 0.02) = 20.
      // vBCUFDest = 1000; pDiff = 6 → vDifal = 60; partilha 100% → vICMSUFDest=60.
      // vFCPUFDest = round2(1000 × 0.01) = 10.
      // base PIS = vProd + vSeg − vFCP − vFCPUFDest = 1000 − 20 − 10 = 970.
      assert.equal(item.icms.vFCP, 20);
      assert.equal(item.difal?.vFCPUFDest, 10);
      assert.equal(item.pis.vBC, 970);
      assert.equal(item.cofins.vBC, 970);
    },
  );

  it("zera vBC de ICMS/PIS/COFINS/IPI quando alíquota é 0% (remessa/retorno)", () => {
    const item = calcularItem({
      numeroItem: 1,
      codigo: "C",
      descricao: "Inbound",
      ncm: "85094010",
      cfop: "6949",
      unidade: "UN",
      quantidade: 10,
      valorUnitario: 609,
      icms: { cst: "90", orig: 2, pICMS: 0 },
      ipi: { cst: "55", pIPI: 0, cEnq: "103" },
      pis: { cst: "98", aliquota: 0 },
      cofins: { cst: "98", aliquota: 0 },
    });
    assert.equal(item.vProd, 6090);
    assert.equal(item.icms.vBC, 0);
    assert.equal(item.icms.vICMS, 0);
    assert.equal(item.pis.vBC, 0);
    assert.equal(item.cofins.vBC, 0);
    assert.equal(item.ipi?.vBC, 0);
  });
});
