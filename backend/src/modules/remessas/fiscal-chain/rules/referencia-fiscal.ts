import type { TipoNota } from "./tipo-nota.js";

/** Referência ascendente entre notas (filha → pai). */
export type ReferenciaFiscal = {
  notaPaiId: string;
  notaPaiChave: string;
  notaPaiTipo: TipoNota;
};
