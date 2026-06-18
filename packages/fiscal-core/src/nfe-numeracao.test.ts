import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeProximoNumeroNfe,
  DEFAULT_NFE_NUMERACAO,
  resolveNumeroInicialNfe,
} from "./nfe-numeracao.js";
import type { FiscalEmitterSettingsData } from "./fiscal-emitter-settings-types.js";

const tenantSeries = { serieRemessa: 5, serieTransferencia: 8 };

function settings(numeracao: Partial<typeof DEFAULT_NFE_NUMERACAO>): FiscalEmitterSettingsData {
  return {
    basic: { formaFaturamento: "EMISSOR_PROPRIO", dadosFiscaisAnunciosOk: false },
    taxes: {} as FiscalEmitterSettingsData["taxes"],
    nfe: {
      mensagemNfeOk: false,
      acrescimoPrecoProduto: false,
      freteNoCalculo: true,
      prazoCancelamento: { horas: 24, naoInformar: false },
      acessoExternoContatos: 0,
      contatos: [],
      numeracao: {
        remessa: { numeroInicial: numeracao.remessa?.numeroInicial ?? 1 },
        transferencia: { numeroInicial: numeracao.transferencia?.numeroInicial ?? 1 },
      },
    },
  };
}

describe("computeProximoNumeroNfe", () => {
  it("usa numeroInicial quando ainda não há emissão", () => {
    assert.equal(computeProximoNumeroNfe(null, 100), 100);
    assert.equal(computeProximoNumeroNfe(undefined, 1), 1);
  });

  it("incrementa após última emissão", () => {
    assert.equal(computeProximoNumeroNfe(100, 100), 101);
    assert.equal(computeProximoNumeroNfe(149, 100), 150);
  });

  it("permite pular numeração ao elevar o piso configurado", () => {
    assert.equal(computeProximoNumeroNfe(149, 200), 200);
  });

  it("não retrocede numeração abaixo do último emitido", () => {
    assert.equal(computeProximoNumeroNfe(149, 140), 150);
  });
});

describe("resolveNumeroInicialNfe", () => {
  it("resolve por série de remessa e transferência", () => {
    const cfg = settings({ remessa: { numeroInicial: 100 }, transferencia: { numeroInicial: 50 } });
    assert.equal(resolveNumeroInicialNfe(cfg, 5, tenantSeries), 100);
    assert.equal(resolveNumeroInicialNfe(cfg, 8, tenantSeries), 50);
  });
});
