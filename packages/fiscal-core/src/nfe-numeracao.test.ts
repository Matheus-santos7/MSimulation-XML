import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  advancePastInutilizedRanges,
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

  it("pula faixas inutilizadas após o candidato", () => {
    // Bug: após emitir 100 e inutilizar 101–105, o próximo deve ser 106 — não 101.
    assert.equal(
      computeProximoNumeroNfe(100, 1, [{ numeroIni: 101, numeroFim: 105 }]),
      106,
    );
  });

  it("pula várias faixas inutilizadas consecutivas ou intercaladas", () => {
    assert.equal(
      computeProximoNumeroNfe(10, 1, [
        { numeroIni: 11, numeroFim: 12 },
        { numeroIni: 13, numeroFim: 15 },
      ]),
      16,
    );
  });

  it("respeita piso mesmo quando a faixa inutilizada começa abaixo do piso", () => {
    // Último 50, piso 100, inutilizado 100–102 → próximo 103
    assert.equal(
      computeProximoNumeroNfe(50, 100, [{ numeroIni: 100, numeroFim: 102 }]),
      103,
    );
  });
});

describe("advancePastInutilizedRanges", () => {
  it("não altera candidato fora de faixas", () => {
    assert.equal(advancePastInutilizedRanges(50, [{ numeroIni: 10, numeroFim: 20 }]), 50);
  });
});

describe("resolveNumeroInicialNfe", () => {
  it("resolve por série de remessa e transferência", () => {
    const cfg = settings({ remessa: { numeroInicial: 100 }, transferencia: { numeroInicial: 50 } });
    assert.equal(resolveNumeroInicialNfe(cfg, 5, tenantSeries), 100);
    assert.equal(resolveNumeroInicialNfe(cfg, 8, tenantSeries), 50);
  });
});
