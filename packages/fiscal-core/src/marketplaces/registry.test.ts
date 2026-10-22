import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { enrichFulfillmentPayload } from "./fulfillment-payload.js";
import { MARKETPLACE_CODES, Marketplace, isMarketplaceCode } from "./marketplace.js";
import {
  MARKETPLACE_NOT_CONFIGURED_MESSAGE,
  MarketplaceNotConfiguredError,
} from "./marketplace-not-configured.error.js";
import { ML_INTERMEDIADOR_CNPJ } from "./mercado-livre/intermediador.js";
import {
  getBillableMarketplaceProfile,
  getMarketplaceProfile,
  listMarketplaceProfiles,
} from "./registry.js";

describe("marketplaces / registry", () => {
  it("tem um perfil para cada marketplace, com o próprio código", () => {
    assert.deepEqual(
      listMarketplaceProfiles().map((profile) => profile.code),
      [...MARKETPLACE_CODES],
    );
  });

  it("Mercado Livre está ativo e traz o intermediador EBAZAR", () => {
    const profile = getBillableMarketplaceProfile(Marketplace.MERCADO_LIVRE);

    assert.equal(profile.status, "ATIVO");
    assert.equal(profile.intermediador?.cnpj, ML_INTERMEDIADOR_CNPJ);
  });

  for (const code of [Marketplace.SHOPEE, Marketplace.AMAZON, Marketplace.MAGALU]) {
    it(`${code} fica pendente e bloqueia o faturamento`, () => {
      const profile = getMarketplaceProfile(code);

      assert.equal(profile.status, "PENDENTE_CONFIGURACAO");
      assert.throws(() => getBillableMarketplaceProfile(code), MarketplaceNotConfiguredError);
      assert.throws(() => profile.enrichFulfillmentPayload({}, { quantidadeTotal: 1 }), {
        message: MARKETPLACE_NOT_CONFIGURED_MESSAGE,
      });
      assert.throws(
        () => profile.enrichVendaPayload({}, { quantidade: 1 }),
        MarketplaceNotConfiguredError,
      );
    });
  }

  it("reconhece só os códigos conhecidos", () => {
    assert.equal(isMarketplaceCode("SHOPEE"), true);
    assert.equal(isMarketplaceCode("shopee"), false);
    assert.equal(isMarketplaceCode(undefined), false);
  });
});

describe("marketplaces / enrichFulfillmentPayload", () => {
  it("não monta infIntermed, ibsCbs nem transporta quando o marketplace não define", () => {
    const out = enrichFulfillmentPayload(
      {},
      { quantidadeTotal: 2 },
      { intermediador: null, autXmlCpfsPadrao: [], ibsCbsPadrao: null, transportadorPadrao: null },
    );

    assert.equal("infIntermed" in out, false);
    assert.equal("ibsCbs" in out, false);
    assert.equal("transporta" in out, false);
    assert.deepEqual(out.transp, { qVol: 2, pesoL: 1.4, pesoB: 1.42 });
  });

  it("usa o idCadIntTran da empresa no lugar do padrão do marketplace", () => {
    const out = enrichFulfillmentPayload(
      {},
      { quantidadeTotal: 1, idCadIntTran: " 999 " },
      {
        intermediador: { cnpj: "11111111000111", idCadIntTranPadrao: "1" },
        autXmlCpfsPadrao: [],
        ibsCbsPadrao: null,
        transportadorPadrao: null,
      },
    );

    assert.deepEqual(out.infIntermed, { cnpj: "11111111000111", idCadIntTran: "999" });
  });
});
