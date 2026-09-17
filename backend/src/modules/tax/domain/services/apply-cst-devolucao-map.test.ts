import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FiscalEmitterSettingsData } from "@msimulation-xml/fiscal-core";
import { calcularItem, calcularNotaFiscal, type ItemFiscalInput } from "./tax-engine.js";
import { mirrorOriginForDevolucao } from "./mirror-origin-for-devolucao.js";
import { applyCstDevolucaoMap } from "./apply-cst-devolucao-map.js";

const saleItem = (overrides: Partial<ItemFiscalInput> = {}): ItemFiscalInput => ({
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
  ipi: { cst: "50", pIPI: 5, cEnq: "999" },
  incluirIpiNaBaseIcms: true,
  ...overrides,
});

const cstDevolucao = (
  patch: Partial<FiscalEmitterSettingsData["taxes"]["cstDevolucao"]> = {},
): FiscalEmitterSettingsData["taxes"]["cstDevolucao"] => ({
  mode: "CUSTOM",
  icms: [{ venda: "00", devolucao: "41" }],
  pisCofins: [
    { venda: "01", devolucao: "50" },
    { venda: "02", devolucao: "50" },
    { venda: "03", devolucao: "50" },
    { venda: "04", devolucao: "98" },
    { venda: "05", devolucao: "98" },
    { venda: "06", devolucao: "98" },
    { venda: "07", devolucao: "98" },
    { venda: "08", devolucao: "98" },
    { venda: "09", devolucao: "98" },
    { venda: "49", devolucao: "98" },
    { venda: "99", devolucao: "98" },
  ],
  ...patch,
});

describe("applyCstDevolucaoMap", () => {
  it("não altera a nota quando o modo é DEFAULT", () => {
    const origin = calcularNotaFiscal([calcularItem(saleItem())]);
    const mirrored = mirrorOriginForDevolucao({ origin, ratio: 1, nonContributorIpi: true });
    const mapped = applyCstDevolucaoMap(mirrored, cstDevolucao({ mode: "DEFAULT" }));

    assert.equal(mapped.itens[0]!.icms.cst, "00");
    assert.equal(mapped.itens[0]!.pis.cst, "01");
    assert.equal(mapped.itens[0]!.icms.vICMS, mirrored.itens[0]!.icms.vICMS);
    assert.equal(mapped.totais.vICMS, mirrored.totais.vICMS);
  });

  it("aplica o DE/PARA da tela: PIS/COFINS 01→50 e preserva bases/valores", () => {
    const origin = calcularNotaFiscal([calcularItem(saleItem())]);
    const mirrored = mirrorOriginForDevolucao({ origin, ratio: 1, nonContributorIpi: false });
    const mapped = applyCstDevolucaoMap(mirrored, cstDevolucao({ icms: [] }));

    const item = mapped.itens[0]!;
    assert.equal(item.pis.cst, "50");
    assert.equal(item.cofins.cst, "50");
    assert.equal(item.pis.vBC, mirrored.itens[0]!.pis.vBC);
    assert.equal(item.pis.vPIS, mirrored.itens[0]!.pis.vPIS);
    assert.equal(item.cofins.vCOFINS, mirrored.itens[0]!.cofins.vCOFINS);
    assert.equal(item.icms.cst, "00");
    assert.equal(item.ipi?.cst, mirrored.itens[0]!.ipi?.cst);
  });

  it("mapeia PIS/COFINS monofásico 04→98 (DE/PARA customizado da tela)", () => {
    const origin = calcularNotaFiscal([
      calcularItem(saleItem({ pis: { cst: "04", aliquota: 0 }, cofins: { cst: "04", aliquota: 0 } })),
    ]);
    const mirrored = mirrorOriginForDevolucao({ origin, ratio: 1, nonContributorIpi: false });
    const mapped = applyCstDevolucaoMap(mirrored, cstDevolucao({ icms: [] }));

    assert.equal(mapped.itens[0]!.pis.cst, "98");
    assert.equal(mapped.itens[0]!.cofins.cst, "98");
  });

  it("ICMS 00→41 zera vBC/vICMS e reconcilia ICMSTot (Rejeição 532)", () => {
    const origin = calcularNotaFiscal([calcularItem(saleItem())]);
    const mirrored = mirrorOriginForDevolucao({ origin, ratio: 1, nonContributorIpi: true });
    assert.ok(mirrored.itens[0]!.icms.vICMS > 0);

    const mapped = applyCstDevolucaoMap(mirrored, cstDevolucao());
    const item = mapped.itens[0]!;

    assert.equal(item.icms.cst, "41");
    assert.equal(item.icms.vBC, 0);
    assert.equal(item.icms.vICMS, 0);
    assert.equal(item.icms.pICMS, 0);
    assert.equal(mapped.totais.vBC, 0);
    assert.equal(mapped.totais.vICMS, 0);
    assert.equal(mapped.totais.vNF, mirrored.totais.vNF);
    assert.equal(item.pis.cst, "50");
  });

  it("mapeia CSOSN 102 da venda para CST 41 na devolução", () => {
    const origin = calcularNotaFiscal([
      calcularItem(saleItem({ icms: { cst: "102", orig: 0, pICMS: 0, pFCP: 0 } })),
    ]);
    const mirrored = mirrorOriginForDevolucao({ origin, ratio: 1, nonContributorIpi: false });
    const mapped = applyCstDevolucaoMap(
      mirrored,
      cstDevolucao({ icms: [{ venda: "102", devolucao: "41" }] }),
    );

    assert.equal(mapped.itens[0]!.icms.cst, "41");
    assert.equal(mapped.itens[0]!.icms.vBC, 0);
    assert.equal(mapped.itens[0]!.icms.vICMS, 0);
  });

  it("aplica o DE/PARA por item (não pelo CST do cabeçalho)", () => {
    const origin = calcularNotaFiscal([
      calcularItem(saleItem({ numeroItem: 1, codigo: "A" })),
      calcularItem(
        saleItem({
          numeroItem: 2,
          codigo: "B",
          pis: { cst: "04", aliquota: 0 },
          cofins: { cst: "04", aliquota: 0 },
        }),
      ),
    ]);
    const mirrored = mirrorOriginForDevolucao({ origin, ratio: 1, nonContributorIpi: false });
    const mapped = applyCstDevolucaoMap(mirrored, cstDevolucao({ icms: [] }));

    assert.equal(mapped.itens[0]!.pis.cst, "50");
    assert.equal(mapped.itens[1]!.pis.cst, "98");
  });

  it("é idempotente: CST já mapeado não é remapeado de volta", () => {
    const origin = calcularNotaFiscal([calcularItem(saleItem())]);
    const mirrored = mirrorOriginForDevolucao({ origin, ratio: 1, nonContributorIpi: true });
    const once = applyCstDevolucaoMap(mirrored, cstDevolucao());
    const twice = applyCstDevolucaoMap(once, cstDevolucao());

    assert.equal(twice.itens[0]!.icms.cst, "41");
    assert.equal(twice.itens[0]!.pis.cst, "50");
  });
});
