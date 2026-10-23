import { Marketplace } from "../marketplace.js";
import type { MarketplaceFiscalProfile } from "../marketplace-fiscal-profile.js";
import { MarketplaceNotConfiguredError } from "../marketplace-not-configured.error.js";
import { PENDING_ORDER_ID_RULES } from "../order-id.js";

/**
 * Amazon: regras ainda não levantadas (ver `README.md`). O faturamento fica bloqueado até a
 * pasta ser preenchida e o status virar `ATIVO`.
 */
export const amazonProfile: MarketplaceFiscalProfile = {
  code: Marketplace.AMAZON,
  nome: "Amazon",
  status: "PENDENTE_CONFIGURACAO",
  intermediador: null,
  responsavelTecnico: { remessa: null, venda: null },
  autXmlCpfsPadrao: [],
  transportador: { remessa: null, venda: null },
  ibsCbsPadrao: { remessa: null, venda: null },
  ide: { verProcVenda: null, natOpVenda: null },
  pedido: PENDING_ORDER_ID_RULES,
  enrichFulfillmentPayload() {
    throw new MarketplaceNotConfiguredError(Marketplace.AMAZON);
  },
  enrichVendaPayload() {
    throw new MarketplaceNotConfiguredError(Marketplace.AMAZON);
  },
};
