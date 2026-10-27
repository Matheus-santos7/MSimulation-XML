import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Marketplace, MarketplaceNotConfiguredError } from "@msimulation-xml/fiscal-core";
import { buildNFeXmlFromBuilder } from "../core/nfe-factory.js";
import { goldenEmit, goldenProduct, goldenScenarios } from "./golden-scenarios.js";

describe("nfe-xml / perfil do marketplace", () => {
  const remessa = goldenScenarios.find((s) => s.name === "mercado-livre-remessa")!.nfe;

  it("nota sem marketplace usa o Mercado Livre (dados anteriores ao suporte a vários marketplaces)", () => {
    const semMarketplace = buildNFeXmlFromBuilder({
      nfe: remessa,
      emit: goldenEmit,
      product: goldenProduct,
    });
    const comMarketplace = buildNFeXmlFromBuilder({
      nfe: { ...remessa, marketplace: Marketplace.MERCADO_LIVRE },
      emit: goldenEmit,
      product: goldenProduct,
    });

    const strip = (xml: string) => xml.replace(/<nProt>\d+<\/nProt>/g, "");
    assert.equal(strip(semMarketplace), strip(comMarketplace));
  });

  for (const marketplace of [Marketplace.SHOPEE, Marketplace.AMAZON, Marketplace.MAGALU]) {
    it(`não gera XML para ${marketplace} enquanto o perfil estiver pendente`, () => {
      assert.throws(
        () =>
          buildNFeXmlFromBuilder({
            nfe: { ...remessa, marketplace },
            emit: goldenEmit,
            product: goldenProduct,
          }),
        MarketplaceNotConfiguredError,
      );
    });
  }
});
