/**
 * @deprecated Nomes antigos das regras de venda do Mercado Livre. As regras moram em
 * `marketplaces/mercado-livre/`; use o perfil (`getMarketplaceProfile`). Sai na fase 6 do plano
 * de marketplaces, quando nenhum consumidor usar mais estes nomes.
 */
import type {
  VendaPayloadInput,
  VendaReturnNoteDestinatario,
  VendaReturnNoteRef,
} from "./marketplaces/marketplace-fiscal-profile.js";
import { enrichMercadoLivreVendaPayload } from "./marketplaces/mercado-livre/venda-payload.js";

export { ML_CD_DEPOSITO_PADRAO as VENDA_ML_CD_DEPOSITO } from "./marketplaces/mercado-livre/armazem.js";
export { ML_RESP_TEC_VENDA as VENDA_ML_INF_RESP_TEC } from "./marketplaces/mercado-livre/responsavel-tecnico.js";
export { ML_TRANSPORTADOR_VENDA as VENDA_ML_TRANSPORTA } from "./marketplaces/mercado-livre/transporte.js";
export { ML_IBS_CBS_VENDA as VENDA_ML_IBS_CBS_DEFAULT } from "./marketplaces/mercado-livre/tributos.js";
export {
  buildVendaInfAdProdText,
  buildVendaInfCplMiddle,
  buildVendaInfCplText,
  estimateVendaVTotTrib,
  type VendaEngineTaxSnapshot,
} from "./marketplaces/mercado-livre/venda-payload.js";

export type EnrichMlVendaPayloadInput = VendaPayloadInput;
export type VendaMlReturnNoteDestinatario = VendaReturnNoteDestinatario;
export type VendaMlReturnNoteRef = VendaReturnNoteRef;

export const enrichFiscalPayloadMlVenda = enrichMercadoLivreVendaPayload;
