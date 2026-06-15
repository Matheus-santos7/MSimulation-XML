import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultInterstateConvenioRate,
  inferIcmsRateForSale,
  inferIcmsRateForShipment,
  normalizeProductOrigin,
  resolveIcmsFallbackRate,
  resolveInterstateIcmsFallback,
  resolvePisCofinsFallbackRates,
} from "./tax-fallback-resolver.service.js";
import { DEFAULT_FISCAL_EMITTER_SETTINGS } from "../../../fiscal-settings/domain/services/fiscal-emitter-settings-defaults.js";

describe("resolveInterstateIcmsFallback — tabela Senado", () => {
  it("produto importado (origem 2) SP→BA retorna 4%", () => {
    assert.equal(resolveInterstateIcmsFallback("SP", "BA", 2), 4);
    assert.equal(resolveInterstateIcmsFallback("sp", "ba", "2"), 4);
  });

  it("produto nacional (origem 0) SP→BA retorna 7%", () => {
    assert.equal(resolveInterstateIcmsFallback("SP", "BA", 0), 7);
  });

  it("produto nacional (origem 0) SP→RJ retorna 12%", () => {
    assert.equal(resolveInterstateIcmsFallback("SP", "RJ", 0), 12);
  });

  it("produto nacional (origem 0) BA→SP retorna 12%", () => {
    assert.equal(resolveInterstateIcmsFallback("BA", "SP", 0), 12);
  });

  it("operação intraestadual SP→SP retorna null", () => {
    assert.equal(resolveInterstateIcmsFallback("SP", "SP", 0), null);
  });

  it("origens importadas 1, 3 e 8 retornam 4% independentemente dos estados", () => {
    assert.equal(resolveInterstateIcmsFallback("PR", "SC", 1), 4);
    assert.equal(resolveInterstateIcmsFallback("PR", "SC", 3), 4);
    assert.equal(resolveInterstateIcmsFallback("PR", "SC", 8), 4);
  });

  it("normalizeProductOrigin aceita string numérica", () => {
    assert.equal(normalizeProductOrigin("2"), 2);
    assert.equal(normalizeProductOrigin(null), 0);
  });
});

describe("tax-fallback-resolver", () => {
  it("resolveIcmsFallbackRate usa defaults do emissor", () => {
    const settings = {
      ...DEFAULT_FISCAL_EMITTER_SETTINGS,
      taxes: {
        ...DEFAULT_FISCAL_EMITTER_SETTINGS.taxes,
        defaultIcmsRates: { intra: 17, interSale: 11, interInbound: 3 },
      },
    };

    assert.equal(resolveIcmsFallbackRate("SP", "SP", "sale", settings), 17);
    assert.equal(resolveIcmsFallbackRate("SP", "BA", "sale", settings, 0), 7);
    assert.equal(resolveIcmsFallbackRate("SP", "MG", "inbound", settings), 3);
  });

  it("resolveIcmsFallbackRate interestadual prioriza tabela Senado sobre settings", () => {
    const settings = {
      ...DEFAULT_FISCAL_EMITTER_SETTINGS,
      taxes: {
        ...DEFAULT_FISCAL_EMITTER_SETTINGS.taxes,
        defaultIcmsRates: { intra: 18, interSale: 11, interInbound: 3 },
      },
    };

    assert.equal(resolveIcmsFallbackRate("SP", "BA", "sale", settings, 0), 7);
    assert.equal(resolveIcmsFallbackRate("SP", "BA", "sale", settings, 2), 4);
  });

  it("inferIcmsRateForSale e inferIcmsRateForShipment delegam ao resolver com origem", () => {
    assert.equal(inferIcmsRateForSale("SP", "SP"), 18);
    assert.equal(inferIcmsRateForSale("SP", "BA", null, 0), 7);
    assert.equal(inferIcmsRateForShipment("SP", "MG"), 4);
  });

  it("defaultInterstateConvenioRate aplica tabela 7/12 para produto nacional", () => {
    assert.equal(defaultInterstateConvenioRate("SP", "BA"), 7);
    assert.equal(defaultInterstateConvenioRate("SP", "RS"), 12);
  });

  it("resolvePisCofinsFallbackRates lê settings ou padrão legal", () => {
    assert.equal(resolvePisCofinsFallbackRates(null).pis, 1.65);
    assert.equal(resolvePisCofinsFallbackRates(null).cofins, 7.6);
  });
});
