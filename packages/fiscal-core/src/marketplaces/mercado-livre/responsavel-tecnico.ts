import type { NfeInfRespTec } from "../marketplace-fiscal-profile.js";
import { ML_INTERMEDIADOR_CNPJ } from "./intermediador.js";

/** `<infRespTec>` nos XMLs de fulfillment (remessa, retorno, transferência). */
export const ML_RESP_TEC_REMESSA = {
  cnpj: ML_INTERMEDIADOR_CNPJ,
  xContato: "EBAZAR.COM.BR. LTDA",
  email: "fiscal@mercadolivre.com",
  fone: "1125434155",
  idCSRT: "01",
  hashCSRT: "4ET98v7L2eZzffy/WSCSTlYq+N4=",
} as const satisfies NfeInfRespTec;

/** `<infRespTec>` nos XMLs de venda (hashCSRT de produção). */
export const ML_RESP_TEC_VENDA = {
  ...ML_RESP_TEC_REMESSA,
  hashCSRT: "+TuKUMc7ueWv9UiYNVaTD+ym1a4=",
} as const satisfies NfeInfRespTec;
