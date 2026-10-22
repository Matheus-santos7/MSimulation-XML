/**
 * @deprecated Nomes antigos das regras de fulfillment do Mercado Livre. As regras moram em
 * `marketplaces/mercado-livre/`; use o perfil (`getMarketplaceProfile`). Sai na fase 6 do plano
 * de marketplaces, quando nenhum consumidor usar mais estes nomes.
 */
import { enrichMercadoLivreFulfillmentPayload } from "./marketplaces/mercado-livre/fulfillment-payload.js";
import type {
  FulfillmentPayloadInput,
  NfeTransporta,
} from "./marketplaces/marketplace-fiscal-profile.js";

export { ML_AUT_XML_CPFS_PADRAO as REMESSA_AUT_XML_CPFS } from "./marketplaces/mercado-livre/aut-xml.js";
export {
  ML_ID_CAD_INT_TRAN_PADRAO as REMESSA_ML_INTERMED_ID_DEFAULT,
  ML_INTERMEDIADOR_CNPJ as REMESSA_ML_INTERMED_CNPJ,
} from "./marketplaces/mercado-livre/intermediador.js";
export { ML_RESP_TEC_REMESSA as ML_INF_RESP_TEC } from "./marketplaces/mercado-livre/responsavel-tecnico.js";
export { syncObsContXTextoWarehouseSuffix } from "./marketplaces/mercado-livre/textos.js";
export { ML_TRANSPORTADOR_REMESSA as REMESSA_ML_TRANSPORTA_DEFAULT } from "./marketplaces/mercado-livre/transporte.js";
export { ML_IBS_CBS_REMESSA as REMESSA_IBS_CBS_DEFAULT } from "./marketplaces/mercado-livre/tributos.js";
export {
  estimateRemessaPesoVol,
  type RemessaTranspVol,
} from "./marketplaces/fulfillment-payload.js";

export type RemessaMlTransporta = NfeTransporta;
export type EnrichMlFulfillmentPayloadInput = FulfillmentPayloadInput;

export const enrichFiscalPayloadMlFulfillment = enrichMercadoLivreFulfillmentPayload;
