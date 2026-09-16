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

describe("mirrorOriginForDevolucao — devolução parcial por item", () => {
  const twoItemSale = () =>
    calcularNotaFiscal([
      calcularItem({ ...baseSaleItem(), numeroItem: 1, codigo: "SKU1", quantidade: 1 }),
      calcularItem({
        ...baseSaleItem(),
        numeroItem: 2,
        codigo: "SKU2",
        quantidade: 2,
        valorUnitario: 333.33,
        frete: 0,
      }),
    ]);

  it("engine legado com nItem=1 em todas as linhas usa a posição em <det> (MOC)", () => {
    const sale = twoItemSale();
    const origin = {
      ...sale,
      itens: sale.itens.map((item) => ({ ...item, numeroItem: 1 })),
    };
    const partial = mirrorOriginForDevolucao({
      origin,
      itens: [{ numeroItem: 2, quantidade: 1 }],
      nonContributorIpi: true,
    });

    assert.equal(partial.itens.length, 1);
    assert.equal(partial.itens[0]!.codigo, "SKU2");
    assert.equal(partial.itens[0]!.quantidade, 1);
  });

  it("espelha só as linhas pedidas, renumera nItem e escala pela quantidade devolvida", () => {
    const sale = twoItemSale();
    const partial = mirrorOriginForDevolucao({
      origin: sale,
      itens: [{ numeroItem: 2, quantidade: 1 }],
      nonContributorIpi: true,
    });

    const origin = sale.itens[1]!;
    assert.equal(partial.itens.length, 1);
    const d = partial.itens[0]!;
    assert.equal(d.numeroItem, 1);
    assert.equal(d.codigo, "SKU2");
    assert.equal(d.quantidade, 1);
    assert.equal(d.icms.vBC, Number((origin.icms.vBC * 0.5).toFixed(2)));
    assert.equal(d.icms.vICMS, Number((origin.icms.vICMS * 0.5).toFixed(2)));
    assert.equal(d.pis.vPIS, Number((origin.pis.vPIS * 0.5).toFixed(2)));
    assert.equal(d.difal!.vICMSUFDest, Number((origin.difal!.vICMSUFDest * 0.5).toFixed(2)));
    assert.equal(partial.totais.vBC, d.icms.vBC);
    assert.equal(partial.totais.vProd, d.vProd);
  });

  it("vProd da linha devolvida = round2(qtd × valorUnitario) (MOC: vProd = qCom × vUnCom)", () => {
    const sale = twoItemSale();
    const partial = mirrorOriginForDevolucao({
      origin: sale,
      itens: [{ numeroItem: 2, quantidade: 1 }],
      nonContributorIpi: false,
    });
    assert.equal(partial.itens[0]!.vProd, 333.33);
    assert.equal(partial.itens[0]!.valorUnitario, 333.33);
  });

  it("pDevol é o percentual da mercadoria devolvida (NT 2016.002) e vIPIDevol é proporcional", () => {
    const sale = twoItemSale();
    const partial = mirrorOriginForDevolucao({
      origin: sale,
      itens: [{ numeroItem: 2, quantidade: 1 }],
      nonContributorIpi: true,
    });
    const origin = sale.itens[1]!;
    const d = partial.itens[0]!;
    assert.equal(d.impostoDevol!.pDevol, 50);
    assert.equal(d.impostoDevol!.vIPIDevol, Number((origin.ipi!.vIPI * 0.5).toFixed(2)));
    assert.equal(d.ipi, undefined);
    assert.equal(partial.totais.vIPIDevol, d.impostoDevol!.vIPIDevol);
  });

  it("devolver todas as linhas com quantidade integral equivale ao espelho ratio 1", () => {
    const sale = twoItemSale();
    const full = mirrorOriginForDevolucao({ origin: sale, ratio: 1, nonContributorIpi: true });
    const byItems = mirrorOriginForDevolucao({
      origin: sale,
      itens: [
        { numeroItem: 1, quantidade: 1 },
        { numeroItem: 2, quantidade: 2 },
      ],
      nonContributorIpi: true,
    });
    assert.deepEqual(byItems, full);
    assert.equal(byItems.itens[0]!.impostoDevol!.pDevol, 100);
  });

  it("mantém a ordem das linhas da origem independente da ordem do pedido", () => {
    const sale = twoItemSale();
    const partial = mirrorOriginForDevolucao({
      origin: sale,
      itens: [
        { numeroItem: 2, quantidade: 1 },
        { numeroItem: 1, quantidade: 1 },
      ],
      nonContributorIpi: false,
    });
    assert.deepEqual(
      partial.itens.map((i) => [i.numeroItem, i.codigo]),
      [
        [1, "SKU1"],
        [2, "SKU2"],
      ],
    );
  });

  it("rejeita nItem inexistente, quantidade acima da origem ou não positiva", () => {
    const sale = twoItemSale();
    assert.throws(
      () =>
        mirrorOriginForDevolucao({
          origin: sale,
          itens: [{ numeroItem: 3, quantidade: 1 }],
          nonContributorIpi: false,
        }),
      /item 3/i,
    );
    assert.throws(
      () =>
        mirrorOriginForDevolucao({
          origin: sale,
          itens: [{ numeroItem: 2, quantidade: 3 }],
          nonContributorIpi: false,
        }),
      /excede/i,
    );
    assert.throws(
      () =>
        mirrorOriginForDevolucao({
          origin: sale,
          itens: [{ numeroItem: 1, quantidade: 0 }],
          nonContributorIpi: false,
        }),
      /quantidade/i,
    );
  });
});
