import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calcularItem, calcularNotaFiscal, type ItemFiscalInput } from "./tax-engine.js";
import { mirrorOriginForDevolucao } from "./mirror-origin-for-devolucao.js";

const baseSaleItem = (): ItemFiscalInput => ({
  numeroItem: 1,
  codigo: "SKU1",
  descricao: "Produto",
  ncm: "85171231",
  cfop: "6108",
  unidade: "UN",
  quantidade: 2,
  valorUnitario: 500,
  icms: { cst: "00", orig: 2, pICMS: 12, pFCP: 0 },
  pis: { cst: "01", aliquota: 1.65 },
  cofins: { cst: "01", aliquota: 7.6 },
  difal: { pICMSInter: 12, pICMSUFDest: 18, pFCPUFDest: 2, pICMSInterPart: 100 },
  ipi: { cst: "50", pIPI: 5, cEnq: "999" },
  incluirIpiNaBaseIcms: true,
});

describe("mirrorOriginForDevolucao", () => {
  it("espelha BC/ICMS/DIFAL/FCP proporcionalmente e mantém vICMSUFDest", () => {
    const sale = calcularNotaFiscal([calcularItem(baseSaleItem())]);
    const half = mirrorOriginForDevolucao({
      origin: sale,
      ratio: 0.5,
      nonContributorIpi: true,
    });

    const o = sale.itens[0]!;
    const d = half.itens[0]!;
    assert.equal(d.icms.orig, 2);
    assert.equal(d.icms.cst, "00");
    assert.equal(d.icms.vBC, Number((o.icms.vBC * 0.5).toFixed(2)));
    assert.equal(d.icms.vICMS, Number((o.icms.vICMS * 0.5).toFixed(2)));
    assert.equal(d.icms.vFCP, 0);
    assert.ok(d.difal);
    assert.equal(d.difal!.vICMSUFDest, Number((o.difal!.vICMSUFDest * 0.5).toFixed(2)));
    assert.equal(d.difal!.vICMSUFRemet, Number((o.difal!.vICMSUFRemet * 0.5).toFixed(2)));
    assert.equal(d.difal!.vFCPUFDest, Number((o.difal!.vFCPUFDest * 0.5).toFixed(2)));
    assert.equal(half.totais.vFCP, 0);
    assert.equal(half.totais.vFCPUFDest, d.difal!.vFCPUFDest);
  });

  it("IPI de não contribuinte vai para impostoDevol — não em vIPI/vProd", () => {
    const sale = calcularNotaFiscal([calcularItem(baseSaleItem())]);
    const full = mirrorOriginForDevolucao({
      origin: sale,
      ratio: 1,
      nonContributorIpi: true,
    });
    const item = full.itens[0]!;
    assert.ok(item.impostoDevol);
    assert.equal(item.impostoDevol!.pDevol, 100);
    assert.ok((item.impostoDevol!.vIPIDevol ?? 0) > 0);
    assert.equal(item.ipi, undefined);
    assert.equal(full.totais.vIPI, 0);
    assert.equal(full.totais.vIPIDevol, item.impostoDevol!.vIPIDevol);
    assert.equal(
      full.totais.vNF,
      Number(
        (
          full.totais.vProd +
          full.totais.vFrete +
          full.totais.vIPIDevol -
          full.totais.vDesc
        ).toFixed(2),
      ),
    );
  });

  it("contribuinte de IPI mantém IPI tributado (sem impostoDevol)", () => {
    const sale = calcularNotaFiscal([calcularItem(baseSaleItem())]);
    const full = mirrorOriginForDevolucao({
      origin: sale,
      ratio: 1,
      nonContributorIpi: false,
    });
    assert.equal(full.itens[0]!.impostoDevol, undefined);
    assert.ok((full.itens[0]!.ipi?.vIPI ?? 0) > 0);
    assert.equal(full.totais.vIPIDevol, 0);
  });
});
