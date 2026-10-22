import { Marketplace } from "../marketplace.js";
import type { MarketplaceFiscalProfile } from "../marketplace-fiscal-profile.js";
import { MarketplaceNotConfiguredError } from "../marketplace-not-configured.error.js";

/**
 * Shopee: regras ainda não levantadas (ver `README.md`). O faturamento fica bloqueado até a
 * pasta ser preenchida e o status virar `ATIVO`.
 */
export const shopeeProfile: MarketplaceFiscalProfile = {
  code: Marketplace.SHOPEE,
  nome: "Shopee",
  status: "PENDENTE_CONFIGURACAO",
  intermediador: null,
  responsavelTecnico: { remessa: null, venda: null },
  autXmlCpfsPadrao: [],
  transportador: { remessa: null, venda: null },
  ibsCbsPadrao: { remessa: null, venda: null },
  ide: { verProcVenda: null, natOpVenda: null },
  enrichFulfillmentPayload() {
    throw new MarketplaceNotConfiguredError(Marketplace.SHOPEE);
  },
  enrichVendaPayload() {
    throw new MarketplaceNotConfiguredError(Marketplace.SHOPEE);
  },
};
