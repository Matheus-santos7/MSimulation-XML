import { Marketplace } from "../marketplace.js";
import type { MarketplaceFiscalProfile } from "../marketplace-fiscal-profile.js";
import { ML_AUT_XML_CPFS_PADRAO } from "./aut-xml.js";
import { enrichMercadoLivreFulfillmentPayload } from "./fulfillment-payload.js";
import { ML_NAT_OP_VENDA, ML_VER_PROC_VENDA } from "./ide.js";
import { ML_INTERMEDIADOR } from "./intermediador.js";
import { ML_ORDER_ID_RULES } from "./pedido.js";
import { ML_RESP_TEC_REMESSA, ML_RESP_TEC_VENDA } from "./responsavel-tecnico.js";
import { ML_TRANSPORTADOR_REMESSA, ML_TRANSPORTADOR_VENDA } from "./transporte.js";
import { ML_IBS_CBS_REMESSA, ML_IBS_CBS_VENDA } from "./tributos.js";
import { enrichMercadoLivreVendaPayload } from "./venda-payload.js";

/** Mercado Livre (Full). Regras extraídas dos XMLs reais de fulfillment; ver `README.md`. */
export const mercadoLivreProfile: MarketplaceFiscalProfile = {
  code: Marketplace.MERCADO_LIVRE,
  nome: "Mercado Livre",
  status: "ATIVO",
  intermediador: ML_INTERMEDIADOR,
  responsavelTecnico: { remessa: ML_RESP_TEC_REMESSA, venda: ML_RESP_TEC_VENDA },
  autXmlCpfsPadrao: ML_AUT_XML_CPFS_PADRAO,
  transportador: { remessa: ML_TRANSPORTADOR_REMESSA, venda: ML_TRANSPORTADOR_VENDA },
  ibsCbsPadrao: { remessa: ML_IBS_CBS_REMESSA, venda: ML_IBS_CBS_VENDA },
  ide: { verProcVenda: ML_VER_PROC_VENDA, natOpVenda: ML_NAT_OP_VENDA },
  pedido: ML_ORDER_ID_RULES,
  enrichFulfillmentPayload: enrichMercadoLivreFulfillmentPayload,
  enrichVendaPayload: enrichMercadoLivreVendaPayload,
};
