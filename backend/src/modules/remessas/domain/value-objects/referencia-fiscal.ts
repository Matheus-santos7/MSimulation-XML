import type { TipoNota } from "./tipo-nota.js";

/** Referência ascendente entre notas (filha → pai). */
export type ReferenciaFiscal = {
  notaPaiId: string;
  notaPaiChave: string;
  notaPaiTipo: TipoNota;
};

export function criarReferenciaFiscal(input: ReferenciaFiscal): ReferenciaFiscal {
  if (!input.notaPaiId.trim()) {
    throw new Error("Referência fiscal exige nota pai");
  }
  return input;
}
