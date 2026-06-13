import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calcTributoBase,
  composicaoChannel,
  enrichTaxSnapshot,
  mapCstDevolucao,
  normalizeTaxStCode,
  resolveModFrete,
  type TaxSnapshot,
} from "./fiscal-emitter-runtime.js";
import type { FiscalEmitterSettingsData } from "./fiscal-emitter-settings-types.js";

const minimalSettings = (): FiscalEmitterSettingsData => ({
  basic: {
    formaFaturamento: "EMISSOR_PROPRIO",
    dadosFiscaisAnunciosOk: false,
  },
  taxes: {
    cstDevolucao: { mode: "DEFAULT", icms: [], pisCofins: [] },
    composicaoBaseCalculo: {
      mode: "CUSTOM",
      pisCofins: {
        frete: { venda: "INCLUIR_NA_BASE", remessa: "INCLUIR_NA_BASE" },
        desconto: { venda: "SUBTRAIR_DA_BASE", remessa: "SUBTRAIR_DA_BASE" },
        icms: { venda: "SUBTRAIR_DA_BASE", remessa: "SUBTRAIR_DA_BASE" },
        acrescimoPreco: { venda: "NAO_INCLUIR", remessa: "NAO_INCLUIR" },
      },
      icms: {
        frete: { venda: "INCLUIR_NA_BASE", remessa: "INCLUIR_NA_BASE" },
        desconto: { venda: "SUBTRAIR_DA_BASE", remessa: "SUBTRAIR_DA_BASE" },
        ipi: { venda: "INCLUIR_NA_BASE", remessa: "INCLUIR_NA_BASE" },
        acrescimoPreco: { venda: "NAO_INCLUIR", remessa: "NAO_INCLUIR" },
      },
      ipi: {
        frete: { venda: "INCLUIR_NA_BASE", remessa: "INCLUIR_NA_BASE" },
        desconto: { venda: "SUBTRAIR_DA_BASE", remessa: "SUBTRAIR_DA_BASE" },
        acrescimoPreco: { venda: "NAO_INCLUIR", remessa: "NAO_INCLUIR" },
      },
    },
    calculoDifal: { mode: "DEFAULT", bulk: "PADRAO", porUf: {} },
    modalidadeFrete: {
      mode: "CUSTOM",
      fullfilmentVendas: "9",
      fullfilmentEntrada: "3",
      coleta: "1",
      flex: "0",
      turbo: "0",
    },
    emissaoGnre: { mode: "DEFAULT", estadosIeCount: 0, estadosComIe: [] },
  },
  nfe: {
    mensagemNfeOk: false,
    acrescimoPrecoProduto: false,
    freteNoCalculo: true,
    prazoCancelamento: { horas: 24, naoInformar: false },
    acessoExternoContatos: 0,
    contatos: [],
  },
});

const emptySnapshot = (): TaxSnapshot => ({
  icms: { cst: "00", aliquota: 18 },
  ipi: {},
  pis: {},
  cofins: {},
  ibsCbs: {},
});

describe("fiscal-emitter-runtime", () => {
  it("mapCstDevolucao mapeia CST de venda", () => {
    const maps = [{ venda: "01", devolucao: "50" }];
    assert.equal(mapCstDevolucao("01", maps), "50");
    assert.equal(mapCstDevolucao("99", maps), "99");
  });

  it("normalizeTaxStCode extrai CST (2) ou CSOSN (3)", () => {
    assert.equal(normalizeTaxStCode("00 - Tributada"), "00");
    assert.equal(normalizeTaxStCode("102 - SN"), "102");
    assert.equal(normalizeTaxStCode(41), "41");
  });

  it("mapCstDevolucao mapeia CSOSN de 3 dígitos (ex.: 102 → 41)", () => {
    const maps = [
      { venda: "102", devolucao: "41" },
      { venda: "500", devolucao: "60" },
    ];
    assert.equal(mapCstDevolucao("102", maps), "41");
    assert.equal(mapCstDevolucao("102 - Tributada", maps), "41");
    assert.equal(mapCstDevolucao("500", maps), "60");
  });

  it("resolveModFrete por tipo de NF-e", () => {
    const s = minimalSettings();
    assert.equal(resolveModFrete(s, "REMESSA"), "9");
    assert.equal(resolveModFrete(s, "REMESSA_SIMBOLICA"), "1");
    assert.equal(resolveModFrete(s, "RETORNO_SIMBOLICO"), "3");
    assert.equal(resolveModFrete(s, "VENDA"), "9");
  });

  it("composicaoChannel usa canal remessa em fulfillment", () => {
    assert.equal(composicaoChannel("REMESSA"), "remessa");
    assert.equal(composicaoChannel("VENDA"), "venda");
  });

  it("calcTributoBase subtrai ICMS na composição PIS/COFINS", () => {
    const comp = minimalSettings().taxes.composicaoBaseCalculo.pisCofins;
    const base = calcTributoBase(
      100,
      { frete: 0, desconto: 0, icms: 10, difal: 0, fcpIcms: 0, fcpDifal: 0, ipi: 0, acrescimo: 0 },
      comp,
      "venda",
    );
    assert.equal(base, 90);
  });

  it("enrichTaxSnapshot preenche emitter e bases por tributo", () => {
    const out = enrichTaxSnapshot(emptySnapshot(), {
      settings: minimalSettings(),
      tipo: "REMESSA",
      valor: 200,
      valorIcms: 36,
      emitUf: "SP",
      destUf: "RJ",
      indFinal: 0,
    });
    assert.equal(out.emitter?.modFrete, "9");
    assert.equal(out.icms.vBc, 200);
    assert.equal(out.pis.vBc, 164);
    assert.equal(out.emitter?.bases.vBcPisCofins, 164);
  });

  it("enrichTaxSnapshot zera vBc quando alíquota explícita é 0%", () => {
    const out = enrichTaxSnapshot(
      {
        icms: { cst: "90", aliquota: 0 },
        ipi: { aliquota: 0 },
        pis: { aliquota: 0 },
        cofins: { aliquota: 0 },
        ibsCbs: {},
      },
      {
        settings: minimalSettings(),
        tipo: "REMESSA_SIMBOLICA",
        valor: 6090,
        valorIcms: 0,
        emitUf: "SP",
        destUf: "MG",
        indFinal: 0,
      },
    );
    assert.equal(out.icms.vBc, 0);
    assert.equal(out.pis.vBc, 0);
    assert.equal(out.cofins.vBc, 0);
    assert.equal(out.ipi.vBc, 0);
    assert.equal(out.emitter?.bases.vBcIcms, 0);
  });
});
