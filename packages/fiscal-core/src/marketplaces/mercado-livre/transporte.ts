import type { NfeTransporta } from "../marketplace-fiscal-profile.js";

/** Transportador nas remessas físicas (modFrete=0, somente razão social). */
export const ML_TRANSPORTADOR_REMESSA: NfeTransporta = {
  xNome: "Transgoss Transporte e Logistica",
};

/** Transportador nas vendas (modFrete=0, operador logístico). */
export const ML_TRANSPORTADOR_VENDA: NfeTransporta = {
  cnpj: "03007331012239",
  xNome: "EBAZAR.COM.BR LTDA",
  ie: "120519234116",
  xEnder: "AVENIDA DAS NACOES UNIDAS 3000 3003",
  xMun: "OSASCO",
  uf: "SP",
};
