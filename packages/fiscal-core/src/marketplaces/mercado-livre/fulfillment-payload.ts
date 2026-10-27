import { enrichFulfillmentPayload, type FulfillmentPayloadRules } from "../fulfillment-payload.js";
import type { FulfillmentPayloadInput } from "../marketplace-fiscal-profile.js";
import { ML_AUT_XML_CPFS_PADRAO } from "./aut-xml.js";
import { ML_INTERMEDIADOR } from "./intermediador.js";
import { syncObsContXTextoWarehouseSuffix } from "./textos.js";
import { ML_TRANSPORTADOR_REMESSA } from "./transporte.js";
import { ML_IBS_CBS_REMESSA } from "./tributos.js";

export const ML_FULFILLMENT_RULES: FulfillmentPayloadRules = {
  intermediador: ML_INTERMEDIADOR,
  autXmlCpfsPadrao: ML_AUT_XML_CPFS_PADRAO,
  ibsCbsPadrao: ML_IBS_CBS_REMESSA,
  transportadorPadrao: ML_TRANSPORTADOR_REMESSA,
  syncIdCadIntTran: syncObsContXTextoWarehouseSuffix,
};

/** Blocos dos XMLs reais de fulfillment do Mercado Livre no `fiscalPayload`. */
export function enrichMercadoLivreFulfillmentPayload(
  payload: Record<string, unknown>,
  input: FulfillmentPayloadInput,
): Record<string, unknown> {
  return enrichFulfillmentPayload(payload, input, ML_FULFILLMENT_RULES);
}
