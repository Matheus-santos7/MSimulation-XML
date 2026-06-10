import { REMESSA_NAT_OP } from "./remessa-dest.js";

/** @deprecated Use `resolveRemessaCfop` — remessa simbólica segue a mesma regra 5949/6949 da física. */
export const REMESSA_SIMBOLICA_CFOP = "5949";
/** Mesma natureza da remessa física (planilha ML / depósito temporário). */
export const REMESSA_SIMBOLICA_NAT_OP = REMESSA_NAT_OP;
