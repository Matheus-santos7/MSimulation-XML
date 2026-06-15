import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calcularItem,
  calcularNotaFiscal,
  calcularTotais,
  round2,
  type ItemFiscalInput,
  type ItemFiscalResult,
} from "./tax-engine.js";

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
