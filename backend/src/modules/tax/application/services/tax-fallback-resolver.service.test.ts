import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultInterstateConvenioRate,
  inferIcmsRateForSale,
  inferIcmsRateForShipment,
  resolveIcmsFallbackRate,
  resolvePisCofinsFallbackRates,
} from "./tax-fallback-resolver.service.js";
import { DEFAULT_FISCAL_EMITTER_SETTINGS } from "../../../fiscal-settings/domain/services/fiscal-emitter-settings-defaults.js";

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
    assert.equal(resolveIcmsFallbackRate("SP", "MG", "sale", settings), 11);
    assert.equal(resolveIcmsFallbackRate("SP", "MG", "inbound", settings), 3);
  });

  it("inferIcmsRateForSale e inferIcmsRateForShipment delegam ao resolver", () => {
    assert.equal(inferIcmsRateForSale("SP", "SP"), 18);
    assert.equal(inferIcmsRateForShipment("SP", "MG"), 4);
  });

  it("defaultInterstateConvenioRate aplica tabela 7/12", () => {
    assert.equal(defaultInterstateConvenioRate("SP", "BA"), 7);
    assert.equal(defaultInterstateConvenioRate("SP", "RS"), 12);
  });

  it("resolvePisCofinsFallbackRates lê settings ou padrão legal", () => {
    assert.equal(resolvePisCofinsFallbackRates(null).pis, 1.65);
    assert.equal(resolvePisCofinsFallbackRates(null).cofins, 7.6);
  });
});
