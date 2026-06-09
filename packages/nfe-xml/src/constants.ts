/** Reexporta constantes ML de fiscal-core — fonte única com o backend. */
export {
  REMESSA_AUT_XML_CPFS,
  REMESSA_ML_INTERMED_CNPJ,
  REMESSA_ML_INTERMED_ID_DEFAULT as REMESSA_ML_INTERMED_ID,
  REMESSA_ML_TRANSPORTA_DEFAULT as REMESSA_ML_TRANSPORTA,
} from "@msimulation-xml/fiscal-core";

import type { RemessaMlTransporta } from "@msimulation-xml/fiscal-core";

export type { RemessaMlTransporta };

const UF_IBGE: Record<string, number> = {
  AC: 12, AL: 27, AM: 13, AP: 16, BA: 29, CE: 23, DF: 53, ES: 32, GO: 52, MA: 21, MG: 31, MS: 50,
  MT: 51, PA: 15, PB: 25, PE: 26, PI: 22, PR: 41, RJ: 33, RN: 24, RO: 11, RR: 14, RS: 43, SC: 42,
  SE: 28, SP: 35, TO: 17,
};

export function ufToCodigo(uf: string): number {
  return UF_IBGE[uf.toUpperCase()] ?? 35;
}
