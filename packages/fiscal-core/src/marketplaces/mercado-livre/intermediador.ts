import type { MarketplaceIntermediador } from "../marketplace-fiscal-profile.js";

/** CNPJ do Mercado Livre (EBAZAR.COM.BR LTDA) no `<infIntermed>`. */
export const ML_INTERMEDIADOR_CNPJ = "03007331000141";

/** `idCadIntTran` dos XMLs de referência; a empresa pode informar o próprio cadastro. */
export const ML_ID_CAD_INT_TRAN_PADRAO = "279642028";

export const ML_INTERMEDIADOR: MarketplaceIntermediador = {
  cnpj: ML_INTERMEDIADOR_CNPJ,
  idCadIntTranPadrao: ML_ID_CAD_INT_TRAN_PADRAO,
};
